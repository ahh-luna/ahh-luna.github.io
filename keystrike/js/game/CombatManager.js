/**
 * KEYSTRIKE — CombatManager
 * 
 * Connects the typing system to the combat system.
 * Processes parsed commands into game actions, manages damage,
 * effects, enemy spawning, and wave progression.
 */
import { Enemy } from './Enemy.js';
import { TARGET_WORDS, VERBS } from '../core/WordBank.js';

export class CombatManager {
  constructor(eventBus, grammar, player, particles, screenFX) {
    this.eventBus = eventBus;
    this.grammar = grammar;
    this.player = player;
    this.particles = particles;
    this.screenFX = screenFX;

    /** @type {Enemy[]} */
    this.enemies = [];
    this.deadEnemies = []; // Keep for death animation
    this.nextEnemyId = 1;

    // Wave system
    this.wave = 0;
    this.waveEnemiesRemaining = 0;
    this.waveSpawnTimer = 0;
    this.waveSpawnInterval = 2500;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesTotal = 0;
    this.betweenWaves = true;
    this.betweenWaveTimer = 3000;
    this.gameOver = false;
    this.victory = false;

    // Stats
    this.totalKills = 0;
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;

    // Target word pool (shuffled per wave)
    this.wordPool = [];
    this.usedWords = new Set();

    // Set up target resolver for grammar system
    this.grammar.setTargetResolver(() => this._getTargets());

    // Listen for commands
    this._unsubExecute = this.eventBus.on('input:execute', (data) => {
      this._handleCommand(data);
    });

    this._unsubCombo = this.eventBus.on('combo:triggered', (data) => {
      this._handleCombo(data);
    });
  }

  // ─── Target Resolution ────────────────────────────────────────

  _getTargets() {
    return this.enemies
      .filter(e => e.alive)
      .map(e => ({ id: e.id, word: e.word, entity: e }));
  }

  // ─── Command Processing ───────────────────────────────────────

  _handleCommand(data) {
    const { command, comboCount, record } = data;
    if (!command.valid) return;

    const verb = command.verb;
    const verbDef = command.verbDef;
    const target = command.target;

    // Calculate damage with bonuses
    let damage = verbDef.baseDamage;

    // Accuracy bonus: clean typing = bonus damage
    const accuracy = record.accuracy;
    if (accuracy >= 1.0) {
      damage = Math.floor(damage * 1.2); // 20% bonus for perfect typing
    }

    // Speed bonus: fast WPM = bonus
    const wpm = record.wpm;
    if (wpm > 120) {
      damage = Math.floor(damage * 1.15);
    }

    // Combo chain multiplier (from speed tiers)
    if (comboCount >= 12) damage = Math.floor(damage * 2.0);
    else if (comboCount >= 8) damage = Math.floor(damage * 1.5);
    else if (comboCount >= 5) damage = Math.floor(damage * 1.25);
    else if (comboCount >= 3) damage = Math.floor(damage * 1.1);

    // Process based on category
    switch (verbDef.category) {
      case 'attack':
        this._processAttack(verb, verbDef, target, damage);
        break;
      case 'defense':
        this._processDefense(verb, verbDef, target, damage);
        break;
      case 'spell':
        this._processSpell(verb, verbDef, target, damage);
        break;
    }
  }

  _processAttack(verb, verbDef, target, damage) {
    if (!target) return;
    const enemy = target.entity;
    if (!enemy || !enemy.alive) return;

    // Player animation
    this.player.setState('attacking', 400);
    this.player.attackTarget = { x: enemy.x, y: enemy.y };

    // Apply damage
    const killed = enemy.takeDamage(damage);
    this.totalDamageDealt += damage;

    // Crit check (PIERCE has critBonus)
    const critChance = (verbDef.effects?.critBonus || 0) + 0.05;
    const isCrit = Math.random() < critChance;
    const finalDamage = isCrit ? damage * 2 : damage;
    if (isCrit) {
      enemy.takeDamage(damage); // Extra damage
      this.totalDamageDealt += damage;
    }

    // VFX
    const hitDir = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
    this.particles.hitSpark(enemy.x, enemy.y, verbDef.element === 'fire' ? '#ff6600' : '#00ffc8', hitDir);
    this.screenFX.shake(isCrit ? 8 : 4, isCrit ? 250 : 150);
    this.screenFX.addFloatingText(
      `${isCrit ? 'CRIT ' : ''}${finalDamage}`,
      enemy.x, enemy.y - 30,
      isCrit ? '#ffff00' : '#ffffff',
      isCrit ? 24 : 18
    );

    // Bleed effect
    if (verbDef.effects?.bleed && enemy.alive) {
      this._applyBleed(enemy, verbDef.effects.bleed);
    }

    if (killed) this._onEnemyKilled(enemy);
  }

