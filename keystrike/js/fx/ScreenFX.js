/**
 * KEYSTRIKE — Screen Effects
 * 
 * Screen shake, flash, CRT scanlines, vignette.
 */
export class ScreenFX {
  constructor() {
    // Shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;

    // Flash
    this.flashColor = '#ffffff';
    this.flashAlpha = 0;
    this.flashDuration = 0;
    this.flashTimer = 0;

    // Floating damage texts
    this.floatingTexts = [];

    // Scanline settings
    this.scanlineOpacity = 0.04;
    this.scanlineSpeed = 0.5;
    this.scanlineOffset = 0;
  }

  shake(intensity = 8, duration = 200) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  flash(color = '#ffffff', duration = 150) {
    this.flashColor = color;
    this.flashAlpha = 0.4;
    this.flashDuration = duration;
    this.flashTimer = duration;
  }

  addFloatingText(text, x, y, color = '#ffffff', size = 20) {
    this.floatingTexts.push({
      text, x, y, color, size,
      life: 1200,
      maxLife: 1200,
      vy: -1.5,
    });
  }

  update(dt) {
    // Shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = this.shakeTimer / this.shakeDuration;
      const intensity = this.shakeIntensity * progress;
      this.shakeX = (Math.random() - 0.5) * 2 * intensity;
      this.shakeY = (Math.random() - 0.5) * 2 * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashAlpha = 0.4 * (this.flashTimer / this.flashDuration);
    } else {
      this.flashAlpha = 0;
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * (dt / 16);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Scanlines
    this.scanlineOffset += this.scanlineSpeed * (dt / 16);
    if (this.scanlineOffset > 4) this.scanlineOffset -= 4;
  }

  applyPreTransform(ctx) {
    if (this.shakeX !== 0 || this.shakeY !== 0) {
      ctx.translate(this.shakeX, this.shakeY);
    }
  }

  renderOverlay(ctx, width, height) {
    // Scanlines
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${this.scanlineOpacity})`;
    for (let y = this.scanlineOffset; y < height; y += 4) {
      ctx.fillRect(0, y, width, 2);
    }
    ctx.restore();

    // Flash overlay
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Vignette
    ctx.save();
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.3,
      width / 2, height / 2, height * 0.85
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Floating texts
    ctx.save();
    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.3));
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${ft.size}px 'Courier New', monospace`;
      ctx.fillStyle = ft.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }
}
