// Training-lab surroundings for the bench. Everything here COMPLEMENTS the GLB: nothing in the
// model is moved, scaled or recolored. Positions derive from the model bounds at runtime.
// All lab meshes are static (frozen), non-pickable and excluded from camera framing, so they never
// interfere with selection, occlusion checks, framing or XR teleport targets.
// The room itself (walls, school identity, workshop furniture) lives in workshop.js.
import { Color3, MeshBuilder, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";
import { CLEARANCE } from "./layout.js";
import { SCHOOL } from "../config/school.js";
import { BENCH } from "../config/bench.js";
import { FONT, drawSignImage, fitFont, signMaterial, texture } from "./canvasTex.js";
import { createWorkshop } from "./workshop.js";
import { createCabinetDressing } from "./cabinet.js";

const TAPE_W = 0.08; // floor tape width (m)
// identification boards on the bench frame (m): left board = split of the width, gap shows the frame
const BOARD = { inset: 0.005, height: 0.3, top: 0.02, gap: 0.04, split: 0.53 };

function finalize(meshes) {
  for (const m of meshes) {
    m.isPickable = false;
    m.metadata = { ...m.metadata, lab: true };
    m.freezeWorldMatrix();
    m.material?.freeze();
  }
  return meshes;
}

function nodeBounds(scene, name) {
  const node = scene.getNodeByName(name);
  return node ? node.getHierarchyBoundingVectors(true) : null;
}

// ---------- floor ----------
function technicalFloor(scene, ground, size) {
  const tex = texture(scene, "labFloorTex", 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#535a62"; // epoxy gray
    ctx.fillRect(0, 0, w, h);
    // subtle speckle so large areas do not look flat
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // 0.5 m modules (texture = 1 m)
    ctx.strokeStyle = "rgba(20,24,28,0.55)";
    ctx.lineWidth = 3;
    for (const p of [0, w / 2]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
    }
  });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = tex.vScale = size;
  const mat = new StandardMaterial("labFloorMat", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  mat.specularPower = 48;
  ground.material = mat; // the ground mesh itself (XR floor) is kept as is
}

// ---------- safety perimeter ----------
function hazardTexture(scene, name) {
  return texture(scene, name, 256, 64, (ctx, w, h) => {
    ctx.fillStyle = "#f2c200";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#16181b";
    for (let x = -h; x < w + h; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 32, h);
      ctx.lineTo(x + 32 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.fill();
    }
  });
}

function hazardTape(scene, b) {
  const x0 = b.min.x - CLEARANCE;
  const x1 = b.max.x + CLEARANCE;
  const z0 = b.min.z - CLEARANCE;
  const z1 = b.max.z + CLEARANCE;
  const y = 0.003;
  const sides = [
    { len: x1 - x0 + TAPE_W, pos: new Vector3((x0 + x1) / 2, y, z1), rot: 0 },
    { len: x1 - x0 + TAPE_W, pos: new Vector3((x0 + x1) / 2, y, z0), rot: 0 },
    { len: z1 - z0 - TAPE_W, pos: new Vector3(x0, y, (z0 + z1) / 2), rot: Math.PI / 2 },
    { len: z1 - z0 - TAPE_W, pos: new Vector3(x1, y, (z0 + z1) / 2), rot: Math.PI / 2 },
  ];
  return sides.map((s, i) => {
    const t = hazardTexture(scene, `labTapeTex${i}`);
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    t.uScale = s.len / 0.25;
    const strip = MeshBuilder.CreateGround(`labTape${i}`, { width: s.len, height: TAPE_W }, scene);
    strip.position.copyFrom(s.pos);
    strip.rotation.y = s.rot;
    const mat = new StandardMaterial(`labTapeMat${i}`, scene);
    mat.diffuseTexture = t;
    mat.specularColor = Color3.Black();
    mat.emissiveColor = new Color3(0.12, 0.12, 0.12);
    strip.material = mat;
    return strip;
  });
}

function floorText(scene, b) {
  const W = 1.5;
  const H = 0.22;
  const tex = texture(scene, "labFloorTextTex", 1024, 150, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(242,194,0,0.92)";
    ctx.font = `800 70px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ÁREA DE INSPEÇÃO · USE EPI", w / 2, h / 2 + 4);
  }, { alpha: true });
  const plane = MeshBuilder.CreateGround("labFloorText", { width: W, height: H }, scene);
  plane.position.set((b.min.x + b.max.x) / 2, 0.004, b.max.z + CLEARANCE + 0.32);
  plane.rotation.y = Math.PI; // readable when facing the bench from the front (+z)
  const mat = new StandardMaterial("labFloorTextMat", scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = Color3.Black();
  mat.emissiveColor = new Color3(0.25, 0.22, 0.05);
  plane.material = mat;
  return [plane];
}

// ---------- identification ----------
function plateTexture(scene, name, tag, label) {
  return texture(scene, `${name}Tex`, 512, 230, (ctx, w, h) => {
    ctx.fillStyle = "#123a6b"; // equipment tag blue
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e9eef5";
    ctx.lineWidth = 10;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 112px ${FONT}`;
    ctx.fillText(tag, w / 2, h * 0.43);
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(label, w / 2, h * 0.8);
  });
}

