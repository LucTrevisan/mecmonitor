// Real lab room (6 × 5 m, 3 m ceiling), modeled from the 360° photo of the school's lab: parquet floor,
// white walls with a light-grey lower band, grey doors with "SAÍDA" signs, windows, blue workbenches, white
// base cabinets, tall test panel, cable trays, conduits and LED luminaires.
// True 3D geometry (correct from any viewpoint and in VR), but cheap: everything is batched into a handful
// of meshes — walls (vertex colors with baked corner shading), solids (vertex colors), decals (one atlas),
// LEDs and floor effects (light pools + contact shadows). No external assets, no GLB touched.
import { Color3, Mesh, StandardMaterial, Texture, VertexData } from "@babylonjs/core";
import { FONT, signMaterial, texture } from "./canvasTex.js";

export const ROOM_H = 3;
const BAND_H = 2.15; // light-grey band up to just above the doors (as in the real room)

const rgb = (hex) => {
  const c = Color3.FromHexString(hex);
  return [c.r, c.g, c.b];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Geometry batch: quads / boxes / prisms with per-vertex color (and optional UV) → one mesh, one draw call. */
export function createBatch() {
  const P = [];
  const N = [];
  const C = [];
  const UV = [];
  const I = [];
  const api = {
    /** Quad o + s·u + t·v (s, t ∈ [0, 1]); visible from the side its normal n = u × v points to. */
    quad(o, u, v, color, uv = [0, 0, 1, 1]) {
      const n = cross(u, v);
      const len = Math.hypot(...n) || 1;
      const base = P.length / 3;
      const cols = Array.isArray(color[0]) ? color : [color, color, color, color];
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([s, t], k) => {
        P.push(o[0] + s * u[0] + t * v[0], o[1] + s * u[1] + t * v[1], o[2] + s * u[2] + t * v[2]);
        N.push(n[0] / len, n[1] / len, n[2] / len);
        C.push(...cols[k], 1);
        UV.push(uv[0] + s * (uv[2] - uv[0]), uv[1] + t * (uv[3] - uv[1]));
      });
      I.push(base, base + 2, base + 1, base, base + 3, base + 2);
      return api;
    },
    box(x0, x1, y0, y1, z0, z1, hex) {
      const c = typeof hex === "string" ? rgb(hex) : hex;
      const [w, h, d] = [x1 - x0, y1 - y0, z1 - z0];
      api.quad([x0, y0, z1], [w, 0, 0], [0, h, 0], c); // +z
      api.quad([x1, y0, z0], [-w, 0, 0], [0, h, 0], c); // −z
      api.quad([x1, y0, z1], [0, 0, -d], [0, h, 0], c); // +x
      api.quad([x0, y0, z0], [0, 0, d], [0, h, 0], c); // −x
      api.quad([x0, y1, z1], [w, 0, 0], [0, 0, -d], c); // +y
      api.quad([x0, y0, z0], [w, 0, 0], [0, 0, d], c); // −y
      return api;
    },
    /** Prism (cylinder) from point a to point b. */
    cyl(a, b, r, hex, seg = 10) {
      const c = rgb(hex);
      const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const L = Math.hypot(...ax);
      const d = ax.map((v) => v / L);
      const ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = cross(d, ref).map((v, _, arr) => v / Math.hypot(...arr));
      const e2 = cross(d, e1);
      const ring = (k) => {
        const t = (k / seg) * Math.PI * 2;
        return [0, 1, 2].map((i) => r * (Math.cos(t) * e1[i] + Math.sin(t) * e2[i]));
      };
      for (let k = 0; k < seg; k++) {
        const p = ring(k);
        const q = ring(k + 1);
        const base = P.length / 3;
        for (const [off, end] of [[p, a], [q, a], [q, b], [p, b]]) {
          P.push(end[0] + off[0], end[1] + off[1], end[2] + off[2]);
          N.push(off[0] / r, off[1] / r, off[2] / r);
          C.push(...c, 1);
          UV.push(0, 0);
        }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
        // caps (both windings: a thin prism is never worth the orientation bookkeeping)
        for (const end of [a, b]) {
          const cb = P.length / 3;
          for (const off of [[0, 0, 0], p, q]) {
            P.push(end[0] + off[0], end[1] + off[1], end[2] + off[2]);
            N.push(...(end === a ? d.map((v) => -v) : d));
            C.push(...c, 1);
            UV.push(0, 0);
          }
          I.push(cb, cb + 1, cb + 2, cb, cb + 2, cb + 1);
        }
      }
      return api;
    },
    get empty() {
      return I.length === 0;
    },
    build(scene, name, material) {
      const mesh = new Mesh(name, scene);
      const vd = new VertexData();
      vd.positions = P;
      vd.normals = N;
      vd.colors = C;
      vd.uvs = UV;
      vd.indices = I;
      vd.applyToMesh(mesh);
      mesh.material = material;
      return mesh;
    },
  };
  return api;
}

