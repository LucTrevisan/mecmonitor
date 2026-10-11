// Legend of the TÉRMICO mode (desktop / mobile): T-01 value + level (text + swatch, never color alone),
// the color scale with the level boundaries, the data source and a disclaimer (one thermocouple, not a
// thermal camera). The same ramp colors the monitored region on the model.
import { THERMAL } from "../config/viewModes.js";
import { legendPosition, thermalColor } from "../twin/thermalScale.js";

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;

export function createThermalLegend(root, { config = THERMAL, fmt = (v) => v.toFixed(1) } = {}) {
  const { ticks, stops, levels } = config;
  const gradient = stops.map(([t, c]) => `${c} ${(legendPosition(t, ticks) * 100).toFixed(1)}%`).join(", ");
  let prev = 0;
  const segments = levels
    .map((l) => {
      const p = Number.isFinite(l.max) ? legendPosition(l.max, ticks) : 1;
      const html = `<span class="tl-level-name" style="left:${(prev * 100).toFixed(1)}%;width:${((p - prev) * 100).toFixed(1)}%">${l.label}</span>`;
      prev = p;
      return html;
    })
    .join("");
  const bounds = levels
    .filter((l) => Number.isFinite(l.max))
    .map((l) => `<i class="tl-bound" style="left:${(legendPosition(l.max, ticks) * 100).toFixed(1)}%"></i>`)
    .join("");
  const tickHtml = ticks.map((t) => `<span style="left:${(legendPosition(t, ticks) * 100).toFixed(1)}%">${t}</span>`).join("");

  root.innerHTML = `
    <div class="tl-head">
      <span class="tl-title">Modo térmico · T-01</span>
      <span class="tl-source"></span>
    </div>
    <div class="tl-read">
      <span class="tl-value">—</span>
      <span class="tl-level"><i class="tl-swatch" aria-hidden="true"></i><span class="tl-level-text">—</span></span>
    </div>
    <div class="tl-scale">
      <div class="tl-ticks" aria-hidden="true">${tickHtml}</div>
      <div class="tl-bar" role="img" style="background: linear-gradient(90deg, ${gradient})">${bounds}<i class="tl-marker" hidden></i></div>
      <div class="tl-levels" aria-hidden="true">${segments}</div>
    </div>
    <p class="tl-note">Estimativa visual a partir de um único termopar (T-01) na caixa do mancal; o restante, em cinza, não é medido. Não é termografia.</p>`;
  const $ = (s) => root.querySelector(s);
  const bar = $(".tl-bar");
  const marker = $(".tl-marker");

  return {
    /** st: viewModes.thermalState() */
    update(st) {
      if (!st) return;
      const noData = st.value == null;
      $(".tl-value").textContent = noData ? "SEM DADOS" : `${fmt(st.value, 1)} °C`;
      $(".tl-level-text").textContent = noData ? "–" : st.level;
      $(".tl-swatch").style.background = noData ? config.nodataColor : rgb(thermalColor(st.value, stops));
      $(".tl-source").textContent = st.source;
      $(".tl-source").dataset.kind = st.sourceKind ?? "";
      marker.hidden = noData;
      if (!noData) marker.style.left = `${(st.marker * 100).toFixed(1)}%`;
      root.dataset.level = st.levelId ?? "nodata";
      bar.setAttribute("aria-label", noData ? "Escala térmica: sem dados do T-01" : `Escala térmica: T-01 em ${fmt(st.value, 1)} °C, nível ${st.level}`);
    },
    toggle(on) {
      root.hidden = !on;
    },
    get visible() {
      return !root.hidden;
    },
  };
}
