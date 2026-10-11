// Thermal scale of the TÉRMICO mode (pure functions: no Babylon, unit-tested).

/** Level for a temperature: first level whose max (inclusive) is not exceeded; null without data. */
export function thermalLevel(t, levels) {
  if (t == null || !Number.isFinite(t)) return null;
  return levels.find((l) => t <= l.max) ?? levels[levels.length - 1];
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** sRGB color [r, g, b] (0–1) for a temperature, linearly interpolated between the ramp stops (clamped). */
export function thermalColor(t, stops) {
  if (t <= stops[0][0]) return hexToRgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (t <= t1) {
      const [t0, c0] = stops[i - 1];
      const k = (t - t0) / (t1 - t0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return a.map((v, j) => v + (b[j] - v) * k);
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

/**
 * Illustrative temperature at distance d (m) from the sensor: the excess over ambient decays smoothly
 * (Gaussian), so the region is hottest at T-01 and never hotter than T-01 reads.
 */
export function regionTemperature(t01, d, ambient, falloff) {
  return ambient + (t01 - ambient) * Math.exp(-((d / falloff) ** 2));
}

/** Position (0–1) of a temperature on the legend bar spanning the first..last tick. */
export function legendPosition(t, ticks) {
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  return Math.min(1, Math.max(0, (t - lo) / (hi - lo)));
}
