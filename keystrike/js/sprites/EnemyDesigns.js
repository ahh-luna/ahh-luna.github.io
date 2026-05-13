/**
 * KEYSTRIKE — EnemyDesigns
 * 
 * Drawing routines for each enemy type.
 * Each type has a distinct silhouette, color palette, and personality.
 * 
 * Types:
 *   drone  — Small floating sphere, single eye, antenna (easy, tier 1)
 *   scout  — Sleek angular bipedal, fast-looking (medium, tier 2)
 *   brute  — Heavy armored, oversized, slow (hard, tier 3)
 *   boss   — Complex, menacing, crowned (boss, tier 4)
 */
import { neonPolygon, neonCircle, neonLine, neonRect, circuitLines, glowDot, energyBlade } from './DrawUtils.js';

const BODY_FILL = '#080818';
const DARK_FILL = '#050510';

// Palettes per type
const PALETTES = {
  drone:  { primary: '#ff3355', accent: '#ff6688', eye: '#ff0033' },
  scout:  { primary: '#ff4488', accent: '#ff77aa', eye: '#ff2266' },
  brute:  { primary: '#ff8800', accent: '#ffaa33', eye: '#ff6600' },
  boss:   { primary: '#cc44ff', accent: '#dd88ff', eye: '#aa00ff' },
};

export const ENEMY_TYPES = {
  drone:  { width: 32, height: 36, tier: 'easy' },
  scout:  { width: 36, height: 56, tier: 'medium' },
  brute:  { width: 52, height: 72, tier: 'hard' },
  boss:   { width: 56, height: 80, tier: 'boss' },
};

export const ENEMY_STATES = ['idle', 'attack', 'hit', 'death'];

/**
 * Draw an enemy sprite.
 */
export function drawEnemy(ctx, ox, oy, w, h, type, state, t) {
  switch (type) {
    case 'drone':  return _drawDrone(ctx, ox, oy, w, h, state, t);
    case 'scout':  return _drawScout(ctx, ox, oy, w, h, state, t);
    case 'brute':  return _drawBrute(ctx, ox, oy, w, h, state, t);
    case 'boss':   return _drawBoss(ctx, ox, oy, w, h, state, t);
  }
}

