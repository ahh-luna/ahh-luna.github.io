/**
 * KEYSTRIKE — GameLoop
 * 
 * Fixed-timestep game loop with variable rendering.
 * Provides consistent update ticks and smooth rendering.
 */
export class GameLoop {
  constructor(updateFn, renderFn) {
    this.update = updateFn;
    this.render = renderFn;
    this.running = false;
    this.rafId = null;
    this.lastTime = 0;
    this.accumulator = 0;
    this.tickRate = 1000 / 60; // 60 updates/sec
    this.frameCount = 0;
    this.fps = 0;
    this.fpsTimer = 0;
    this.fpsFrames = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this._loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _loop(timestamp) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = Math.min(timestamp - this.lastTime, 100); // cap to avoid spiral
    this.lastTime = timestamp;
    this.accumulator += dt;

    // Fixed timestep updates
    while (this.accumulator >= this.tickRate) {
      this.update(this.tickRate);
      this.accumulator -= this.tickRate;
    }

    // Render with interpolation factor
    const alpha = this.accumulator / this.tickRate;
    this.render(alpha, dt);

    // FPS counter
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1000) {
      this.fps = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsTimer -= 1000;
    }
    this.frameCount++;
  }
}
