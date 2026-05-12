/**
 * KEYSTRIKE — Player Entity
 */
export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;

    // Animation state
    this.state = 'idle';       // 'idle' | 'attacking' | 'blocking' | 'dodging' | 'hurt' | 'casting'
    this.stateTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.idleBob = 0;

    // Combat state
    this.blocking = false;
    this.blockTimer = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;

    // Attack animation
    this.attackTarget = null;    // {x, y} of target for slash direction
    this.attackAnim = 0;         // 0-1 progress

    // Visual
    this.width = 40;
    this.height = 60;
    this.color = '#00ffc8';
    this.glowColor = '#00ffc8';
    this.facing = 1; // 1 = right
  }

  update(dt) {
    // Idle bob
    this.idleBob += dt * 0.003;
    this.y = this.baseY + Math.sin(this.idleBob) * 3;

    // State timers
    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      this.attackAnim = 1 - (this.stateTimer / this.stateDuration);
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.attackAnim = 0;
        this.glowColor = '#00ffc8';
      }
    }

    // Block timer
    if (this.blockTimer > 0) {
      this.blockTimer -= dt;
      if (this.blockTimer <= 0) this.blocking = false;
    }

    // Invulnerable timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) this.invulnerable = false;
    }
  }

  takeDamage(amount) {
    if (this.invulnerable) return 0;
    
    let finalDamage = amount;
    if (this.blocking) {
      finalDamage = Math.floor(amount * 0.4);
    }
    
    this.hp = Math.max(0, this.hp - finalDamage);
    if (this.hp <= 0) this.alive = false;

    // Hurt animation
    if (!this.blocking) {
      this.setState('hurt', 300);
    }

    return finalDamage;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  setState(state, duration = 400) {
    this.state = state;
    this.stateTimer = duration;
    this.stateDuration = duration;
    this.attackAnim = 0;

    switch (state) {
      case 'attacking':
        this.glowColor = '#ff6600';
        break;
      case 'casting':
        this.glowColor = '#ff00aa';
        break;
      case 'blocking':
        this.glowColor = '#00aaff';
        this.blocking = true;
        this.blockTimer = duration;
        break;
      case 'dodging':
        this.glowColor = '#ffff00';
        this.invulnerable = true;
        this.invulnerableTimer = duration;
        break;
      case 'hurt':
        this.glowColor = '#ff0044';
        break;
      default:
        this.glowColor = '#00ffc8';
    }
  }

  render(ctx) {
    ctx.save();
    const drawX = this.x;
    const drawY = this.y;

    // Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.glowColor;

    // Body
    const bodyW = this.width;
    const bodyH = this.height;

    // Hurt flash
    if (this.state === 'hurt') {
      ctx.globalAlpha = 0.5 + Math.sin(this.stateTimer * 0.05) * 0.5;
    }

    // Dodge offset
    let offsetX = 0;
    if (this.state === 'dodging') {
      offsetX = -40 * Math.sin(this.attackAnim * Math.PI);
    }

    // Draw cyberpunk warrior
    const cx = drawX + offsetX;
    const cy = drawY;

    // Legs
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + bodyH / 2);
    ctx.lineTo(cx - 4, cy + bodyH / 2 + 20);
    ctx.moveTo(cx + 8, cy + bodyH / 2);
    ctx.lineTo(cx + 4, cy + bodyH / 2 + 20);
    ctx.stroke();

    // Body (rectangle with neon edge)
    ctx.fillStyle = '#0a0a1a';
    ctx.strokeStyle = this.glowColor;
    ctx.lineWidth = 2;
    ctx.fillRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH);
    ctx.strokeRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH);

    // Inner detail lines
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW / 2 + 5, cy - bodyH / 2 + 10);
    ctx.lineTo(cx + bodyW / 2 - 5, cy - bodyH / 2 + 10);
    ctx.moveTo(cx, cy - bodyH / 2);
    ctx.lineTo(cx, cy + bodyH / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = '#0a0a1a';
    ctx.strokeStyle = this.glowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - bodyH / 2 - 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Visor (eye line)
    ctx.strokeStyle = this.glowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - bodyH / 2 - 13);
    ctx.lineTo(cx + 8, cy - bodyH / 2 - 13);
    ctx.stroke();

    // Arm / weapon
    ctx.strokeStyle = this.glowColor;
    ctx.lineWidth = 2.5;
    if (this.state === 'attacking' && this.attackTarget) {
      // Swing arm toward target
      const angle = Math.atan2(
        this.attackTarget.y - cy,
        this.attackTarget.x - cx
      );
      const swingAngle = angle + Math.sin(this.attackAnim * Math.PI) * 1.2;
      const armLen = 35;
      ctx.beginPath();
      ctx.moveTo(cx + bodyW / 2, cy - 5);
      ctx.lineTo(
        cx + bodyW / 2 + Math.cos(swingAngle) * armLen,
        cy - 5 + Math.sin(swingAngle) * armLen
      );
      ctx.stroke();

      // Blade glow
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + bodyW / 2, cy - 5);
      ctx.lineTo(
        cx + bodyW / 2 + Math.cos(swingAngle) * armLen,
        cy - 5 + Math.sin(swingAngle) * armLen
      );
      ctx.stroke();
    } else if (this.state === 'blocking') {
      // Shield arm
      ctx.fillStyle = this.glowColor;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(cx + bodyW / 2 + 15, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = this.glowColor;
      ctx.beginPath();
      ctx.arc(cx + bodyW / 2 + 15, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Idle arm
      ctx.beginPath();
      ctx.moveTo(cx + bodyW / 2, cy - 5);
      ctx.lineTo(cx + bodyW / 2 + 15, cy + 10);
      ctx.stroke();
    }

    // HP bar above
    const barW = 50;
    const barH = 4;
    const barX = cx - barW / 2;
    const barY = cy - bodyH / 2 - 32;
    const hpRatio = this.hp / this.maxHp;
    
    ctx.fillStyle = '#1a1a2f';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpRatio > 0.5 ? '#00ff88' : hpRatio > 0.25 ? '#ffaa00' : '#ff4444';
    ctx.shadowBlur = 5;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    ctx.restore();
  }
}
