/**
 * KEYSTRIKE — Renderer
 * 
 * Neon cyberpunk canvas renderer. Draws the arena, characters,
 * HUD, terminal input, and all visual effects.
 */
export class Renderer {
  constructor(canvas, eventBus, logicalWidth, logicalHeight) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.eventBus = eventBus;

    // Use logical dimensions (not canvas.width which is scaled by DPR)
    this.width = logicalWidth || 900;
    this.height = logicalHeight || 500;
    this.groundY = Math.round(this.height * 0.72);

    // Visual state
    this.screenShake = 0;
    this.screenShakeIntensity = 0;
    this.flashOverlay = 0;
    this.flashColor = '#fff';
    this.time = 0;

    // Grid animation
    this.gridOffset = 0;

    // Cache
    this.inputBuffer = '';
    this.inputPartial = null;
    this.wpm = 0;
    this.comboCount = 0;
    this.accuracy = 1;

    // Subscribe to events for effects
    this.eventBus.on('combat:attack', () => this.shake(4, 150));
    this.eventBus.on('combat:playerHit', () => {
      this.shake(8, 200);
      this.flash('#ff0000', 150);
    });
    this.eventBus.on('enemy:killed', () => this.flash('#00ffc8', 100));
    this.eventBus.on('combo:triggered', () => {
      this.shake(6, 200);
      this.flash('#ffaa00', 200);
    });
    this.eventBus.on('combo:speed', () => this.flash('#ff00aa', 150));
    this.eventBus.on('player:death', () => this.flash('#ff0000', 500));
    this.eventBus.on('wave:start', () => this.flash('#00aaff', 200));

