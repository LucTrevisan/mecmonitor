// Digital Twin integration: links KPIs, sensor hotspots, camera focus and the technical panel.
//   KPI click     → sensor → camera focus → technical panel
//   Hotspot click → sensor → KPI highlight → telemetry → history (camera stays where the user put it)
import { Matrix, PointerEventTypes, Vector3 } from "@babylonjs/core";
import { KPI_BY_KEY } from "../config/kpis.js";
import { SENSORS, SENSOR_BY_ID, SENSOR_BY_KPI } from "../config/sensors.js";
import { createCameraFocus } from "./cameraFocus.js";
import { createFraming } from "./framing.js";
import { createHotspots } from "./hotspots.js";
import { createSensorPanel } from "./sensorPanel.js";
import { SOURCE_TEXT } from "../header.js";
import { createSensorBodies } from "../sensors/sensorBodies.js";
import { createInteractionManager } from "../interaction/interactionManager.js";

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function createDigitalTwin({ scene, camera, canvas, dashboard, panelRoot, onHistory }) {
  const cameraFocus = createCameraFocus(scene, camera, canvas);
  const overlays = ["topbar", "dashboard", "dock"].map((id) => document.getElementById(id)).concat(panelRoot);
  const framing = createFraming(scene, camera, () => overlays);
  let selectedId = null;
  let last = { result: null, sample: null };

  const hotspots = createHotspots(scene, SENSORS, { onSelect: (id) => select(id, { focus: false }) });
  // Physical sensors + enlarged interaction volumes (the only pickable sensor geometry).
  const sensorBodies = createSensorBodies(scene, SENSORS, hotspots.anchors);

  // One business layer for every device (mouse, touch, XR controllers, hands): selecting a sensor
  // runs the same code whatever the input. Hands are wired from main.js (interaction/handInteraction.js).
  const interaction = createInteractionManager();
  const hovered = new Set();
  const refreshIndicator = (id) => sensorBodies.setIndicator(id, selectedId === id ? "select" : hovered.has(id) ? "hover" : null);
  for (const s of SENSORS) {
    interaction.addTarget({
      id: s.id,
      kind: "sensor",
      onHover(on) {
        on ? hovered.add(s.id) : hovered.delete(s.id);
        hotspots.setHover(hovered);
        refreshIndicator(s.id);
      },
      onSelect: () => select(s.id, { focus: false }),
    });
  }

  // Canvas input. Picks ONLY the interaction volumes (never the model meshes).
  const pickSensorAt = (x, y) => {
    const hit = scene.pick(x, y, sensorBodies.isCollider);
    return hit?.hit ? sensorBodies.idOf(hit.pickedMesh) : null;
  };
  scene.onPointerObservable.add((pi) => {
    if (scene.activeCamera?.getClassName() === "WebXRCamera") {
      // XR controller rays (Babylon pointer selection, already limited to interactive objects).
      const id = pi.pickInfo?.hit ? sensorBodies.idOf(pi.pickInfo.pickedMesh) : null;
      const src = `xr-pointer-${pi.event?.pointerId ?? 0}`;
      if (pi.type === PointerEventTypes.POINTERMOVE) interaction.hover(id, src);
      else if (pi.type === PointerEventTypes.POINTERDOWN && id) interaction.select(id, src);
      return;
    }
    const src = pi.event?.pointerType === "touch" ? "touch" : "mouse";
    if (pi.type === PointerEventTypes.POINTERTAP) {
      const id = pickSensorAt(scene.pointerX, scene.pointerY);
      if (id) interaction.select(id, src);
    } else if (pi.type === PointerEventTypes.POINTERMOVE && !pi.event.buttons) {
      const id = pickSensorAt(scene.pointerX, scene.pointerY);
      interaction.hover(id, src);
      canvas.style.cursor = id ? "pointer" : "";
    }
  });
  const panel = createSensorPanel(panelRoot, {
    onClose: () => clear(),
    onFocus: (id) => focus(id),
    onHistory: (sensor) => onHistory?.(sensor),
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
    const prev = selectedId;
    selectedId = id;
    hotspots.setSelected(id);
    if (prev) refreshIndicator(prev);
    refreshIndicator(id);
    dashboard.setSelected(s.kpi);
    panel.open(s);
    refreshPanel();
    if (moveCamera) focus(id);
  }

  function clear() {
    const prev = selectedId;
    selectedId = null;
    if (prev) refreshIndicator(prev);
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
    sensorBodies,
    interaction,
    /** Sensor id under a screen point (CSS px), via the interaction volumes. */
    pickSensorAt,
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
