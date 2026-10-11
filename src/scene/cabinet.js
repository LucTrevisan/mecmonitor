// Electrical cabinet dressed like the real bench's: legend plates, asset sticker and 3D controls (door lock
// handle, pushbuttons, pilot light, selector, emergency mushroom) overlaid on the door of the GLB's
// enclosure (CABINET.node). The GLB is untouched. Purely visual: static, non-pickable (lab finalize) and
// stateless (the pilot light is not lit: it never suggests a real panel state).
// Draw calls: all controls are merged into one mesh (one submesh per material) and all plates share one
// canvas atlas in one mesh.
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, VertexBuffer } from "@babylonjs/core";
import { CABINET } from "../config/bench.js";
import { FONT, fitFont, signMaterial, texture } from "./canvasTex.js";

const PX_PER_M = 3000; // plate resolution in the atlas
const ATLAS_W = 1024;
const ATLAS_H = 512;

/** Door of the enclosure: the largest of its own primitives (sensor bodies are parented to the node). */
function doorBounds(scene, name) {
  const parts = scene.meshes.filter((m) => m.name === name || m.name.startsWith(`${name}_primitive`));
  let best = null;
  for (const m of parts) {
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    const size = bb.maximumWorld.subtract(bb.minimumWorld).length();
    if (!best || size > best.size) best = { size, min: bb.minimumWorld.clone(), max: bb.maximumWorld.clone() };
  }
  return best;
}