  _processDefense(verb, verbDef, target, damage) {
    if (verb === 'BLOCK') {
      this.player.setState('blocking', verbDef.effects?.duration || 2000);
      this.screenFX.addFloatingText('BLOCK', this.player.x, this.player.y - 50, '#00aaff', 16);
      this.particles.emit({
        x: this.player.x + 25, y: this.player.y,
        count: 8, color: '#00aaff',
        speed: 1, size: 3, life: 400,
        spread: Math.PI * 0.5, angle: 0,
      });
    } else if (verb === 'DODGE') {
      this.player.setState('dodging', verbDef.effects?.duration || 800);
      this.screenFX.addFloatingText('DODGE', this.player.x, this.player.y - 50, '#ffff00', 16);
    } else if (verb === 'PARRY' && target) {
      const enemy = target.entity;
      if (enemy && enemy.alive) {
        // Counter attack
        this.player.setState('attacking', 400);
        this.player.attackTarget = { x: enemy.x, y: enemy.y };
        
        // Parry deals reflected damage if enemy was telegraphing/attacking
        let parryDamage = damage;
        if (enemy.state === 'telegraphing' || enemy.state === 'attacking') {
          parryDamage = Math.floor(enemy.damage * (verbDef.effects?.reflectMultiplier || 1.5));
          // Cancel enemy attack
          enemy.state = 'hurt';
          enemy.stateTimer = 500;
          this.screenFX.addFloatingText('COUNTER!', enemy.x, enemy.y - 40, '#ffaa00', 22);
          this.screenFX.flash('#ffaa00', 200);
          this.screenFX.shake(10, 300);
        }

        const killed = enemy.takeDamage(parryDamage);
        this.totalDamageDealt += parryDamage;
        this.particles.hitSpark(enemy.x, enemy.y, '#ffaa00');
        this.screenFX.addFloatingText(`${parryDamage}`, enemy.x, enemy.y - 30, '#ffaa00', 20);

        if (killed) this._onEnemyKilled(enemy);
      }
    }
  }

  _processSpell(verb, verbDef, target, damage) {
    const isHeal = verb === 'HEAL';
    const isDrain = verb === 'DRAIN';

    if (isHeal) {
      const healAmount = verbDef.effects?.heal || 30;
      this.player.heal(healAmount);
      this.player.setState('casting', 500);
      this.particles.healEffect(this.player.x, this.player.y);
      this.screenFX.addFloatingText(`+${healAmount}`, this.player.x, this.player.y - 50, '#00ff88', 20);
      return;
    }

    if (!target) return;
    const enemy = target.entity;
    if (!enemy || !enemy.alive) return;

    this.player.setState('casting', 500);
    this.player.attackTarget = { x: enemy.x, y: enemy.y };

    // Spell color based on element
    const elementColors = {
      fire: '#ff6600',
      ice: '#00ccff',
      lightning: '#ffff00',
      dark: '#aa00ff',
      holy: '#ffffff',
    };
    const spellColor = elementColors[verbDef.element] || '#ff00aa';

    // Apply damage
    const killed = enemy.takeDamage(damage);
    this.totalDamageDealt += damage;

    // VFX
    this.particles.spellBurst(enemy.x, enemy.y, spellColor);
    this.screenFX.shake(6, 200);
    this.screenFX.flash(spellColor, 100);
    this.screenFX.addFloatingText(`${damage}`, enemy.x, enemy.y - 30, spellColor, 20);

    // Effects
    if (verbDef.effects?.burn && enemy.alive) {
      this._applyBleed(enemy, verbDef.effects.burn); // Reuse bleed for burn
    }
    if (verbDef.effects?.slow && enemy.alive) {
      enemy.speed *= verbDef.effects.slow.factor;
      enemy.attackCooldown *= (1 / verbDef.effects.slow.factor);
    }
    if (isDrain && verbDef.effects?.lifesteal) {
      const healAmt = Math.floor(damage * verbDef.effects.lifesteal);
      this.player.heal(healAmt);
      this.screenFX.addFloatingText(`+${healAmt}`, this.player.x, this.player.y - 50, '#aa00ff', 16);
    }
    if (verbDef.effects?.chain && enemy.alive === false) {
      // Chain lightning to nearby
      this._chainDamage(enemy, Math.floor(damage * verbDef.effects.chain.falloff), spellColor);
    }

    if (killed) this._onEnemyKilled(enemy);
  }

