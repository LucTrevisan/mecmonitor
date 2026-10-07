// Time-series history per KPI: fixed-size ring buffers (default 24 h at 1 Hz) with timestamps,
// plus bucketing (min / mean / max per interval) for charts and the table view.
// Pure module (no DOM) — unit-tested in Node.

export const RANGES = {
  "5m": { label: "5 min", ms: 5 * 60_000 },
  "30m": { label: "30 min", ms: 30 * 60_000 },
  "1h": { label: "1 h", ms: 60 * 60_000 },
  "24h": { label: "24 h", ms: 24 * 60 * 60_000 },
};

export function createHistoryStore(keys, capacity = 24 * 60 * 60) {
  const series = Object.fromEntries(
    keys.map((k) => [k, { t: new Float64Array(capacity), v: new Float64Array(capacity), start: 0, len: 0 }]),
  );

  function push(key, t, value) {
    const s = series[key];
    if (!s || !Number.isFinite(value) || !Number.isFinite(t)) return;
    const i = (s.start + s.len) % capacity;
    s.t[i] = t;
    s.v[i] = value;
    if (s.len < capacity) s.len++;
    else s.start = (s.start + 1) % capacity;
  }

  /** Calls fn(t, v) for every point with from <= t <= to, oldest first. */
  function each(key, from, to, fn) {
    const s = series[key];
    if (!s) return;
    for (let n = 0; n < s.len; n++) {
      const i = (s.start + n) % capacity;
      const t = s.t[i];
      if (t >= from && t <= to) fn(t, s.v[i]);
    }
  }

  /**
   * Splits [from, to] into n equal buckets. Empty buckets are null (gaps are drawn as breaks).
   * @returns {Array<null | { t: number, min: number, max: number, mean: number, count: number }>}
   */
  function buckets(key, from, to, n) {
    const out = new Array(n).fill(null);
    const span = (to - from) / n;
    if (span <= 0) return out;
    each(key, from, to, (t, v) => {
      const b = Math.min(n - 1, Math.floor((t - from) / span));
      const cur = out[b];
      if (!cur) out[b] = { t: from + (b + 0.5) * span, min: v, max: v, mean: v, count: 1 };
      else {
        cur.min = Math.min(cur.min, v);
        cur.max = Math.max(cur.max, v);
        cur.mean += (v - cur.mean) / ++cur.count;
      }
    });
    return out;
  }

  /** min / mean / max / last over [from, to], or null with no data. */
  function summary(key, from, to) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    let last = null;
    each(key, from, to, (t, v) => {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
      count++;
      last = { t, v };
    });
    return count ? { min, max, mean: sum / count, count, last } : null;
  }

  return { push, each, buckets, summary, size: (key) => series[key]?.len ?? 0, capacity };
}
