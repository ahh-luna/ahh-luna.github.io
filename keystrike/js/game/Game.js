/**
 * KEYSTRIKE — Main Game
 * 
 * Orchestrates all systems: input, combat, rendering, UI.
 */
import { EventBus } from '../core/EventBus.js';
import { GrammarSystem } from '../core/GrammarSystem.js';
import { InputEngine } from '../core/InputEngine.js';
import { ComboSystem } from '../core/ComboSystem.js';
import { initializeWordBank, VERBS, COMBOS } from '../core/WordBank.js';
import { GameLoop } from './GameLoop.js';
import { Player } from './Player.js';
import { CombatManager } from './CombatManager.js';
import { ParticleSystem } from '../fx/Particles.js';
import { ScreenFX } from '../fx/ScreenFX.js';

export class Game {
  constructor(canvas, logicalWidth, logicalHeight) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Use logical dimensions (canvas.width/height are DPR-scaled)
    this.width = logicalWidth || 900;
    this.height = logicalHeight || 500;

    // Core systems
    this.eventBus = new EventBus();
    this.grammar = new GrammarSystem();
    this.comboSystem = new ComboSystem(this.eventBus);
    initializeWordBank(this.grammar, this.comboSystem);

    // FX
    this.particles = new ParticleSystem();
    this.screenFX = new ScreenFX();

    // Player
    this.player = new Player(120, this.height / 2 - 20);

    // Input
    this.inputEngine = new InputEngine(this.eventBus, this.grammar);

    // Combat
    this.combat = new CombatManager(
      this.eventBus, this.grammar, this.player,
      this.particles, this.screenFX
    );

    // Game state
    this.state = 'boot';  // 'boot' | 'menu' | 'playing' | 'gameover'
    this.bootTimer = 0;
    this.bootLines = [];
    this.bootLineIndex = 0;
    this.bootText = [
      'KEYSTRIKE SYSTEM v1.0',
      'INITIALIZING NEURAL LINK...',
      'WEAPON SYSTEMS ONLINE',
      'COMBAT PROTOCOLS LOADED',
      '> READY',
      '',
      'TYPE "FIGHT" TO BEGIN',
      'TYPE "BANK" TO VIEW COMMANDS',
    ];

    // Menu/bank state
    this.showBank = false;

    // HUD data
    this.hudData = {
      wpm: 0, lpm: 0, accuracy: 100,
      comboCount: 0, wave: 0,
      enemiesLeft: 0,
    };

