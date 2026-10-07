// Canvas time-series chart for one KPI (single series, one y-axis).
// Marks follow the dataviz spec: 2px line, 10% min–max wash, 8px end dot with a 2px surface ring,
// solid hairline grid, recessive axes. Limits are status lines with icon + label (never color alone);
// text always uses text tokens, never the series color.
import { STATES } from "./states.js";

export const SERIES_COLOR = "#3987e5"; // validated dark categorical slot 1 (dataviz validator: PASS)
const SURFACE = "#151b22";
const GRID = "rgba(255,255,255,0.07)";
const AXIS = "rgba(255,255,255,0.16)";
const TEXT_MUTED = "#8592a3";
const TEXT_2 = "#b4bfcc";
const CROSSHAIR = "rgba(255,255,255,0.4)";
const FONT = '11px "Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
export const PAD = { l: 46, r: 74, t: 10, b: 22 };

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function niceTicks(lo, hi, count = 4) {
  if (!(hi > lo)) {
    const p = Math.abs(lo) * 0.1 || 1;
    lo -= p;
    hi += p;
  }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { ticks, lo: start, hi: end, step };
}

function timeLabel(t, withSeconds) {
  return new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ buckets: Array, from: number, to: number, kpi: object, hoverT?: number|null }} o
 * @returns geometry for hit-testing: { tToX, xToT, plot }
 */
export function renderChart(canvas, { buckets, from, to, kpi, hoverT = null }) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = FONT;

  const plot = { x: PAD.l, y: PAD.t, w: Math.max(10, W - PAD.l - PAD.r), h: Math.max(10, H - PAD.t - PAD.b) };
  const data = buckets.filter(Boolean);

  // y domain: data + both limit lines, so the reader always sees the distance to alert/critical.
  const limits = [
    ...[kpi.normal[0], kpi.normal[1]].filter(Number.isFinite).map((v) => ({ v, state: "alert" })),
    ...[kpi.alert[0], kpi.alert[1]].filter(Number.isFinite).map((v) => ({ v, state: "critical" })),
  ];
  const lows = data.map((b) => b.min).concat(limits.map((l) => l.v));
  const highs = data.map((b) => b.max).concat(limits.map((l) => l.v));
  const { ticks, lo, hi, step } = niceTicks(Math.min(...lows), Math.max(...highs), 4);
  const tickDecimals = Math.max(0, -Math.floor(Math.log10(step)) + (step % 1 ? 1 : 0));

  const tToX = (t) => plot.x + ((t - from) / (to - from)) * plot.w;
  const xToT = (x) => from + ((x - plot.x) / plot.w) * (to - from);
  const vToY = (v) => plot.y + plot.h - ((v - lo) / (hi - lo)) * plot.h;

  // grid + y ticks (solid hairlines, recessive)
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  for (const t of ticks) {
    const y = Math.round(vToY(t)) + 0.5;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(fmt(t, Math.min(tickDecimals, 2)), plot.x - 6, y);
  }

  // x axis baseline + time ticks
  const withSeconds = to - from <= 10 * 60_000;
  ctx.strokeStyle = AXIS;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y + plot.h + 0.5);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h + 0.5);
  ctx.stroke();
  ctx.fillStyle = TEXT_MUTED;
  ctx.textBaseline = "top";
  const xTicks = 4;
  for (let i = 0; i <= xTicks; i++) {
    const t = from + ((to - from) * i) / xTicks;
    ctx.textAlign = i === 0 ? "left" : i === xTicks ? "right" : "center";
    ctx.fillText(timeLabel(t, withSeconds), tToX(t), plot.y + plot.h + 6);
  }

  // limit lines: status color + icon + label (the label text stays in a text token)
  for (const l of limits) {
    if (l.v < lo || l.v > hi) continue;
    const y = Math.round(vToY(l.v)) + 0.5;
    const color = STATES[l.state].color;
    ctx.strokeStyle = color;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(STATES[l.state].glyph, plot.x + plot.w + 6, y);
    ctx.fillStyle = TEXT_2;
    ctx.fillText(`${fmt(l.v, kpi.decimals === 0 ? 0 : 1)}`, plot.x + plot.w + 20, y);
  }

  // min–max wash (10%) then the mean line (2px), broken at gaps
  ctx.fillStyle = "rgba(57,135,229,0.10)";
  let run = [];
  const flushWash = () => {
    if (run.length > 1) {
      ctx.beginPath();
      run.forEach((b, i) => (i ? ctx.lineTo(tToX(b.t), vToY(b.max)) : ctx.moveTo(tToX(b.t), vToY(b.max))));
      for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(tToX(run[i].t), vToY(run[i].min));
      ctx.closePath();
      ctx.fill();
    }
    run = [];
  };
  for (const b of buckets) b ? run.push(b) : flushWash();
  flushWash();

  ctx.strokeStyle = SERIES_COLOR;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  let pen = false;
  for (const b of buckets) {
    if (!b) {
      pen = false;
      continue;
    }
    const x = tToX(b.t);
    const y = vToY(b.mean);
    pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    pen = true;
  }
  ctx.stroke();

  const dot = (b) => {
    ctx.beginPath();
    ctx.arc(tToX(b.t), vToY(b.mean), 4, 0, Math.PI * 2);
    ctx.fillStyle = SERIES_COLOR;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = SURFACE;
    ctx.stroke();
  };
  const last = data.at(-1);
  if (last) dot(last);

  // crosshair (snaps to the nearest bucket with data)
  let hovered = null;
  if (hoverT != null && hoverT >= from && hoverT <= to && data.length) {
    hovered = data.reduce((a, b) => (Math.abs(b.t - hoverT) < Math.abs(a.t - hoverT) ? b : a));
    const x = Math.round(tToX(hovered.t)) + 0.5;
    ctx.strokeStyle = CROSSHAIR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.h);
    ctx.stroke();
    dot(hovered);
  }

  return { tToX, xToT, plot, hovered };
}
