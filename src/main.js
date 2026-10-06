import "./style.css";
import { createEngine, createScene, createGround, frameCamera } from "./scene.js";
import { loadPump, placePump } from "./modelLoader.js";
import { startSimulation } from "./simulation.js";
import { checkVRSupport, setupXR } from "./xr.js";
import { createHeader } from "./header.js";
import { createDashboard } from "./dashboard.js";

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
  startSimulation((s) => {
    app.lastSample = s;
    app.health = dashboard.update(s);
    header.onSample(s, app.health);
  });
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

async function wireVR(ground) {
  const btn = $("btnVR");
  const support = await checkVRSupport();
  app.vrSupport = support;
  if (!support.supported) {
    btn.title = support.reason;
    return;
  }
  try {
    const { enter } = await setupXR(scene, ground);
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

    const size = pump.bounds.max.subtract(pump.bounds.min);
    const ground = createGround(scene, Math.max(size.length() * 4, 10));
    frameCamera(camera, pump.bounds);

    app.recenter = () => frameCamera(camera, pump.bounds);
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
    wireVR(ground);
  } catch (e) {
    console.error("Falha ao carregar o modelo:", e);
    $("loading").classList.add("error");
    $("loadingText").textContent = "Erro ao carregar o modelo 3D. Veja o console.";
  }
}

init();
