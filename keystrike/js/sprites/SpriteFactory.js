/**
 * KEYSTRIKE — SpriteFactory
 * 
 * Pre-renders all character sprites onto offscreen canvases at startup.
 * During gameplay, just blits the cached frames — zero drawing overhead.
 * 
 * Usage:
 *   const factory = new SpriteFactory();
 *   factory.init();  // pre-renders everything
 *   factory.draw(ctx, 'player', 'idle', frameIndex, x, y);
 *   factory.draw(ctx, 'drone', 'attack', frameIndex, x, y);
 */
import { createCanvas } from './DrawUtils.js';
import { drawPlayer, PLAYER_STATES } from './PlayerDesign.js';
import { drawEnemy, ENEMY_TYPES, ENEMY_STATES } from './EnemyDesigns.js';

// Sprite padding for glow effects
const GLOW_PAD = 16;

export class SpriteFactory {
  constructor() {
    // Cache structure: { type: { state: { frame: canvas } } }
    this.cache = {};
    this.ready = false;
  }

  /**
   * Pre-render all sprites. Call once at game init.
   */
  init() {
    // Player
    this._buildPlayerSprites();
    
    // Each enemy type
    for (const type of Object.keys(ENEMY_TYPES)) {
      this._buildEnemySprites(type);
    }
    
    this.ready = true;
  }

  _buildPlayerSprites() {
    const def = { width: 48, height: 72 };
    this.cache['player'] = { def };
    
    for (const state of PLAYER_STATES) {
      this.cache['player'][state] = {};
      const frameCount = this._getFrameCount('player', state);
      for (let f = 0; f < frameCount; f++) {
        const cw = def.width + GLOW_PAD * 2;
        const ch = def.height + GLOW_PAD * 2;
        const c = createCanvas(cw, ch);
        const ctx = c.getContext('2d');
        // Draw centered in the canvas with padding for glow
        drawPlayer(ctx, GLOW_PAD, GLOW_PAD, def.width, def.height, state, f / Math.max(1, frameCount - 1));
        this.cache['player'][state][f] = c;
      }
    }
  }

  _buildEnemySprites(type) {
    const eDef = ENEMY_TYPES[type];
    this.cache[type] = { def: eDef };
    
    for (const state of ENEMY_STATES) {
      this.cache[type][state] = {};
      const frameCount = this._getFrameCount(type, state);
      for (let f = 0; f < frameCount; f++) {
        const cw = eDef.width + GLOW_PAD * 2;
        const ch = eDef.height + GLOW_PAD * 2;
        const c = createCanvas(cw, ch);
        const ctx = c.getContext('2d');
        drawEnemy(ctx, GLOW_PAD, GLOW_PAD, eDef.width, eDef.height, type, state, f / Math.max(1, frameCount - 1));
        this.cache[type][state][f] = c;
      }
    }
  }

  _getFrameCount(type, state) {
    // More frames for smoother animations on key states
    if (state === 'idle') return 4;
    if (state === 'attack') return 4;
    if (state === 'hit') return 2;
    if (state === 'death') return 4;
    if (state === 'defend') return 2;
    if (state === 'cast') return 3;
    return 2;
  }

  /**
   * Draw a cached sprite at position (cx, cy) — center-anchored.
   * @param {string} type - 'player', 'drone', 'scout', 'brute', 'boss'
   * @param {string} state - 'idle', 'attack', 'hit', 'death', etc.
   * @param {number} progress - 0-1 animation progress
   * @param {number} cx - center x position
   * @param {number} cy - center y position
   * @param {object} opts - { tint, alpha, scale, flipX }
   */
  draw(ctx, type, state, progress, cx, cy, opts = {}) {
    const typeCache = this.cache[type];
    if (!typeCache) return;
    
    const stateCache = typeCache[state] || typeCache['idle'];
    if (!stateCache) return;
    
    const frameCount = this._getFrameCount(type, state);
    const frameIdx = Math.min(Math.floor(progress * frameCount), frameCount - 1);
    const canvas = stateCache[frameIdx];
    if (!canvas) return;
    
    const def = typeCache.def;
    const scale = opts.scale || 1;
    const dw = (def.width + GLOW_PAD * 2) * scale;
    const dh = (def.height + GLOW_PAD * 2) * scale;
    
    ctx.save();
    
    if (opts.alpha !== undefined) {
      ctx.globalAlpha = opts.alpha;
    }
    
    if (opts.flipX) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(canvas, cx - dw / 2, cy - dh / 2, dw, dh);
    }
    
    // Tint overlay (for hurt flash, targeting highlight, etc.)
    if (opts.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = opts.tint;
      ctx.globalAlpha = opts.tintAlpha || 0.3;
      ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
    }
    
    ctx.restore();
  }

  /**
   * Get sprite dimensions for a type.
   */
  getSize(type) {
    const tc = this.cache[type];
    return tc ? { width: tc.def.width, height: tc.def.height } : { width: 30, height: 45 };
  }
}
