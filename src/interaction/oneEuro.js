// One Euro filter (Casiez et al., CHI 2012): adaptive low-pass for noisy tracking.
// Slow motion → low cutoff (removes jitter); fast motion → higher cutoff (keeps latency low).
// Pure module (no Babylon), unit-tested. Time in seconds.

function smoothingFactor(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/**
 * @param {{ minCutoff?: number, beta?: number, dCutoff?: number }} o
 *   minCutoff: Hz at rest (lower = smoother); beta: how fast the cutoff rises with speed (units/s).
 */
export function createOneEuro({ minCutoff = 1.5, beta = 6, dCutoff = 1.0 } = {}) {
  let xPrev = null;
  let dxPrev = 0;
  let tPrev = null;
  return {
    filter(x, t) {
      if (xPrev === null || tPrev === null || t <= tPrev) {
        xPrev = x;
        tPrev = t;
        dxPrev = 0;
        return x;
      }
      const dt = t - tPrev;
      const dx = (x - xPrev) / dt;
      const edx = dxPrev + smoothingFactor(dCutoff, dt) * (dx - dxPrev);
      const cutoff = minCutoff + beta * Math.abs(edx);
      const out = xPrev + smoothingFactor(cutoff, dt) * (x - xPrev);
      xPrev = out;
      dxPrev = edx;
      tPrev = t;
      return out;
    },
    reset() {
      xPrev = null;
      tPrev = null;
      dxPrev = 0;
    },
  };
}

/** Three independent One Euro filters for a 3D point ({x,y,z} in, writes into `out`). */
export function createVec3Filter(options) {
  const fx = createOneEuro(options);
  const fy = createOneEuro(options);
  const fz = createOneEuro(options);
  return {
    filter(v, t, out) {
      out.x = fx.filter(v.x, t);
      out.y = fy.filter(v.y, t);
      out.z = fz.filter(v.z, t);
      return out;
    },
    reset() {
      fx.reset();
      fy.reset();
      fz.reset();
    },
  };
}