// ═══════════════════════════════════════════════════════════════════
// DRONE — Small floating orb with single eye
// ═══════════════════════════════════════════════════════════════════
function _drawDrone(ctx, ox, oy, w, h, state, t) {
  const pal = PALETTES.drone;
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  const r = w * 0.38;
  
  const bob = state === 'idle' ? Math.sin(t * Math.PI * 2) * 3 : 0;
  const hitShake = state === 'hit' ? Math.sin(t * Math.PI * 8) * 4 : 0;
  const offx = hitShake;
  const offy = bob;
  
  // Hover shadow (subtle)
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = pal.primary;
  ctx.beginPath();
  ctx.ellipse(cx, oy + h - 4, r * 0.8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Antenna
  neonLine(ctx, cx + offx, cy - r + offy, cx + offx, cy - r - 10 + offy, pal.accent, 1.5, 4);
  glowDot(ctx, cx + offx, cy - r - 10 + offy, 2, pal.accent, 6);
  
  // Main body sphere
  neonCircle(ctx, cx + offx, cy + offy, r, BODY_FILL, pal.primary, 2, 10);
  
  // Inner ring detail
  ctx.save();
  ctx.strokeStyle = pal.primary;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx + offx, cy + offy, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  
  // Single eye (center)
  const eyeR = state === 'attack' ? r * 0.35 : r * 0.25;
  glowDot(ctx, cx + offx, cy + offy, eyeR, pal.eye, 14);
  // Pupil
  glowDot(ctx, cx + offx, cy + offy, eyeR * 0.35, '#ffffff', 4);
  
  // Side sensor dots
  glowDot(ctx, cx - r + 3 + offx, cy + offy, 1.5, pal.accent, 3);
  glowDot(ctx, cx + r - 3 + offx, cy + offy, 1.5, pal.accent, 3);
}

// ═══════════════════════════════════════════════════════════════════
// SCOUT — Sleek angular biped, fast and agile
// ═══════════════════════════════════════════════════════════════════
function _drawScout(ctx, ox, oy, w, h, state, t) {
  const pal = PALETTES.scout;
  const cx = ox + w / 2;
  const botY = oy + h;
  
  const bob = state === 'idle' ? Math.sin(t * Math.PI * 2) * 2 : 0;
  const hitShake = state === 'hit' ? Math.sin(t * Math.PI * 8) * 3 : 0;
  const offx = hitShake;
  const offy = bob;
  
  const headR = w * 0.18;
  const headY = oy + headR + 4;
  const torsoTop = headY + headR + 3;
  const torsoH = h * 0.3;
  const torsoW = w * 0.45;
  
  // Legs — thin, angular
  neonLine(ctx, cx - 5 + offx, torsoTop + torsoH + offy, cx - 8 + offx, botY + offy, pal.primary, 2, 4);
  neonLine(ctx, cx + 5 + offx, torsoTop + torsoH + offy, cx + 8 + offx, botY + offy, pal.primary, 2, 4);
  
  // Torso — narrow and sleek
  const torsoPoints = [
    { x: cx - torsoW / 2 + offx, y: torsoTop + offy },
    { x: cx + torsoW / 2 + offx, y: torsoTop + offy },
    { x: cx + torsoW / 2 - 3 + offx, y: torsoTop + torsoH + offy },
    { x: cx - torsoW / 2 + 3 + offx, y: torsoTop + torsoH + offy },
  ];
  neonPolygon(ctx, torsoPoints, BODY_FILL, pal.primary, 1.5, 8);
  circuitLines(ctx, cx - torsoW / 2 + 3 + offx, torsoTop + 2 + offy, torsoW - 6, torsoH - 4, pal.primary, 0.15);
  
  // Head — angular, pointed
  const headPoints = [
    { x: cx + offx, y: headY - headR - 4 + offy },  // top point
    { x: cx + headR + 2 + offx, y: headY + offy },
    { x: cx + headR + offx, y: headY + headR * 0.6 + offy },
    { x: cx - headR + offx, y: headY + headR * 0.6 + offy },
    { x: cx - headR - 2 + offx, y: headY + offy },
  ];
  neonPolygon(ctx, headPoints, BODY_FILL, pal.primary, 1.5, 8);
  
  // Eyes — dual narrow slits
  neonLine(ctx, cx - headR + 3 + offx, headY - 1 + offy, cx - 2 + offx, headY - 1 + offy, pal.eye, 2, 8);
  neonLine(ctx, cx + 2 + offx, headY - 1 + offy, cx + headR - 3 + offx, headY - 1 + offy, pal.eye, 2, 8);
  
  // Arms — blade-like appendages
  const armAngle = state === 'attack' ? -0.3 + t * 1.5 : 0.5;
  const armLen = 16;
  neonLine(ctx,
    cx + torsoW / 2 + offx, torsoTop + 5 + offy,
    cx + torsoW / 2 + Math.cos(armAngle) * armLen + offx, torsoTop + 5 + Math.sin(armAngle) * armLen + offy,
    pal.accent, 2, 5
  );
  neonLine(ctx,
    cx - torsoW / 2 + offx, torsoTop + 5 + offy,
    cx - torsoW / 2 - 10 + offx, torsoTop + 15 + offy,
    pal.accent, 2, 5
  );
}

// ═══════════════════════════════════════════════════════════════════
// BRUTE — Heavy armored tank, oversized
// ═══════════════════════════════════════════════════════════════════
function _drawBrute(ctx, ox, oy, w, h, state, t) {
  const pal = PALETTES.brute;
  const cx = ox + w / 2;
  const botY = oy + h;
  
  const bob = state === 'idle' ? Math.sin(t * Math.PI * 2) * 1.5 : 0;
  const hitShake = state === 'hit' ? Math.sin(t * Math.PI * 6) * 5 : 0;
  const offx = hitShake;
  const offy = bob;
  
  const headH = h * 0.15;
  const headW = w * 0.45;
  const headY = oy + headH + 4;
  const torsoTop = headY + headH;
  const torsoH = h * 0.4;
  const torsoW = w * 0.75;
  const legLen = h * 0.25;
  
  // Legs — thick and heavy
  neonLine(ctx, cx - 12 + offx, torsoTop + torsoH + offy, cx - 14 + offx, botY + offy, pal.primary, 4, 5);
  neonLine(ctx, cx + 12 + offx, torsoTop + torsoH + offy, cx + 14 + offx, botY + offy, pal.primary, 4, 5);
  // Boot blocks
  neonRect(ctx, cx - 19 + offx, botY - 6 + offy, 12, 6, DARK_FILL, pal.primary, 1.5, 4, 1);
  neonRect(ctx, cx + 7 + offx, botY - 6 + offy, 12, 6, DARK_FILL, pal.primary, 1.5, 4, 1);
  
  // Torso — massive plate
  const torsoPoints = [
    { x: cx - torsoW / 2 - 4 + offx, y: torsoTop + offy },
    { x: cx + torsoW / 2 + 4 + offx, y: torsoTop + offy },
    { x: cx + torsoW / 2 + offx, y: torsoTop + torsoH + offy },
    { x: cx - torsoW / 2 + offx, y: torsoTop + torsoH + offy },
  ];
  neonPolygon(ctx, torsoPoints, BODY_FILL, pal.primary, 2.5, 12);
  circuitLines(ctx, cx - torsoW / 2 + 5 + offx, torsoTop + 4 + offy, torsoW - 10, torsoH - 8, pal.primary, 0.15);
  
  // Power core (large center glow)
  glowDot(ctx, cx + offx, torsoTop + torsoH * 0.4 + offy, 5, pal.accent, 12);
  
  // Shoulder plates (big)
  neonRect(ctx, cx - torsoW / 2 - 8 + offx, torsoTop - 3 + offy, 12, 12, DARK_FILL, pal.primary, 2, 6, 2);
  neonRect(ctx, cx + torsoW / 2 - 4 + offx, torsoTop - 3 + offy, 12, 12, DARK_FILL, pal.primary, 2, 6, 2);
  
  // Head — heavy helm with horns
  const helmPoints = [
    { x: cx - headW / 2 - 5 + offx, y: headY + offy },  // horn left
    { x: cx - headW / 2 + offx, y: headY - headH + offy },
    { x: cx + headW / 2 + offx, y: headY - headH + offy },
    { x: cx + headW / 2 + 5 + offx, y: headY + offy },  // horn right
    { x: cx + headW / 2 - 2 + offx, y: headY + headH * 0.5 + offy },
    { x: cx - headW / 2 + 2 + offx, y: headY + headH * 0.5 + offy },
  ];
  neonPolygon(ctx, helmPoints, BODY_FILL, pal.primary, 2, 10);
  
  // Horn tips glow
  glowDot(ctx, cx - headW / 2 - 5 + offx, headY + offy, 2, pal.accent, 5);
  glowDot(ctx, cx + headW / 2 + 5 + offx, headY + offy, 2, pal.accent, 5);
  
  // Eyes — menacing, close-set
  glowDot(ctx, cx - 5 + offx, headY - 1 + offy, 3, pal.eye, 10);
  glowDot(ctx, cx + 5 + offx, headY - 1 + offy, 3, pal.eye, 10);
  
  // Arms — massive
  const armAngle = state === 'attack' ? -0.5 + t * 1.8 : 0.4;
  const armLen = 22;
  // Right arm (weapon arm)
  neonLine(ctx,
    cx + torsoW / 2 + 4 + offx, torsoTop + 8 + offy,
    cx + torsoW / 2 + 4 + Math.cos(armAngle) * armLen + offx, torsoTop + 8 + Math.sin(armAngle) * armLen + offy,
    pal.primary, 3.5, 6
  );
  // Left arm
  neonLine(ctx,
    cx - torsoW / 2 - 4 + offx, torsoTop + 8 + offy,
    cx - torsoW / 2 - 14 + offx, torsoTop + 20 + offy,
    pal.primary, 3.5, 6
  );
}

// ═══════════════════════════════════════════════════════════════════
// BOSS — Complex, menacing, crowned
// ═══════════════════════════════════════════════════════════════════
function _drawBoss(ctx, ox, oy, w, h, state, t) {
  const pal = PALETTES.boss;
  const cx = ox + w / 2;
  const botY = oy + h;
  
  const bob = state === 'idle' ? Math.sin(t * Math.PI * 2) * 2 : 0;
  const hitShake = state === 'hit' ? Math.sin(t * Math.PI * 8) * 5 : 0;
  const offx = hitShake;
  const offy = bob;
  
  const headH = h * 0.12;
  const headW = w * 0.4;
  const headY = oy + headH + 12;
  const torsoTop = headY + headH + 2;
  const torsoH = h * 0.38;
  const torsoW = w * 0.65;
  
  // Legs
  neonLine(ctx, cx - 10 + offx, torsoTop + torsoH + offy, cx - 14 + offx, botY + offy, pal.primary, 3, 5);
  neonLine(ctx, cx + 10 + offx, torsoTop + torsoH + offy, cx + 14 + offx, botY + offy, pal.primary, 3, 5);
  neonRect(ctx, cx - 19 + offx, botY - 5 + offy, 12, 5, DARK_FILL, pal.primary, 1.5, 4);
  neonRect(ctx, cx + 7 + offx, botY - 5 + offy, 12, 5, DARK_FILL, pal.primary, 1.5, 4);
  
  // Cape/cloak wisps (behind torso)
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 1;
  ctx.shadowColor = pal.primary;
  ctx.shadowBlur = 8;
  for (let i = -2; i <= 2; i++) {
    const sx = cx + i * 8 + offx;
    ctx.beginPath();
    ctx.moveTo(sx, torsoTop + torsoH * 0.5 + offy);
    ctx.quadraticCurveTo(sx + i * 3, torsoTop + torsoH + 10 + offy, sx + i * 6, botY + 5 + offy);
    ctx.stroke();
  }
  ctx.restore();
  
  // Torso — regal armor
  const torsoPoints = [
    { x: cx - torsoW / 2 - 2 + offx, y: torsoTop + offy },
    { x: cx + torsoW / 2 + 2 + offx, y: torsoTop + offy },
    { x: cx + torsoW / 2 + offx, y: torsoTop + torsoH + offy },
    { x: cx - torsoW / 2 + offx, y: torsoTop + torsoH + offy },
  ];
  neonPolygon(ctx, torsoPoints, BODY_FILL, pal.primary, 2, 12);
  circuitLines(ctx, cx - torsoW / 2 + 4 + offx, torsoTop + 3 + offy, torsoW - 8, torsoH - 6, pal.primary, 0.2);
  
  // Dual power cores
  glowDot(ctx, cx - 8 + offx, torsoTop + torsoH * 0.35 + offy, 3.5, pal.accent, 10);
  glowDot(ctx, cx + 8 + offx, torsoTop + torsoH * 0.35 + offy, 3.5, pal.accent, 10);
  
  // Shoulder plates
  neonRect(ctx, cx - torsoW / 2 - 8 + offx, torsoTop - 4 + offy, 12, 14, DARK_FILL, pal.primary, 2, 7, 2);
  neonRect(ctx, cx + torsoW / 2 - 4 + offx, torsoTop - 4 + offy, 12, 14, DARK_FILL, pal.primary, 2, 7, 2);
  
  // Head — crowned, menacing
  const helmPoints = [
    { x: cx - headW / 2 + offx, y: headY - headH + offy },
    { x: cx + headW / 2 + offx, y: headY - headH + offy },
    { x: cx + headW / 2 + 2 + offx, y: headY + headH * 0.4 + offy },
    { x: cx - headW / 2 - 2 + offx, y: headY + headH * 0.4 + offy },
  ];
  neonPolygon(ctx, helmPoints, BODY_FILL, pal.primary, 2, 10);
  
  // Crown spikes (3 points)
  const crownY = headY - headH + offy;
  neonLine(ctx, cx - 8 + offx, crownY, cx - 10 + offx, crownY - 10, pal.accent, 1.5, 6);
  neonLine(ctx, cx + offx, crownY, cx + offx, crownY - 13, pal.accent, 1.5, 6);
  neonLine(ctx, cx + 8 + offx, crownY, cx + 10 + offx, crownY - 10, pal.accent, 1.5, 6);
  glowDot(ctx, cx - 10 + offx, crownY - 10, 2, pal.accent, 5);
  glowDot(ctx, cx + offx, crownY - 13, 2.5, pal.accent, 6);
  glowDot(ctx, cx + 10 + offx, crownY - 10, 2, pal.accent, 5);
  
  // Eyes — intense, three-eyed
  glowDot(ctx, cx - 6 + offx, headY - 2 + offy, 2.5, pal.eye, 10);
  glowDot(ctx, cx + offx, headY - 4 + offy, 2, pal.eye, 8);  // third eye
  glowDot(ctx, cx + 6 + offx, headY - 2 + offy, 2.5, pal.eye, 10);
  
  // Arms with energy weapons
  const armAngle = state === 'attack' ? -0.6 + t * 2.0 : 0.3;
  const armLen = 20;
  const bladeLen = 18;
  
  // Right arm + blade
  const rElbowX = cx + torsoW / 2 + 4 + Math.cos(armAngle) * armLen + offx;
  const rElbowY = torsoTop + 8 + Math.sin(armAngle) * armLen + offy;
  neonLine(ctx, cx + torsoW / 2 + 4 + offx, torsoTop + 8 + offy, rElbowX, rElbowY, pal.primary, 3, 6);
  energyBlade(ctx, rElbowX, rElbowY,
    rElbowX + Math.cos(armAngle - 0.2) * bladeLen,
    rElbowY + Math.sin(armAngle - 0.2) * bladeLen,
    pal.accent, 2.5
  );
  
  // Left arm
  neonLine(ctx, cx - torsoW / 2 - 4 + offx, torsoTop + 8 + offy, cx - torsoW / 2 - 16 + offx, torsoTop + 22 + offy, pal.primary, 3, 6);
}