/**
 * Front and back plates mounted on a part's faces (it.on = bounds of the mounting part).
 * it.y overrides the height (default: middle of the mounting part).
 */
function equipmentPlates(scene, b, items) {
  const W = 0.2;
  const H = 0.09;
  const meshes = [];
  const plates = {};
  for (const it of items) {
    const tex = plateTexture(scene, `labPlate${it.tag}`, it.tag, it.label);
    const mat = signMaterial(scene, `labPlate${it.tag}Mat`, tex);
    const on = it.on ?? b;
    const y = it.y ?? (on.min.y + on.max.y) / 2;
    const zFront = on.max.z + 0.004;
    const zBack = on.min.z - 0.004;
    for (const [side, z, rot] of [["F", zFront, Math.PI], ["B", zBack, 0]]) {
      const p = MeshBuilder.CreatePlane(`labPlate${it.tag}${side}`, { width: W, height: H }, scene);
      p.position.set(it.x, y, z);
      p.rotation.y = rot; // plane front faces -Z; rotate to face outward
      p.material = mat;
      meshes.push(p);
      plates[`${it.tag}${side}`] = p;
    }
  }
  return { meshes, plates };
}

/**
 * Identification on top of the bench frame, like the real bench at the school: two boards side by side,
 * with the frame visible between them.
 *   left   manufacturer: official logo if supplied (BENCH.makerLogoUrl), else typographic name + ®;
 *          "Soluções em Bombeamento" below
 *   right  black FIESP / SESI / SENAI / IRS box + official SENAI logo (SCHOOL.logoUrl)
 * Each board is drawn with text fallbacks, then redrawn when its logo loads (metadata.logo).
 */
function benchSign(scene, b, frame) {
  const fb = frame ?? b;
  const H = BOARD.height;
  const total = fb.max.x - fb.min.x - 2 * BOARD.inset;
  const leftW = (total - BOARD.gap) * BOARD.split;
  const rightW = total - BOARD.gap - leftW;
  const y = fb.max.y - BOARD.top - H / 2;
  const z = fb.max.z + 0.006;
  const board = (name, x, w, draw, logoUrl, text) => {
    const CW = 1536;
    const CH = Math.round((CW * H) / w);
    const tex = texture(scene, `${name}Tex`, CW, CH, (ctx, cw, ch) => draw(ctx, cw, ch, null));
    const sign = MeshBuilder.CreatePlane(name, { width: w, height: H }, scene);
    sign.position.set(x, y, z);
    sign.rotation.y = Math.PI; // faces the front (+z)
    sign.material = signMaterial(scene, `${name}Mat`, tex);
    sign.metadata = { text };
    drawSignImage(sign, tex, logoUrl, draw);
    return sign;
  };
  const paper = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfbfa";
    ctx.fillRect(0, 0, w, h);
  };

  const drawMaker = (ctx, w, h, logo) => {
    paper(ctx, w, h);
    if (logo) {
      const lh = h * 0.6;
      const lw = Math.min(w * 0.9, lh * (logo.width / logo.height));
      ctx.drawImage(logo, (w - lw) / 2, h * 0.06, lw, lw / (logo.width / logo.height));
    } else {
      // heavy upright lettering in the board's red, with the ® of the real board
      ctx.fillStyle = BENCH.makerColor;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      const size = fitFont(ctx, BENCH.maker, 900, Math.round(h * 0.62), w * 0.78);
      const tw = ctx.measureText(BENCH.maker).width;
      const x = (w - tw) / 2;
      ctx.fillText(BENCH.maker, x, h * 0.6);
      ctx.font = `600 ${Math.round(size * 0.16)}px ${FONT}`;
      ctx.fillText("®", x + tw + size * 0.04, h * 0.6 - size * 0.58);
    }
    ctx.fillStyle = "#3a3d41";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    fitFont(ctx, BENCH.makerTagline, 500, Math.round(h * 0.15), w * 0.72);
    ctx.fillText(BENCH.makerTagline, w / 2, h * 0.86);
  };

  const drawSystem = (ctx, w, h, logo) => {
    paper(ctx, w, h);
    const aspect = SCHOOL.logoAspect ?? 3.9;
    let logoH = h * 0.6;
    const size = (lh) => ({ boxH: lh * 0.88, boxW: lh * 0.88 * 0.8, gap: h * 0.04, logoW: lh * aspect });
    let m = size(logoH);
    while (m.boxW + m.gap + m.logoW > w * 0.94 && logoH > 20) m = size((logoH -= 2));
    let x = (w - (m.boxW + m.gap + m.logoW)) / 2;
    // FIESP-system box: white words separated by thin white rules
    const by = (h - m.boxH) / 2;
    ctx.fillStyle = "#151617";
    ctx.fillRect(x, by, m.boxW, m.boxH);
    const rows = BENCH.system.length;
    const rowH = m.boxH / rows;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    BENCH.system.forEach((t, i) => {
      ctx.fillStyle = "#ffffff";
      fitFont(ctx, t, 700, Math.round(rowH * 0.62), m.boxW * 0.72);
      ctx.fillText(t, x + m.boxW / 2, by + rowH * (i + 0.47));
      ctx.fillRect(x + m.boxW * 0.14, by + rowH * (i + 1) - 2, m.boxW * 0.72, Math.max(2, h * 0.006));
    });
    x += m.boxW + m.gap;
    const ly = (h - logoH) / 2;
    if (logo) {
      ctx.drawImage(logo, x, ly, m.logoW, logoH);
    } else {
      ctx.fillStyle = SCHOOL.accent;
      ctx.fillRect(x, ly, m.logoW, logoH);
      ctx.fillStyle = "#ffffff";
      fitFont(ctx, SCHOOL.network, "italic 900", Math.round(logoH * 0.8), m.logoW * 0.8);
      ctx.fillText(SCHOOL.network, x + m.logoW / 2, ly + logoH / 2 + 4);
    }
  };

  // Seen from the front of the bench (+z, looking towards −z) the viewer's left is +x.
  return [
    board("labBenchSign", fb.max.x - BOARD.inset - leftW / 2, leftW, drawMaker, BENCH.makerLogoUrl, [BENCH.maker, BENCH.makerTagline]),
    board("labBenchSignSystem", fb.min.x + BOARD.inset + rightW / 2, rightW, drawSystem, SCHOOL.logoUrl, [...BENCH.system, SCHOOL.network]),
  ];
}

