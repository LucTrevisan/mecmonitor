// Header status (presentation only). Health state comes from health.evaluate(); data source and
// device state come from TelemetryService. Simulated data is never shown as "TEMPO REAL".
import { STATE_LABEL } from "./config/kpis.js";

const STALE_MS = 5000;

export function createHeader() {
  const health = document.getElementById("chipHealth");
  const healthLabel = health.querySelector(".chip-label");
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

  const setHealth = (state, label) => {
    health.dataset.state = state;
    healthLabel.textContent = label;
  };

  setInterval(() => {
    const stale = lastArrival && Date.now() - lastArrival > STALE_MS;
    if (stale) setHealth("idle", "SEM DADOS");
    dashboard.classList.toggle("stale", Boolean(stale));
  }, 1000);

  return {
    onSample(sample, health) {
      lastArrival = Date.now();
      // The tag follows the source of the data actually on screen.
      sourceTag.dataset.kind = sample.source;
      sourceTag.textContent = sample.source === "realtime" ? "● TEMPO REAL" : "● SIMULAÇÃO";
      setHealth(health.state, STATE_LABEL[health.state]);
      const d = new Date(sample.timestamp);
      updated.textContent = d.toLocaleTimeString("pt-BR");
      updated.dateTime = d.toISOString();
    },
    onStatus(status) {
      const real = status.kind === "realtime";
      sourceChip.dataset.state = real ? (status.connection === "online" ? "online" : "offline") : "sim";
      sourceLabel.textContent = real ? "TEMPO REAL" : status.kind ? "SIMULAÇÃO" : "—";
      sourceChip.title = real ? `Dados reais via ${status.label}${status.detail ? " · " + status.detail : ""}` : "Dados gerados por simulação — não são leituras reais";

      if (!real) {
        device.dataset.state = "offline";
        deviceDetail.textContent = "sem conexão";
        device.title = "Nenhum ESP32 conectado — exibindo dados simulados";
        return;
      }
      const map = { online: ["online", "online"], connecting: ["idle", "conectando…"], offline: ["offline", "sem conexão"], error: ["critical", "erro"] };
      const [state, text] = map[status.connection] ?? map.offline;
      device.dataset.state = state;
      deviceDetail.textContent = text;
      device.title = `${status.label}${status.detail ? " · " + status.detail : ""}`;
    },
  };
}
