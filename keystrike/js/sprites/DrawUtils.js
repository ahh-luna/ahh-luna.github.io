/**
 * KEYSTRIKE — DrawUtils
 * 
 * Shared drawing utilities for the sprite system.
 * Provides neon glow effects, circuit patterns, body-part helpers.
 */

/**
 * Create an offscreen canvas of given size.
 */
export function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}

/**
 * Draw a neon-outlined polygon.
 * Points: [{x, y}, ...]
 */
export function neonPolygon(ctx, points, fillColor, strokeColor, lineWidth, glowSize) {
  ctx.save();
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = glowSize || 8;
  ctx.fillStyle = fillColor || '#0a0a1a';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth || 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a neon circle/ellipse.
 */
export function neonCircle(ctx, x, y, r, fillColor, strokeColor, lineWidth, glowSize) {
  ctx.save();
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = glowSize || 8;
  ctx.fillStyle = fillColor || '#0a0a1a';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth || 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a neon line with glow.
 */
export function neonLine(ctx, x1, y1, x2, y2, color, lineWidth, glowSize) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glowSize || 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth || 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a neon rectangle with optional rounded corners.
 */
export function neonRect(ctx, x, y, w, h, fillColor, strokeColor, lineWidth, glowSize, radius) {
  ctx.save();
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = glowSize || 8;
  ctx.fillStyle = fillColor || '#0a0a1a';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth || 2;
  ctx.beginPath();
  if (radius && ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw circuit-line detail pattern on a rectangular area.
 */
export function circuitLines(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha || 0.25;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  
  // Horizontal lines
  const hLines = 3;
  for (let i = 1; i <= hLines; i++) {
    const ly = y + (h / (hLines + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(x + 4, ly);
    ctx.lineTo(x + w - 4, ly);
    ctx.stroke();
  }
  
  // Vertical center
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 3);
  ctx.lineTo(x + w / 2, y + h - 3);
  ctx.stroke();
  
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draw a glowing dot (for eyes, indicators, etc.)
 */
export function glowDot(ctx, x, y, r, color, glowSize) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glowSize || 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Double draw for brighter glow
  ctx.fill();
  ctx.restore();
}

/**
 * Draw an energy blade line with intense glow.
 */
export function energyBlade(ctx, x1, y1, x2, y2, color, width) {
  ctx.save();
  // Outer glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Inner bright core
  ctx.shadowBlur = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = (width || 3) * 0.4;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a shield/barrier arc.
 */
export function shieldArc(ctx, x, y, r, startAngle, endAngle, color, lineWidth) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth || 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, startAngle, endAngle);
  ctx.stroke();
  // Inner
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, startAngle, endAngle);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a spell orb with pulsing glow.
 */
export function spellOrb(ctx, x, y, r, color, phase) {
  const pulse = 1 + Math.sin(phase || 0) * 0.2;
  ctx.save();
  // Outer glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 20 * pulse;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.5 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Core
  ctx.globalAlpha = 0.8;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Bright center
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
