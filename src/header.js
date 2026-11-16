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
  // connected to the broker/socket, but no reading from the board yet (ESP32 off or without internet)
  waiting: ["idle", "◌ AGUARDANDO"],
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
  let lastReal = 0; // arrival of the last REAL reading (the device chip only turns ONLINE with data)
  let lastStatus = null;

  const renderDevice = () => {
    if (!lastStatus || lastStatus.kind !== "realtime") return;
    let key = lastStatus.connection in DEVICE ? lastStatus.connection : "offline";
    if (key === "online" && (!lastReal || Date.now() - lastReal > STALE_MS)) key = "waiting";
    const [state, text] = DEVICE[key];
    device.dataset.state = state;
    deviceDetail.textContent = text;
    const via = `${lastStatus.label}${lastStatus.detail ? " · " + lastStatus.detail : ""}`;
    device.title = key === "waiting" ? `Conectado (${via}), aguardando leituras do ESP32 — confira se a placa está ligada e com internet` : via;
  };

  // Expose the real header height so panels below it never overlap when it wraps (mobile).
  const topbar = document.getElementById("topbar");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--header-h", `${topbar.offsetHeight}px`);
  }).observe(topbar);
  const dock = document.getElementById("dock");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
  }).observe(dock);
  // on narrow screens the training sheet must stop below the dashboard (the KPIs stay readable)
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--dash-h", `${dashboard.offsetHeight}px`);
  }).observe(dashboard);

  // Whole stream silent: dim the dashboard (per-KPI SEM DADOS comes from the dashboard itself).
  setInterval(() => {
    const stale = lastArrival && Date.now() - lastArrival > STALE_MS;
    dashboard.classList.toggle("stale", Boolean(stale));
    renderDevice();
  }, 1000);

  return {
    /** Health chip: icon + text + color from the dashboard evaluation. */
    setHealth(result) {
      health.dataset.state = result.state;
      health.innerHTML = `${stateIcon(result.state)}<span class="chip-label">${stateLabel(result.state)}</span>`;
    },
    onSample(sample) {
      lastArrival = Date.now();
      if (sample.source === "realtime") {
        lastReal = lastArrival;
        renderDevice();
      }
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
      if (lastStatus?.label !== status.label || lastStatus?.kind !== status.kind) lastReal = 0; // new source
      sourceChip.dataset.state = real ? (status.connection === "online" ? "online" : "offline") : "sim";
      sourceLabel.textContent = real ? "DADOS REAIS" : status.kind ? "SIMULAÇÃO" : "—";
      sourceChip.title = real ? `Dados reais via ${status.label}${status.detail ? " · " + status.detail : ""}` : "Dados gerados por simulação — não são leituras reais";

      lastStatus = status;
      if (!real) {
        device.dataset.state = "offline";
        deviceDetail.textContent = DEVICE.offline[1];
        device.title = "Nenhum ESP32 conectado — exibindo dados simulados";
        return;
      }
      renderDevice();
    },
  };
}
