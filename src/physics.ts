// Swinging thread + twisting charm. Pure maths, no browser stuff, so it is easy to test.
// Coordinates: x to the right, y UP (same as the 3D scene).

export interface PhysicsOptions {
  length: number;
  weight: number;
  drag: number;
  spin: number;
  twistStiffness: number;
  twistDamping: number;
}

const SEGMENTS = 14;
const GRAVITY = 2400;      // pixels per second squared
const SUBSTEP = 1 / 120;   // physics runs 120 times a second
const ROPE_MASS = 0.05;    // the thread itself is very light

export class SwingPhysics {
  readonly count = SEGMENTS + 1;
  readonly x = new Float64Array(SEGMENTS + 1);
  readonly y = new Float64Array(SEGMENTS + 1);
  private px = new Float64Array(SEGMENTS + 1);
  private py = new Float64Array(SEGMENTS + 1);
  private inv = new Float64Array(SEGMENTS + 1);
  private segLen: number;

  yaw = 0;        // twist angle around the thread (radians)
  yawVel = 0;
  private prevRingVx = 0;
  private acc = 0;
  private anchorX = 0;
  private anchorY = 0;
  maxSpeed = 0;   // fastest point, pixels per substep (used to know when we can sleep)

  constructor(private o: PhysicsOptions, ax: number, ay: number) {
    this.segLen = o.length / SEGMENTS;
    this.inv[0] = 0; // point 0 is nailed to the mouse
    for (let i = 1; i < SEGMENTS; i++) this.inv[i] = 1 / ROPE_MASS;
    this.inv[SEGMENTS] = 1 / Math.max(0.05, o.weight); // the charm itself
    this.reset(ax, ay);
  }

  reset(ax: number, ay: number) {
    this.anchorX = ax;
    this.anchorY = ay;
    for (let i = 0; i <= SEGMENTS; i++) {
      this.x[i] = this.px[i] = ax;
      this.y[i] = this.py[i] = ay - i * this.segLen;
    }
    this.yaw = this.yawVel = this.prevRingVx = 0;
    this.maxSpeed = 0;
  }

  get ringX() { return this.x[SEGMENTS]; }
  get ringY() { return this.y[SEGMENTS]; }

  /** Tilt of the charm: 0 = hanging straight down. */
  get angle(): number {
    const j = SEGMENTS - 3;
    const dx = this.x[SEGMENTS] - this.x[j];
    const dy = this.y[SEGMENTS] - this.y[j];
    const a = Math.atan2(dx, -dy);
    return Math.max(-1.75, Math.min(1.75, a)); // never flips higher than ~100 degrees
  }

  get settled(): boolean {
    return this.maxSpeed < 0.12 && Math.abs(this.yawVel) < 0.05 && Math.abs(this.yaw) < 0.02;
  }

  /** Move forward by frameDt seconds while the mouse is at (ax, ay). */
  step(frameDt: number, ax: number, ay: number) {
    this.acc += frameDt;
    const n = Math.floor(this.acc / SUBSTEP);
    this.acc -= n * SUBSTEP;
    const sx = this.anchorX, sy = this.anchorY;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      this.substep(SUBSTEP, sx + (ax - sx) * t, sy + (ay - sy) * t);
    }
    if (n > 0) { this.anchorX = ax; this.anchorY = ay; }
  }

  private substep(dt: number, ax: number, ay: number) {
    const N = SEGMENTS;
    const { x, y, px, py } = this;
    const damp = Math.exp(-this.o.drag * 60 * dt);

    x[0] = px[0] = ax;
    y[0] = py[0] = ay;

    for (let i = 1; i <= N; i++) {
      const vx = (x[i] - px[i]) * damp;
      const vy = (y[i] - py[i]) * damp;
      px[i] = x[i];
      py[i] = y[i];
      x[i] += vx;
      y[i] += vy - GRAVITY * dt * dt;
    }

    for (let it = 0; it < 12; it++) {
      for (let i = 0; i < N; i++) this.constrain(i, i + 1);
    }

    // keep speeds sane when the mouse teleports
    let maxV = 0;
    for (let i = 1; i <= N; i++) {
      let vx = x[i] - px[i];
      let vy = y[i] - py[i];
      const v = Math.hypot(vx, vy);
      if (v > 60) { vx *= 60 / v; vy *= 60 / v; px[i] = x[i] - vx; py[i] = y[i] - vy; }
      if (Math.min(v, 60) > maxV) maxV = Math.min(v, 60);
    }
    this.maxSpeed = maxV;

    // Twist: a sideways push on the ring twists the thread. The thread then
    // untwists like a spring (that is what makes a real keychain spin back).
    const ringVx = (x[N] - px[N]) / dt;
    const dvx = Math.max(-600, Math.min(600, ringVx - this.prevRingVx));
    this.prevRingVx = ringVx;
    this.yawVel += this.o.spin * 0.012 * dvx;

    const k = this.o.twistStiffness;
    const c = 2 * this.o.twistDamping * Math.sqrt(k);
    this.yawVel += (-k * this.yaw - c * this.yawVel) * dt;
    this.yaw += this.yawVel * dt;
    const lim = Math.PI * 4;
    if (this.yaw > lim) this.yaw = lim;
    if (this.yaw < -lim) this.yaw = -lim;
  }

  private constrain(i: number, j: number) {
    const { x, y, inv } = this;
    const dx = x[j] - x[i];
    const dy = y[j] - y[i];
    const d = Math.hypot(dx, dy) || 1e-6;
    const diff = (d - this.segLen) / d;
    const wi = inv[i], wj = inv[j];
    const s = wi + wj;
    if (s === 0) return;
    const ci = wi / s, cj = wj / s;
    x[i] += dx * diff * ci;
    y[i] += dy * diff * ci;
    x[j] -= dx * diff * cj;
    y[j] -= dy * diff * cj;
  }
}
