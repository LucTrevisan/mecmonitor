// UX / responsive layout check (mobile UX refactor): the resolutions of the brief + phones in landscape,
// in four states (initial, sensor selected, history, training). Fails on what has been fixed so far;
// reports the rest (3D view share, touch targets) so every phase can be measured.
// Usage: npm run build && npm run test:ux
import { preview } from "vite";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BROWSERS = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"];
const executablePath = process.env.CHROME_PATH || BROWSERS.find(existsSync);
const VIEWPORTS = [
  ["320x568", 320, 568, true],
  ["360x800", 360, 800, true],
  ["390x844", 390, 844, true],
  ["430x932", 430, 932, true],
  ["568x320 paisagem", 568, 320, true],
  ["844x390 paisagem", 844, 390, true],
  ["932x430 paisagem", 932, 430, true],
  ["768x1024", 768, 1024, true],
  ["1024x768", 1024, 768, true],
  ["1280x800", 1280, 800, false],
  ["1920x1080", 1920, 1080, false],
];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  process.stderr.write(`${ok ? "✓" : "✗"} ${name}\n`);
};
const info = (name, detail) => results.push({ name, ok: true, detail, info: true });

// measured in the page
const MEASURE = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const vis = (e) => {
    if (!e) return false;
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden" || e.closest("[hidden]")) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  let free = 0;
  let total = 0;
  for (let y = 4; y < vh; y += 12)
    for (let x = 4; x < vw; x += 12) {
      total++;
      if (document.elementFromPoint(x, y)?.id === "renderCanvas") free++;
    }
  const interactive = [...document.querySelectorAll("button, a[href], input, select, [role=button]")].filter(vis);
  const name = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim();
  const texts = [...document.querySelectorAll("body *")].filter(
    (e) => vis(e) && e.id !== "perfHud" && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 2,
  );
  const small = texts.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => `${e.className || e.tagName} ${getComputedStyle(e).fontSize}`);
  return {
    hScroll: document.documentElement.scrollWidth > vw,
    canvas: Math.round((free / total) * 100),
    unnamed: interactive.filter((e) => !name(e)).map((e) => e.id || e.className),
    under44: interactive.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    }).length,
    targets: interactive.length,
    small: [...new Set(small)],
  };
};

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: "warn" });
const browser = await puppeteer.launch({ executablePath, headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const table = [];
try {
  for (const [label, w, h, touch] of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch });
    await page.goto(server.resolvedUrls.local[0], { waitUntil: "load" });
    await page.waitForFunction(() => window.mecmonitor?.ready && window.mecmonitor.modes && window.mecmonitor.training, { timeout: 180000 });
    await new Promise((r) => setTimeout(r, 2000));
    const row = { label };
    const states = {};
    states.inicial = await page.evaluate(MEASURE);
    await page.evaluate(() => document.querySelector('[data-kpi="vibration"]').click());
    await new Promise((r) => setTimeout(r, 1800));
    states.sensor = await page.evaluate(MEASURE);
    await page.evaluate(() => window.mecmonitor.twin.clear());
    await page.evaluate(() => window.mecmonitor.historyPanel.toggle());
    await new Promise((r) => setTimeout(r, 1000));
    states.historico = await page.evaluate(MEASURE);
    await page.evaluate(() => window.mecmonitor.historyPanel.toggle());
    await page.evaluate(() => document.getElementById("btnTraining").click());
    await new Promise((r) => setTimeout(r, 1000));
    states.treino = await page.evaluate(MEASURE);
    // training sheet: tall enough, and every button reachable (scrolled into view like a user would,
    // then visible and on top — not covered, not squeezed)
    const tr = await page.evaluate(() => {
      const panel = document.getElementById("trainingPanel").getBoundingClientRect();
      const btns = [...document.querySelectorAll("#trainingPanel button")];
      const bad = btns.filter((b) => {
        b.scrollIntoView({ block: "nearest" });
        const q = b.getBoundingClientRect();
        if (q.top < 0 || q.bottom > innerHeight || q.height < 20) return true;
        const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return !(top === b || b.contains(top));
      });
      return { n: btns.length, height: Math.round(panel.height), bad: bad.map((b) => (b.textContent || b.getAttribute("aria-label")).trim().slice(0, 18)) };
    });
    await page.evaluate(() => document.querySelector("#trainingPanel [data-close]")?.click());
    // SEM DADOS (telemetry stopped): the state label of every KPI fits inside its card
    await page.evaluate(() => window.mecmonitor.telemetry.stop?.());
    await page.waitForFunction(() => [...document.querySelectorAll(".kpi")].every((k) => k.dataset.state === "nodata"), { timeout: 20000 }).catch(() => {});
    const nodata = await page.evaluate(() =>
      [...document.querySelectorAll(".kpi")].filter((k) => {
        const s = k.querySelector(".kpi-state");
        const a = s.getBoundingClientRect();
        const c = k.getBoundingClientRect();
        return a.right > c.right + 0.5 || a.left < c.left - 0.5 || s.scrollWidth > s.clientWidth + 1;
      }).map((k) => k.dataset.kpi),
    );
    const meta = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
    const footLines = !touch ? await page.evaluate(() => [...document.querySelectorAll(".kpi-foot")].map((f) => Math.round(f.getBoundingClientRect().height))) : [];
    await page.close();

    const all = Object.values(states);
    check(`${label}: sem rolagem horizontal`, all.every((s) => !s.hScroll));
    check(`${label}: nenhum texto abaixo de 11 px`, all.every((s) => s.small.length === 0), [...new Set(all.flatMap((s) => s.small))].slice(0, 4).join(", "));
    check(`${label}: todo botão tem nome acessível`, all.every((s) => s.unnamed.length === 0), [...new Set(all.flatMap((s) => s.unnamed))].join(", "));
    check(`${label}: painel de treinamento utilizável (≥ 150 px; botões alcançáveis)`, tr.n > 0 && tr.height >= 150 && tr.bad.length === 0, `${tr.height} px${tr.bad.length ? ` · inacessíveis: ${tr.bad.join(", ")}` : ""}`);
    check(`${label}: "SEM DADOS" inteiro nos 4 KPIs`, nodata.length === 0, nodata.join(", "));
    check(`${label}: viewport-fit=cover (áreas seguras)`, meta.includes("viewport-fit=cover"));
    if (!touch) check(`${label}: KPIs do desktop com tendência e estado na mesma linha`, footLines.length === 4 && footLines.every((hgt) => hgt <= 20), footLines.join("/"));
    row.canvas = `${states.inicial.canvas} / ${states.sensor.canvas} / ${states.treino.canvas}`;
    row.targets = `${states.inicial.under44}/${states.inicial.targets}`;
    table.push(row);
  }
} catch (e) {
  check("Execução do teste de layout", false, String(e));
} finally {
  await browser.close();
  await server.close();
}
for (const r of table) info(`${r.label}: cena 3D visível (inicial / sensor / treino)`, `${r.canvas} % · botões < 44 px: ${r.targets}`);
for (const r of results) console.log(`${r.info ? "INFO" : r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} falha(s)` : "\nLayout OK em todas as resoluções");
process.exit(failed ? 1 : 0);
