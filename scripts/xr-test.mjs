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
// Waits for n XR frames: independent of the (software-rendered) frame rate.
let page;
const waitXRFrames = (n) =>
  page.evaluate(
    (n) =>
      new Promise((res) => {
        const sm = window.mecmonitor.xr.helper.baseExperience.sessionManager;
        let k = 0;
        const o = sm.onXRFrameObservable.add(() => {
          if (++k >= n) {
            sm.onXRFrameObservable.remove(o);
            res();
          }
        });
      }),
    n,
  );

const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: "warn" });
const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});

try {
  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  // IWER 2.5.0 bug (emulator only): getOffsetReferenceSpace passes the XRRigidTransform where its
  // XRSpace expects a mat4, so every offset space behaves as identity. Real headsets (and Babylon's own
  // teleport) rely on offset spaces; pass originOffset.matrix so the emulation is faithful.
  await page.evaluateOnNewDocument(
    `${IWER_SRC};
window.__xrDevice = new IWER.XRDevice(IWER.metaQuest3);
window.__xrDevice.installRuntime({ forceInstall: true });
{
  const P = IWER.XRReferenceSpace.prototype;
  const orig = P.getOffsetReferenceSpace;
  P.getOffsetReferenceSpace = function (o) { return orig.call(this, o && o.matrix ? o.matrix : o); };
}`,
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
  await waitXRFrames(6); // start pose on frame 2, panel re-placed on frame 3
  const inXR = await page.evaluate(() => {
    const { scene, xr, vrPanel, pump } = window.mecmonitor;
    const cam = scene.activeCamera;
    const p = cam.globalPosition;
    const toPanel = vrPanel.mesh.position.subtract(p);
    const b = pump.bounds;
    const inside = p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z;
    // Proves frames keep being rendered: wait for 3 rendered frames (up to 20 s, since software
    // rendering in CI can drop well below 1 fps). A fixed 1 s window was flaky.
    let frames = 0;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const finish = () => {
        scene.onAfterRenderObservable.remove(obs);
        clearTimeout(timer);
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
          frameMs: Math.round((performance.now() - t0) / Math.max(frames, 1)),
          sessionMode: xr.helper.baseExperience.sessionManager.sessionMode,
        });
      };
      const obs = scene.onAfterRenderObservable.add(() => ++frames >= 3 && finish());
      const timer = setTimeout(finish, 20000);
    });
  });
  check("Sessão imersiva iniciada (WebXRCamera ativa)", inXR.camClass === "WebXRCamera" && inXR.sessionMode === "immersive-vr", `${inXR.camClass}, ${inXR.sessionMode}`);
  check("Renderizando frames XR", inXR.frames >= 3, `${inXR.frames} frames, ~${inXR.frameMs} ms/frame (render por software)`);
  check("Painel VR visível à frente do usuário", inXR.panelVisible && Math.abs(inXR.panelDist - 0.85) < 0.1 && inXR.panelDrop > 0.2, `dist ${inXR.panelDist} m, ${inXR.panelDrop} m abaixo dos olhos`);
  check("Controles esquerdo e direito detectados", inXR.controllers.includes("left:controller") && inXR.controllers.includes("right:controller"), inXR.controllers.join(", "));
  // Fase 6 — start pose, tracking, safe teleport floor and ray targets.
  const pose = await page.evaluate(() => {
    const { scene, xr } = window.mecmonitor;
    const cam = scene.activeCamera;
    const p = cam.globalPosition;
    const f = cam.getForwardRay(1).direction;
    const c = xr.layout.center;
    const to = { x: c.x - p.x, z: c.z - p.z };
    const n = Math.hypot(to.x, to.z);
    return { x: p.x, y: p.y, z: p.z, start: xr.layout.start, facing: (f.x * to.x + f.z * to.z) / (Math.hypot(f.x, f.z) * n) };
  });
  check("Pose inicial fixa em frente à bancada (fora da faixa de segurança)", Math.abs(pose.x - pose.start.x) < 0.05 && Math.abs(pose.z - pose.start.z) < 0.05 && !inXR.insideBench, `cabeça em ${pose.x.toFixed(2)}; ${pose.y.toFixed(2)}; ${pose.z.toFixed(2)}`);
  check("Usuário olhando para a bancada", pose.facing > 0.97, `cos ${pose.facing.toFixed(3)}`);
  check("Altura real da cabeça preservada (local-floor)", Math.abs(pose.y - 1.6) < 0.05, `${pose.y.toFixed(2)} m`);

  // Physical movement maps 1:1 and in the right direction after the start-pose offset.
  const readHead = () => page.evaluate(() => {
    const cam = window.mecmonitor.scene.activeCamera;
    const f = cam.getForwardRay(1).direction;
    return { ...Object.fromEntries(["x", "y", "z"].map((k) => [k, cam.globalPosition[k]])), yaw: Math.atan2(f.x, f.z) };
  });
  await page.evaluate(() => {
    window.__xrDevice.position.z -= 1; // one step forward (WebXR forward = −z)
  });
  await waitXRFrames(3);
  const walked = await readHead();
  check("Andar 1 m para a frente aproxima da bancada 1 m", Math.abs(pose.z - walked.z - 1) < 0.05 && Math.abs(walked.x - pose.x) < 0.05, `z ${pose.z.toFixed(2)} → ${walked.z.toFixed(2)}`);
  await page.evaluate(() => {
    window.__xrDevice.position.y = 0.9; // crouch
  });
  await waitXRFrames(3);
  const crouch = await readHead();
  check("Agachar acompanha a altura da cabeça", Math.abs(crouch.y - 0.9) < 0.05, `${crouch.y.toFixed(2)} m`);
  await page.evaluate(() => {
    const d = window.__xrDevice;
    d.position.y = 1.6;
    d.position.z += 1;
    const s = Math.sin(Math.PI / 4);
    d.quaternion.set(0, s, 0, Math.cos(Math.PI / 4)); // turn the head 90°
  });
  await waitXRFrames(3);
  const turned = await readHead();
  const dyaw = Math.abs(((turned.yaw - walked.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  check("Girar a cabeça 90° gira a visão 90° sem deslocar a posição", Math.abs(dyaw - Math.PI / 2) < 0.06 && Math.hypot(turned.x - pose.x, turned.z - pose.z) < 0.05, `Δyaw ${((dyaw * 180) / Math.PI).toFixed(1)}°`);
  await page.evaluate(() => window.__xrDevice.quaternion.set(0, 0, 0, 1));
  await wait(600);

  const policy = await page.evaluate(() => {
    const { scene, xr, pump, vrPanel, twin } = window.mecmonitor;
    const tp = xr.helper.teleportation;
    const floors = tp?._floorMeshes ?? [];
    const ray = (x, z) => {
      const R = scene.getEngine().constructor; // keep imports out of the page: build the ray from camera utils
      const cam = scene.activeCamera;
      const r = cam.getForwardRay(10);
      r.origin.set(x, 3, z);
      r.direction.set(0, -1, 0);
      const hit = scene.pickWithRay(r, (m) => floors.includes(m));
      return hit?.hit ? hit.pickedMesh.name : null;
    };
    const model = pump.parts.find((m) => m.name === "House Bearing-1") ?? pump.parts[0];
    const pred = xr.helper.pointerSelection.raySelectionPredicate;
    return {
      floors: floors.map((m) => m.name).sort().join(),
      groundIsFloor: floors.some((m) => m.name === "ground"),
      benchCenter: ray(0, 0),
      tape: ray(0, 0.6),
      front: ray(0, 2.5),
      corridor: ray(-2, -1.5),
      blocksModel: xr.isBlocker ? null : null,
      rayModel: pred(model),
      rayGround: pred(scene.getMeshByName("ground")),
      rayPanel: pred(vrPanel.mesh),
      raySensor: pred(twin.sensorBodies.colliders.mpu6050),
    };
  });
  check("Teleporte só no piso seguro (o piso inteiro não é alvo)", policy.floors.includes("xrSafeFloor-front") && !policy.groundIsFloor, policy.floors);
  check("Teleporte impossível dentro da bancada e da faixa zebrada", policy.benchCenter === null && policy.tape === null && policy.front === "xrSafeFloor-front" && policy.corridor === "xrSafeFloor-back", JSON.stringify({ centro: policy.benchCenter, faixa: policy.tape, frente: policy.front, corredor: policy.corridor }));
  check("Raios dos controles só em objetos interativos", !policy.rayModel && !policy.rayGround && policy.rayPanel && policy.raySensor, JSON.stringify({ modelo: policy.rayModel, piso: policy.rayGround, painel: policy.rayPanel, sensor: policy.raySensor }));

  // Fase 7 — controllers → hands (the Quest switching to hand tracking), joints, one hand, and back.
  const sources = () => page.evaluate(() => window.mecmonitor.xr.helper.input.controllers.map((c) => c.inputSource.handedness + (c.inputSource.hand ? ":hand" : ":controller")));
  const readHands = () => page.evaluate(() => {
    const { scene, xr } = window.mecmonitor;
    const h = xr.hands;
    const cam = scene.activeCamera;
    const eye = cam.globalPosition;
    const right = cam.getDirection(new eye.constructor(1, 0, 0));
    const side = (s) => {
      const tracked = h.isTracked(s);
      const j = (n) => h.joint(s, n);
      const names = ["wrist", "thumb-tip", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "pinky-finger-tip"];
      const pts = names.map(j);
      const ok = tracked && pts.every((p) => p && Number.isFinite(p.x + p.y + p.z));
      return {
        tracked,
        allJoints: ok,
        distinct: ok && new Set(pts.map((p) => p.asArray().map((v) => v.toFixed(3)).join())).size === names.length,
        wristToIndex: ok ? pts[2].subtract(pts[0]).length() : null,
        nearHead: ok ? pts[0].subtract(eye).length() : null,
        lateral: ok ? pts[0].subtract(eye).dot(right) : null,
        markers: h.markers(s).filter((m) => m.isEnabled()).length,
      };
    };
    return { available: h.available, modes: h.modes, left: side("left"), right: side("right") };
  });

  await page.evaluate(() => (window.__xrDevice.primaryInputMode = "hand"));
  await page.waitForFunction(() => window.mecmonitor.xr.hands.isTracked("left") && window.mecmonitor.xr.hands.isTracked("right"), { timeout: 15000, polling: 200 });
  const hs = await readHands();
  const src2 = await sources();
  check("Hand tracking disponível (feature opcional)", hs.available === true);
  check("Troca controle → mãos sem recarregar e sem ponteiros duplicados", hs.modes.left === "hand" && hs.modes.right === "hand" && src2.length === 2, `${JSON.stringify(hs.modes)} · ${src2.join(", ")}`);
  check("Juntas das duas mãos (pulso, polegar, indicador, médio, anelar, mínimo)", hs.left.allJoints && hs.right.allJoints && hs.left.distinct && hs.right.distinct);
  check("Mapeamento anatômico coerente (pulso→indicador 10–22 cm, perto do corpo)", [hs.left, hs.right].every((s) => s.wristToIndex > 0.1 && s.wristToIndex < 0.22 && s.nearHead < 1.0), `pulso→indicador E ${hs.left.wristToIndex?.toFixed(3)} D ${hs.right.wristToIndex?.toFixed(3)} m`);
  check("Mão esquerda à esquerda, direita à direita (sem inversão)", hs.left.lateral < 0 && hs.right.lateral > 0, `E ${hs.left.lateral?.toFixed(2)} D ${hs.right.lateral?.toFixed(2)}`);
  check("Feedback discreto: 2 marcadores por mão (polegar e indicador)", hs.left.markers === 2 && hs.right.markers === 2);

  // Only one hand tracked (the other leaves the cameras' view), then it comes back.
  await page.evaluate(() => (window.__xrDevice.hands.left.connected = false));
  await page.waitForFunction(() => !window.mecmonitor.xr.hands.isTracked("left"), { timeout: 15000, polling: 200 });
  const one = await readHands();
  check("Uma mão só: a outra some sem afetar a rastreada", !one.left.tracked && one.left.markers === 0 && one.right.tracked && one.right.markers === 2 && one.modes.left === "none", JSON.stringify(one.modes));
  await page.evaluate(() => (window.__xrDevice.hands.left.connected = true));
  await page.waitForFunction(() => window.mecmonitor.xr.hands.isTracked("left"), { timeout: 15000, polling: 200 });
  check("Retorno do tracking da mão esquerda", (await readHands()).left.tracked);

  await page.evaluate(() => (window.__xrDevice.primaryInputMode = "controller"));
  await page.waitForFunction(() => window.mecmonitor.xr.hands.modes.right === "controller", { timeout: 15000, polling: 200 });
  const back = await sources();
  const hb = await readHands();
  check("Retorno mãos → controles (marcadores somem)", back.includes("left:controller") && back.includes("right:controller") && back.length === 2 && hb.left.markers + hb.right.markers === 0 && !hb.left.tracked, back.join(", "));

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

  // Re-enter with the desktop camera zoomed onto a sensor: the XR start must not inherit it.
  await page.evaluate(() => window.mecmonitor.twin.focus("rpm"));
  await page.waitForFunction(() => !window.mecmonitor.twin.focusing, { timeout: 15000 });
  await page.click("#btnVR");
  await page.waitForFunction((s) => window.mecmonitor.xr.helper.baseExperience.state === s, { timeout: 30000 }, IN_XR);
  await waitXRFrames(6);
  const re = await page.evaluate(() => {
    const p = window.mecmonitor.scene.activeCamera.globalPosition;
    const s = window.mecmonitor.xr.layout.start;
    return { d: Math.hypot(p.x - s.x, p.z - s.z), pos: [p.x, p.z].map((v) => v.toFixed(2)).join("; ") };
  });
  check("Reentrada no VR sem recarregar, na mesma pose inicial (independe da câmera desktop)", re.d < 0.05, re.pos);
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
