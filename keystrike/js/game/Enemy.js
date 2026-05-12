/**
 * KEYSTRIKE — Enemy Entity
 * 
 * Enemies approach the player and attack periodically.
 * Each has a TARGET WORD above their head for the typing system.
 */
export class Enemy {
  constructor(config) {
    this.id = config.id;
    this.word = config.word;         // Target word shown above head
    this.x = config.x;
    this.y = config.y;
    this.baseY = config.y;
    this.targetX = config.targetX || 300; // Where to walk toward

    // Stats
    this.hp = config.hp || 50;
    this.maxHp = config.hp || 50;
    this.damage = config.damage || 10;
    this.speed = config.speed || 0.3;
    this.attackCooldown = config.attackCooldown || 3000;
    this.tier = config.tier || 'easy'; // 'easy' | 'medium' | 'hard' | 'boss'

    // State
    this.alive = true;
    this.state = 'approaching';  // 'approaching' | 'idle' | 'telegraphing' | 'attacking' | 'hurt' | 'dying'
    this.stateTimer = 0;
    this.stateDuration = 0;
    this.attackTimer = this.attackCooldown * (0.5 + Math.random() * 0.5);
    this.telegraphDuration = 1200;

    // Visual
    this.width = 30 + (this.tier === 'boss' ? 20 : this.tier === 'hard' ? 10 : 0);
    this.height = 45 + (this.tier === 'boss' ? 30 : this.tier === 'hard' ? 10 : 0);
    this.color = this._tierColor();
    this.glowColor = this.color;
    this.idleBob = Math.random() * Math.PI * 2;
    this.deathAnim = 0;
    this.hurtFlash = 0;
    this.reachedPosition = false;

    // Targeting
    this.isTargetedBy = false; // Visual indicator when player is typing this target
  }

  _tierColor() {
    switch (this.tier) {
      case 'easy': return '#ff4466';
      case 'medium': return '#ff6600';
      case 'hard': return '#ff00aa';
      case 'boss': return '#ff0000';
      default: return '#ff4466';
    }
  }

  update(dt) {
    if (!this.alive) {
      this.deathAnim += dt * 0.003;
      return;
    }

    this.idleBob += dt * 0.003;
    this.y = this.baseY + Math.sin(this.idleBob) * 2;

    // Approach player
    if (this.state === 'approaching') {
      const dx = this.targetX - this.x;
      if (Math.abs(dx) > 5) {
        this.x += Math.sign(dx) * this.speed * (dt / 16);
      } else {
        this.state = 'idle';
        this.reachedPosition = true;
      }
    }

    // State timer
    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state === 'telegraphing') {
          // Execute attack
          this.state = 'attacking';
          this.stateTimer = 400;
          this.stateDuration = 400;
        } else if (this.state === 'attacking') {
          this.state = 'idle';
        } else if (this.state === 'hurt') {
          this.state = 'idle';
        }
      }
    }

    // Hurt flash decay
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt * 0.005;
    }

    // Attack timer (only when idle and in position)
    if (this.state === 'idle' && this.reachedPosition) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.startTelegraph();
      }
    }
  }

  startTelegraph() {
    this.state = 'telegraphing';
    this.stateTimer = this.telegraphDuration;
    this.stateDuration = this.telegraphDuration;
    this.glowColor = '#ff0000';
  }

  /**
   * Returns true if the attack hits (used by combat manager).
   */
  isAttacking() {
    return this.state === 'attacking' && this.stateTimer > 200;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 1;
    this.state = 'hurt';
    this.stateTimer = 200;

    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dying';
    }
    return this.hp <= 0;
  }

  render(ctx) {
    ctx.save();
    const cx = this.x;
    const cy = this.y;

    // Death animation
    if (!this.alive) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathAnim);
      if (this.deathAnim > 1) {
        ctx.restore();
        return;
      }
      ctx.translate(cx, cy);
      ctx.scale(1 + this.deathAnim * 0.5, 1 + this.deathAnim * 0.5);
      ctx.translate(-cx, -cy);
    }

    // Glow
    const glowColor = this.state === 'telegraphing' || this.state === 'attacking'
      ? '#ff0000'
      : this.isTargetedBy ? '#ffff00' : this.color;
    ctx.shadowBlur = this.state === 'telegraphing' ? 25 : 12;
    ctx.shadowColor = glowColor;

    // Hurt flash
    if (this.hurtFlash > 0) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#ffffff';
    }

    // Body
    ctx.fillStyle = '#0a0a1a';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;

    // Enemy shape — more angular/aggressive than player
    const hw = this.width / 2;
    const hh = this.height / 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy - hh - 5);
    ctx.lineTo(cx + hw + 3, cy - hh + 10);
    ctx.lineTo(cx + hw, cy + hh);
    ctx.lineTo(cx - hw, cy + hh);
    ctx.lineTo(cx - hw - 3, cy - hh + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner lines
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = (this.alive ? 0.3 : 0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw + 5, cy - 5);
    ctx.lineTo(cx + hw - 5, cy - 5);
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx, cy + hh);
    ctx.stroke();
    ctx.globalAlpha = this.alive ? 1 : Math.max(0, 1 - this.deathAnim);

    // Eyes (menacing)
    ctx.fillStyle = glowColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(cx - 8, cy - hh + 15, 5, 3);
    ctx.fillRect(cx + 3, cy - hh + 15, 5, 3);

    // Telegraph warning indicator
    if (this.state === 'telegraphing') {
      const progress = 1 - (this.stateTimer / this.stateDuration);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(progress * Math.PI * 6) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, this.width + 10 + Math.sin(progress * Math.PI * 4) * 5, 0, Math.PI * 2 * progress);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // "!" warning
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff0000';
      ctx.fillText('!', cx, cy - hh - 25);
    }

    // Target word above head
    if (this.alive) {
      const wordY = cy - hh - (this.state === 'telegraphing' ? 40 : 15);
      ctx.font = `bold ${this.tier === 'boss' ? 16 : 13}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.isTargetedBy ? '#ffff00' : glowColor;
      ctx.shadowBlur = 10;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillText(this.word, cx, wordY);
    }

    // HP bar
    if (this.alive && this.hp < this.maxHp) {
      const barW = this.width + 10;
      const barH = 3;
      const barX = cx - barW / 2;
      const barY = cy + hh + 8;
      const hpRatio = this.hp / this.maxHp;

      ctx.fillStyle = '#1a1a2f';
      ctx.shadowBlur = 0;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#ff4466' : '#ff0000';
      ctx.shadowBlur = 4;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    ctx.restore();
  }
}