// ---------- floor ----------
/** Varnished parquet ("taco"): 30 cm squares of five strips, alternating direction. Texture = 1.2 m. */
export function parquetFloor(scene, ground, groundSize, room) {
  const tex = texture(scene, "labFloorTex", 1024, 1024, (ctx, w) => {
    const sq = w / 4;
    const strips = 5;
    const tones = ["#8f3f24", "#9a4628", "#84381f", "#a34f2d", "#7a321c", "#96422a", "#8a3b22"];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const horizontal = (i + j) % 2 === 0;
        for (let k = 0; k < strips; k++) {
          const s = sq / strips;
          const [x, y, sw, sh] = horizontal ? [i * sq, j * sq + k * s, sq, s] : [i * sq + k * s, j * sq, s, sq];
          ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
          ctx.fillRect(x, y, sw, sh);
          // wood grain: a few darker / lighter streaks along the strip
          for (let g = 0; g < 7; g++) {
            ctx.fillStyle = Math.random() < 0.5 ? "rgba(40,12,4,0.16)" : "rgba(255,190,140,0.07)";
            const off = Math.random() * (horizontal ? sh : sw);
            if (horizontal) ctx.fillRect(x, y + off, sw, 1.5);
            else ctx.fillRect(x + off, y, 1.5, sh);
          }
          ctx.strokeStyle = "rgba(30,9,3,0.55)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.75, y + 0.75, sw - 1.5, sh - 1.5);
        }
      }
  });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  const W = room.x1 - room.x0;
  const D = room.z1 - room.z0;
  tex.uScale = W / 1.2;
  tex.vScale = D / 1.2;
  tex.anisotropicFilteringLevel = 8;
  const mat = new StandardMaterial("labFloorMat", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.42, 0.38, 0.34); // varnish
  mat.specularPower = 90;
  mat.emissiveColor = new Color3(0.16, 0.13, 0.12);
  ground.material = mat;
  // the ground mesh itself (XR floor / desktop picking) is kept; it only takes the size of the real room
  ground.scaling.x = W / groundSize;
  ground.scaling.z = D / groundSize;
  ground.position.x = (room.x0 + room.x1) / 2;
  ground.position.z = (room.z0 + room.z1) / 2;
}

