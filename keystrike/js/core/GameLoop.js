/**
 * KEYSTRIKE — GameLoop
 * 
 * Fixed-timestep game loop with interpolation.
 * Drives update() and render() cycles at consistent rates.
 */
export class GameLoop {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.running = false;
    this.rafId = null;

    // Timing
    this.tickRate = 60;             // Updates per second
    this.dt = 1000 / this.tickRate; // ms per tick
    this.lastTime = 0;
    this.accumulator = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsTimer = 0;

    // Callbacks
    this.updateFn = null;
    this.renderFn = null;

    this._loop = this._loop.bind(this);
  }

  /**
   * Set the update and render functions.
   * update(dt) — called at fixed timestep
   * render(interpolation) — called every frame
   */
  setup(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this._loop);
    this.eventBus.emit('loop:start');
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.eventBus.emit('loop:stop');
  }

  _loop(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._loop);

    let elapsed = now - this.lastTime;
    this.lastTime = now;

    // Clamp to prevent spiral of death
    if (elapsed > 200) elapsed = 200;

    this.accumulator += elapsed;

    // Fixed timestep updates
    while (this.accumulator >= this.dt) {
      if (this.updateFn) this.updateFn(this.dt, now);
      this.accumulator -= this.dt;
    }

    // Render with interpolation
    const interpolation = this.accumulator / this.dt;
    if (this.renderFn) this.renderFn(interpolation, now);

    // FPS counter
    this.frameCount++;
    this.fpsTimer += elapsed;
    if (this.fpsTimer >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer -= 1000;
    }
  }
}
