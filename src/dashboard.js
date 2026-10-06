// Operational dashboard: health card + KPI cards. Presentation only; evaluation lives in health.js.
import { KPIS, STATE_LABEL } from "./config/kpis.js";
import { evaluate, trend } from "./health.js";

const HISTORY = 120; // samples kept per KPI (2 min at 1 Hz)
const ARROW = { up: "▲", down: "▼", flat: "▶" };
const TREND_LABEL = { up: "subindo", down: "caindo", flat: "estável" };

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function createDashboard(root) {
  const grid = root.querySelector(".kpi-grid");
  const history = Object.fromEntries(KPIS.map((k) => [k.key, []]));
  const cards = {};

  for (const k of KPIS) {
    const el = document.createElement("article");
    el.className = "kpi";
    el.dataset.kpi = k.key;
    el.dataset.state = "idle";
    el.innerHTML = `
      <span class="kpi-label"><span class="kpi-label-full">${k.label}</span><span class="kpi-label-short">${k.short ?? k.label}</span></span>
      <div class="kpi-value"><span class="kpi-num">—</span><span class="kpi-unit">${k.unit}</span></div>
      <footer class="kpi-foot">
        <span class="kpi-trend" data-dir="flat"><span class="kpi-arrow" aria-hidden="true">${ARROW.flat}</span><span class="kpi-trend-text">—</span></span>
        <span class="kpi-state"><i class="dot" aria-hidden="true"></i><span class="kpi-state-text">—</span></span>
      </footer>`;
    grid.appendChild(el);
    cards[k.key] = {
      el,
      num: el.querySelector(".kpi-num"),
      state: el.querySelector(".kpi-state-text"),
      trendEl: el.querySelector(".kpi-trend"),
      arrow: el.querySelector(".kpi-arrow"),
      trendText: el.querySelector(".kpi-trend-text"),
    };
  }

  const healthEl = root.querySelector(".health");
  const healthScore = root.querySelector(".health-score");
  const healthState = root.querySelector(".health-state");
  const healthBar = root.querySelector(".health-bar-fill");

  return {
    history,
    update(sample) {
      const result = evaluate(sample);
      for (const k of KPIS) {
        const item = result.kpis[k.key];
        if (!item) continue;
        const h = history[k.key];
        h.push(item.value);
        if (h.length > HISTORY) h.shift();
        const t = trend(h, k.trendEps);
        item.trend = t;

        const c = cards[k.key];
        c.el.dataset.state = item.state;
        c.num.textContent = fmt(item.value, k.decimals);
        c.state.textContent = STATE_LABEL[item.state];
        c.trendEl.dataset.dir = t.dir;
        c.arrow.textContent = ARROW[t.dir];
        c.trendText.textContent = t.dir === "flat" ? TREND_LABEL.flat : `${t.delta > 0 ? "+" : ""}${fmt(t.delta, k.decimals)} ${k.unit}`;
        c.trendEl.title = `Tendência: ${TREND_LABEL[t.dir]} (média dos últimos 5 s vs 5 s anteriores)`;
      }

      healthEl.dataset.state = result.state;
      healthScore.textContent = result.score ?? "—";
      healthState.textContent = STATE_LABEL[result.state];
      healthBar.style.width = `${result.score ?? 0}%`;
      return result;
    },
  };
}
