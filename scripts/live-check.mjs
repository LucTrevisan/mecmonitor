// Live check (Fase 13): opens the PUBLISHED site (GitHub Pages) and verifies it works on the real hosting —
// secure context (required by WebXR), the GLB + Draco decoder + environment + logo loaded, no failed request,
// no console error, telemetry running, and the ?perf=1 HUD.
// Usage: npm run test:live [-- https://other.host/path/]
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const URL_ = process.argv[2] || "https://luctrevisan.github.io/mecmonitor/";
const BROWSERS = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"];
const executablePath = process.env.CHROME_PATH || BROWSERS.find(existsSync);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  process.stderr.write(`${ok ? "✓" : "✗"} ${name}\n`);
};

const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
const failed = [];
const loaded = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setCacheEnabled(false); // what a first-time visitor downloads
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => failed.push(`${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.url()} (HTTP ${r.status()})`);
    else loaded.push(r.url());
  });
  const t0 = Date.now();
  await page.goto(URL_, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.mecmonitor?.ready, { timeout: 180000, polling: 500 });
  const loadS = ((Date.now() - t0) / 1000).toFixed(1);
  await new Promise((r) => setTimeout(r, 3000));
  const st = await page.evaluate(() => ({
    secure: window.isSecureContext,
    protocol: location.protocol,
    xr: "xr" in navigator,
    glb: window.mecmonitor.pump?.pivot.getChildMeshes(false).filter((m) => m.metadata?.glb).length ?? 0,
    sample: window.mecmonitor.lastSample?.source ?? null,
    health: document.querySelector("#chipHealth .chip-label")?.textContent,
    vr: document.getElementById("btnVR").title || (document.getElementById("btnVR").disabled ? "desabilitado" : "habilitado"),
  }));
  const has = (re) => loaded.some((u) => re.test(u));
  check("Site publicado em contexto seguro (HTTPS — exigência do WebXR)", st.secure && st.protocol === "https:", `${st.protocol} · navigator.xr ${st.xr ? "presente" : "ausente"}`);
  check("Modelo 3D (GLB comprimido com Draco) carregado", st.glb > 200 && has(/\.glb(\?|$)/) && has(/draco_(decoder|wasm_wrapper)_gltf/), `${st.glb} peças · carregado em ${loadS} s`);
  check("Ambiente (environmentSpecular.env) e logo do SENAI carregados", has(/environmentSpecular\.env/) && has(/senai-sp-logo\.png/));
  check("Nenhuma requisição falhou", failed.length === 0, failed.slice(0, 3).join(" | "));
  check("Telemetria rodando (simulação rotulada)", st.sample === "simulation" && Boolean(st.health), `${st.sample} · ${st.health}`);
  const hud = await browser.newPage();
  await hud.goto(`${URL_}?perf=1`, { waitUntil: "load", timeout: 180000 });
  await hud.waitForFunction(() => /FPS/.test(document.getElementById("perfHud")?.textContent ?? ""), { timeout: 180000, polling: 500 });
  check("HUD de desempenho com ?perf=1", true, await hud.evaluate(() => document.getElementById("perfHud").textContent));
} catch (e) {
  check("Execução do teste no site publicado", false, String(e));
} finally {
  await browser.close();
}
check("Console sem erros no site publicado", errors.length === 0, errors.slice(0, 3).join(" | "));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n${bad} falha(s) — ${URL_}` : `\nSite publicado OK — ${URL_}`);
process.exit(bad ? 1 : 0);
