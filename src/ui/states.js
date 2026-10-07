// Single source for operating states: every state is shown as icon + text + color (never color alone).

export const STATES = {
  normal: { label: "NORMAL", glyph: "✓", color: "#34d399" },
  alert: { label: "ALERTA", glyph: "⚠", color: "#fbbf24" },
  critical: { label: "CRÍTICO", glyph: "✖", color: "#f87171" },
  nodata: { label: "SEM DADOS", glyph: "–", color: "#8592a3" },
};

// 14×14 line icons (stroke = currentColor).
const ICONS = {
  normal: '<circle cx="7" cy="7" r="6"/><path d="M4.2 7.2l1.9 1.9 3.8-4"/>',
  alert: '<path d="M7 1.6l5.8 10.4H1.2z"/><path d="M7 5.6v3"/><path d="M7 10.4h.01"/>',
  critical: '<path d="M4.6 1.2h4.8l3.4 3.4v4.8l-3.4 3.4H4.6L1.2 9.4V4.6z"/><path d="M5 5l4 4M9 5l-4 4"/>',
  nodata: '<circle cx="7" cy="7" r="6" stroke-dasharray="2 2"/><path d="M4.5 7h5"/>',
};

export function stateIcon(state) {
  const body = ICONS[state] ?? ICONS.nodata;
  return `<svg class="state-icon" viewBox="0 0 14 14" aria-hidden="true">${body}</svg>`;
}

export const stateLabel = (state) => STATES[state]?.label ?? "—";

/** "↑ +4%" style trend text from a trend() result. */
export function trendText(t, decimals = 0) {
  if (!t || t.dir === "flat") return "→ estável";
  const arrow = t.dir === "up" ? "↑" : "↓";
  if (t.pct == null) return `${arrow} ${t.delta > 0 ? "+" : ""}${t.delta.toFixed(decimals)}`;
  const abs = Math.abs(t.pct);
  const n = abs < 1 ? abs.toFixed(1) : Math.round(abs).toString();
  return `${arrow} ${t.pct > 0 ? "+" : "−"}${n.replace(".", ",")}%`;
}
