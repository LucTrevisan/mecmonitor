// Smoke test: serves dist/ with vite preview, opens it in headless Chrome/Edge and checks
// model load, camera/zoom, controls, simulation and console errors.
// Usage: npm run build && npm run test:smoke [-- screenshot.png]
import { preview } from "vite";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
];
const executablePath = process.env.CHROME_PATH || BROWSERS.find(existsSync);
const screenshot = process.argv[2];
const VIEWPORTS = {
  desktop: { width: 1366, height: 768 },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
};
const viewport = VIEWPORTS[process.env.VIEWPORT || "desktop"];

const server = await preview({ preview: { port: 4173, strictPort: true }, logLevel: "warn" });
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});

const errors = [];
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

try {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));

  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.mecmonitor?.ready, { timeout: 120000 });

  const info = await page.evaluate(() => {
    const { scene, pump, camera } = window.mecmonitor;
    const b = pump.bounds;
    return {
      meshes: scene.meshes.length,
      parts: pump.parts.length,
      cameras: scene.cameras.map((c) => c.name),
      size: b.max.subtract(b.min).asArray().map((v) => +v.toFixed(3)),
      minY: +b.min.y.toFixed(4),
      center: b.min.add(b.max).scale(0.5).asArray().map((v) => +v.toFixed(3)),
      radius: camera.radius,
      alpha: camera.alpha,
      loadingHidden: document.getElementById("loading").classList.contains("hidden"),
      vr: window.mecmonitor.vrSupport,
    };
  });
  check("Modelo carregado", info.parts > 150, `${info.parts} partes, ${info.meshes} meshes`);
  check("Câmera do SolidWorks descartada", info.cameras.length === 1, info.cameras.join(","));
  check("Base em y=0 e centrado", Math.abs(info.minY) < 1e-3 && Math.abs(info.center[0]) < 1e-3 && Math.abs(info.center[2]) < 1e-3, `min.y=${info.minY} centro=${info.center} tamanho=${info.size}`);
  check("Tela de carregamento oculta", info.loadingHidden);

  // Zoom (mouse wheel) and orbit (drag) on the canvas.
  const cx = viewport.width / 2, cy = viewport.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel({ deltaY: -400 });
  await new Promise((r) => setTimeout(r, 400));
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy, { steps: 10 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => ({ radius: window.mecmonitor.camera.radius, alpha: window.mecmonitor.camera.alpha }));
  check("Zoom funciona", after.radius < info.radius, `${info.radius.toFixed(2)} → ${after.radius.toFixed(2)}`);
  check("Órbita funciona", Math.abs(after.alpha - info.alpha) > 0.05, `alpha ${info.alpha.toFixed(2)} → ${after.alpha.toFixed(2)}`);

  await page.click("#btnRecenter");
  const rec = await page.evaluate(() => window.mecmonitor.camera.radius);
  check("Recentrar funciona", Math.abs(rec - info.radius) < 1e-3, `raio ${rec.toFixed(2)}`);

  const ts1 = await page.evaluate(() => window.mecmonitor.lastSample?.timestamp);
  await new Promise((r) => setTimeout(r, 2200));
  const sim = await page.evaluate(() => ({ t: document.getElementById("simTemp").textContent, tag: document.querySelector(".sim-tag").textContent, src: window.mecmonitor.lastSample?.source, ts: window.mecmonitor.lastSample?.timestamp }));
  check("Simulação atualiza", sim.t !== "—" && sim.ts > ts1, `amostra +${sim.ts - ts1} ms, ${sim.t}`);
  check("Rótulo SIMULAÇÃO visível", sim.tag.includes("SIMULAÇÃO") && sim.src === "simulation");

  const vrBtn = await page.$eval("#btnVR", (b) => ({ disabled: b.disabled, title: b.title }));
  check("Botão VR coerente sem headset", vrBtn.disabled && vrBtn.title.length > 0, vrBtn.title);

  const fsBtn = await page.$("#btnFullscreen");
  check("Botão tela cheia presente", !!fsBtn);

  // Etapa 1 — header, control groups and layout.
  const ui = await page.evaluate(() => {
    const visible = (s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== "none"; };
    const txt = (s) => document.querySelector(s)?.textContent.trim().replace(/\s+/g, " ") ?? "";
    const rect = (s) => document.querySelector(s).getBoundingClientRect();
    const overlap = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    const [h, d, s] = ["#topbar", "#dock", "#simPanel"].map(rect);
    const modes = [...document.querySelectorAll("[data-mode]")].map((b) => ({ mode: b.dataset.mode, pressed: b.getAttribute("aria-pressed"), disabled: b.disabled }));
    return {
      title: txt(".brand-title"),
      sub: txt(".brand-sub"),
      asset: txt("#assetName"),
      assetVisible: visible("#assetName"),
      health: txt("#chipHealth"),
      healthState: document.getElementById("chipHealth").dataset.state,
      device: txt("#chipDevice"),
      updated: txt("#lastUpdate"),
      groups: [...document.querySelectorAll(".group-label")].map((e) => e.textContent.trim()),
      modes,
      overlaps: { headerDock: overlap(h, d), headerSim: overlap(h, s), dockSim: overlap(d, s) },
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      inView: [h, d, s].every((r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight),
    };
  });
  check("Header: marca e equipamento", ui.title === "MECMONITOR" && ui.sub === "Digital Twin · Predictive Maintenance" && ui.asset === "Bomba Centrífuga · P-01");
  check("Header: equipamento visível", ui.assetVisible);
  check("Header: status NORMAL", ui.health === "NORMAL" && ui.healthState === "normal", ui.health);
  check("Header: ESP32 não aparece como conectado", ui.device.includes("ESP32") && ui.device.includes("sem conexão"), ui.device);
  check("Header: última atualização", /^\d{2}:\d{2}:\d{2}$/.test(ui.updated), ui.updated);
  check("Grupos Visualização/Câmera/Imersão", ui.groups.join("|") === "Visualização|Câmera|Imersão", ui.groups.join("|"));
  check("Modo Normal ativo, demais desabilitados", ui.modes[0].pressed === "true" && ui.modes.slice(1).every((m) => m.disabled), ui.modes.map((m) => m.mode).join(","));
  check("Painéis sem sobreposição", !Object.values(ui.overlaps).some(Boolean), JSON.stringify(ui.overlaps));
  check("Painéis dentro da tela", ui.inView);
  check("Sem scroll horizontal", !ui.hScroll);

  if (screenshot) {
    await page.click("#btnRecenter");
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: screenshot });
  }
} catch (e) {
  check("Execução do teste", false, String(e));
} finally {
  await browser.close();
  await server.close();
}

check("Console sem erros", errors.length === 0, errors.slice(0, 5).join(" | "));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} falha(s)` : "\nTodos os testes passaram");
process.exit(failed ? 1 : 0);
