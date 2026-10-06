// Header status (presentation only). The health state comes from health.evaluate();
// the device chip stays "sem conexão" while data is simulated.
import { STATE_LABEL } from "./config/kpis.js";

const STALE_MS = 5000;

export function createHeader() {
  const health = document.getElementById("chipHealth");
  const healthLabel = health.querySelector(".chip-label");
  const updated = document.getElementById("lastUpdate");
  let lastTs = 0;

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
    if (lastTs && Date.now() - lastTs > STALE_MS) setHealth("idle", "SEM DADOS");
  }, 1000);

  return {
    onSample(sample, health) {
      lastTs = sample.timestamp;
      setHealth(health.state, STATE_LABEL[health.state]);
      const d = new Date(sample.timestamp);
      updated.textContent = d.toLocaleTimeString("pt-BR");
      updated.dateTime = d.toISOString();
    },
  };
}