    // Game loop
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (alpha, dt) => this.render(alpha, dt)
    );

    this._setupEvents();
  }

  _setupEvents() {
    this.eventBus.on('input:metricsUpdate', (data) => {
      this.hudData.wpm = data.wpm;
      this.hudData.lpm = data.lpm;
      this.hudData.accuracy = Math.round(data.accuracy * 100);
      this.hudData.comboCount = data.comboCount;
    });

    this.eventBus.on('combat:waveStart', (data) => {
      this.hudData.wave = data.wave;
      this.hudData.enemiesLeft = data.enemies;
      this.screenFX.addFloatingText(
        `WAVE ${data.wave}`,
        this.width / 2, this.height / 2 - 50,
        '#00ffc8', 32
      );
    });

    this.eventBus.on('combat:waveComplete', (data) => {
      this.screenFX.addFloatingText(
        'WAVE CLEAR!',
        this.width / 2, this.height / 2 - 50,
        '#00ff88', 28
      );
    });

    this.eventBus.on('combat:enemyKilled', () => {
      this.hudData.enemiesLeft = this.combat.waveEnemiesRemaining;
    });

    this.eventBus.on('combat:gameOver', (data) => {
      this.state = 'gameover';
      this.gameOverData = data;
      this.inputEngine.deactivate();
      // Re-activate after delay for restart
      setTimeout(() => {
        this.inputEngine.activate();
      }, 1500);
    });

    // Buffer change → update target highlights
    this.eventBus.on('input:bufferChange', (data) => {
      if (this.state === 'playing') {
        this.combat.updateTargetHighlights(data.partial);
      }
    });

    // Menu/boot input handling
    this.eventBus.on('input:execute', (data) => {
      const raw = data.command.raw?.toUpperCase() || data.record?.raw?.toUpperCase() || '';
      
      if (this.state === 'menu' || this.state === 'boot') {
        if (raw === 'FIGHT' || raw === 'START' || raw === 'PLAY') {
          this._startGame();
        } else if (raw === 'BANK' || raw === 'WORDS' || raw === 'HELP') {
          this.showBank = !this.showBank;
        }
      } else if (this.state === 'gameover') {
        if (raw === 'FIGHT' || raw === 'RESTART' || raw === 'RETRY' || raw === 'AGAIN') {
          this._startGame();
        }
      }
    });

    // Also catch errors for menu navigation
    this.eventBus.on('input:error', (data) => {
      const raw = data.error.raw?.toUpperCase() || '';
      if (this.state === 'menu' || this.state === 'boot') {
        if (raw === 'FIGHT' || raw === 'START' || raw === 'PLAY') {
          this._startGame();
        } else if (raw === 'BANK' || raw === 'WORDS' || raw === 'HELP') {
          this.showBank = !this.showBank;
        }
      } else if (this.state === 'gameover') {
        if (raw === 'FIGHT' || raw === 'RESTART' || raw === 'RETRY' || raw === 'AGAIN') {
          this._startGame();
        }
      }
    });
  }

  start() {
    this.inputEngine.activate();
    this.loop.start();
  }

  _startGame() {
    this.state = 'playing';
    this.showBank = false;
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.x = 120;
    this.player.baseY = this.height / 2 - 20;
    this.inputEngine.reset();
    this.inputEngine.activate();
    this.grammar.resetCooldowns();
    this.combat.reset();
    this.comboSystem.reset();
    this.particles.clear();
    this.combat.startWave(1);
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════

  update(dt) {
    if (this.state === 'boot') {
      this.bootTimer += dt;
      const lineInterval = 350;
      const targetIndex = Math.floor(this.bootTimer / lineInterval);
      if (targetIndex > this.bootLineIndex && this.bootLineIndex < this.bootText.length) {
        this.bootLines.push(this.bootText[this.bootLineIndex]);
        this.bootLineIndex++;
      }
      if (this.bootLineIndex >= this.bootText.length && this.bootTimer > this.bootText.length * lineInterval + 500) {
        this.state = 'menu';
      }
    }

    if (this.state === 'playing') {
      this.player.update(dt);
      this.combat.update(dt);
    }

    this.particles.update(dt);
    this.screenFX.update(dt);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  render(alpha, dt) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    ctx.save();

    // Apply screen effects
    this.screenFX.applyPreTransform(ctx);

    // Background
    this._renderBackground(ctx, W, H);

    if (this.state === 'boot' || this.state === 'menu') {
      this._renderMenuScreen(ctx, W, H);
    } else if (this.state === 'playing') {
      this._renderArena(ctx, W, H);
    } else if (this.state === 'gameover') {
      this._renderArena(ctx, W, H);
      this._renderGameOver(ctx, W, H);
    }

    // Particles on top
    this.particles.render(ctx);

    // Screen FX overlay
    this.screenFX.renderOverlay(ctx, W, H);

    // Input bar (always)
    this._renderInputBar(ctx, W, H);

    ctx.restore();
  }

  _renderBackground(ctx, W, H) {
    // Dark background
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Floor line
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 90);
    ctx.lineTo(W, H - 90);
    ctx.stroke();
  }

  _renderMenuScreen(ctx, W, H) {
    // Title
    ctx.save();
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillStyle = '#00ffc8';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00ffc8';
    ctx.textAlign = 'center';
    ctx.fillText('KEYSTRIKE', W / 2, 100);

    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = '#ff00aa';
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 15;
    ctx.fillText('YOUR KEYBOARD IS YOUR WEAPON', W / 2, 125);
    ctx.restore();

    // Boot text
    ctx.save();
    ctx.font = '13px "Courier New", monospace';
    ctx.textAlign = 'left';
    const startY = 160;
    for (let i = 0; i < this.bootLines.length; i++) {
      const line = this.bootLines[i];
      if (line.startsWith('>')) {
        ctx.fillStyle = '#00ff88';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ff88';
      } else if (line.startsWith('TYPE')) {
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffaa00';
      } else {
        ctx.fillStyle = '#666';
        ctx.shadowBlur = 0;
      }
      ctx.fillText(line, 60, startY + i * 20);
    }
    ctx.restore();

    // Instructions panel (right side)
    if (this.state === 'menu') {
      this._renderInstructions(ctx, W, H);
    }

    // Word bank overlay
    if (this.showBank) {
      this._renderWordBank(ctx, W, H);
    }
  }

  _renderInstructions(ctx, W, H) {
    ctx.save();
    const panelX = W / 2 - 10;
    const panelY = 55;
    const panelW = W / 2 - 20;
    const panelH = H - 120;

    // Panel background
    ctx.fillStyle = 'rgba(6, 6, 18, 0.85)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    let y = panelY + 28;
    const x = panelX + 18;
    const lineH = 17;

    // Section: HOW TO PLAY
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#00ffc8';
    ctx.textAlign = 'left';
    ctx.fillText('HOW TO PLAY', x, y);
    y += lineH + 4;

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#8899aa';
    const howTo = [
      'Enemies approach with WORDS above them.',
      'Type a VERB + the enemy\'s WORD to attack.',
      '',
      '  Example: SLASH BUG  →  slash the "BUG"',
      '  Example: FIRE NEON  →  fireball at "NEON"',
      '',
      'Defensive verbs need no target:',
      '  BLOCK  →  reduces incoming damage',
      '  DODGE  →  evade the next attack',
      '  HEAL   →  restore your HP',
    ];
    for (const line of howTo) {
      if (line.startsWith('  Example') || line.startsWith('  BLOCK') || line.startsWith('  DODGE') || line.startsWith('  HEAL')) {
        ctx.fillStyle = '#bbccdd';
      } else {
        ctx.fillStyle = '#8899aa';
      }
      ctx.fillText(line, x, y);
      y += lineH;
    }

    y += 6;
    // Section: COMBOS
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('COMBOS', x, y);
    y += lineH;

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#8899aa';
    const combos = [
      'SLASH → STRIKE = ONSLAUGHT (1.8x)',
      'ICE → CRUSH   = SHATTER   (3.0x)',
      'DODGE → SLASH  = RIPOSTE   (2.0x)',
    ];
    for (const line of combos) {
      ctx.fillText(line, x, y);
      y += lineH;
    }

    y += 6;
    // Section: CONTROLS
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#ff00aa';
    ctx.fillText('CONTROLS', x, y);
    y += lineH;

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#8899aa';
    const controls = [
      'ENTER  →  execute command',
      'TAB    →  autocomplete word',
      'ESC    →  cancel / clear input',
    ];
    for (const line of controls) {
      ctx.fillText(line, x, y);
      y += lineH;
    }

    ctx.restore();
  }

  _renderWordBank(ctx, W, H) {
    // Semi-transparent overlay
    ctx.save();
    ctx.fillStyle = 'rgba(6, 6, 12, 0.95)';
    ctx.fillRect(40, 40, W - 80, H - 120);
    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 120);

    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = '#00ffc8';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffc8';
    ctx.fillText('COMMAND DATABASE', W / 2, 72);

    // Categories
    const categories = [
      { name: 'ATTACKS', color: '#ff6600', filter: 'attack' },
      { name: 'DEFENSE', color: '#00aaff', filter: 'defense' },
      { name: 'SPELLS', color: '#ff00aa', filter: 'spell' },
    ];

    let colX = 70;
    ctx.textAlign = 'left';
    
    for (const cat of categories) {
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillStyle = cat.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = cat.color;
      ctx.fillText(`─── ${cat.name} ───`, colX, 100);

      const verbs = Object.entries(VERBS).filter(([, v]) => v.category === cat.filter);
      let y = 120;
      ctx.font = '11px "Courier New", monospace';
      ctx.shadowBlur = 0;

      for (const [name, def] of verbs) {
        ctx.fillStyle = cat.color;
        ctx.fillText(name, colX, y);
        ctx.fillStyle = '#666';
        const info = def.selfTargeted ? '(self)' : `${def.baseDamage}dmg`;
        const cd = def.cooldown > 0 ? ` ${def.cooldown / 1000}s cd` : '';
        ctx.fillText(`  ${info}${cd}`, colX + 65, y);
        y += 16;

        ctx.fillStyle = '#444';
        ctx.fillText(`  ${def.description}`, colX, y);
        y += 20;
      }
      colX += 270;
    }

    // Combos
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffaa00';
    ctx.fillText('─── COMBOS ───', 70, H - 155);
    ctx.font = '11px "Courier New", monospace';
    ctx.shadowBlur = 0;

    let comboX = 70;
    let comboY = H - 135;
    for (const combo of COMBOS) {
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`${combo.name}`, comboX, comboY);
      ctx.fillStyle = '#666';
      ctx.fillText(`  ${combo.sequence.join(' → ')} (${combo.damageMultiplier}x)`, comboX + 120, comboY);
      comboY += 16;
      if (comboY > H - 90) {
        comboY = H - 135;
        comboX += 400;
      }
    }

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#444';
    ctx.fillText('Type "BANK" to close', W / 2 - 60, H - 85);

    ctx.restore();
  }

  _renderArena(ctx, W, H) {
    // HUD — top bar
    ctx.save();

    // Player HP
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#00ffc8';
    ctx.textAlign = 'left';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#00ffc8';
    ctx.fillText(`HP`, 15, 25);

    const hpBarW = 150;
    const hpRatio = this.player.hp / this.player.maxHp;
    ctx.fillStyle = '#1a1a2f';
    ctx.fillRect(40, 15, hpBarW, 14);
    const hpColor = hpRatio > 0.5 ? '#00ff88' : hpRatio > 0.25 ? '#ffaa00' : '#ff4444';
    ctx.fillStyle = hpColor;
    ctx.shadowBlur = 5;
    ctx.shadowColor = hpColor;
    ctx.fillRect(40, 15, hpBarW * hpRatio, 14);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(40, 15, hpBarW, 14);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(`${this.player.hp}/${this.player.maxHp}`, 45, 26);

    // Wave info
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#ff00aa';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff00aa';
    ctx.fillText(`WAVE ${this.hudData.wave}`, W / 2, 25);

    if (this.combat.betweenWaves && this.combat.wave > 0) {
      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = '#00ff88';
      ctx.fillText(`NEXT WAVE IN ${Math.ceil(this.combat.betweenWaveTimer / 1000)}`, W / 2, 45);
    }

    // Right side stats
    ctx.textAlign = 'right';
    ctx.font = '11px "Courier New", monospace';
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffc8';
    ctx.fillText(`WPM: ${this.hudData.wpm}`, W - 15, 18);
    ctx.fillStyle = '#666';
    ctx.fillText(`ACC: ${this.hudData.accuracy}%`, W - 15, 33);
    
    // Combo counter
    if (this.hudData.comboCount > 1) {
      ctx.fillStyle = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffaa00';
      ctx.font = `bold ${14 + Math.min(this.hudData.comboCount, 10)}px "Courier New", monospace`;
      ctx.fillText(`x${this.hudData.comboCount} COMBO`, W - 15, 55);
    }

    // Kills
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#ff4466';
    ctx.shadowBlur = 0;
    ctx.fillText(`KILLS: ${this.combat.totalKills}`, W - 15, this.hudData.comboCount > 1 ? 72 : 50);

    ctx.restore();

    // Mini word bank (bottom-right reference)
    this._renderMiniBank(ctx, W, H);

    // Render entities
    this.player.render(ctx);
    this.combat.renderEnemies(ctx);
  }

  _renderMiniBank(ctx, W, H) {
    ctx.save();
    
    // Guide panel on the right side
    const panelW = 210;
    const panelH = H - 100;
    const panelX = W - panelW - 8;
    const panelY = 60;
    
    // Semi-transparent background — dark enough for contrast
    ctx.fillStyle = 'rgba(4, 4, 14, 0.7)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(panelX, panelY, panelW, panelH, 4);
    } else {
      ctx.rect(panelX, panelY, panelW, panelH);
    }
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    const x = panelX + 10;
    let y = panelY + 18;
    const lineH = 14;
    
    ctx.textAlign = 'left';
    
    // Title
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0, 255, 200, 0.7)';
    ctx.fillText('COMBAT GUIDE', x, y);
    y += lineH + 5;
    
    // Attack verbs
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 130, 40, 0.85)';
    ctx.fillText('⚔ ATTACK  [verb] [target]', x, y);
    y += lineH;
    ctx.fillStyle = 'rgba(255, 130, 40, 0.55)';
    const atkVerbs = Object.entries(VERBS).filter(([,v]) => v.category === 'attack').map(([n]) => n);
    ctx.fillText(atkVerbs.join(' '), x, y);
    y += lineH + 4;

    // Defense verbs
    ctx.fillStyle = 'rgba(60, 180, 255, 0.85)';
    ctx.fillText('🛡 DEFEND  [verb] (no tgt)', x, y);
    y += lineH;
    ctx.fillStyle = 'rgba(60, 180, 255, 0.55)';
    const defVerbs = Object.entries(VERBS).filter(([,v]) => v.category === 'defense').map(([n]) => n);
    ctx.fillText(defVerbs.join('  '), x, y);
    y += lineH + 4;

    // Spell verbs
    ctx.fillStyle = 'rgba(180, 80, 255, 0.85)';
    ctx.fillText('✦ SPELL   [verb] [target]', x, y);
    y += lineH;
    ctx.fillStyle = 'rgba(180, 80, 255, 0.55)';
    const splVerbs = Object.entries(VERBS).filter(([,v]) => v.category === 'spell').map(([n]) => n);
    ctx.fillText(splVerbs.join(' '), x, y);
    y += lineH + 7;
    
    // Combos section
    ctx.fillStyle = 'rgba(255, 200, 60, 0.8)';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText('★ COMBOS (chain fast!)', x, y);
    y += lineH + 1;
    
    ctx.font = '9px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 200, 60, 0.55)';
    const comboList = [
      'SLASH→STRIKE  ONSLAUGHT 1.8x',
      'DODGE→SLASH   RIPOSTE   2.0x',
      'ICE→CRUSH     SHATTER   3.0x',
      'FIRE→BOLT     FIRESTORM 2.0x',
      'SLASHx2→STRIKE VORTEX  2.5x',
    ];
    for (const c of comboList) {
      ctx.fillText(c, x, y);
      y += lineH - 1;
    }
    
    y += 5;
    // Controls
    ctx.fillStyle = 'rgba(255, 60, 180, 0.7)';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText('CONTROLS', x, y);
    y += lineH;
    ctx.font = '9px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 60, 180, 0.5)';
    ctx.fillText('ENTER execute  TAB complete', x, y);
    y += lineH - 1;
    ctx.fillText('ESC cancel     PARRY [tgt]', x, y);

    ctx.restore();
  }

  _renderGameOver(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 6, 12, 0.8)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillStyle = '#ff0044';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff0044';
    ctx.fillText('SYSTEM FAILURE', W / 2, H / 2 - 60);

    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = '#ff4466';
    ctx.shadowBlur = 0;
    ctx.fillText('NEURAL LINK SEVERED', W / 2, H / 2 - 25);

    const d = this.gameOverData || {};
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = '#666';
    let y = H / 2 + 15;
    ctx.fillText(`Waves survived: ${d.wave || 0}`, W / 2, y); y += 22;
    ctx.fillText(`Enemies destroyed: ${d.kills || 0}`, W / 2, y); y += 22;
    ctx.fillText(`Damage dealt: ${d.damageDealt || 0}`, W / 2, y); y += 22;
    ctx.fillText(`Max combo: ${this.inputEngine.maxCombo}`, W / 2, y); y += 22;
    ctx.fillText(`Avg WPM: ${this.hudData.wpm}`, W / 2, y); y += 35;

    ctx.fillStyle = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffaa00';
    ctx.fillText('TYPE "FIGHT" TO RETRY', W / 2, y);

    ctx.restore();
  }

  _renderInputBar(ctx, W, H) {
    const barH = 45;
    const barY = H - barH;

    // Background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
    ctx.fillRect(0, barY, W, barH);

    // Top border
    ctx.strokeStyle = '#00ffc840';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(W, barY);
    ctx.stroke();

    // Prompt
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00ffc8';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#00ffc8';
    ctx.fillText('>', 12, barY + 28);

    // Input buffer
    const buffer = this.inputEngine.buffer;
    const partial = this.grammar.parsePartial(buffer);

    let displayX = 30;
    if (buffer.length > 0) {
      const words = buffer.split(' ');
      
      // First word (verb) coloring
      if (partial.verbValid) {
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
      } else if (partial.verbSuggestions?.length > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff4444';
      }
      ctx.fillText(words[0], displayX, barY + 28);
      displayX += ctx.measureText(words[0]).width;

      // Space + target
      if (words.length > 1) {
        ctx.fillStyle = '#666';
        ctx.fillText(' ', displayX, barY + 28);
        displayX += ctx.measureText(' ').width;

        if (partial.state === 'ready') {
          ctx.fillStyle = '#ffaa00';
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#ffaa00';
        } else if (partial.targetSuggestions?.length > 0) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = '#ff4444';
        }
        ctx.fillText(words[1] || '', displayX, barY + 28);
        displayX += ctx.measureText(words[1] || '').width;
      }
    }

    // Blinking cursor
    const cursorVisible = Math.floor(performance.now() / 400) % 2 === 0;
    if (cursorVisible) {
      ctx.fillStyle = '#00ffc8';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#00ffc8';
      ctx.fillRect(displayX + 2, barY + 15, 8, 18);
    }

    // Suggestions (subtle)
    if (buffer.length > 0 && partial.state !== 'ready') {
      ctx.fillStyle = '#333';
      ctx.shadowBlur = 0;
      ctx.font = '11px "Courier New", monospace';
      let suggestions = [];
      if (partial.state === 'typing_verb' && !partial.verbValid) {
        suggestions = (partial.verbSuggestions || []).slice(0, 3);
      } else if (partial.state === 'typing_target') {
        suggestions = (partial.targetSuggestions || []).slice(0, 4);
      }
      if (suggestions.length > 0) {
        ctx.fillText(suggestions.join('  '), displayX + 25, barY + 28);
      }
    }

    // Ready indicator
    if (partial.state === 'ready') {
      ctx.fillStyle = '#00ff88';
      ctx.font = '10px "Courier New", monospace';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#00ff88';
      ctx.fillText('ENTER ⏎', W - 70, barY + 28);
    }

    ctx.shadowBlur = 0;
  }
}
