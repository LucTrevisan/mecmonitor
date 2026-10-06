import { preview } from "vite";
import puppeteer from "puppeteer-core";
const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: "warn" });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage();
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.mecmonitor?.ready, { timeout: 120000 });
const out = await page.evaluate(() => {
  const { scene } = window.mecmonitor;
  const f = (v) => v.asArray().map((x) => +x.toFixed(3));
  // meshes whose center is in the pump body region (x -0.02..0.45, around shaft axis)
  return scene.meshes.filter((m) => m.getTotalVertices() > 0 && m.name !== "ground").map((m) => {
    const { min, max } = m.getHierarchyBoundingVectors(true);
    const c = min.add(max).scale(0.5);
    const mat = m.material;
    const col = mat?.albedoColor ?? mat?.diffuseColor;
    let n = m; const chain = [];
    while (n) { chain.push(n.name); n = n.parent; }
    return { name: m.name, chain: chain.slice(0, 3).join(" < "), c: f(c), size: f(max.subtract(min)), mat: mat?.name, col: col ? col.toHexString() : null, alpha: mat?.alpha, mode: mat?.transparencyMode, cls: m.getClassName() };
  }).filter((o) => o.c[0] > -0.03 && o.c[0] < 0.45 && Math.abs(o.c[1] - 0.87) < 0.15 && Math.abs(o.c[2] + 0.043) < 0.12 && Math.max(...o.size) > 0.05);
});
for (const o of out) console.log(JSON.stringify(o));
await browser.close(); await server.close();
