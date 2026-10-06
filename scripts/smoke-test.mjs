// Smoke test: serves dist/ with vite preview, opens it in headless Chrome/Edge and checks
// model load, camera/zoom, controls, simulation and console errors.
// Usage: npm run build && npm run test:smoke [-- screenshot.png]
import { preview } from "vite";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { WebSocketServer } from "ws";

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
  const sim = await page.evaluate(() => ({ t: document.querySelector('[data-kpi="temperature"] .kpi-num').textContent, tag: document.querySelector(".sim-tag").textContent, src: window.mecmonitor.lastSample?.source, ts: window.mecmonitor.lastSample?.timestamp }));
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
    const [h, d, s] = ["#topbar", "#dock", "#dashboard"].map(rect);
    const modes = [...document.querySelectorAll("[data-mode]")].map((b) => ({ mode: b.dataset.mode, pressed: b.getAttribute("aria-pressed"), disabled: b.disabled }));
    return {
      title: txt(".brand-title"),
      sub: txt(".brand-sub"),
      asset: txt("#assetName"),
      assetVisible: visible("#assetName") && document.getElementById("assetName").scrollWidth <= document.getElementById("assetName").clientWidth,
      health: txt("#chipHealth"),
      healthState: document.getElementById("chipHealth").dataset.state,
      device: txt("#chipDevice"),
      updated: txt("#lastUpdate"),
      dashState: txt(".health-state"),
      groups: [...document.querySelectorAll(".group-label")].map((e) => e.textContent.trim()),
      modes,
      overlaps: { headerDock: overlap(h, d), headerDash: overlap(h, s), dockDash: overlap(d, s) },
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      inView: [h, d, s].every((r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight),
    };
  });
  check("Header: marca e equipamento", ui.title === "MECMONITOR" && ui.sub === "Digital Twin · Predictive Maintenance" && ui.asset === "Bomba Centrífuga · P-01");
  check("Header: equipamento visível e sem truncar", ui.assetVisible);
  check("Header: status = estado da saúde", ui.health === ui.dashState && ["NORMAL", "ALERTA", "CRÍTICO"].includes(ui.health), `${ui.health} / ${ui.dashState}`);
  check("Header: ESP32 não aparece como conectado", ui.device.includes("ESP32") && ui.device.includes("sem conexão"), ui.device);
  check("Header: última atualização", /^\d{2}:\d{2}:\d{2}$/.test(ui.updated), ui.updated);
  check("Grupos Visualização/Câmera/Imersão", ui.groups.join("|") === "Visualização|Câmera|Imersão", ui.groups.join("|"));
  check("Modo Normal ativo, demais desabilitados", ui.modes[0].pressed === "true" && ui.modes.slice(1).every((m) => m.disabled), ui.modes.map((m) => m.mode).join(","));
  check("Painéis sem sobreposição", !Object.values(ui.overlaps).some(Boolean), JSON.stringify(ui.overlaps));
  check("Painéis dentro da tela", ui.inView);
  check("Sem scroll horizontal", !ui.hScroll);

  // Etapa 2 — dashboard
  const dash = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".kpi")].map((c) => ({
      key: c.dataset.kpi,
      state: c.dataset.state,
      num: c.querySelector(".kpi-num").textContent,
      unit: c.querySelector(".kpi-unit").textContent,
      stateText: c.querySelector(".kpi-state-text").textContent,
      dir: c.querySelector(".kpi-trend").dataset.dir,
    }));
    const score = Number(document.querySelector(".health-score").textContent);
    const overflow = [...document.querySelectorAll(".kpi, .health")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.kpi ?? "health");
    return { overflow, cards, score, healthState: document.querySelector(".health").dataset.state, app: window.mecmonitor.health };
  });
  check("4 KPIs na ordem", dash.cards.map((c) => c.key).join() === "temperature,vibration,current,rpm", dash.cards.map((c) => c.key).join());
  check("KPIs com valor, unidade, estado e tendência", dash.cards.every((c) => c.num !== "—" && c.unit && ["NORMAL", "ALERTA", "CRÍTICO"].includes(c.stateText) && ["up", "down", "flat"].includes(c.dir)), dash.cards.map((c) => `${c.num} ${c.unit} ${c.stateText} ${c.dir}`).join(" | "));
  check("Cards sem conteúdo vazando", dash.overflow.length === 0, dash.overflow.join());
  check("Saúde 0–100% coerente com a avaliação", dash.score >= 0 && dash.score <= 100 && dash.score === dash.app.score && dash.healthState === dash.app.state, `${dash.score}% ${dash.healthState}`);

  // Etapa 3 — data source labeling with the default (simulation) provider.
  const src = await page.evaluate(() => ({
    chip: document.querySelector("#chipSource .chip-label").textContent,
    chipState: document.getElementById("chipSource").dataset.state,
    tag: document.getElementById("sourceTag").textContent,
    device: document.getElementById("chipDevice").textContent.replace(/\s+/g, " ").trim(),
    status: window.mecmonitor.telemetry.status,
  }));
  check("Telemetria: provider padrão = simulação", src.status.providerId === "simulation" && src.status.connection === "online", JSON.stringify(src.status));
  check("Telemetria: rótulo SIMULAÇÃO (header + dashboard)", src.chip === "SIMULAÇÃO" && src.chipState === "sim" && src.tag === "● SIMULAÇÃO", `${src.chip} / ${src.tag}`);
  check("Telemetria: ESP32 sem conexão em simulação", src.device.includes("sem conexão"), src.device);

  // Etapa 4 — Digital Twin: hotspots, KPI ↔ sensor, camera focus, technical panel.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const twin0 = await page.evaluate(() => {
    const { twin, pump } = window.mecmonitor;
    const items = Object.values(twin.hotspots.items);
    const b = pump.pivot.getHierarchyBoundingVectors(true);
    return {
      ids: items.map((i) => i.sensor.id),
      near: items.map((i) => {
        const p = i.anchor.getAbsolutePosition();
        const { min, max } = i.node.getHierarchyBoundingVectors(true);
        const out = Math.max(min.x - p.x, p.x - max.x, min.y - p.y, p.y - max.y, min.z - p.z, p.z - max.z, 0);
        return { id: i.sensor.id, out: +out.toFixed(4) };
      }),
      bounds: [...b.min.asArray(), ...b.max.asArray()].map((v) => +v.toFixed(5)),
      ref: [...pump.bounds.min.asArray(), ...pump.bounds.max.asArray()].map((v) => +v.toFixed(5)),
      parts: pump.parts.length,
    };
  });
  check("Hotspots dos 4 sensores", twin0.ids.join() === "mpu6050,max6675,sct013,rpm", twin0.ids.join());
  check("Hotspots ancorados nas peças (≤ 2 cm)", twin0.near.every((n) => n.out <= 0.02), JSON.stringify(twin0.near));
  check("Geometria do modelo inalterada", twin0.bounds.join() === twin0.ref.join() && twin0.parts === info.parts, `${twin0.parts} partes`);

  // KPI → sensor → camera focus → panel (real click on the card).
  await page.click('.kpi[data-kpi="vibration"]');
  await page.waitForFunction(() => !window.mecmonitor.twin.focusing, { timeout: 15000 });
  await wait(300);
  const k1 = await page.evaluate(() => {
    const { twin, camera } = window.mecmonitor;
    const panel = document.getElementById("sensorPanel");
    const target = twin.hotspots.items.mpu6050.anchor.getAbsolutePosition();
    return {
      selected: twin.selected,
      pressed: document.querySelector('.kpi[data-kpi="vibration"]').getAttribute("aria-pressed"),
      panelOpen: !panel.hidden,
      model: panel.querySelector(".sp-model").textContent,
      value: panel.querySelector(".sp-value").textContent,
      kpiValue: document.querySelector('[data-kpi="vibration"] .kpi-num').textContent,
      history: panel.querySelector(".sp-history-count").textContent,
      spark: panel.querySelector(".sp-spark").width,
      source: panel.querySelector(".sp-source").textContent,
      dist: camera.target.subtract(target).length(),
      radius: camera.radius,
      highlighted: twin.hotspots.items.mpu6050.meshes.length,
      panelInView: (() => { const r = panel.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })(),
    };
  });
  check("KPI → sensor selecionado e KPI destacado", k1.selected === "mpu6050" && k1.pressed === "true", `${k1.selected} / ${k1.pressed}`);
  check("KPI → câmera focada no sensor", k1.dist < 0.005 && Math.abs(k1.radius - 0.75) < 0.01, `dist ${k1.dist.toFixed(4)} m, raio ${k1.radius.toFixed(2)}`);
  check("Painel técnico aberto com o sensor e o valor do KPI", k1.panelOpen && k1.model === "MPU6050" && k1.value === k1.kpiValue && k1.panelInView, `${k1.model} ${k1.value} / KPI ${k1.kpiValue}`);
  // The focused sensor must be visible: projected anchor lands on the canvas, not under a panel.
  await wait(800);
  const vis = await page.evaluate(() => {
    const { scene, camera, twin } = window.mecmonitor;
    const p = twin.hotspots.items.mpu6050.anchor.getAbsolutePosition();
    const engine = scene.getEngine();
    const m = scene.getTransformMatrix();
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const s = twin.project(p, m, vp);
    const el = document.elementFromPoint(s.x, s.y);
    return { x: Math.round(s.x), y: Math.round(s.y), onCanvas: el?.id === "renderCanvas" };
  });
  check("Sensor focado visível (fora dos painéis)", vis.onCanvas, `(${vis.x}, ${vis.y})`);
  check("Painel: histórico e origem dos dados", /^\d+ amostras$/.test(k1.history) && k1.spark > 0 && k1.source === "● SIMULAÇÃO", `${k1.history}, ${k1.source}`);

  // Sensor (hotspot click on the canvas) → KPI → telemetry/history; camera must not move.
  const hs = await page.evaluate(() => {
    const { twin, camera } = window.mecmonitor;
    const canvas = document.getElementById("renderCanvas");
    for (const it of Object.values(twin.hotspots.items)) {
      if (it.sensor.id === twin.selected) continue;
      const x = it.pill.centerX;
      const y = it.pill.centerY;
      if (x > 0 && y > 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y) === canvas) {
        return { id: it.sensor.id, kpi: it.sensor.kpi, x, y, target: camera.target.asArray(), radius: camera.radius };
      }
    }
    return null;
  });
  if (hs) {
    await page.mouse.click(hs.x, hs.y);
    await wait(400);
    const k2 = await page.evaluate((kpi) => ({
      selected: window.mecmonitor.twin.selected,
      pressed: document.querySelector(`.kpi[data-kpi="${kpi}"]`).getAttribute("aria-pressed"),
      panelSensor: document.getElementById("sensorPanel").dataset.sensor,
      target: window.mecmonitor.camera.target.asArray(),
      radius: window.mecmonitor.camera.radius,
    }), hs.kpi);
    const moved = Math.hypot(...k2.target.map((v, i) => v - hs.target[i])) + Math.abs(k2.radius - hs.radius);
    check("Hotspot (clique no modelo) → sensor + KPI + painel", k2.selected === hs.id && k2.pressed === "true" && k2.panelSensor === hs.id, `${hs.id}: ${k2.selected}/${k2.pressed}/${k2.panelSensor}`);
    check("Hotspot não move a câmera", moved < 1e-6, moved.toExponential(1));
  } else {
    check("Hotspot clicável visível", false, "nenhum hotspot livre de painéis na tela");
  }

  await page.click("#sensorPanel .sp-close");
  const closed = await page.evaluate(() => ({ hidden: document.getElementById("sensorPanel").hidden, sel: window.mecmonitor.twin.selected, pressed: document.querySelectorAll('.kpi[aria-pressed="true"]').length }));
  check("Fechar painel limpa a seleção", closed.hidden && closed.sel === null && closed.pressed === 0, JSON.stringify(closed));

  await page.click('.kpi[data-kpi="rpm"]');
  await page.keyboard.press("Escape");
  const esc = await page.evaluate(() => window.mecmonitor.twin.selected);
  check("Esc fecha o painel", esc === null, String(esc));

  await page.click("#btnRecenter");
  const rec2 = await page.evaluate(() => window.mecmonitor.camera.radius);
  check("Recentrar após foco restaura a vista", Math.abs(rec2 - info.radius) < 1e-3, `raio ${rec2.toFixed(2)}`);

  if (screenshot) {
    await page.click("#btnRecenter");
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: screenshot });
  }

  // Etapa 3 — real-time path: a local WebSocket server plays the ESP32.
  if (!process.env.SKIP_REALTIME) {
    const wss = new WebSocketServer({ port: 8091 });
    const payload = { temp: 61.4, vrms: 3.1, corrente: 4.1, rpm: 1748 };
    wss.on("connection", (sock) => {
      const id = setInterval(() => sock.readyState === 1 && sock.send(JSON.stringify(payload)), 500);
      sock.on("close", () => clearInterval(id));
    });
    const rt = await browser.newPage();
    await rt.setViewport(viewport);
    rt.on("pageerror", (e) => errors.push(`[realtime] ${e}`));
    rt.on("console", (m) => m.type() === "error" && !m.text().includes("WebSocket") && errors.push(`[realtime] ${m.text()}`));
    await rt.goto(`${url}?source=ws&url=ws://localhost:8091`, { waitUntil: "load" });
    await rt.waitForFunction(() => window.mecmonitor?.lastSample?.source === "realtime", { timeout: 30000 });
    const live = await rt.evaluate(() => ({
      chip: document.querySelector("#chipSource .chip-label").textContent,
      tag: document.getElementById("sourceTag").textContent,
      device: document.getElementById("chipDevice").dataset.state,
      temp: document.querySelector('[data-kpi="temperature"] .kpi-num').textContent,
      vib: document.querySelector('[data-kpi="vibration"] [class="kpi-num"]').textContent,
      tempState: document.querySelector('[data-kpi="temperature"]').dataset.state,
      vibState: document.querySelector('[data-kpi="vibration"]').dataset.state,
      health: document.getElementById("chipHealth").textContent.trim(),
    }));
    check("Tempo real: rótulo TEMPO REAL e ESP32 online", live.chip === "TEMPO REAL" && live.tag === "● TEMPO REAL" && live.device === "online", JSON.stringify(live));
    check("Tempo real: valores recebidos nos KPIs", live.temp === "61,4" && live.vib === "3,10", `${live.temp} °C, ${live.vib} mm/s`);
    check("Tempo real: limites aplicados (61,4 °C / 3,1 mm/s → ALERTA)", live.tempState === "alert" && live.vibState === "alert" && live.health === "ALERTA", `${live.tempState}/${live.vibState}/${live.health}`);

    for (const c of wss.clients) c.terminate();
    wss.close();
    // While reconnecting the chip alternates "sem conexão"/"conectando…": anything but online is a detected loss.
    await rt.waitForFunction(() => document.getElementById("chipDevice").dataset.state !== "online", { timeout: 15000, polling: 200 });
    await rt.waitForFunction(() => document.getElementById("chipHealth").textContent.includes("SEM DADOS"), { timeout: 15000, polling: 200 });
    const lost = await rt.evaluate(() => ({
      chip: document.querySelector("#chipSource .chip-label").textContent,
      stale: document.getElementById("dashboard").classList.contains("stale"),
    }));
    check("Tempo real: queda detectada sem cair para simulação", lost.chip === "TEMPO REAL" && lost.stale, JSON.stringify(lost));
    await rt.close();
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
