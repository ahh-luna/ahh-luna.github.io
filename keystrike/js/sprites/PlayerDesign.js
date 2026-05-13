/**
 * KEYSTRIKE — PlayerDesign
 * 
 * Drawing routines for the player character.
 * Cyberpunk warrior with visor helmet, armored torso, energy blade.
 * 
 * Color palette: Cyan (#00ffc8) primary, white highlights
 */
import { neonPolygon, neonCircle, neonLine, neonRect, circuitLines, glowDot, energyBlade, shieldArc, spellOrb } from './DrawUtils.js';

const PRIMARY = '#00ffc8';
const ACCENT = '#00aaff';
const BODY_FILL = '#080818';
const DARK_FILL = '#050510';
const VISOR = '#00ffc8';

export const PLAYER_STATES = ['idle', 'attack', 'defend', 'cast', 'hit', 'death'];

/**
 * Draw the player character.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} ox - origin x (top-left of sprite area, excluding glow pad)
 * @param {number} oy - origin y
 * @param {number} w - sprite width
 * @param {number} h - sprite height
 * @param {string} state - animation state
 * @param {number} t - 0-1 animation progress within state
 */
export function drawPlayer(ctx, ox, oy, w, h, state, t) {
  const cx = ox + w / 2;
  const botY = oy + h;
  
  // Proportions
  const headR = w * 0.2;
  const headY = oy + headR + 2;
  const torsoTop = headY + headR + 2;
  const torsoH = h * 0.35;
  const torsoW = w * 0.55;
  const torsoBot = torsoTop + torsoH;
  const legLen = h * 0.28;
  
  // Idle bob
  const bob = state === 'idle' ? Math.sin(t * Math.PI * 2) * 2 : 0;
  const offy = bob;
  
  // --- LEGS ---
  const legSpread = state === 'attack' ? 10 : state === 'defend' ? 12 : 6;
  neonLine(ctx, cx - legSpread, torsoBot + offy, cx - legSpread - 2, botY, PRIMARY, 3, 4);
  neonLine(ctx, cx + legSpread, torsoBot + offy, cx + legSpread + 2, botY, PRIMARY, 3, 4);
  
  // Boot accents
  neonLine(ctx, cx - legSpread - 5, botY - 2, cx - legSpread + 3, botY - 2, ACCENT, 2, 3);
  neonLine(ctx, cx + legSpread - 3, botY - 2, cx + legSpread + 5, botY - 2, ACCENT, 2, 3);
  
  // --- TORSO ---
  const torsoPoints = [
    { x: cx - torsoW / 2 - 3, y: torsoTop + offy },      // top-left (shoulder)
    { x: cx + torsoW / 2 + 3, y: torsoTop + offy },      // top-right
    { x: cx + torsoW / 2, y: torsoBot + offy },           // bottom-right
    { x: cx - torsoW / 2, y: torsoBot + offy },           // bottom-left
  ];
  neonPolygon(ctx, torsoPoints, BODY_FILL, PRIMARY, 2, 10);
  
  // Shoulder pads
  neonRect(ctx, cx - torsoW / 2 - 6, torsoTop + offy - 2, 8, 6, DARK_FILL, PRIMARY, 1.5, 5, 2);
  neonRect(ctx, cx + torsoW / 2 - 2, torsoTop + offy - 2, 8, 6, DARK_FILL, PRIMARY, 1.5, 5, 2);
  
  // Circuit detail on torso
  circuitLines(ctx, cx - torsoW / 2 + 3, torsoTop + 3 + offy, torsoW - 6, torsoH - 6, PRIMARY, 0.2);
  
  // Core energy (center chest)
  glowDot(ctx, cx, torsoTop + torsoH * 0.35 + offy, 3, ACCENT, 8);
  
  // --- HEAD ---
  // Helmet (angular)
  const helmetPoints = [
    { x: cx - headR - 2, y: headY + offy },
    { x: cx - headR + 2, y: headY - headR - 2 + offy },
    { x: cx + headR - 2, y: headY - headR - 2 + offy },
    { x: cx + headR + 2, y: headY + offy },
    { x: cx + headR - 1, y: headY + headR * 0.5 + offy },
    { x: cx - headR + 1, y: headY + headR * 0.5 + offy },
  ];
  neonPolygon(ctx, helmetPoints, BODY_FILL, PRIMARY, 2, 10);
  
  // Visor (horizontal glowing slit)
  neonLine(ctx, cx - headR + 3, headY - 1 + offy, cx + headR - 3, headY - 1 + offy, VISOR, 2.5, 12);
  
  // Antenna/crest
  neonLine(ctx, cx, headY - headR - 2 + offy, cx, headY - headR - 8 + offy, ACCENT, 1.5, 6);
  glowDot(ctx, cx, headY - headR - 8 + offy, 1.5, ACCENT, 6);
  
  // --- ARMS / WEAPON ---
  _drawArms(ctx, cx, torsoTop, torsoW, torsoH, offy, state, t);
}

