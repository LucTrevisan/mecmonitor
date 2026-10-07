// Operational dashboard: health card + KPI cards. Presentation only; evaluation lives in health.js.
// Keeps the latest reading of each KPI so partial payloads and stale KPIs are handled per KPI
// (a KPI without a reading for STALE_MS shows SEM DADOS, even if other KPIs keep arriving).
import { KPIS, STALE_MS } from "./config/kpis.js";
import { SENSOR_BY_KPI } from "./config/sensors.js";
import { evaluateLatest, trend } from "./health.js";
import { stateIcon, stateLabel, trendText } from "./ui/states.js";

const HISTORY = 120; // samples kept per KPI (2 min at 1 Hz)
const REFRESH_MS = 1000;

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function createDashboard(root) {
  const grid = root.querySelector(".kpi-grid");
  const history = Object.fromEntries(KPIS.map((k) => [k.key, []]));
  const latest = {};
  const trends = {};
  const cards = {};
  const selectListeners = new Set();
  const resultListeners = new Set();
  let lastResult = null;

  for (const k of KPIS) {
    const sensor = SENSOR_BY_KPI[k.key];
    const tag = sensor?.tag ?? "";
    // A button: selecting a KPI focuses its sensor on the Digital Twin.
    const el = document.createElement("button");
    el.type = "button";
    el.className = "kpi";
    el.setAttribute("aria-pressed", "false");
    el.title = `${k.label} (${tag}) — localizar o sensor no modelo`;
    el.addEventListener("click", () => selectListeners.forEach((fn) => fn(k.key)));
    el.dataset.kpi = k.key;
    el.dataset.state = "nodata";
    if (sensor?.secondary) el.dataset.secondary = "";
    el.innerHTML = `
      <span class="kpi-label"><span class="kpi-label-full">${k.label}</span><span class="kpi-label-short">${k.short ?? k.label}</span><span class="kpi-tag">${tag}</span></span>
      <span class="kpi-value"><span class="kpi-num">—</span><span class="kpi-unit">${k.unit}</span></span>
      <span class="kpi-foot">
        <span class="kpi-trend" data-dir="flat">—</span>
        <span class="kpi-state">${stateIcon("nodata")}<span class="kpi-state-text">${stateLabel("nodata")}</span></span>
      </span>`;
    grid.appendChild(el);
    cards[k.key] = {
      el,
      num: el.querySelector(".kpi-num"),
      stateWrap: el.querySelector(".kpi-state"),
      trendEl: el.querySelector(".kpi-trend"),
    };
  }

  const healthEl = root.querySelector(".health");
  const healthScore = root.querySelector(".health-score");
  const healthState = root.querySelector(".health-state");
  const healthBar = root.querySelector(".health-bar-fill");

  function render(result) {
    for (const k of KPIS) {
      const item = result.kpis[k.key];
      const c = cards[k.key];
      c.el.dataset.state = item.state;
      c.num.textContent = item.value == null ? "—" : fmt(item.value, k.decimals);
      c.stateWrap.innerHTML = `${stateIcon(item.state)}<span class="kpi-state-text">${stateLabel(item.state)}</span>`;
      const t = item.state === "nodata" ? null : item.trend;
      c.trendEl.dataset.dir = t?.dir ?? "flat";
      c.trendEl.textContent = t ? trendText(t, k.decimals) : "—";
      c.trendEl.title = "Tendência: média dos últimos 5 s vs os 5 s anteriores";
    }
    healthEl.dataset.state = result.state;
    healthScore.textContent = result.score ?? "—";
    healthState.innerHTML = `${stateIcon(result.state)}<span>${stateLabel(result.state)}</span>`;
    healthBar.style.width = `${result.score ?? 0}%`;
  }

  function recompute() {
    const result = evaluateLatest(latest, Date.now(), STALE_MS);
    for (const k of KPIS) if (result.kpis[k.key].state !== "nodata") result.kpis[k.key].trend = trends[k.key];
    lastResult = result;
    render(result);
    resultListeners.forEach((fn) => fn(result));
    return result;
  }

  recompute();
  setInterval(recompute, REFRESH_MS);

  return {
    history,
    get result() {
      return lastResult;
    },
    onSelect(fn) {
      selectListeners.add(fn);
    },
    /** Called with the evaluation on every sample and every second (freshness changes). */
    onResult(fn) {
      resultListeners.add(fn);
    },
    setSelected(key) {
      for (const [k, c] of Object.entries(cards)) c.el.setAttribute("aria-pressed", String(k === key));
    },
    update(sample) {
      const now = Date.now();
      for (const k of KPIS) {
        const value = sample[k.key];
        if (!Number.isFinite(value)) continue;
        latest[k.key] = { value, at: now };
        const h = history[k.key];
        h.push(value);
        if (h.length > HISTORY) h.shift();
        trends[k.key] = trend(h, k.trendEps);
      }
      return recompute();
    },
  };
}
