// Header status (presentation only). Health state comes from the dashboard evaluation; data source
// and device state come from TelemetryService. Simulated data is never shown as "DADOS REAIS".
import { STALE_MS } from "./config/kpis.js";
import { stateIcon, stateLabel } from "./ui/states.js";

export const SOURCE_TEXT = { realtime: "● DADOS REAIS", simulation: "◐ SIMULAÇÃO" };
// Device connectivity: symbol + text + color.
const DEVICE = {
  online: ["online", "● ONLINE"],
  connecting: ["idle", "◌ CONECTANDO"],
  offline: ["offline", "○ OFFLINE"],
  error: ["critical", "✖ ERRO"],
};

export function createHeader() {
  const health = document.getElementById("chipHealth");
  const updated = document.getElementById("lastUpdate");
  const sourceChip = document.getElementById("chipSource");
  const sourceLabel = sourceChip.querySelector(".chip-label");
  const sourceTag = document.getElementById("sourceTag");
  const device = document.getElementById("chipDevice");
  const deviceDetail = device.querySelector(".chip-detail");
  const dashboard = document.getElementById("dashboard");
  let lastArrival = 0;

  // Expose the real header height so panels below it never overlap when it wraps (mobile).
  const topbar = document.getElementById("topbar");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--header-h", `${topbar.offsetHeight}px`);
  }).observe(topbar);
  const dock = document.getElementById("dock");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
  }).observe(dock);

  // Whole stream silent: dim the dashboard (per-KPI SEM DADOS comes from the dashboard itself).
  setInterval(() => {
    const stale = lastArrival && Date.now() - lastArrival > STALE_MS;
    dashboard.classList.toggle("stale", Boolean(stale));
  }, 1000);

  return {
    /** Health chip: icon + text + color from the dashboard evaluation. */
    setHealth(result) {
      health.dataset.state = result.state;
      health.innerHTML = `${stateIcon(result.state)}<span class="chip-label">${stateLabel(result.state)}</span>`;
    },
    onSample(sample) {
      lastArrival = Date.now();
      dashboard.classList.remove("stale");
      // The tag follows the source of the data actually on screen.
      sourceTag.dataset.kind = sample.source;
      sourceTag.textContent = SOURCE_TEXT[sample.source] ?? "—";
      const d = new Date(sample.timestamp);
      updated.textContent = d.toLocaleTimeString("pt-BR");
      updated.dateTime = d.toISOString();
    },
    onStatus(status) {
      const real = status.kind === "realtime";
      sourceChip.dataset.state = real ? (status.connection === "online" ? "online" : "offline") : "sim";
      sourceLabel.textContent = real ? "DADOS REAIS" : status.kind ? "SIMULAÇÃO" : "—";
      sourceChip.title = real ? `Dados reais via ${status.label}${status.detail ? " · " + status.detail : ""}` : "Dados gerados por simulação — não são leituras reais";

      if (!real) {
        device.dataset.state = "offline";
        deviceDetail.textContent = DEVICE.offline[1];
        device.title = "Nenhum ESP32 conectado — exibindo dados simulados";
        return;
      }
      const [state, text] = DEVICE[status.connection] ?? DEVICE.offline;
      device.dataset.state = state;
      deviceDetail.textContent = text;
      device.title = `${status.label}${status.detail ? " · " + status.detail : ""}`;
    },
  };
}
