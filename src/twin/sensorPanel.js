// Technical panel for the selected sensor: identity, live reading, limits, telemetry and history.
import { KPI_BY_KEY, STATE_LABEL } from "../config/kpis.js";

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const TREND = { up: "▲ subindo", down: "▼ caindo", flat: "▶ estável" };
const STATE_COLORS = { normal: "#34d399", alert: "#fbbf24", critical: "#f87171" };

function bandText([lo, hi], unit, d) {
  if (lo === -Infinity) return `≤ ${fmt(hi, d)} ${unit}`;
  return `${fmt(lo, d)} – ${fmt(hi, d)} ${unit}`;
}

function drawSparkline(canvas, values, kpi) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (values.length < 2) return;

  const limits = [kpi.normal[0], kpi.normal[1], kpi.alert[0], kpi.alert[1]].filter(Number.isFinite);
  let min = Math.min(...values);
  let max = Math.max(...values);
  // Keep the nearest limits in view so the line reads against them.
  for (const l of limits) {
    if (Math.abs(l - (min + max) / 2) < (max - min) * 2 + Math.abs(max) * 0.25) {
      min = Math.min(min, l);
      max = Math.max(max, l);
    }
  }
  const pad = (max - min) * 0.1 || 1;
  min -= pad;
  max += pad;
  const y = (v) => h - ((v - min) / (max - min)) * h;
  const x = (i) => (i / (values.length - 1)) * w;

  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  [[kpi.normal, STATE_COLORS.alert], [kpi.alert, STATE_COLORS.critical]].forEach(([band, color]) => {
    band.filter(Number.isFinite).forEach((l) => {
      if (l < min || l > max) return;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, y(l));
      ctx.lineTo(w, y(l));
      ctx.stroke();
    });
  });
  ctx.setLineDash([]);
  ctx.strokeStyle = "#4cb1ff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.stroke();
}

export function createSensorPanel(root, { onClose, onFocus } = {}) {
  const $ = (sel) => root.querySelector(sel);
  let current = null;

  $(".sp-close").addEventListener("click", () => onClose?.());
  $(".sp-focus").addEventListener("click", () => current && onFocus?.(current.id));

  function render(sensor) {
    const kpi = KPI_BY_KEY[sensor.kpi];
    $(".sp-model").textContent = sensor.model;
    $(".sp-quantity").textContent = sensor.quantity;
    $(".sp-type").textContent = sensor.type;
    $(".sp-location").textContent = sensor.location;
    $(".sp-interface").textContent = sensor.interface;
    $(".sp-notes").textContent = sensor.notes;
    $(".sp-unit").textContent = kpi.unit;
    $(".sp-normal").textContent = bandText(kpi.normal, kpi.unit, kpi.decimals);
    $(".sp-alert").textContent = bandText(kpi.alert, kpi.unit, kpi.decimals);
    $(".sp-critical").textContent = "fora da faixa de alerta";
  }

  return {
    get current() {
      return current;
    },
    open(sensor) {
      current = sensor;
      render(sensor);
      root.hidden = false;
      root.dataset.sensor = sensor.id;
      document.body.classList.add("sensor-open");
    },
    close() {
      current = null;
      root.hidden = true;
      delete root.dataset.sensor;
      document.body.classList.remove("sensor-open");
    },
    /** Refreshes live values; called on every sample while open. */
    update({ result, sample, history, sourceLabel }) {
      if (!current) return;
      const kpi = KPI_BY_KEY[current.kpi];
      const item = result?.kpis[current.kpi];
      root.dataset.state = item?.state ?? "idle";
      $(".sp-value").textContent = item ? fmt(item.value, kpi.decimals) : "—";
      $(".sp-state").textContent = item ? STATE_LABEL[item.state] : "—";
      $(".sp-trend").textContent = item?.trend ? TREND[item.trend.dir] : "—";
      $(".sp-source").textContent = sourceLabel;
      $(".sp-source").dataset.kind = sample?.source ?? "none";
      $(".sp-updated").textContent = sample ? new Date(sample.timestamp).toLocaleTimeString("pt-BR") : "—";
      const values = history[current.kpi] ?? [];
      $(".sp-history-count").textContent = `${values.length} amostras`;
      drawSparkline($(".sp-spark"), values, kpi);
    },
  };
}
