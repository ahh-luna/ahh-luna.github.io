/**
 * KEYSTRIKE — EnemySpawner
 * 
 * Manages waves of enemies. Scales difficulty over time.
 * Assigns unique target words from the WordBank pools.
 */
import { Enemy } from './Enemy.js';
import { TARGET_WORDS } from '../core/WordBank.js';

export class EnemySpawner {
  constructor(eventBus) {
    this.eventBus = eventBus;

    this.wave = 0;
    this.enemies = [];
    this.usedWords = new Set();
    this.nextId = 1;

    // Wave config
    this.waveTimer = 0;
    this.waveDelay = 3000;      // Delay between waves
    this.waveActive = false;
    this.enemiesPerWave = 3;
    this.spawnTimer = 0;
    this.spawnInterval = 1500;  // Stagger spawns within a wave
    this.spawnQueue = [];

    // Canvas bounds (set by renderer)
    this.canvasWidth = 900;
    this.canvasHeight = 500;
    this.groundY = 350;
  }

  reset() {
    this.wave = 0;
    this.enemies = [];
    this.usedWords.clear();
    this.nextId = 1;
    this.waveTimer = this.waveDelay;
    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.enemiesPerWave = 3;
  }

  update(dt) {
    // Update existing enemies
    for (const enemy of this.enemies) {
      const result = enemy.update(dt);
      if (result === 'attack') {
        this.eventBus.emit('enemy:attack', { enemy });
      }
    }

    // Remove fully dead enemies
    this.enemies = this.enemies.filter(e => !e.fullyDead);

    // Process spawn queue
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const config = this.spawnQueue.shift();
        this._spawnEnemy(config);
        this.spawnTimer = this.spawnInterval;
      }
    }

    // Check if wave is clear
    if (this.waveActive && this.spawnQueue.length === 0 &&
        this.enemies.filter(e => e.alive).length === 0) {
      this.waveActive = false;
      this.waveTimer = this.waveDelay;
      this.eventBus.emit('wave:clear', { wave: this.wave });
    }

    // Wait for next wave
    if (!this.waveActive && this.spawnQueue.length === 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this._startWave();
      }
    }
  }

  _startWave() {
    this.wave++;
    this.waveActive = true;
    this.usedWords.clear();

    // Scale difficulty
    const count = Math.min(3 + Math.floor(this.wave * 0.7), 10);
    this.enemiesPerWave = count;

    // Build spawn queue
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      this.spawnQueue.push(this._generateEnemyConfig(i));
    }

    this.spawnTimer = 200; // First spawn quick

    this.eventBus.emit('wave:start', {
      wave: this.wave,
      enemyCount: count,
    });
  }

  _generateEnemyConfig(index) {
    // Determine tier based on wave
    let tier = 'easy';
    const roll = Math.random();
    if (this.wave >= 7 && roll < 0.1) {
      tier = 'boss';
    } else if (this.wave >= 4 && roll < 0.3) {
      tier = 'hard';
    } else if (this.wave >= 2 && roll < 0.6) {
      tier = 'medium';
    }

    // Pick unique word
    const word = this._pickWord(tier);

    // Enemy types with scaling
    const waveScale = 1 + (this.wave - 1) * 0.15;
    const configs = {
      easy: {
        type: 'drone',
        hp: Math.round(30 * waveScale),
        damage: Math.round(8 * waveScale),
        speed: 0.015 + Math.random() * 0.01,
        attackInterval: 3500 + Math.random() * 1500,
      },
      medium: {
        type: 'scout',
        hp: Math.round(50 * waveScale),
        damage: Math.round(12 * waveScale),
        speed: 0.02 + Math.random() * 0.015,
        attackInterval: 3000 + Math.random() * 1000,
      },
      hard: {
        type: 'brute',
        hp: Math.round(80 * waveScale),
        damage: Math.round(18 * waveScale),
        speed: 0.01 + Math.random() * 0.005,
        attackInterval: 4000 + Math.random() * 1000,
      },
      boss: {
        type: 'boss',
        hp: Math.round(150 * waveScale),
        damage: Math.round(25 * waveScale),
        speed: 0.008,
        attackInterval: 3000 + Math.random() * 1000,
      },
    };

    const cfg = configs[tier];
    const spawnX = this.canvasWidth - 60 + Math.random() * 80;
    const spawnY = this.groundY - 40 + (Math.random() - 0.5) * 60;

    return {
      ...cfg,
      word,
      x: spawnX,
      y: spawnY,
    };
  }

  _pickWord(tier) {
    const pool = TARGET_WORDS[tier] || TARGET_WORDS.easy;
    const available = pool.filter(w => !this.usedWords.has(w));
    if (available.length === 0) {
      // Fallback: use any available word from any tier
      const allPools = Object.values(TARGET_WORDS).flat();
      const fallback = allPools.filter(w => !this.usedWords.has(w));
      if (fallback.length === 0) {
        this.usedWords.clear();
        return pool[Math.floor(Math.random() * pool.length)];
      }
      const word = fallback[Math.floor(Math.random() * fallback.length)];
      this.usedWords.add(word);
      return word;
    }
    const word = available[Math.floor(Math.random() * available.length)];
    this.usedWords.add(word);
    return word;
  }

  _spawnEnemy(config) {
    const enemy = new Enemy({
      id: this.nextId++,
      ...config,
    });
    this.enemies.push(enemy);
    this.eventBus.emit('enemy:spawn', { enemy });
  }

  /**
   * Get all alive enemies (for target resolution).
   */
  getAliveEnemies() {
    return this.enemies.filter(e => e.alive);
  }

  /**
   * Get targets for the grammar system.
   * Returns [{id, word, entity}]
   */
  getTargets() {
    return this.getAliveEnemies().map(e => ({
      id: e.id,
      word: e.word,
      entity: e,
    }));
  }
}