  _handleCombo(data) {
    const { combo, command } = data;
    this.screenFX.addFloatingText(
      `★ ${combo.name}!`,
      this.player.x, this.player.y - 80,
      '#ffaa00', 26
    );
    this.screenFX.flash('#ffaa00', 300);
    this.screenFX.shake(12, 400);
    this.particles.comboFlash(this.player.x, this.player.y);

    // Apply combo damage multiplier to all enemies (AoE combos)
    if (combo.bonusEffect?.aoe) {
      const aoe = combo.bonusEffect.aoe;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
        if (dist < aoe.radius + 200) {
          enemy.takeDamage(aoe.damage);
          this.particles.hitSpark(enemy.x, enemy.y, '#ffaa00');
        }
      }
    }
  }

  _applyBleed(enemy, config) {
    let ticks = config.ticks;
    const tickDamage = config.damage;
    const interval = setInterval(() => {
      if (!enemy.alive || ticks <= 0) {
        clearInterval(interval);
        return;
      }
      enemy.takeDamage(tickDamage);
      this.particles.damagePop(enemy.x, enemy.y, '#ff4444');
      this.screenFX.addFloatingText(`${tickDamage}`, enemy.x + (Math.random() - 0.5) * 20, enemy.y - 20, '#ff6644', 12);
      ticks--;
      if (!enemy.alive) {
        this._onEnemyKilled(enemy);
        clearInterval(interval);
      }
    }, 800);
  }

  _chainDamage(source, damage, color) {
    const nearby = this.enemies
      .filter(e => e.alive && e.id !== source.id)
      .sort((a, b) =>
        Math.hypot(a.x - source.x, a.y - source.y) -
        Math.hypot(b.x - source.x, b.y - source.y)
      );

    if (nearby.length > 0) {
      const target = nearby[0];
      target.takeDamage(damage);
      this.particles.hitSpark(target.x, target.y, color);
      this.screenFX.addFloatingText(`${damage}`, target.x, target.y - 30, color, 14);
      if (!target.alive) this._onEnemyKilled(target);
    }
  }

  _onEnemyKilled(enemy) {
    this.totalKills++;
    this.waveEnemiesRemaining--;
    this.usedWords.delete(enemy.word);

    // Death VFX
    this.particles.emit({
      x: enemy.x, y: enemy.y,
      count: 20,
      colors: [enemy.color, '#ffffff', '#ff6600'],
      speed: 4, speedVariance: 3,
      size: 4, sizeVariance: 3,
      life: 600, lifeVariance: 200,
      spread: Math.PI * 2,
      drag: 0.95,
      shape: 'square',
      glow: true,
    });
    this.screenFX.addFloatingText('DESTROYED', enemy.x, enemy.y - 40, enemy.color, 14);

    this.eventBus.emit('combat:enemyKilled', { enemy, totalKills: this.totalKills });

    // Check wave complete
    if (this.waveEnemiesRemaining <= 0 && this.waveEnemiesSpawned >= this.waveEnemiesTotal) {
      this._onWaveComplete();
    }
  }

  // ─── Wave System ──────────────────────────────────────────────

  startWave(waveNumber) {
    this.wave = waveNumber;
    this.betweenWaves = false;

    // Scale difficulty
    const baseEnemies = 3 + Math.floor(waveNumber * 1.5);
    this.waveEnemiesTotal = Math.min(baseEnemies, 15);
    this.waveEnemiesRemaining = this.waveEnemiesTotal;
    this.waveEnemiesSpawned = 0;
    this.waveSpawnTimer = 500; // Small delay before first spawn

    // Prepare word pool
    this._buildWordPool();

    // Decrease spawn interval as waves progress
    this.waveSpawnInterval = Math.max(1000, 2500 - waveNumber * 150);

    this.eventBus.emit('combat:waveStart', { wave: waveNumber, enemies: this.waveEnemiesTotal });
  }

  _onWaveComplete() {
    this.betweenWaves = true;
    this.betweenWaveTimer = 3000;

    // Heal player a bit between waves
    this.player.heal(15);

    this.eventBus.emit('combat:waveComplete', {
      wave: this.wave,
      kills: this.totalKills,
    });
  }

  _buildWordPool() {
    // Use harder words as waves increase
    let pool = [];
    if (this.wave <= 2) {
      pool = [...TARGET_WORDS.easy];
    } else if (this.wave <= 5) {
      pool = [...TARGET_WORDS.easy, ...TARGET_WORDS.medium];
    } else if (this.wave <= 8) {
      pool = [...TARGET_WORDS.medium, ...TARGET_WORDS.hard];
    } else {
      pool = [...TARGET_WORDS.medium, ...TARGET_WORDS.hard, ...TARGET_WORDS.boss];
    }

    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.wordPool = pool;
  }

  _getNextWord() {
    for (const word of this.wordPool) {
      if (!this.usedWords.has(word)) {
        this.usedWords.add(word);
        return word;
      }
    }
    // Fallback: all words used, rebuild
    this._buildWordPool();
    const word = this.wordPool[0];
    this.usedWords.add(word);
    return word;
  }

  _spawnEnemy() {
    const word = this._getNextWord();

    // Determine tier based on wave and word
    let tier = 'easy';
    let hp = 30 + this.wave * 5;
    let damage = 8 + this.wave * 2;
    let speed = 0.3 + this.wave * 0.02;

    if (TARGET_WORDS.medium.includes(word)) {
      tier = 'medium';
      hp = 50 + this.wave * 8;
      damage = 12 + this.wave * 2;
      speed = 0.25 + this.wave * 0.02;
    }
    if (TARGET_WORDS.hard.includes(word)) {
      tier = 'hard';
      hp = 80 + this.wave * 10;
      damage = 18 + this.wave * 3;
      speed = 0.2 + this.wave * 0.02;
    }
    if (TARGET_WORDS.boss.includes(word)) {
      tier = 'boss';
      hp = 150 + this.wave * 15;
      damage = 25 + this.wave * 3;
      speed = 0.15 + this.wave * 0.01;
    }

    // Spawn position: right side, random Y
    const canvas = { width: 900, height: 500 }; // Will be passed in
    const spawnX = canvas.width + 30 + Math.random() * 50;
    const spawnY = 200 + Math.random() * 150;
    const targetX = 300 + Math.random() * 350;

    const enemy = new Enemy({
      id: this.nextEnemyId++,
      word,
      x: spawnX,
      y: spawnY,
      targetX,
      hp,
      damage,
      speed,
      tier,
      attackCooldown: Math.max(2000, 4000 - this.wave * 200),
    });

    this.enemies.push(enemy);
    this.waveEnemiesSpawned++;

    this.eventBus.emit('combat:enemySpawned', { enemy });
  }

  // ─── Update ───────────────────────────────────────────────────

  update(dt) {
    if (this.gameOver) return;

    // Between waves countdown
    if (this.betweenWaves) {
      this.betweenWaveTimer -= dt;
      if (this.betweenWaveTimer <= 0) {
        this.startWave(this.wave + 1);
      }
      return;
    }

    // Spawn enemies
    if (this.waveEnemiesSpawned < this.waveEnemiesTotal) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        this._spawnEnemy();
        this.waveSpawnTimer = this.waveSpawnInterval;
      }
    }

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(dt);

      // Check if enemy attacks player
      if (enemy.isAttacking() && enemy.alive) {
        const dmg = this.player.takeDamage(enemy.damage);
        this.totalDamageTaken += dmg;
        enemy.state = 'idle';
        enemy.stateTimer = 0;
        enemy.attackTimer = enemy.attackCooldown;

        if (dmg > 0) {
          this.particles.hitSpark(this.player.x, this.player.y, '#ff0044', Math.PI);
          this.screenFX.shake(dmg > 15 ? 10 : 5, 200);
          this.screenFX.flash('#ff0044', 100);
          this.screenFX.addFloatingText(
            `-${dmg}`,
            this.player.x, this.player.y - 50,
            this.player.blocking ? '#00aaff' : '#ff4444',
            this.player.blocking ? 14 : 18
          );
        }
      }
    }

    // Clean up dead enemies (after animation)
    this.enemies = this.enemies.filter(e => e.alive || e.deathAnim < 1.5);

    // Check game over
    if (!this.player.alive) {
      this.gameOver = true;
      this.eventBus.emit('combat:gameOver', {
        wave: this.wave,
        kills: this.totalKills,
        damageDealt: this.totalDamageDealt,
        damageTaken: this.totalDamageTaken,
      });
    }
  }

  // ─── Rendering helpers ────────────────────────────────────────

  renderEnemies(ctx, spriteFactory) {
    for (const enemy of this.enemies) {
      enemy.render(ctx, spriteFactory);
    }
  }

  /**
   * Mark an enemy as being targeted (visual feedback while typing).
   */
  updateTargetHighlights(partial) {
    for (const enemy of this.enemies) {
      enemy.isTargetedBy = false;
    }
    if (partial && partial.state === 'typing_target' && partial.targetSuggestions) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (partial.targetSuggestions.includes(enemy.word.toUpperCase())) {
          enemy.isTargetedBy = true;
        }
      }
    } else if (partial && partial.state === 'ready' && partial.targetMatch) {
      const match = this.enemies.find(e => e.alive && e.id === partial.targetMatch.id);
      if (match) match.isTargetedBy = true;
    }
  }

  reset() {
    this.enemies = [];
    this.wave = 0;
    this.waveEnemiesRemaining = 0;
    this.waveSpawnTimer = 0;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesTotal = 0;
    this.betweenWaves = true;
    this.betweenWaveTimer = 2000;
    this.gameOver = false;
    this.totalKills = 0;
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    this.usedWords.clear();
    this.nextEnemyId = 1;
  }

  destroy() {
    if (this._unsubExecute) this._unsubExecute();
    if (this._unsubCombo) this._unsubCombo();
  }
}
