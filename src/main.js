import "./style.css";
import { createEngine, createScene, createGround, frameCamera } from "./scene.js";
import { loadPump, placePump } from "./modelLoader.js";
import { checkVRSupport, createSafeFloor, setupXR } from "./xr.js";
import { computeLayout } from "./scene/layout.js";
import { createHeader } from "./header.js";
import { createDashboard } from "./dashboard.js";
import { createDigitalTwin } from "./twin/index.js";
import { applyColorOverrides } from "./twin/appearance.js";
import { COLOR_OVERRIDES } from "./config/appearance.js";
import { createVRPanel } from "./xr/vrPanel.js";
import { createLab } from "./scene/lab.js";
import { createHistoryStore } from "./telemetry/historyStore.js";
import { createHistoryPanel } from "./ui/historyPanel.js";
import { KPIS } from "./config/kpis.js";
import { SENSOR_BY_KPI } from "./config/sensors.js";
import { SOURCE_TEXT } from "./header.js";
import { createProvider, createTelemetryService, resolveTelemetryConfig } from "./telemetry/index.js";

const $ = (id) => document.getElementById(id);
const canvas = $("renderCanvas");

const engine = createEngine(canvas);
const { scene, camera } = createScene(engine, canvas);
engine.runRenderLoop(() => scene.render());

const app = { scene, camera, engine, ready: false };
window.mecmonitor = app;

function setProgress(fraction) {
  const pct = Math.round(fraction * 100);
  $("loadingFill").style.width = `${pct}%`;
  $("loadingText").textContent = `${pct}%`;
}

function wireDashboard() {
  const header = createHeader();
  const dashboard = createDashboard($("dashboard"));
  app.dashboard = dashboard;
  const telemetry = createTelemetryService();
  app.telemetry = telemetry;
  telemetry.onStatus((st) => header.onStatus(st));
  // Evaluation (incl. per-KPI SEM DADOS) is pushed on every sample and every second.
  dashboard.onResult((result) => {
    app.health = result;
    header.setHealth(result);
    app.twin?.update(result, app.lastSample);
  });
  // 24 h of history at 1 Hz (arrival time), shared by the history charts and the table view.
  const history = createHistoryStore(KPIS.map((k) => k.key));
  app.history = history;
  app.historyPanel = createHistoryPanel($("historyPanel"), {
    store: history,
    kpis: KPIS,
    tagOf: (key) => SENSOR_BY_KPI[key]?.tag ?? "",
    isSecondary: (key) => Boolean(SENSOR_BY_KPI[key]?.secondary),
    getResult: () => app.health,
    getSource: () => app.lastSample?.source,
    sourceText: SOURCE_TEXT,
  });
  $("btnHistory").addEventListener("click", () => app.historyPanel.toggle());
  telemetry.onSample((s) => {
    app.lastSample = s;
    const now = Date.now();
    for (const k of KPIS) history.push(k.key, now, s[k.key]);
    header.onSample(s);
    dashboard.update(s);
  });
  app.telemetryConfig = resolveTelemetryConfig(window.location.search);
  telemetry.use(createProvider(app.telemetryConfig));
}

function wireFullscreen() {
  $("btnFullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => {
    $("btnFullscreen").querySelector(".btn-label").textContent = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
  });
}

async function wireVR({ layout, pump }) {
  const btn = $("btnVR");
  // In-headset control panel with "Sair da imersão". Created even without XR support so it can be tested.
  const vrExit = { handler: null };
  app.vrPanel = createVRPanel(scene, { onExit: () => vrExit.handler?.() });
  const support = await checkVRSupport();
  app.vrSupport = support;
  if (!support.supported) {
    btn.title = support.reason;
    return;
  }
  try {
    // Teleport only onto the safe floor; the bench (model meshes) blocks the teleport arc.
    const safeFloor = createSafeFloor(scene, layout);
    const { xr, enter, exit, recenter, onImmersiveChange } = await setupXR(scene, {
      layout,
      safeFloor,
      isBlocker: (m) => m.isDescendantOf(pump.pivot) && !m.metadata?.sensorCollider,
      isInteractive: (m) => Boolean(m.metadata?.xrInteractive) && m.isEnabled(),
      onStartPose: (cam) => app.vrPanel.show(cam), // re-place the panel in front of the user at the start pose
    });
    app.xr = { helper: xr, enter, exit, recenter, safeFloor, layout }; // handles for tooling and the emulated-XR test
    vrExit.handler = () => exit().catch((e) => console.warn("Falha ao sair do VR:", e));
    // On exit Babylon copies the head pose into the desktop camera (it would end up inside the bench):
    // keep the desktop view from before the session and restore it.
    let desktopView = null;
    const restoreDesktopView = () => {
      if (!desktopView) return;
      camera.setTarget(desktopView.target.clone());
      camera.alpha = desktopView.alpha;
      camera.beta = desktopView.beta;
      camera.radius = desktopView.radius;
    };
    onImmersiveChange((inXR, xrCamera) => {
      if (inXR) {
        desktopView = { target: camera.target.clone(), alpha: camera.alpha, beta: camera.beta, radius: camera.radius };
        app.vrPanel.show(xrCamera);
      } else {
        app.vrPanel.hide();
        restoreDesktopView();
        scene.onAfterRenderObservable.addOnce(restoreDesktopView); // in case Babylon writes after the event
      }
    });
    btn.disabled = false;
    btn.addEventListener("click", () => enter().catch((e) => console.warn("Falha ao entrar em VR:", e)));
  } catch (e) {
    btn.title = "WebXR indisponível no Babylon.js neste navegador.";
    console.warn("WebXR:", e);
  }
}

async function init() {
  wireFullscreen();
  wireDashboard();

  try {
    const pump = await loadPump(scene, setProgress);
    app.pump = pump;
    app.recolored = applyColorOverrides(scene, COLOR_OVERRIDES);

    const size = pump.bounds.max.subtract(pump.bounds.min);
    const groundSize = Math.max(size.length() * 4, 10);
    const ground = createGround(scene, groundSize);
    app.layout = computeLayout(pump.bounds, groundSize); // floor plan shared by the lab and XR
    app.lab = createLab(scene, { pump, ground, groundSize }); // lab surroundings; never moves the model
    frameCamera(camera, pump.bounds);

    app.twin = createDigitalTwin({
      scene,
      camera,
      canvas,
      dashboard: app.dashboard,
      panelRoot: $("sensorPanel"),
      onHistory: (sensor) => app.historyPanel.show({ focusKey: sensor.kpi }),
    });
    if (app.health) app.twin.update(app.health, app.lastSample);

    app.recenter = () => {
      app.twin.resetView();
      frameCamera(camera, pump.bounds);
    };
    $("btnRecenter").addEventListener("click", app.recenter);

    // Console helper to fix model orientation without rebuilding (degrees).
    app.ajustarRotacaoGraus = (x = 0, y = 0, z = 0) => {
      const r = Math.PI / 180;
      pump.pivot.rotation.set(x * r, y * r, z * r);
      placePump(pump);
      frameCamera(camera, pump.bounds);
    };

    $("loading").classList.add("hidden");
    app.ready = true;
    wireVR({ layout: app.layout, pump });
  } catch (e) {
    console.error("Falha ao carregar o modelo:", e);
    $("loading").classList.add("error");
    $("loadingText").textContent = "Erro ao carregar o modelo 3D. Veja o console.";
  }
}

init();