    this.eventBus.on('input:bufferChange', ({ buffer, partial, currentAccuracy }) => {
      this.inputBuffer = buffer;
      this.inputPartial = partial;
      this.accuracy = currentAccuracy;
    });
    this.eventBus.on('input:execute', () => { this.inputBuffer = ''; this.inputPartial = null; });
    this.eventBus.on('input:cancel', () => { this.inputBuffer = ''; this.inputPartial = null; });
    this.eventBus.on('input:metricsUpdate', ({ wpm, comboCount }) => {
      this.wpm = wpm;
      this.comboCount = comboCount;
    });
  }

  shake(intensity, duration) {
    this.screenShake = duration;
    this.screenShakeIntensity = intensity;
  }

  flash(color, duration) {
    this.flashColor = color;
    this.flashOverlay = duration;
  }

  render(interpolation, now, game) {
    const ctx = this.ctx;
    this.time = now;

    // Update effects
    const dt = 16; // ~60fps
    if (this.screenShake > 0) this.screenShake -= dt;
    if (this.flashOverlay > 0) this.flashOverlay -= dt;

    // Apply screen shake
    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShakeIntensity;
      const sy = (Math.random() - 0.5) * this.screenShakeIntensity;
      ctx.translate(sx, sy);
    }

    // Background
    this._drawBackground(ctx, now);

    // Game entities
    if (game) {
      this._drawPlayer(ctx, game.player, now);
      this._drawEnemies(ctx, game.spawner.enemies, now);
      this._drawDamageNumbers(ctx, game.combatManager);
      this._drawHUD(ctx, game.player, game.spawner, game.grammar);
      this._drawInputBar(ctx, game.spawner);
      this._drawWaveInfo(ctx, game.spawner, game.combatManager);
    }

    // Flash overlay
    if (this.flashOverlay > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = (this.flashOverlay / 300) * 0.15;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    // CRT scanline effect
    this._drawScanlines(ctx);

    // Vignette
    this._drawVignette(ctx);

    ctx.restore();
  }

  // ─── Background ─────────────────────────────────────────────────

  _drawBackground(ctx, now) {
    // Dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#06060f');
    grad.addColorStop(1, '#0a0a18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Animated grid floor
    this._drawGrid(ctx, now);

    // Ground line
    ctx.strokeStyle = '#00ffc820';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY + 30);
    ctx.lineTo(this.width, this.groundY + 30);
    ctx.stroke();
  }

  _drawGrid(ctx, now) {
    const gridY = this.groundY + 30;
    const perspective = 0.7;
    this.gridOffset = (now * 0.01) % 40;

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 0.5;

    // Horizontal lines
    for (let i = 0; i < 8; i++) {
      const y = gridY + i * 20 * (1 + i * perspective * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Vertical lines (converging)
    const cx = this.width / 2;
    for (let i = -12; i <= 12; i++) {
      const x = cx + i * (40 + this.gridOffset * 0.1);
      const bx = cx + i * 120;
      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(bx, this.height);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── Player ─────────────────────────────────────────────────────

  _drawPlayer(ctx, player, now) {
    const x = player.x;
    const y = this.groundY - 10;
    const glow = player.state === 'attacking' ? 20 : player.state === 'casting' ? 15 : 8;
    const color = player.state === 'attacking' ? '#00ffc8' :
                  player.state === 'casting' ? '#aa66ff' :
                  player.state === 'defending' ? '#00aaff' :
                  player.state === 'hit' ? '#ff4444' : '#00ffc8';

    // Flash on damage
    if (player.flashTimer > 0 && Math.floor(now / 80) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
    }

    // Glow
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;

    // Body (stylized cyberpunk silhouette)
    ctx.fillStyle = '#0a0a18';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 65, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Torso
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 52);
    ctx.lineTo(x + 15, y - 52);
    ctx.lineTo(x + 12, y - 20);
    ctx.lineTo(x - 12, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 20);
    ctx.lineTo(x - 14, y);
    ctx.moveTo(x + 10, y - 20);
    ctx.lineTo(x + 14, y);
    ctx.stroke();

    // Attack arm animation
    if (player.state === 'attacking') {
      const progress = 1 - (player.stateTimer / 350);
      const armX = x + 15 + Math.sin(progress * Math.PI) * 30;
      const armY = y - 42 - Math.sin(progress * Math.PI) * 10;
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 42);
      ctx.lineTo(armX, armY);
      ctx.strokeStyle = '#ff00aa';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Sword/weapon tip
      ctx.beginPath();
      ctx.arc(armX + 5, armY - 5, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00aa';
      ctx.fill();
    } else if (player.state === 'casting') {
      // Magic effect
      const t = (now % 1000) / 1000;
      ctx.beginPath();
      ctx.arc(x + 20, y - 45, 8 + Math.sin(t * Math.PI * 2) * 3, 0, Math.PI * 2);
      ctx.fillStyle = color + '44';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Idle arms
      ctx.beginPath();
      ctx.moveTo(x - 15, y - 48);
      ctx.lineTo(x - 20, y - 30);
      ctx.moveTo(x + 15, y - 48);
      ctx.lineTo(x + 20, y - 30);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Invulnerability shield
    if (player.invulnerable) {
      ctx.beginPath();
      ctx.arc(x, y - 35, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#00aaff66';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Block shield
    if (player.damageReduction > 0) {
      ctx.fillStyle = '#00aaff22';
      ctx.beginPath();
      ctx.arc(x + 18, y - 38, 14, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.fill();
      ctx.strokeStyle = '#00aaff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    if (player.flashTimer > 0 && Math.floor(now / 80) % 2 === 0) {
      ctx.restore();
    }
  }

  // ─── Enemies ────────────────────────────────────────────────────

  _drawEnemies(ctx, enemies, now) {
    for (const enemy of enemies) {
      this._drawEnemy(ctx, enemy, now);
    }
  }

  _drawEnemy(ctx, enemy, now) {
    const x = enemy.x;
    const y = enemy.y;

    // Spawn animation
    if (enemy.spawnTimer > 0) {
      const p = 1 - enemy.spawnTimer / 500;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(x, y);
      ctx.scale(p, p);
      ctx.translate(-x, -y);
    }

    // Death animation
    if (!enemy.alive) {
      const p = enemy.deathTimer / 500;
      ctx.save();
      ctx.globalAlpha = p;
    }

    // Damage flash
    const isFlashing = enemy.flashTimer > 0 && Math.floor(now / 60) % 2 === 0;

    // Determine color based on type and state
    let bodyColor = '#ff0044';
    let glowSize = 8;
    if (enemy.type === 'brute') { bodyColor = '#ff6600'; glowSize = 12; }
    if (enemy.type === 'boss') { bodyColor = '#ff00aa'; glowSize = 15; }
    if (enemy.type === 'scout') { bodyColor = '#ff4488'; glowSize = 6; }
    if (enemy.attacking) { bodyColor = '#ff0000'; glowSize += 5; }
    if (isFlashing) bodyColor = '#ffffff';

    // Glow
    ctx.save();
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = glowSize;

    // Body
    ctx.fillStyle = '#0a0a18';
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.5;

    const scale = enemy.type === 'brute' ? 1.3 : enemy.type === 'boss' ? 1.5 : 1;

    // Head (angular/threatening)
    ctx.beginPath();
    ctx.moveTo(x - 8 * scale, y - 50 * scale);
    ctx.lineTo(x + 8 * scale, y - 50 * scale);
    ctx.lineTo(x + 10 * scale, y - 38 * scale);
    ctx.lineTo(x - 10 * scale, y - 38 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eyes (red dots)
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - 5 * scale, y - 46 * scale, 3, 2);
    ctx.fillRect(x + 2 * scale, y - 46 * scale, 3, 2);

    // Torso
    ctx.fillStyle = '#0a0a18';
    ctx.beginPath();
    ctx.moveTo(x - 12 * scale, y - 38 * scale);
    ctx.lineTo(x + 12 * scale, y - 38 * scale);
    ctx.lineTo(x + 8 * scale, y - 10 * scale);
    ctx.lineTo(x - 8 * scale, y - 10 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x - 6 * scale, y - 10 * scale);
    ctx.lineTo(x - 10 * scale, y + 5);
    ctx.moveTo(x + 6 * scale, y - 10 * scale);
    ctx.lineTo(x + 10 * scale, y + 5);
    ctx.stroke();

    ctx.restore();

    // Attack telegraph
    if (enemy.attacking) {
      const tp = enemy.telegraphProgress;
      // Pulsing warning
      ctx.save();
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + tp * 0.7})`;
      ctx.lineWidth = 2 + tp * 2;
      ctx.beginPath();
      ctx.arc(x, y - 25 * scale, 25 * scale + tp * 10, 0, Math.PI * 2);
      ctx.stroke();

      // Warning text
      if (tp > 0.5) {
        ctx.fillStyle = `rgba(255, 0, 0, ${tp})`;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!ATTACK!', x, y - 60 * scale);
      }
      ctx.restore();
    }

    // Target word above head
    this._drawTargetWord(ctx, enemy, now);

    // HP bar
    if (enemy.hp < enemy.maxHp && enemy.alive) {
      const barW = 40 * scale;
      const barH = 3;
      const barX = x - barW / 2;
      const barY = y + 10;
      const hpPct = enemy.hp / enemy.maxHp;

      ctx.fillStyle = '#1a1a2f';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpPct > 0.5 ? '#ff0044' : hpPct > 0.25 ? '#ff6600' : '#ff0000';
      ctx.fillRect(barX, barY, barW * hpPct, barH);
    }

    // Status effect indicators
    let statusX = x - 15;
    if (enemy.burning) {
      ctx.fillStyle = '#ff6600';
      ctx.font = '8px monospace';
      ctx.fillText('🔥', statusX, y + 20);
      statusX += 15;
    }
    if (enemy.slowed) {
      ctx.fillStyle = '#66ccff';
      ctx.font = '8px monospace';
      ctx.fillText('❄', statusX, y + 20);
      statusX += 15;
    }
    if (enemy.bleeding) {
      ctx.fillStyle = '#ff4444';
      ctx.font = '8px monospace';
      ctx.fillText('🩸', statusX, y + 20);
    }

    // Close spawn/death animation
    if (enemy.spawnTimer > 0 || !enemy.alive) {
      ctx.restore();
    }
  }

  _drawTargetWord(ctx, enemy, now) {
    const x = enemy.x;
    const scale = enemy.type === 'brute' ? 1.3 : enemy.type === 'boss' ? 1.5 : 1;
    const y = enemy.y - 60 * scale;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';

    // Background pill
    const metrics = ctx.measureText(enemy.word);
    const padX = 8;
    const padY = 4;
    const tw = metrics.width + padX * 2;
    const th = 18;

    ctx.fillStyle = enemy.attacking ? '#ff000033' : '#00000088';
    ctx.strokeStyle = enemy.attacking ? '#ff0000' : '#ff004466';
    ctx.lineWidth = 1;

    // Rounded rect
    const rx = x - tw / 2;
    const ry = y - th / 2 - 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, tw, th, 4);
    ctx.fill();
    ctx.stroke();

    // Word text
    ctx.fillStyle = enemy.attacking
      ? `hsl(0, 100%, ${60 + Math.sin(now * 0.01) * 20}%)`
      : '#ff6688';
    ctx.fillText(enemy.word, x, y + 3);

    ctx.restore();
  }

  // ─── Damage Numbers ─────────────────────────────────────────────

  _drawDamageNumbers(ctx, combatManager) {
    ctx.save();
    ctx.textAlign = 'center';

    for (const dn of combatManager.damageNumbers) {
      ctx.globalAlpha = dn.opacity;
      ctx.font = `bold ${14 + (1 - dn.opacity) * 4}px monospace`;
      ctx.fillStyle = dn.color;
      ctx.shadowColor = dn.color;
      ctx.shadowBlur = 6;
      ctx.fillText(dn.value, dn.x, dn.y);
    }

    for (const msg of combatManager.statusMessages) {
      ctx.globalAlpha = msg.opacity;
      ctx.font = `bold ${12 + (1 - msg.opacity) * 2}px monospace`;
      ctx.fillStyle = msg.color;
      ctx.shadowColor = msg.color;
      ctx.shadowBlur = 8;
      ctx.fillText(msg.text, msg.x, msg.y);
    }

    ctx.restore();
  }

  // ─── HUD ────────────────────────────────────────────────────────

  _drawHUD(ctx, player, spawner, grammar) {
    ctx.save();

    // Player HP
    const barW = 180;
    const barH = 14;
    const barX = 20;
    const barY = 16;
    const hpPct = player.hp / player.maxHp;

    ctx.fillStyle = '#0d0d18';
    ctx.strokeStyle = '#00ffc844';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();
    ctx.stroke();

    const hpColor = hpPct > 0.6 ? '#00ffc8' : hpPct > 0.3 ? '#ffaa00' : '#ff4444';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpPct, barH, 3);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HP ${player.hp}/${player.maxHp}`, barX + barW / 2, barY + 11);

    // WPM display
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ffc8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${this.wpm} WPM`, this.width - 20, 28);

    // Combo display
    if (this.comboCount > 1) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = `bold ${16 + Math.min(this.comboCount, 10)}px monospace`;
      ctx.fillText(`x${this.comboCount}`, this.width - 20, 52);
    }

    // Wave display
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00aaff88';
    ctx.font = '11px monospace';
    ctx.fillText(`WAVE ${spawner.wave}`, this.width / 2, 20);

    // Word bank quick reference
    this._drawWordBankRef(ctx, grammar);

    ctx.restore();
  }

  _drawWordBankRef(ctx, grammar) {
    const startY = 60;
    const x = this.width - 15;
    ctx.textAlign = 'right';
    ctx.font = '9px monospace';

    const categories = [
      { cat: 'attack', label: '⚔ ATK', color: '#ff4444' },
      { cat: 'defense', label: '🛡 DEF', color: '#00aaff' },
      { cat: 'spell', label: '✦ SPL', color: '#aa66ff' },
    ];

    let yOff = startY;
    for (const { cat, label, color } of categories) {
      ctx.fillStyle = color + '88';
      ctx.fillText(label, x, yOff);
      yOff += 12;

      const verbs = grammar.getVerbs(cat);
      for (const v of verbs) {
        const cd = grammar.getCooldown(v.name);
        const onCd = cd > 0;
        ctx.fillStyle = onCd ? '#333' : color + '55';
        let text = v.name;
        if (onCd) text += ` (${Math.ceil(cd / 1000)}s)`;
        ctx.fillText(text, x, yOff);
        yOff += 11;
      }
      yOff += 4;
    }
  }

  // ─── Input Bar ──────────────────────────────────────────────────

  _drawInputBar(ctx, spawner) {
    const barH = 50;
    const barY = this.height - barH;

    // Background
    ctx.fillStyle = '#0a0a15ee';
    ctx.fillRect(0, barY, this.width, barH);

    // Top border
    ctx.strokeStyle = '#00ffc833';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(this.width, barY);
    ctx.stroke();

    // Prompt
    ctx.fillStyle = '#00ffc8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('>', 15, barY + 30);

    // Input text with syntax highlighting
    const inputX = 35;
    const partial = this.inputPartial;

    if (this.inputBuffer) {
      const parts = this.inputBuffer.split(' ');
      let curX = inputX;

      // Verb part
      let verbColor = '#fff';
      if (partial) {
        if (partial.verbValid) verbColor = '#00ff88';
        else if (partial.verbSuggestions?.length === 0) verbColor = '#ff4444';
        else verbColor = '#fff';
      }
      ctx.fillStyle = verbColor;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(parts[0], curX, barY + 30);
      curX += ctx.measureText(parts[0]).width;

      // Space + target
      if (parts.length > 1) {
        ctx.fillText(' ', curX, barY + 30);
        curX += ctx.measureText(' ').width;

        let targetColor = '#fff';
        if (partial?.state === 'ready') targetColor = '#ffaa00';
        else if (partial?.targetSuggestions?.length === 0) targetColor = '#ff4444';
        ctx.fillStyle = targetColor;
        ctx.fillText(parts[1] || '', curX, barY + 30);
        curX += ctx.measureText(parts[1] || '').width;
      }

      // Cursor
      ctx.fillStyle = '#00ffc8';
      ctx.globalAlpha = Math.sin(this.time * 0.006) > 0 ? 1 : 0;
      ctx.fillText('▌', curX + 2, barY + 30);
      ctx.globalAlpha = 1;

      // Suggestions
      if (partial?.verbSuggestions?.length > 0 && !partial.verbValid) {
        ctx.fillStyle = '#333';
        ctx.font = '12px monospace';
        ctx.fillText(partial.verbSuggestions.slice(0, 3).join(' '), inputX, barY + 46);
      } else if (partial?.targetSuggestions?.length > 0 && partial.state === 'typing_target') {
        ctx.fillStyle = '#333';
        ctx.font = '12px monospace';
        const verbW = ctx.measureText(parts[0] + ' ').width;
        ctx.fillText(partial.targetSuggestions.slice(0, 4).join(' '), inputX + verbW, barY + 46);
      }
    } else {
      // Empty - show blinking cursor
      ctx.fillStyle = '#00ffc8';
      ctx.globalAlpha = Math.sin(this.time * 0.004) > 0 ? 1 : 0;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('▌', inputX, barY + 30);
      ctx.globalAlpha = 1;

      // Hint
      ctx.fillStyle = '#333';
      ctx.font = '11px monospace';

      const targets = spawner.getAliveEnemies().slice(0, 4).map(e => e.word).join(' ');
      if (targets) {
        ctx.fillText(`TARGETS: ${targets}`, inputX, barY + 46);
      } else {
        ctx.fillText('Waiting for enemies...', inputX, barY + 46);
      }
    }
  }

  // ─── Wave Info ──────────────────────────────────────────────────

  _drawWaveInfo(ctx, spawner, combatManager) {
    // Show "WAVE X" banner when wave starts
    if (spawner.waveActive && spawner.spawnQueue.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00aaff';
      ctx.font = 'bold 28px monospace';
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 20;
      ctx.fillText(`WAVE ${spawner.wave}`, this.width / 2, this.height / 2 - 40);
      ctx.restore();
    }

    // Enemies remaining
    const alive = spawner.getAliveEnemies().length + spawner.spawnQueue.length;
    if (alive > 0 && spawner.waveActive) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff004488';
      ctx.font = '10px monospace';
      ctx.fillText(`${alive} ENEMIES REMAINING`, this.width / 2, 35);
      ctx.restore();
    }
  }

  // ─── Post-processing ───────────────────────────────────────────

  _drawScanlines(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#000';
    for (let y = 0; y < this.height; y += 3) {
      ctx.fillRect(0, y, this.width, 1);
    }
    ctx.restore();
  }

  _drawVignette(ctx) {
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.width * 0.3,
      this.width / 2, this.height / 2, this.width * 0.7
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}
