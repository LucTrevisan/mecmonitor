// Digital Twin integration: links KPIs, sensor hotspots, camera focus and the technical panel.
//   KPI click     → sensor → camera focus → technical panel
//   Hotspot click → sensor → KPI highlight → telemetry → history (camera stays where the user put it)
import { Matrix, Vector3 } from "@babylonjs/core";
import { KPI_BY_KEY } from "../config/kpis.js";
import { SENSORS, SENSOR_BY_ID, SENSOR_BY_KPI } from "../config/sensors.js";
import { createCameraFocus } from "./cameraFocus.js";
import { createFraming } from "./framing.js";
import { createHotspots } from "./hotspots.js";
import { createSensorPanel } from "./sensorPanel.js";
import { SOURCE_TEXT } from "../header.js";

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function createDigitalTwin({ scene, camera, canvas, dashboard, panelRoot }) {
  const cameraFocus = createCameraFocus(scene, camera, canvas);
  const overlays = ["topbar", "dashboard", "dock"].map((id) => document.getElementById(id)).concat(panelRoot);
  const framing = createFraming(scene, camera, () => overlays);
  let selectedId = null;
  let last = { result: null, sample: null };

  const hotspots = createHotspots(scene, SENSORS, { onSelect: (id) => select(id, { focus: false }) });
  const panel = createSensorPanel(panelRoot, {
    onClose: () => clear(),
    onFocus: (id) => focus(id),
  });

  function refreshPanel() {
    panel.update({
      result: last.result,
      sample: last.sample,
      history: dashboard.history,
      sourceLabel: SOURCE_TEXT[last.sample?.source] ?? "—",
    });
  }

  function focus(id) {
    const s = SENSOR_BY_ID[id];
    const target = hotspots.position(id);
    if (!s || !target) return Promise.resolve(false);
    framing.active = true; // keep the sensor in the area not covered by panels
    return cameraFocus.focus(target, s.view);
  }

  function select(id, { focus: moveCamera = false } = {}) {
    const s = SENSOR_BY_ID[id];
    if (!s) return;
    selectedId = id;
    hotspots.setSelected(id);
    dashboard.setSelected(s.kpi);
    panel.open(s);
    refreshPanel();
    if (moveCamera) focus(id);
  }

  function clear() {
    selectedId = null;
    hotspots.setSelected(null);
    dashboard.setSelected(null);
    panel.close();
    framing.active = false;
  }

  dashboard.onSelect((kpiKey) => {
    const s = SENSOR_BY_KPI[kpiKey];
    if (!s) return;
    if (selectedId === s.id) clear();
    else select(s.id, { focus: true });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selectedId) clear();
  });

  return {
    select,
    selectByKpi: (key) => SENSOR_BY_KPI[key] && select(SENSOR_BY_KPI[key].id, { focus: true }),
    clear,
    focus,
    /** Stops any focus transition and removes the panel-aware offset (used by "Recentrar"). */
    resetView() {
      cameraFocus.cancel();
      framing.reset();
    },
    get selected() {
      return selectedId;
    },
    get focusing() {
      return cameraFocus.animating;
    },
    hotspots,
    update(result, sample) {
      last = { result, sample };
      hotspots.update(result, KPI_BY_KEY, fmt);
      refreshPanel();
    },
    moveHotspot: (id, x, y, z) => hotspots.move(id, x, y, z),
    /** World → screen (CSS px) for the active camera, for tests and tooling. */
    project(p) {
      const cam = scene.activeCamera;
      const engine = scene.getEngine();
      const transform = cam.getViewMatrix().multiply(cam.getProjectionMatrix());
      const vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      return Vector3.Project(p, Matrix.Identity(), transform, vp);
    },
  };
}