function _drawArms(ctx, cx, torsoTop, torsoW, torsoH, offy, state, t) {
  const shoulderR = cx + torsoW / 2 + 3;
  const shoulderL = cx - torsoW / 2 - 3;
  const shoulderY = torsoTop + 8 + offy;
  
  if (state === 'attack') {
    // Right arm — energy blade swing
    const swingAngle = -0.8 + t * 2.2;  // winds up then slashes
    const armLen = 18;
    const bladeLen = 22;
    const elbowX = shoulderR + Math.cos(swingAngle) * armLen;
    const elbowY = shoulderY + Math.sin(swingAngle) * armLen;
    const tipX = elbowX + Math.cos(swingAngle - 0.3) * bladeLen;
    const tipY = elbowY + Math.sin(swingAngle - 0.3) * bladeLen;
    
    // Arm
    neonLine(ctx, shoulderR, shoulderY, elbowX, elbowY, PRIMARY, 2.5, 5);
    // Energy blade
    energyBlade(ctx, elbowX, elbowY, tipX, tipY, '#00ffc8', 3);
    
    // Left arm braced back
    neonLine(ctx, shoulderL, shoulderY, shoulderL - 10, shoulderY + 12, PRIMARY, 2.5, 4);
    
  } else if (state === 'defend') {
    // Shield arm forward
    const shieldX = shoulderR + 18;
    const shieldY = torsoTop + torsoH / 2 + offy;
    neonLine(ctx, shoulderR, shoulderY, shieldX, shieldY, PRIMARY, 2.5, 5);
    shieldArc(ctx, shieldX + 5, shieldY, 16, -Math.PI * 0.6, Math.PI * 0.6, ACCENT, 3);
    
    // Left arm supporting
    neonLine(ctx, shoulderL, shoulderY, shoulderL - 5, shoulderY + 15, PRIMARY, 2.5, 4);
    
  } else if (state === 'cast') {
    // Both arms forward, orb between hands
    const handR_X = shoulderR + 14;
    const handL_X = shoulderL - 14;
    const handY = torsoTop + torsoH * 0.3 + offy;
    neonLine(ctx, shoulderR, shoulderY, handR_X, handY, PRIMARY, 2.5, 5);
    neonLine(ctx, shoulderL, shoulderY, handL_X, handY, PRIMARY, 2.5, 5);
    
    // Spell orb between hands
    const orbX = cx;
    const orbY = handY;
    spellOrb(ctx, orbX, orbY, 6 + t * 4, '#aa66ff', t * Math.PI * 4);
    
  } else if (state === 'hit') {
    // Arms flinch back
    neonLine(ctx, shoulderR, shoulderY, shoulderR - 5, shoulderY + 15, PRIMARY, 2.5, 4);
    neonLine(ctx, shoulderL, shoulderY, shoulderL + 5, shoulderY + 15, PRIMARY, 2.5, 4);
    
  } else {
    // Idle — right arm with blade at rest, slight sway
    const idleSway = Math.sin(t * Math.PI * 2) * 2;
    const elbowX = shoulderR + 10;
    const elbowY = shoulderY + 14 + idleSway;
    neonLine(ctx, shoulderR, shoulderY, elbowX, elbowY, PRIMARY, 2.5, 4);
    // Blade pointing down
    energyBlade(ctx, elbowX, elbowY, elbowX + 3, elbowY + 16, '#00ffc8', 2);
    
    // Left arm idle
    neonLine(ctx, shoulderL, shoulderY, shoulderL - 8, shoulderY + 14 - idleSway, PRIMARY, 2.5, 4);
  }
}
