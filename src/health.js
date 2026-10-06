// Rule-based KPI classification, health index and trend. Pure functions (unit-tested in Node).
// The health index is a transparent weighted heuristic, not an AI/ML prediction.
import { KPIS } from "./config/kpis.js";

const SEVERITY = { normal: 0, alert: 1, critical: 2 };
const inBand = (v, [lo, hi]) => v >= lo && v <= hi;

export function classify(value, kpi) {
  if (inBand(value, kpi.normal)) return "normal";
  if (inBand(value, kpi.alert)) return "alert";
  return "critical";
}

/** 100 at the reference, 85 at the normal edge, 55 at the alert edge, falling to 0 beyond. */
export function kpiScore(value, kpi) {
  const hi = value >= kpi.ref;
  const nEdge = hi ? kpi.normal[1] : kpi.normal[0];
  const aEdge = hi ? kpi.alert[1] : kpi.alert[0];
  if (!Number.isFinite(nEdge)) return 100;
  const d = Math.abs(value - kpi.ref);
  const dn = Math.abs(nEdge - kpi.ref);
  const da = Math.abs(aEdge - kpi.ref);
  if (d <= dn) return 100 - 15 * (d / dn);
  if (d <= da) return 85 - 30 * ((d - dn) / (da - dn));
  return Math.max(0, 55 - 55 * ((d - da) / (da - dn)));
}

export function evaluate(sample, kpis = KPIS) {
  let weighted = 0;
  let weights = 0;
  let worst = "normal";
  const items = {};
  for (const k of kpis) {
    const value = sample[k.key];
    if (!Number.isFinite(value)) continue;
    const state = classify(value, k);
    const score = kpiScore(value, k);
    items[k.key] = { value, state, score };
    weighted += score * k.weight;
    weights += k.weight;
    if (SEVERITY[state] > SEVERITY[worst]) worst = state;
  }
  return { score: weights ? Math.round(weighted / weights) : null, state: worst, kpis: items };
}

/** Direction of change: mean of the last `n` values vs the `n` before them. */
export function trend(values, eps, n = 5) {
  if (values.length < n * 2) return { dir: "flat", delta: 0 };
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const delta = mean(values.slice(-n)) - mean(values.slice(-2 * n, -n));
  return { dir: delta > eps ? "up" : delta < -eps ? "down" : "flat", delta };
}
