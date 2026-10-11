// Performance report (structural metrics that do not depend on the GPU): draw calls, active triangles,
// meshes, pickable meshes, materials, textures (estimated memory), render targets, per-frame observers and
// the CPU time of a frame, in every visualization mode. Headless Chrome renders in software, so absolute
// FPS here means nothing for the Quest; the structure (what is drawn, how often) is the same.
// Usage: npm run build && npm run test:perf        (exit code 1 if a budget is exceeded)
import { preview } from "vite";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BROWSERS = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"];
const executablePath = process.env.CHROME_PATH || BROWSERS.find(existsSync);

// Budgets per frame (one view). In the headset each eye is a view: without multiview the GPU work doubles.
// Quest 2/3 guidance for 72 Hz: a few hundred draw calls and ~1 M triangles per eye at most.
// The budgets guard against regressions of the current structure (measured in Fase 12).
export const BUDGET = { drawCalls: 200, triangles: 1_000_000, textureMB: 80, pickable: 40 };

const server = await preview({ preview: { port: 4178, strictPort: true }, logLevel: "warn" });
const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
let failed = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.mecmonitor?.ready && window.mecmonitor.modes && window.mecmonitor.training, { timeout: 120000 });
  await page.evaluate(() => {
    const { scene, engine } = window.mecmonitor;
    const dc = engine._drawCalls;
    const perf = (window.__perf = { cpu: [], draws: [], tris: [] });
    let t0 = 0;
    scene.onBeforeRenderObservable.add(() => {
      t0 = performance.now();
      dc?.fetchNewFrame();
    }, undefined, true);
    scene.onAfterRenderObservable.add(() => {
      dc?.addCount(0, true);
      perf.cpu.push(performance.now() - t0);
      perf.draws.push(dc?.current ?? NaN);
      perf.tris.push(scene.getActiveIndices() / 3);
      if (perf.cpu.length > 60) {
        perf.cpu.shift();
        perf.draws.shift();
        perf.tris.shift();
      }
    });
  });
  const measure = async (label, setup) => {
    await page.evaluate(setup);
    await new Promise((r) => setTimeout(r, 2500));
    const m = await page.evaluate(() => {
      const { scene } = window.mecmonitor;
      const p = window.__perf;
      const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN;
      const texBytes = scene.textures.reduce((sum, t) => {
        const s = t.getSize?.() ?? { width: 0, height: 0 };
        const faces = t.isCube ? 6 : 1;
        return sum + s.width * s.height * 4 * faces * (t.noMipmap ? 1 : 1.33);
      }, 0);
      return {
        drawCalls: median(p.draws),
        triangles: Math.round(median(p.tris)),
        activeMeshes: scene.getActiveMeshes().length,
        meshes: scene.meshes.length,
        pickable: scene.meshes.filter((m) => m.isPickable && m.isEnabled()).length,
        materials: scene.materials.length,
        textures: scene.textures.length,
        textureMB: +(texBytes / 1048576).toFixed(1),
        renderTargets: (scene.effectLayers ?? []).filter((l) => l.isEnabled && l.shouldRender?.()).length + scene.customRenderTargets.length,
        observers: scene.onBeforeRenderObservable.observers.length + scene.onAfterRenderObservable.observers.length,
        cpuMs: +median(p.cpu).toFixed(1),
      };
    });
    rows.push({ label, ...m });
  };

  await measure("NORMAL", () => window.mecmonitor.modes.set("normal"));
  await measure("NORMAL + sensor selecionado", () => window.mecmonitor.twin.select("max6675"));
  await measure("SENSORES", () => {
    window.mecmonitor.twin.clear();
    window.mecmonitor.modes.set("sensors");
  });
  await measure("RAIO-X", () => window.mecmonitor.modes.set("xray"));
  await measure("TÉRMICO", () => window.mecmonitor.modes.set("thermal"));
  await measure("TREINAMENTO (painel 3D)", () => {
    const { modes, vrTraining, camera } = window.mecmonitor;
    modes.set("normal");
    vrTraining.show(camera);
  });
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
  await server.close();
}

const cols = ["drawCalls", "triangles", "activeMeshes", "meshes", "pickable", "materials", "textures", "textureMB", "renderTargets", "observers", "cpuMs"];
console.log(["modo".padEnd(28), ...cols.map((c) => c.padStart(12))].join(""));
for (const r of rows) console.log([r.label.padEnd(28), ...cols.map((c) => String(r[c]).padStart(12))].join(""));
for (const r of rows) {
  for (const [k, max] of Object.entries(BUDGET)) {
    if (r[k] > max) {
      failed++;
      console.log(`ACIMA DO ORÇAMENTO  ${r.label}: ${k} = ${r[k]} (máx. ${max})`);
    }
  }
}
console.log(failed ? `\n${failed} item(ns) acima do orçamento` : "\nDentro do orçamento");
process.exit(failed ? 1 : 0);
