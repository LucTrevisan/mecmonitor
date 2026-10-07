// Emulated-XR test: injects Meta's IWER (Immersive Web Emulation Runtime) into the page as a
// Meta Quest 3 and drives a real WebXR session in headless Chrome. IWER is a devDependency and is
// never bundled into the app.
// Usage: npm run build && npm run test:xr
import { preview } from "vite";
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const IWER_SRC = readFileSync(require.resolve("iwer/build/iwer.min.js"), "utf8");
const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
];
const executablePath = process.env.CHROME_PATH || BROWSERS.find(existsSync);
const IN_XR = 2;
const NOT_IN_XR = 3;

const results = [];
const errors = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const info = (name, detail) => results.push({ name, ok: true, detail, info: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: "warn" });
const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.evaluateOnNewDocument(
    `${IWER_SRC};\nwindow.__xrDevice = new IWER.XRDevice(IWER.metaQuest3);\nwindow.__xrDevice.installRuntime({ forceInstall: true });`,
  );

  await page.goto(server.resolvedUrls.local[0], { waitUntil: "load" });
  await page.waitForFunction(() => window.mecmonitor?.ready && window.mecmonitor.xr, { timeout: 120000 });

  const pre = await page.evaluate(() => ({
    support: window.mecmonitor.vrSupport,
    btnDisabled: document.getElementById("btnVR").disabled,
    panel: window.mecmonitor.vrPanel.visible,
  }));
  check("XR detectado (Quest 3 emulado)", pre.support.supported === true, JSON.stringify(pre.support));
  check("Botão \"Entrar em VR\" habilitado", pre.btnDisabled === false);
  check("Painel VR oculto antes da sessão", pre.panel === false);

  const viewBefore = await page.evaluate(() => {
    const c = window.mecmonitor.camera;
    return { radius: c.radius, alpha: c.alpha, beta: c.beta, target: c.target.asArray() };
  });

  // Enter VR with a real click (requestSession needs a user gesture).
  await page.click("#btnVR");
  await page.waitForFunction((s) => window.mecmonitor.xr.helper.baseExperience.state === s, { timeout: 30000 }, IN_XR);
  await wait(1500);
  const inXR = await page.evaluate(() => {
    const { scene, xr, vrPanel, pump } = window.mecmonitor;
    const cam = scene.activeCamera;
    const p = cam.globalPosition;
    const toPanel = vrPanel.mesh.position.subtract(p);
    const b = pump.bounds;
    const inside = p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z;
    let frames = 0;
    const obs = scene.onAfterRenderObservable.add(() => frames++);
    return new Promise((resolve) =>
      setTimeout(() => {
        scene.onAfterRenderObservable.remove(obs);
        resolve({
          camClass: cam.getClassName(),
          pos: p.asArray().map((v) => +v.toFixed(2)),
          distToBench: +Math.hypot(p.x, p.z).toFixed(2),
          insideBench: inside,
          panelVisible: vrPanel.visible,
          panelDist: +Math.hypot(toPanel.x, toPanel.z).toFixed(2),
          panelDrop: +(p.y - vrPanel.mesh.position.y).toFixed(2),
          controllers: xr.helper.input.controllers.map((c) => c.inputSource.handedness + (c.inputSource.hand ? ":hand" : ":controller")),
          frames,
          sessionMode: xr.helper.baseExperience.sessionManager.sessionMode,
        });
      }, 1000),
    );
  });
  check("Sessão imersiva iniciada (WebXRCamera ativa)", inXR.camClass === "WebXRCamera" && inXR.sessionMode === "immersive-vr", `${inXR.camClass}, ${inXR.sessionMode}`);
  check("Renderizando frames XR", inXR.frames > 0, `${inXR.frames} frames/s (render por software)`);
  check("Painel VR visível à frente do usuário", inXR.panelVisible && Math.abs(inXR.panelDist - 0.85) < 0.1 && inXR.panelDrop > 0.2, `dist ${inXR.panelDist} m, ${inXR.panelDrop} m abaixo dos olhos`);
  check("Controles esquerdo e direito detectados", inXR.controllers.includes("left:controller") && inXR.controllers.includes("right:controller"), inXR.controllers.join(", "));
  info("Origem XR (corrigir na Fase 6)", `cabeça em ${inXR.pos.join(", ")}, ${inXR.distToBench} m do centro da bancada${inXR.insideBench ? " — DENTRO da bancada" : ""}`);
  info("Altura dos olhos", `${inXR.pos[1]} m (piso XR = base do modelo, y = 0)`);

  // Controllers → hands (the Quest switching to hand tracking) and back.
  await page.evaluate(() => (window.__xrDevice.primaryInputMode = "hand"));
  await wait(1500);
  const hands = await page.evaluate(() => window.mecmonitor.xr.helper.input.controllers.map((c) => c.inputSource.handedness + (c.inputSource.hand ? ":hand" : ":controller")));
  info("Troca controle → mãos (sem a feature de hand tracking ainda: Fase 7)", hands.join(", ") || "nenhuma fonte de entrada");
  await page.evaluate(() => (window.__xrDevice.primaryInputMode = "controller"));
  await wait(1500);
  const back = await page.evaluate(() => window.mecmonitor.xr.helper.input.controllers.map((c) => c.inputSource.handedness + (c.inputSource.hand ? ":hand" : ":controller")));
  check("Retorno mãos → controles", back.includes("left:controller") && back.includes("right:controller") && back.length === 2, back.join(", "));

  // Exit through the in-headset "Sair da imersão" button handler.
  await page.evaluate(() => window.mecmonitor.vrPanel.exitButton.onPointerUpObservable.notifyObservers({}));
  await page.waitForFunction((s) => window.mecmonitor.xr.helper.baseExperience.state === s, { timeout: 30000 }, NOT_IN_XR);
  await wait(800);
  const after = await page.evaluate(() => ({
    camClass: window.mecmonitor.scene.activeCamera.getClassName(),
    panel: window.mecmonitor.vrPanel.visible,
    exits: window.mecmonitor.vrPanel.exitRequests,
    radius: window.mecmonitor.camera.radius,
    alpha: window.mecmonitor.camera.alpha,
    beta: window.mecmonitor.camera.beta,
    target: window.mecmonitor.camera.target.asArray(),
  }));
  const viewDiff = Math.abs(after.radius - viewBefore.radius) + Math.abs(after.alpha - viewBefore.alpha) + Math.abs(after.beta - viewBefore.beta) + Math.hypot(...after.target.map((v, i) => v - viewBefore.target[i]));
  check("Vista desktop restaurada exatamente ao sair do VR", viewDiff < 1e-3, `raio ${viewBefore.radius.toFixed(2)} → ${after.radius.toFixed(2)}`);
  check("\"Sair da imersão\" encerra a sessão", after.exits === 1, `cliques=${after.exits}`);
  check("Câmera desktop restaurada e painel VR oculto", after.camClass === "ArcRotateCamera" && after.panel === false, after.camClass);

  // Desktop controls still work after leaving XR.
  await page.mouse.move(683, 384);
  await page.mouse.wheel({ deltaY: -400 });
  await wait(500);
  const r2 = await page.evaluate(() => window.mecmonitor.camera.radius);
  check("Zoom no desktop após sair do VR", r2 < after.radius, `${after.radius.toFixed(2)} → ${r2.toFixed(2)}`);

  // Re-enter once to confirm the session can be restarted without reloading.
  await page.click("#btnVR");
  await page.waitForFunction((s) => window.mecmonitor.xr.helper.baseExperience.state === s, { timeout: 30000 }, IN_XR);
  check("Reentrada no VR sem recarregar a página", true);
  await page.evaluate(() => window.mecmonitor.xr.exit());
  await page.waitForFunction((s) => window.mecmonitor.xr.helper.baseExperience.state === s, { timeout: 30000 }, NOT_IN_XR);
} catch (e) {
  check("Execução do teste XR", false, String(e));
} finally {
  await browser.close();
  await server.close();
}

check("Console sem erros", errors.length === 0, errors.slice(0, 5).join(" | "));
for (const r of results) console.log(`${r.info ? "INFO" : r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} falha(s)` : "\nTodos os testes XR passaram");
process.exit(failed ? 1 : 0);
