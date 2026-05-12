/**
 * KEYSTRIKE — Particle System
 * 
 * Lightweight particle system for neon cyberpunk effects.
 * Handles: hit sparks, spell effects, combo flashes, ambient glow.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
  }

  /**
   * Spawn particles with a configuration.
   */
  emit(config) {
    const {
      x, y,
      count = 10,
      color = '#00ffc8',
      colors = null,
      speed = 2,
      speedVariance = 1,
      size = 3,
      sizeVariance = 2,
      life = 600,
      lifeVariance = 200,
      gravity = 0,
      drag = 0.98,
      angle = 0,          // direction in radians
      spread = Math.PI * 2, // cone width
      shape = 'circle',   // 'circle' | 'line' | 'square'
      glow = true,
      fadeOut = true,
    } = config;

    const colorList = colors || [color];

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Recycle oldest
        this.particles.shift();
      }

      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed + (Math.random() - 0.5) * speedVariance;
      const sz = Math.max(1, size + (Math.random() - 0.5) * sizeVariance);
      const l = Math.max(100, life + (Math.random() - 0.5) * lifeVariance);

      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: sz,
        originalSize: sz,
        life: l,
        maxLife: l,
        color: colorList[Math.floor(Math.random() * colorList.length)],
        gravity,
        drag,
        shape,
        glow,
        fadeOut,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
      });
    }
  }

  /**
   * Update all particles.
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * (dt / 16);
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.rotation += p.rotationSpeed;
      if (p.fadeOut) {
        const lifeRatio = p.life / p.maxLife;
        p.size = p.originalSize * lifeRatio;
      }
    }
  }

  /**
   * Render all particles to a canvas context.
   */
  render(ctx) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.fadeOut ? (p.life / p.maxLife) : 1;
      ctx.globalAlpha = alpha;

      if (p.glow) {
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.shape === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, p.size / 2);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Prebuilt effect: Hit sparks
   */
  hitSpark(x, y, color = '#00ffc8', direction = -Math.PI / 2) {
    this.emit({
      x, y, count: 15,
      colors: [color, '#ffffff', color],
      speed: 5, speedVariance: 3,
      size: 3, sizeVariance: 2,
      life: 400, lifeVariance: 200,
      angle: direction, spread: Math.PI * 0.8,
      drag: 0.95, gravity: 0.1,
      shape: 'line', glow: true,
    });
  }

  /**
   * Prebuilt effect: Spell cast
   */
  spellBurst(x, y, color = '#ff00aa') {
    this.emit({
      x, y, count: 25,
      colors: [color, '#ffffff'],
      speed: 3, speedVariance: 2,
      size: 4, sizeVariance: 2,
      life: 600, lifeVariance: 300,
      spread: Math.PI * 2,
      drag: 0.96, gravity: -0.05,
      shape: 'circle', glow: true,
    });
  }

  /**
   * Prebuilt effect: Combo flash
   */
  comboFlash(x, y) {
    this.emit({
      x, y, count: 30,
      colors: ['#ffaa00', '#ff6600', '#ffff00', '#ffffff'],
      speed: 6, speedVariance: 4,
      size: 4, sizeVariance: 3,
      life: 500, lifeVariance: 200,
      spread: Math.PI * 2,
      drag: 0.94, gravity: 0,
      shape: 'line', glow: true,
    });
  }

  /**
   * Prebuilt effect: Damage numbers (just a small pop)
   */
  damagePop(x, y, color = '#ff4444') {
    this.emit({
      x, y, count: 6,
      color,
      speed: 2, speedVariance: 1,
      size: 2, sizeVariance: 1,
      life: 300, lifeVariance: 100,
      angle: -Math.PI / 2, spread: Math.PI * 0.5,
      drag: 0.97, gravity: 0,
      glow: true,
    });
  }

  /**
   * Prebuilt: Heal effect
   */
  healEffect(x, y) {
    this.emit({
      x, y, count: 20,
      colors: ['#00ff88', '#00ffcc', '#88ffaa'],
      speed: 1.5, speedVariance: 1,
      size: 3, sizeVariance: 2,
      life: 800, lifeVariance: 300,
      angle: -Math.PI / 2, spread: Math.PI * 0.6,
      drag: 0.99, gravity: -0.08,
      shape: 'circle', glow: true,
    });
  }

  clear() {
    this.particles = [];
  }
}