// ---------- shell: walls + ceiling with baked corner shading ----------
function shell(scene, room) {
  const { x0, x1, z0, z1 } = room;
  const b = createBatch();
  const upper = rgb("#f3f1ea");
  const lower = rgb("#deded7");
  const ceil = rgb("#efede4");
  const STEP = 0.25;
  // soft darkening towards edges (floor, ceiling, corners): cheap ambient occlusion
  const edge = (d) => 1 - 0.2 * Math.exp(-d / 0.22);
  const shade = (c, k) => c.map((v) => v * k);
  const grid = (o, u, v, lu, lv, colorAt) => {
    const nu = Math.round(lu / STEP);
    const nv = Math.round(lv / STEP);
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const at = (s, t) => colorAt(s * lu, t * lv);
        const [s0, s1, t0, t1] = [i / nu, (i + 1) / nu, j / nv, (j + 1) / nv];
        const p = [o[0] + s0 * lu * u[0] + t0 * lv * v[0], o[1] + s0 * lu * u[1] + t0 * lv * v[1], o[2] + s0 * lu * u[2] + t0 * lv * v[2]];
        b.quad(p, u.map((c) => (c * lu) / nu), v.map((c) => (c * lv) / nv), [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)]);
      }
  };
  const wall = (o, u, len) =>
    grid(o, u, [0, 1, 0], len, ROOM_H, (a, h) => {
      // the band line falls on a grid row (2.25 m would blur it): hard switch at BAND_H
      const base = h < BAND_H - 1e-6 ? lower : upper;
      return shade(base, edge(a) * edge(len - a) * edge(h) * edge(ROOM_H - h));
    });
  const W = x1 - x0;
  const D = z1 - z0;
  wall([x0, 0, z0], [1, 0, 0], W); // back (faces +z)
  wall([x1, 0, z1], [-1, 0, 0], W); // front (faces −z)
  wall([x0, 0, z1], [0, 0, -1], D); // left (faces +x)
  wall([x1, 0, z0], [0, 0, 1], D); // right (faces −x)
  grid([x0, ROOM_H, z0], [1, 0, 0], [0, 0, 1], W, D, (a, c) => shade(ceil, edge(a) * edge(W - a) * edge(c) * edge(D - c)));
  const mat = new StandardMaterial("wsWallMat", scene);
  mat.diffuseColor = new Color3(0.12, 0.12, 0.12);
  mat.emissiveColor = new Color3(0.9, 0.9, 0.9); // evenly lit interior: the baked shading does the work
  mat.specularColor = Color3.Black();
  return b.build(scene, "wsWalls", mat);
}

// ---------- decal atlas (doors, windows, signs, pegboard, panel face) ----------
const ATLAS = { w: 2048, h: 1024 };
const REG = {
  doorDouble: [0, 0, 620, 800],
  doorSingle: [640, 0, 330, 800],
  window: [990, 0, 520, 400],
  pegboard: [990, 420, 760, 330],
  panel: [1770, 0, 250, 760],
  exit: [0, 820, 300, 110],
  fuse: [320, 820, 200, 190],
  extSign: [540, 820, 130, 170],
};
// u runs right-to-left: in Babylon's left-handed world a quad's u axis (n = u × v) points to the viewer's left
const uvOf = ([x, y, w, h]) => [(x + w) / ATLAS.w, 1 - (y + h) / ATLAS.h, x / ATLAS.w, 1 - y / ATLAS.h];

