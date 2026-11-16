// Technical panel for the selected sensor: identity, live reading, limits and telemetry.
import { KPI_BY_KEY } from "../config/kpis.js";
import { stateIcon, stateLabel, trendText } from "../ui/states.js";

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function bandText([lo, hi], unit, d) {
  if (lo === -Infinity) return `≤ ${fmt(hi, d)} ${unit}`;
  return `${fmt(lo, d)} – ${fmt(hi, d)} ${unit}`;
}

export function createSensorPanel(root, { onClose, onFocus } = {}) {
  const $ = (sel) => root.querySelector(sel);
  let current = null;

  $(".sp-close").addEventListener("click", () => onClose?.());
  $(".sp-focus").addEventListener("click", () => current && onFocus?.(current.id));

  function render(sensor) {
    const kpi = KPI_BY_KEY[sensor.kpi];
    $(".sp-tag").textContent = sensor.tag;
    $(".sp-name").textContent = sensor.secondary ? `${sensor.name} · secundário` : sensor.name;
    $(".sp-model").textContent = sensor.model;
    $(".sp-quantity").textContent = sensor.quantity;
    $(".sp-location-short").textContent = sensor.location.split(" — ")[0];
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
    update({ result, sample, sourceLabel }) {
      if (!current) return;
      const kpi = KPI_BY_KEY[current.kpi];
      const item = result?.kpis[current.kpi];
      const state = item?.state ?? "nodata";
      root.dataset.state = state;
      $(".sp-value").textContent = item?.value == null ? "—" : fmt(item.value, kpi.decimals);
      $(".sp-state-wrap").innerHTML = `${stateIcon(state)}<span class="sp-state">${stateLabel(state)}</span>`;
      $(".sp-trend").textContent = state !== "nodata" && item?.trend ? trendText(item.trend, kpi.decimals) : "—";
      $(".sp-source").textContent = sourceLabel;
      $(".sp-source").dataset.kind = sample?.source ?? "none";
      $(".sp-updated").textContent = sample ? new Date(sample.timestamp).toLocaleTimeString("pt-BR") : "—";
    },
  };
}