function material(scene, cache, hex, { metal = false, gloss = 0.25, lift = 0.12 } = {}) {
  const key = `${hex}${metal}${lift}`;
  if (!cache.has(key)) {
    const m = new StandardMaterial(`labCabinetMat${cache.size}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = metal ? new Color3(0.7, 0.7, 0.7) : new Color3(gloss, gloss, gloss);
    m.specularPower = metal ? 96 : 48;
    m.emissiveColor = Color3.FromHexString(hex).scale(lift); // readable on the shaded side
    cache.set(key, m);
  }
  return cache.get(key);
}

export function createCabinetDressing(scene, cfg = CABINET) {
  const door = doorBounds(scene, cfg.node);
  if (!door) return [];
  const W = door.max.x - door.min.x;
  const H = door.max.y - door.min.y;
  const zf = door.max.z; // door front (faces +z, the front of the bench)
  // Seen from the front (+z, looking towards −z) the viewer's left is +x.
  const at = (u, v) => new Vector3(door.max.x - u * W, door.max.y - v * H, zf);

  // ---------- controls (3D) ----------
  const mats = new Map();
  const black = material(scene, mats, "#1b1c1e");
  const steel = material(scene, mats, "#c9ccd0", { metal: true });
  const parts = [];
  const disc = (name, p, r, h, z0, mat) => {
    const c = MeshBuilder.CreateCylinder(name, { diameter: 2 * r, height: h, tessellation: 28 }, scene);
    c.rotation.x = Math.PI / 2; // axis along z, out of the door
    c.position.set(p.x, p.y, zf + z0 + h / 2);
    c.material = mat;
    parts.push(c);
    return c;
  };
  const box = (name, p, w, h, d, z0, mat, rotZ = 0) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.position.set(p.x, p.y, zf + z0 + d / 2);
    b.rotation.z = rotZ;
    b.material = mat;
    parts.push(b);
  };
  for (const c of cfg.controls) {
    const p = at(c.u, c.v);
    // the pilot lens is white diffuser plastic: lifted so it reads white, not grey (still not "lit")
    const color = c.color ? material(scene, mats, c.color, c.kind === "pilot" ? { lift: 0.3, gloss: 0.6 } : {}) : black;
    const n = `labCab_${c.id}`;
    if (c.kind === "lock") {
      // wing handle with a key cylinder (sits over the enclosure's own lock)
      disc(`${n}Base`, p, 0.022, 0.01, 0, black);
      box(`${n}Wing`, p, 0.018, 0.052, 0.024, 0.01, black);
      disc(`${n}Key`, new Vector3(p.x - 0.017, p.y - 0.004, 0), 0.0065, 0.016, 0.002, steel);
    } else if (c.kind === "button") {
      disc(`${n}Bezel`, p, 0.019, 0.008, 0, black);
      disc(`${n}Cap`, p, 0.0145, 0.012, 0.008, color);
    } else if (c.kind === "pilot") {
      disc(`${n}Bezel`, p, 0.019, 0.008, 0, steel);
      const lens = MeshBuilder.CreateSphere(`${n}Lens`, { diameter: 0.03, segments: 12 }, scene);
      lens.scaling.z = 0.55;
      lens.position.set(p.x, p.y, zf + 0.008);
      lens.material = color;
      parts.push(lens);
    } else if (c.kind === "selector") {
      disc(`${n}Bezel`, p, 0.019, 0.008, 0, black);
      disc(`${n}Knob`, p, 0.014, 0.01, 0.008, black);
      box(`${n}Lever`, p, 0.036, 0.011, 0.018, 0.012, black, -0.55); // diagonal lever, as in the photo
    } else if (c.kind === "emergency") {
      disc(`${n}Body`, p, 0.02, 0.016, 0, black);
      disc(`${n}Mushroom`, p, 0.027, 0.016, 0.016, color);
    }
  }
  const controls = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  controls.name = "labCabinetControls";
  controls.metadata = { cabinet: "controls", ids: cfg.controls.map((c) => c.id) };

  // ---------- plates (one atlas, one mesh) ----------
  const items = [];
  const plate = (lines, p, w, h, style) => items.push({ lines, p, w, h, style });
  const lineH = 0.0095;
  for (const c of cfg.controls) {
    if (!c.legend) continue;
    const h = 0.008 + lineH * c.legend.length;
    const top = c.kind === "emergency" ? 0.04 : 0.032; // gap between the plate and the control's center
    const p = at(c.u, c.v);
    plate(c.legend, new Vector3(p.x, p.y + top + h / 2, zf), 0.086, h, "legend");
  }
  for (const pl of cfg.plates) plate(pl.lines, at(pl.u, pl.v), 0.09, 0.008 + lineH * pl.lines.length, "legend");
  if (cfg.sticker) plate(["PATRIMÔNIO", "SENAI-SP"], at(cfg.sticker.u, cfg.sticker.v), 0.1, 0.03, "sticker");

  // shelf-pack the plates into the atlas (canvas px, top-left origin)
  let sx = 0;
  let sy = 0;
  let shelf = 0;
  for (const it of items) {
    it.pw = Math.round(it.w * PX_PER_M);
    it.ph = Math.round(it.h * PX_PER_M);
    if (sx + it.pw > ATLAS_W) {
      sx = 0;
      sy += shelf + 4;
      shelf = 0;
    }
    it.px = sx;
    it.py = sy;
    sx += it.pw + 4;
    shelf = Math.max(shelf, it.ph);
  }
  const tex = texture(scene, "labCabinetAtlas", ATLAS_W, ATLAS_H, (ctx) => {
    ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
    for (const it of items) drawPlate(ctx, it);
  });
  const planes = items.map((it, i) => {
    const pl = MeshBuilder.CreatePlane(`labCabPlate${i}`, { width: it.w, height: it.h }, scene);
    pl.rotation.y = Math.PI; // faces the front (+z)
    pl.position.set(it.p.x, it.p.y, zf + 0.0015);
    // map the plane's 0..1 UVs onto its atlas rectangle (texture v = 1 at the canvas top)
    const uv = pl.getVerticesData(VertexBuffer.UVKind);
    const u0 = it.px / ATLAS_W;
    const u1 = (it.px + it.pw) / ATLAS_W;
    const vb = 1 - (it.py + it.ph) / ATLAS_H;
    const vt = 1 - it.py / ATLAS_H;
    for (let k = 0; k < uv.length; k += 2) {
      uv[k] = u0 + uv[k] * (u1 - u0);
      uv[k + 1] = vb + uv[k + 1] * (vt - vb);
    }
    pl.setVerticesData(VertexBuffer.UVKind, uv);
    return pl;
  });
  const plates = Mesh.MergeMeshes(planes, true, true);
  plates.name = "labCabinetPlates";
  plates.material = signMaterial(scene, "labCabinetPlatesMat", tex);
  plates.metadata = { cabinet: "plates", texts: items.map((it) => it.lines.join(" ")) };

  return [controls, plates];
}

function drawPlate(ctx, { lines, px, py, pw, ph, style }) {
  if (style === "sticker") {
    // white asset tag: text · QR-like block (decorative, not a real code) · text
    ctx.fillStyle = "#f7f7f5";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "#2a2a2a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    fitFont(ctx, lines[0], 700, Math.round(ph * 0.22), pw * 0.3);
    ctx.fillText(lines[0], px + pw * 0.18, py + ph / 2);
    fitFont(ctx, lines[1], 700, Math.round(ph * 0.22), pw * 0.3);
    ctx.fillText(lines[1], px + pw * 0.82, py + ph / 2);
    const q = ph * 0.8;
    const qx = px + (pw - q) / 2;
    const qy = py + (ph - q) / 2;
    const n = 11;
    const cell = q / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const corner = (i < 3 && j < 3) || (i < 3 && j >= n - 3) || (i >= n - 3 && j < 3);
        if (corner || (i * 7 + j * 13 + i * j) % 3 === 0) ctx.fillRect(qx + j * cell, qy + i * cell, cell, cell);
      }
    }
    return;
  }
  // black engraved legend plate, white capitals
  ctx.fillStyle = "#121314";
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = "#f2f2f2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rowH = (ph - 10) / lines.length;
  for (const [i, t] of lines.entries()) {
    fitFont(ctx, t, 700, Math.round(rowH * 0.78), pw * 0.86);
    ctx.fillText(t, px + pw / 2, py + 5 + rowH * (i + 0.5));
  }
}
