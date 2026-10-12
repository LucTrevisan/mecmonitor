// Retractable panels on phones (UX, presentation only): the dashboard KPI cards and the sensor panel
// details can be retracted so the pump stays visible. A class on the panel and aria-expanded on its
// button; CSS (phones only) decides what a retracted panel shows. The last choice is remembered in this
// browser (best effort: private windows may refuse storage). No business logic involved.

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until the page is reloaded */
  }
};

/**
 * @param {HTMLElement} panel element that receives `is-collapsed`
 * @param {HTMLButtonElement} button its toggle (aria-expanded)
 * @param {{ key: string, collapsedByDefault: boolean }} o
 */
function retractable(panel, button, { key, collapsedByDefault }) {
  const saved = read(key);
  let collapsed = saved == null ? collapsedByDefault : saved === "collapsed";
  const render = () => {
    panel.classList.toggle("is-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
  };
  button.addEventListener("click", () => {
    collapsed = !collapsed;
    write(key, collapsed ? "collapsed" : "expanded");
    render();
  });
  render();
  return {
    get collapsed() {
      return collapsed;
    },
  };
}

export function wireRetractablePanels() {
  const dashboard = document.getElementById("dashboard");
  const sensor = document.getElementById("sensorPanel");
  return {
    // KPI cards: retracted at first on short phone screens (the four values stay on the model's labels),
    // visible elsewhere; with a sensor open, phones show them as mini cards anyway (CSS)
    dashboard: retractable(dashboard, document.getElementById("btnDashToggle"), {
      key: "mecmonitor.ui.dashboard",
      collapsedByDefault: window.matchMedia("(max-width: 640px) and (max-height: 760px) and (orientation: portrait)").matches,
    }),
    // sensor panel: reading, state and actions first; details (chart, limits, telemetry) on demand
    sensor: retractable(sensor, sensor.querySelector(".sp-details-toggle"), { key: "mecmonitor.ui.sensorDetails", collapsedByDefault: true }),
  };
}
