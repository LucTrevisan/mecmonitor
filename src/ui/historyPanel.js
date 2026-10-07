// Telemetry history panel: one filter row (range + Gráfico/Tabela) scoping small multiples, one card
// per KPI (single series, one axis each). Shared crosshair + tooltip across the cards; keyboard
// (arrows) shows the same readout as hover; the table view is the accessible twin of the charts.
import { RANGES } from "../telemetry/historyStore.js";
import { renderChart, SERIES_COLOR } from "./historyChart.js";
import { stateIcon, stateLabel, STATES, trendText } from "./states.js";
import { classify } from "../health.js";

const REFRESH_MS = 1000;
const TABLE_ROWS = 30;
const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmmss = (t) => new Date(t).toLocaleTimeString("pt-BR");

/**
 * @param root     #historyPanel
 * @param store    history store (telemetry/historyStore.js)
 * @param kpis     KPI definitions to chart (order = card order)
 * @param tagOf    kpiKey → instrument tag
 * @param getResult () => latest dashboard evaluation (state / trend per KPI)
 * @param getSource () => "realtime" | "simulation" | undefined
 */
export function createHistoryPanel(root, { store, kpis, tagOf, isSecondary = () => false, getResult, getSource, sourceText }) {
  const $ = (s) => root.querySelector(s);
  const charts = $(".hp-charts");
  const tableWrap = $(".hp-table");
  const tooltip = $(".hp-tooltip");
  let range = "5m";
  let view = "chart";
  let hoverT = null;
  let timer = null;
  let window_ = { from: 0, to: 0 };
  const cards = {};
  const geometry = {};

  for (const k of kpis) {
    const card = document.createElement("article");
    card.className = "hp-card";
    card.dataset.kpi = k.key;
    card.innerHTML = `
      <header class="hp-card-head">
        <div class="hp-card-title"><span class="hp-name"></span> <span class="hp-tag"></span></div>
        <div class="hp-card-now"><span class="hp-value"></span><span class="hp-state"></span><span class="hp-trend"></span></div>
      </header>
      <div class="hp-summary"></div>
      <canvas class="hp-canvas" tabindex="0"></canvas>`;
    card.querySelector(".hp-name").textContent = k.label;
    card.querySelector(".hp-tag").textContent = isSecondary(k.key) ? `${tagOf(k.key)} · sec.` : tagOf(k.key);
    const canvas = card.querySelector(".hp-canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Gráfico de ${k.label} (${k.unit}) no intervalo selecionado. Use as setas para ler os valores.`);
    charts.appendChild(card);
    cards[k.key] = { card, canvas };

    canvas.addEventListener("pointermove", (e) => {
      const g = geometry[k.key];
      if (!g) return;
      hoverT = Math.min(window_.to, Math.max(window_.from, g.xToT(e.offsetX)));
      renderAll();
      showTooltip(e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => {
      hoverT = null;
      tooltip.hidden = true;
      renderAll();
    });
    canvas.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const stepT = (window_.to - window_.from) / 60;
      hoverT = Math.min(window_.to, Math.max(window_.from, (hoverT ?? window_.to) + (e.key === "ArrowRight" ? stepT : -stepT)));
      renderAll();
      const r = canvas.getBoundingClientRect();
      const g = geometry[k.key];
      showTooltip(r.left + (g?.hovered ? g.tToX(g.hovered.t) : r.width / 2), r.top + 20);
    });
    canvas.addEventListener("blur", () => {
      tooltip.hidden = true;
    });
  }

  function computeWindow() {
    const to = Date.now();
    window_ = { from: to - RANGES[range].ms, to };
  }

  function renderCards() {
    const result = getResult?.();
    for (const k of kpis) {
      const { card, canvas } = cards[k.key];
      const item = result?.kpis[k.key];
      const state = item?.state ?? "nodata";
      card.dataset.state = state;
      card.querySelector(".hp-value").textContent = item?.value == null ? "—" : `${fmt(item.value, k.decimals)} ${k.unit}`;
      card.querySelector(".hp-state").innerHTML = `${stateIcon(state)}<span>${stateLabel(state)}</span>`;
      card.querySelector(".hp-trend").textContent = state !== "nodata" && item?.trend ? trendText(item.trend, k.decimals) : "";
      const s = store.summary(k.key, window_.from, window_.to);
      card.querySelector(".hp-summary").textContent = s
        ? `mín ${fmt(s.min, k.decimals)} · méd ${fmt(s.mean, k.decimals)} · máx ${fmt(s.max, k.decimals)} ${k.unit} · ${s.count} leituras`
        : "Sem leituras neste intervalo";
      if (view === "chart") {
        const n = Math.max(30, Math.floor((canvas.clientWidth - 120) / 3));
        const buckets = store.buckets(k.key, window_.from, window_.to, n);
        geometry[k.key] = renderChart(canvas, { buckets, from: window_.from, to: window_.to, kpi: k, hoverT });
      }
    }
  }

  function renderTable() {
    const tbody = tableWrap.querySelector("tbody");
    const thead = tableWrap.querySelector("thead tr");
    if (!thead.children.length) {
      for (const label of ["Hora", ...kpis.map((k) => `${k.label} (${k.unit})`)]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = label;
        thead.appendChild(th);
      }
    }
    const cols = kpis.map((k) => store.buckets(k.key, window_.from, window_.to, TABLE_ROWS));
    tbody.replaceChildren();
    for (let i = TABLE_ROWS - 1; i >= 0; i--) {
      const any = cols.find((c) => c[i]);
      if (!any) continue;
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = hhmmss(any[i].t);
      tr.appendChild(th);
      kpis.forEach((k, j) => {
        const td = document.createElement("td");
        const b = cols[j][i];
        if (b) {
          const st = classify(b.mean, k);
          td.textContent = `${st === "normal" ? "" : STATES[st].glyph + " "}${fmt(b.mean, k.decimals)}`;
          if (st !== "normal") td.title = STATES[st].label;
          td.dataset.state = st;
        } else td.textContent = "—";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  }

  function renderAll() {
    computeWindow();
    renderCards();
    if (view === "table") renderTable();
    $(".hp-source").textContent = sourceText?.[getSource?.()] ?? "";
  }

  function showTooltip(clientX, clientY) {
    if (hoverT == null) return;
    const rows = kpis
      .map((k) => {
        const h = geometry[k.key]?.hovered;
        return h ? { k, h } : null;
      })
      .filter(Boolean);
    if (!rows.length) {
      tooltip.hidden = true;
      return;
    }
    tooltip.replaceChildren();
    const time = document.createElement("div");
    time.className = "hp-tt-time";
    time.textContent = hhmmss(rows[0].h.t);
    tooltip.appendChild(time);
    for (const { k, h } of rows) {
      const row = document.createElement("div");
      row.className = "hp-tt-row";
      const key = document.createElement("i");
      key.className = "hp-tt-key";
      key.style.background = SERIES_COLOR;
      const val = document.createElement("strong");
      const st = classify(h.mean, k);
      val.textContent = `${fmt(h.mean, k.decimals)} ${k.unit}`;
      const lab = document.createElement("span");
      lab.textContent = `${k.label}${st === "normal" ? "" : ` · ${STATES[st].glyph} ${STATES[st].label}`}`;
      row.append(key, val, lab);
      tooltip.appendChild(row);
    }
    tooltip.hidden = false;
    const pr = root.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const x = Math.min(pr.width - tw - 8, Math.max(8, clientX - pr.left + 14));
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${Math.max(8, clientY - pr.top + 14)}px`;
  }

  // filters (one row above everything they scope)
  root.querySelectorAll("[data-range]").forEach((b) =>
    b.addEventListener("click", () => {
      range = b.dataset.range;
      root.querySelectorAll("[data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderAll();
    }),
  );
  root.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view;
      root.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      charts.hidden = view !== "chart";
      tableWrap.hidden = view !== "table";
      tooltip.hidden = true;
      renderAll();
    }),
  );
  $(".hp-close").addEventListener("click", () => api.close());
  // Capture phase: Esc closes the history before it reaches the sensor panel's handler.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !root.hidden) {
        e.stopImmediatePropagation();
        api.close();
      }
    },
    true,
  );
  window.addEventListener("resize", () => !root.hidden && renderAll());

  const api = {
    get open() {
      return !root.hidden;
    },
    get range() {
      return range;
    },
    get view() {
      return view;
    },
    /** Opens the panel; focusKey scrolls to and highlights that KPI's chart. */
    show({ focusKey } = {}) {
      root.hidden = false;
      document.body.classList.add("history-open");
      renderAll();
      clearInterval(timer);
      timer = setInterval(renderAll, REFRESH_MS);
      if (focusKey && cards[focusKey]) {
        const { card } = cards[focusKey];
        card.scrollIntoView({ block: "nearest" });
        card.classList.remove("flash");
        void card.offsetWidth;
        card.classList.add("flash");
      }
    },
    close() {
      root.hidden = true;
      tooltip.hidden = true;
      hoverT = null;
      clearInterval(timer);
      document.body.classList.remove("history-open");
    },
    toggle() {
      root.hidden ? api.show() : api.close();
    },
    /** Test/tooling hook: set the crosshair time and re-render. */
    hoverAt(t) {
      hoverT = t;
      renderAll();
      return Object.fromEntries(kpis.map((k) => [k.key, geometry[k.key]?.hovered ?? null]));
    },
  };
  return api;
}