function drawAtlas(ctx) {
  const door = (x, y, w, h) => {
    ctx.fillStyle = "#6b7078";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#4b4f56";
    ctx.lineWidth = 8;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    // glazed panel
    const gx = x + w * 0.24;
    const gw = w * 0.52;
    const g = ctx.createLinearGradient(0, y + 60, 0, y + 330);
    g.addColorStop(0, "#dfeaf0");
    g.addColorStop(1, "#b8cbd3");
    ctx.fillStyle = g;
    ctx.fillRect(gx, y + 70, gw, 250);
    ctx.strokeStyle = "#3f4349";
    ctx.lineWidth = 6;
    ctx.strokeRect(gx, y + 70, gw, 250);
  };
  // double door: two leaves, push bars
  {
    const [x, y, w, h] = REG.doorDouble;
    door(x, y, w / 2, h);
    door(x + w / 2, y, w / 2, h);
    ctx.fillStyle = "#c9ccd0";
    ctx.fillRect(x + w / 2 - 70, y + 420, 50, 12);
    ctx.fillRect(x + w / 2 + 20, y + 420, 50, 12);
  }
  {
    const [x, y, w, h] = REG.doorSingle;
    door(x, y, w, h);
    ctx.fillStyle = "#c9ccd0";
    ctx.fillRect(x + w - 80, y + 420, 55, 12);
  }
  // window: daylight, trees, dark aluminium frame with a mullion
  {
    const [x, y, w, h] = REG.window;
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, "#eaf4fb");
    sky.addColorStop(0.55, "#d3e6ee");
    sky.addColorStop(1, "#a9c7a0");
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = "blur(7px)"; // out of focus behind the glass
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${50 + Math.random() * 60},${105 + Math.random() * 70},${55 + Math.random() * 35},0.55)`;
      ctx.beginPath();
      ctx.arc(x + Math.random() * w, y + h * (0.5 + Math.random() * 0.5), 14 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; // glass sheen
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.45, y);
    ctx.lineTo(x + w * 0.2, y + h);
    ctx.lineTo(x, y + h);
    ctx.fill();
    ctx.strokeStyle = "#4a4e55";
    ctx.lineWidth = 22;
    ctx.strokeRect(x + 11, y + 11, w - 22, h - 22);
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();
  }
  // pegboard with hand tools (pliers, screwdrivers, wrenches), as over the white cabinets
  {
    const [x, y, w, h] = REG.pegboard;
    ctx.fillStyle = "#e9eaec";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#c5c9cd";
    for (let py = y + 14; py < y + h; py += 22) for (let px = x + 14; px < x + w; px += 22) ctx.fillRect(px, py, 4, 4);
    ctx.strokeStyle = "#f7f7f5";
    ctx.lineWidth = 12;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    const grips = ["#1f5fbf", "#d43a2a", "#e08a1a", "#1f5fbf", "#d43a2a", "#2a8f4e"];
    for (let i = 0; i < 12; i++) {
      const px = x + 50 + i * 40;
      ctx.strokeStyle = "#5c636b"; // jaws
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px - 6, y + 50);
      ctx.lineTo(px, y + 110);
      ctx.moveTo(px + 6, y + 50);
      ctx.lineTo(px, y + 110);
      ctx.stroke();
      ctx.strokeStyle = grips[i % grips.length];
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(px, y + 110);
      ctx.lineTo(px - 9, y + 190);
      ctx.moveTo(px, y + 110);
      ctx.lineTo(px + 9, y + 190);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const px = x + 545 + i * 25;
      ctx.fillStyle = grips[(i + 2) % grips.length];
      ctx.fillRect(px - 6, y + 50, 12, 60);
      ctx.fillStyle = "#6a7178";
      ctx.fillRect(px - 2, y + 110, 4, 90 - i * 6);
    }
    for (let i = 0; i < 9; i++) {
      const px = x + 60 + i * 34;
      const len = 80 - i * 4;
      ctx.fillStyle = "#7c848c";
      ctx.fillRect(px - 4, y + 225, 8, len);
      ctx.beginPath();
      ctx.arc(px, y + 225, 10, 0, Math.PI * 2);
      ctx.arc(px, y + 225 + len, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // tall test panel: grey door with rows of indicator lamps / jacks
  {
    const [x, y, w, h] = REG.panel;
    ctx.fillStyle = "#dfe1e2";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#a9adb1";
    ctx.lineWidth = 8;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    const cols = ["#d43a2a", "#2a8f4e", "#e0b21a", "#1f5fbf", "#30343a"];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = cols[(r * 3 + c) % cols.length];
        ctx.beginPath();
        ctx.arc(x + 50 + c * 50, y + 60 + r * 40, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.fillStyle = "#b9bdc1";
    ctx.fillRect(x + 30, y + 460, w - 60, 250);
    ctx.fillStyle = "#30343a";
    ctx.fillRect(x + w - 48, y + 380, 14, 50);
  }
  // emergency exit sign
  {
    const [x, y, w, h] = REG.exit;
    ctx.fillStyle = "#0f8a4b";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 70px ${FONT}`;
    ctx.fillText("SAÍDA", x + w / 2, y + h / 2 + 4);
  }
  // wall distribution box
  {
    const [x, y, w, h] = REG.fuse;
    ctx.fillStyle = "#d9dbdc";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#9ea3a8";
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = "#f2c200";
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 30);
    ctx.lineTo(x + w / 2 + 34, y + 90);
    ctx.lineTo(x + w / 2 - 34, y + 90);
    ctx.fill();
    ctx.fillStyle = "#16181b";
    ctx.font = `900 44px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("ϟ", x + w / 2, y + 72);
    ctx.fillStyle = "#30343a";
    ctx.fillRect(x + w - 34, y + 110, 10, 40);
  }
  // extinguisher sign (white symbol on red)
  {
    const [x, y, w, h] = REG.extSign;
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 48, y + 50, 34, 86);
    ctx.beginPath();
    ctx.arc(x + 65, y + 50, 17, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x + 60, y + 18, 10, 16);
    ctx.fillRect(x + 70, y + 22, 30, 7);
  }
}

// ---------- furniture helpers (solids batch) ----------
const BLUE = "#21489a";
const TOP = "#b7bbc0";
const STEEL = "#8d959d";
const DARK = "#2b2e33";

/** Blue steel workbench against the back wall (x0..x1), optional drawer unit on one side. */
function blueBench(b, x0, x1, zw, { drawers = null } = {}) {
  const D = 0.65;
  const H = 0.9;
  const z0 = zw + 0.03;
  const z1 = z0 + D;
  b.box(x0, x1, H - 0.04, H, z0, z1, TOP);
  b.box(x0, x1, H - 0.1, H - 0.04, z0 + 0.02, z1 - 0.02, BLUE); // apron
  for (const x of [x0 + 0.03, x1 - 0.08]) for (const z of [z0 + 0.03, z1 - 0.08]) {
    b.box(x, x + 0.05, 0.06, H - 0.1, z, z + 0.05, BLUE);
    b.cyl([x + 0.025, 0.03, z + 0.025], [x + 0.025, 0.06, z + 0.025], 0.03, DARK, 8); // caster
  }
  b.box(x0 + 0.05, x1 - 0.05, 0.2, 0.24, z0 + 0.05, z0 + 0.1, BLUE); // rear stretcher
  b.box(x0 + 0.05, x1 - 0.05, 0.2, 0.24, z1 - 0.1, z1 - 0.05, BLUE); // front stretcher
  if (drawers) {
    const [d0, d1] = drawers === "left" ? [x0 + 0.1, x0 + 0.62] : [x1 - 0.62, x1 - 0.1];
    b.box(d0, d1, 0.26, H - 0.1, z0 + 0.04, z1 - 0.03, BLUE);
    for (let i = 0; i < 4; i++) {
      const y = 0.29 + i * 0.128;
      b.box(d0 + 0.015, d1 - 0.015, y, y + 0.115, z1 - 0.03, z1 - 0.018, "#2a55b0");
      b.box(d0 + 0.14, d1 - 0.14, y + 0.075, y + 0.09, z1 - 0.018, z1 - 0.006, "#d7dadd"); // handle
    }
  }
  return { z0: zw, z1 };
}

/** Bench vise. */
function vise(b, x, y, z) {
  b.box(x - 0.1, x + 0.1, y, y + 0.04, z - 0.11, z + 0.11, "#2b5c8a");
  b.box(x - 0.065, x + 0.065, y + 0.04, y + 0.14, z - 0.1, z + 0.1, "#2b5c8a");
  b.box(x - 0.08, x + 0.08, y + 0.1, y + 0.17, z - 0.085, z - 0.06, STEEL);
  b.box(x - 0.08, x + 0.08, y + 0.1, y + 0.17, z + 0.05, z + 0.075, STEEL);
  b.cyl([x, y + 0.09, z + 0.1], [x, y + 0.09, z + 0.26], 0.009, STEEL, 8);
  b.cyl([x - 0.11, y + 0.09, z + 0.24], [x + 0.11, y + 0.09, z + 0.24], 0.006, STEEL, 6);
}

/** Red bench machine (as on the blue benches of the real room). */
function redMachine(b, x, y, z) {
  b.box(x - 0.2, x + 0.2, y, y + 0.03, z - 0.13, z + 0.13, DARK);
  b.cyl([x - 0.16, y + 0.14, z], [x + 0.16, y + 0.14, z], 0.105, "#cf2a22", 14);
  b.cyl([x + 0.16, y + 0.14, z], [x + 0.21, y + 0.14, z], 0.085, "#3a3d42", 14);
  b.cyl([x - 0.21, y + 0.14, z], [x - 0.16, y + 0.14, z], 0.085, "#3a3d42", 14);
  b.box(x - 0.05, x + 0.05, y + 0.03, y + 0.08, z - 0.06, z + 0.06, "#a81f19");
}

/** White base cabinets with a worktop (x0..x1). */
function whiteCabinets(b, x0, x1, zw) {
  const z0 = zw + 0.02;
  const z1 = z0 + 0.6;
  b.box(x0, x1, 0.08, 0.86, z0, z1, "#eeeeea");
  b.box(x0 + 0.02, x1 - 0.02, 0, 0.08, z0, z1 - 0.06, "#3a3d42"); // plinth
  b.box(x0 - 0.01, x1 + 0.01, 0.86, 0.9, z0, z1 + 0.02, "#f7f7f4");
  const n = Math.round((x1 - x0) / 0.45);
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w;
    b.box(a + 0.008, a + w - 0.008, 0.1, 0.84, z1, z1 + 0.012, "#f4f4f1"); // door leaf
    const hx = i % 2 === 0 ? a + w - 0.05 : a + 0.035;
    b.box(hx, hx + 0.015, 0.6, 0.72, z1 + 0.012, z1 + 0.03, "#30343a"); // handle
  }
  return { z0: zw, z1: z1 + 0.03 };
}

/** Wall-mounted fire extinguisher. */
function extinguisherBody(b, x, zw) {
  const z = zw + 0.1;
  b.cyl([x, 0.62, z], [x, 1.1, z], 0.08, "#c8102e", 14);
  b.cyl([x, 1.1, z], [x, 1.17, z], 0.05, "#c8102e", 12);
  b.cyl([x, 1.17, z], [x, 1.25, z], 0.022, DARK, 8);
  b.box(x - 0.012, x + 0.07, 1.22, 1.245, z - 0.012, z + 0.012, DARK); // lever
  b.cyl([x + 0.09, 0.75, z], [x + 0.09, 1.16, z], 0.009, DARK, 6); // hose
  b.box(x - 0.09, x + 0.09, 0.84, 0.87, zw, z, STEEL); // bracket
}

/**
 * Builds the room. Returns the meshes (finalized by lab.js) and the furniture footprints (all inside the
 * back-wall strip, which is never walkable / a teleport target).
 * @param L layout (see layout.js): L.box = { x0, x1, z0, z1 } inner faces of the walls
 */
export function createRoom(scene, L) {
  const R = L.box;
  const zw = R.z0; // back wall
  const solids = createBatch();
  const decals = createBatch();
  const leds = createBatch();
  const fx = createBatch();
  const white = [1, 1, 1];
  const footprints = [];

  // --- decal placement on each wall (centered at a, bottom y, size w × h) ---
  const EPS = 0.012;
  const onBack = (reg, x, y, w, h) => decals.quad([x - w / 2, y, zw + EPS], [w, 0, 0], [0, h, 0], white, uvOf(reg));
  const onFront = (reg, x, y, w, h) => decals.quad([x + w / 2, y, R.z1 - EPS], [-w, 0, 0], [0, h, 0], white, uvOf(reg));
  const onLeft = (reg, z, y, w, h) => decals.quad([R.x0 + EPS, y, z + w / 2], [0, 0, -w], [0, h, 0], white, uvOf(reg));
  const onRight = (reg, z, y, w, h) => decals.quad([R.x1 - EPS, y, z - w / 2], [0, 0, w], [0, h, 0], white, uvOf(reg));

  // --- skirting board (dark wood) ---
  const SK = "#4a2416";
  solids.box(R.x0, R.x1, 0, 0.08, zw, zw + 0.015, SK);
  solids.box(R.x0, R.x1, 0, 0.08, R.z1 - 0.015, R.z1, SK);
  solids.box(R.x0, R.x0 + 0.015, 0, 0.08, zw, R.z1, SK);
  solids.box(R.x1 - 0.015, R.x1, 0, 0.08, zw, R.z1, SK);

  // --- back wall: white cabinets + pegboard | extinguisher | tall test panel | blue bench + 5S board ---
  const cab = whiteCabinets(solids, R.x0 + 0.08, R.x0 + 1.88, zw);
  footprints.push({ name: "armários", x0: R.x0 + 0.08, x1: R.x0 + 1.88, z0: cab.z0, z1: cab.z1 });
  onBack(REG.pegboard, R.x0 + 0.98, 1.08, 1.7, 0.74);
  solids.box(R.x0 + 0.1, R.x0 + 1.86, 1.05, 1.08, zw, zw + 0.05, "#f1f1ee"); // pegboard ledge
  redMachine(solids, R.x0 + 0.5, 0.9, zw + 0.33);

  // fire extinguisher with its sign and the red / yellow floor marking (kept clear)
  const ex = -0.75;
  extinguisherBody(solids, ex, zw);
  onBack(REG.extSign, ex, 1.5, 0.23, 0.3);
  solids.box(ex - 0.35, ex + 0.35, 0.002, 0.005, zw + 0.02, zw + 0.72, "#f2c200");
  solids.box(ex - 0.29, ex + 0.29, 0.004, 0.0065, zw + 0.08, zw + 0.66, "#c8102e");
  footprints.push({ name: "extintor", x0: ex - 0.35, x1: ex + 0.35, z0: zw, z1: zw + 0.72 });

  const panelX = 0.75;
  solids.box(panelX - 0.3, panelX + 0.3, 0.1, 1.95, zw + 0.02, zw + 0.42, "#d4d6d7");
  solids.box(panelX - 0.27, panelX + 0.27, 0, 0.1, zw + 0.05, zw + 0.4, DARK);
  decals.quad([panelX - 0.28, 0.14, zw + 0.42 + 0.004], [0.56, 0, 0], [0, 1.78, 0], white, uvOf(REG.panel));
  footprints.push({ name: "painel de testes", x0: panelX - 0.3, x1: panelX + 0.3, z0: zw, z1: zw + 0.43 });

  const bx0 = R.x1 - 1.9;
  const bx1 = R.x1 - 0.1;
  const bench = blueBench(solids, bx0, bx1, zw, { drawers: "left" });
  vise(solids, bx1 - 0.35, 0.9, zw + 0.5);
  footprints.push({ name: "bancada de ajustagem", x0: bx0, x1: bx1, z0: bench.z0, z1: bench.z1 });

  // --- conduits and distribution box on the front wall (between the door and the window) ---
  const fbx = R.x0 + 2.75;
  for (const [dx, hex] of [[-0.08, "#5c6269"], [0, "#5c6269"], [0.1, "#2f7d4f"]]) solids.cyl([fbx + dx, 1.5, R.z1 - 0.03], [fbx + dx, ROOM_H - 0.24, R.z1 - 0.03], 0.012, hex, 8);
  solids.box(fbx - 0.14, fbx + 0.14, 1.02, 1.5, R.z1 - 0.12, R.z1, "#d9dbdc");
  decals.quad([fbx + 0.13, 1.04, R.z1 - 0.124], [-0.26, 0, 0], [0, 0.44, 0], white, uvOf(REG.fuse));

  // --- doors, windows, exit signs ---
  onFront(REG.doorDouble, R.x0 + 1.35, 0, 1.6, 2.1);
  onFront(REG.exit, R.x0 + 1.35, 2.2, 0.42, 0.155);
  onFront(REG.window, R.x1 - 1.6, 1.05, 1.5, 1.1);
  onRight(REG.doorSingle, R.z1 - 0.85, 0, 0.9, 2.1);
  onRight(REG.exit, R.z1 - 0.85, 2.2, 0.42, 0.155);
  onRight(REG.window, zw + 1.5, 1.05, 1.5, 1.1);
  onLeft(REG.window, R.z1 - 1.35, 1.05, 1.5, 1.1);
  // window sills / door frames (thin solids give them depth)
  solids.box(R.x1 - 2.37, R.x1 - 0.83, 1.02, 1.05, R.z1 - 0.06, R.z1, "#c9ccd0");
  solids.box(R.x1 - 0.06, R.x1, 1.02, 1.05, zw + 0.73, zw + 2.27, "#c9ccd0");
  solids.box(R.x0, R.x0 + 0.06, 1.02, 1.05, R.z1 - 2.12, R.z1 - 0.58, "#c9ccd0");

  // --- hose reel on the right wall (blue coil) ---
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2;
    for (const r of [0.17, 0.21]) solids.cyl([R.x1 - 0.06, 1.55 + r * Math.sin(a0), zw + 0.4 + r * Math.cos(a0)], [R.x1 - 0.06, 1.55 + r * Math.sin(a1), zw + 0.4 + r * Math.cos(a1)], 0.018, "#1f6fc2", 6);
  }
  solids.box(R.x1 - 0.05, R.x1, 1.5, 1.6, zw + 0.35, zw + 0.45, STEEL);

  // --- cable trays under the ceiling (loop + cross runs), hangers ---
  const TY = ROOM_H - 0.28;
  const TRAY = "#3a3d41";
  const inset = 0.55;
  const [tx0, tx1, tz0, tz1] = [R.x0 + inset, R.x1 - inset, zw + inset, R.z1 - inset];
  const trayX = (z) => solids.box(tx0, tx1, TY, TY + 0.05, z - 0.06, z + 0.06, TRAY);
  const trayZ = (x) => solids.box(x - 0.06, x + 0.06, TY, TY + 0.05, tz0, tz1, TRAY);
  trayX(tz0);
  trayX(tz1);
  trayZ(tx0);
  trayZ(tx1);
  trayZ(0);
  for (const x of [tx0, 0, tx1]) for (const z of [tz0, (tz0 + tz1) / 2, tz1]) solids.cyl([x, TY + 0.05, z], [x, ROOM_H, z], 0.006, STEEL, 5);

  // --- LED luminaires (2 rows × 3) + light pools on the varnished floor ---
  const zc = (R.z0 + R.z1) / 2;
  const ledC = rgb("#fbfdff");
  for (const z of [zc - 1.25, zc + 1.25])
    for (const x of [-1.9, 0, 1.9]) {
      solids.box(x - 0.64, x + 0.64, ROOM_H - 0.06, ROOM_H, z - 0.11, z + 0.11, "#e6e8ea");
      leds.quad([x - 0.6, ROOM_H - 0.062, z - 0.07], [1.2, 0, 0], [0, 0, 0.14], ledC);
      fx.quad([x - 1.25, 0.0022, z + 0.55], [2.5, 0, 0], [0, 0, -1.1], white, [0, 0, 0.5, 1]);
    }

  // --- contact shadows (soft dark blobs): pump bench and furniture ---
  const shadow = (x0, x1, z0, z1, grow = 0.18) => fx.quad([x0 - grow, 0.0026, z1 + grow], [x1 - x0 + 2 * grow, 0, 0], [0, 0, -(z1 - z0) - 2 * grow], white, [0.5, 0, 1, 1]);
  shadow(L.tape.x0 + L.clearance, L.tape.x1 - L.clearance, L.tape.z0 + L.clearance, L.tape.z1 - L.clearance, 0.3);
  for (const f of footprints) shadow(f.x0, f.x1, f.z0, f.z1);

  // ---------- materials + meshes ----------
  const solidMat = new StandardMaterial("wsSolidMat", scene);
  solidMat.diffuseColor = new Color3(0.78, 0.78, 0.78);
  solidMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  solidMat.specularColor = new Color3(0.12, 0.12, 0.12);
  solidMat.specularPower = 40;

  const atlasTex = texture(scene, "wsAtlasTex", ATLAS.w, ATLAS.h, (ctx) => drawAtlas(ctx));
  const ledMat = new StandardMaterial("labLedMat", scene);
  ledMat.emissiveColor = new Color3(1, 1, 1);
  ledMat.disableLighting = true;

  // floor effects: left half of the texture = light pool (white), right half = contact shadow (black)
  const fxTex = texture(
    scene,
    "wsFloorFxTex",
    512,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const blob = (cx, color, a) => {
        const g = ctx.createRadialGradient(cx, h / 2, 0, cx, h / 2, h / 2);
        g.addColorStop(0, `rgba(${color},${a})`);
        g.addColorStop(0.55, `rgba(${color},${a * 0.45})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - h / 2, 0, h, h);
      };
      blob(w * 0.25, "255,244,230", 0.3);
      blob(w * 0.75, "10,4,2", 0.62);
    },
    { alpha: true },
  );
  const fxMat = signMaterial(scene, "wsFloorFxMat", fxTex);

  const meshes = [
    shell(scene, R),
    solids.build(scene, "wsRoomSolids", solidMat),
    decals.build(scene, "wsRoomDecals", signMaterial(scene, "wsAtlasMat", atlasTex)),
    leds.build(scene, "labLeds", ledMat),
    fx.build(scene, "wsFloorFx", fxMat),
  ];
  // solids: both faces (thin prisms / boxes seen from any side); shell and decals: inner face only, so an
  // orbiting desktop camera outside the room still sees in
  solidMat.backFaceCulling = false;
  return { meshes, footprints };
}