// ---------- lighting ----------
function ceilingFixtures(scene, b) {
  const mat = new StandardMaterial("labLedMat", scene);
  mat.emissiveColor = new Color3(0.95, 0.97, 1);
  mat.disableLighting = true;
  const housing = new StandardMaterial("labLedHousingMat", scene);
  housing.diffuseColor = Color3.FromHexString("#c8ccd1");
  housing.specularColor = Color3.Black();
  const meshes = [];
  for (const [i, x] of [-0.7, 0.7].entries()) {
    const body = MeshBuilder.CreateBox(`labLedBody${i}`, { width: 1.25, height: 0.05, depth: 0.16 }, scene);
    body.position.set(x, 3.0, (b.min.z + b.max.z) / 2);
    body.material = housing;
    const led = MeshBuilder.CreatePlane(`labLed${i}`, { width: 1.2, height: 0.11 }, scene);
    led.position.set(x, 2.974, (b.min.z + b.max.z) / 2);
    led.rotation.x = -Math.PI / 2; // emissive side faces down
    led.material = mat;
    meshes.push(body, led);
  }
  return meshes;
}

/**
 * Builds the lab around the loaded pump.
 * @param {{ pump: { bounds: { min: Vector3, max: Vector3 } }, ground: Mesh, groundSize: number, layout }} opts
 */
export function createLab(scene, { pump, ground, groundSize, layout }) {
  const b = pump.bounds;
  technicalFloor(scene, ground, groundSize);

  const base = nodeBounds(scene, "Base-1");
  const motor = nodeBounds(scene, "Motor teste-2");
  const casing = nodeBounds(scene, "casing oficial-1");
  const frame = nodeBounds(scene, "senai_placa.stp-1");

  const plateItems = [
    // P-01 on the base frame under the pump casing.
    { tag: "P-01", label: "BOMBA CENTRÍFUGA", on: base, x: casing ? (casing.min.x + casing.max.x) / 2 : b.max.x - 0.4 },
    // M-01 on the motor body itself, near its coupling end: on the base it was hidden by the
    // reservoir and the electrical panel.
    { tag: "M-01", label: "MOTOR ELÉTRICO", on: motor, x: motor ? motor.max.x - 0.1 : b.min.x + 0.4 },
  ];
  const { meshes: plateMeshes, plates } = equipmentPlates(scene, b, plateItems);

  const workshop = createWorkshop(scene, layout);
  const meshes = finalize([
    ...hazardTape(scene, b),
    ...floorText(scene, b),
    ...plateMeshes,
    ...benchSign(scene, b, frame),
    ...createCabinetDressing(scene), // electrical cabinet like the real one (plates + controls on the door)
    ...workshop.meshes,
    ...ceilingFixtures(scene, b),
  ]);
  return { meshes, plates, footprints: workshop.footprints };
}
