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

  render(ctx, spriteFactory) {
    ctx.save();

    // Dodge offset
    let offsetX = 0;
    if (this.state === 'dodging') {
      offsetX = -40 * Math.sin(this.attackAnim * Math.PI);
    }

    const cx = this.x + offsetX;
    const cy = this.y;

    // Hurt flash
    const isHurt = this.state === 'hurt';
    const alpha = isHurt ? (0.5 + Math.sin(this.stateTimer * 0.05) * 0.5) : 1;

    // Map game state to sprite state
    let spriteState = 'idle';
    let progress = 0;
    switch (this.state) {
      case 'attacking': spriteState = 'attack'; progress = this.attackAnim; break;
      case 'blocking':  spriteState = 'defend'; progress = 0; break;
      case 'dodging':   spriteState = 'defend'; progress = this.attackAnim; break;
      case 'casting':   spriteState = 'cast';   progress = this.attackAnim; break;
      case 'hurt':      spriteState = 'hit';    progress = this.attackAnim; break;
      default:          spriteState = 'idle';    progress = (this.idleBob % (Math.PI * 2)) / (Math.PI * 2); break;
    }

    if (spriteFactory && spriteFactory.ready) {
      spriteFactory.draw(ctx, 'player', spriteState, progress, cx, cy, {
        alpha,
        tint: isHurt ? '#ff0044' : null,
        tintAlpha: isHurt ? 0.4 : 0,
      });
    }

    ctx.restore();
  }
}
