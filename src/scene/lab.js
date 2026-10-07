// Training-lab surroundings for the bench. Everything here COMPLEMENTS the GLB: nothing in the
// model is moved, scaled or recolored. Positions derive from the model bounds at runtime.
// All lab meshes are static (frozen), non-pickable and excluded from camera framing, so they never
// interfere with selection, occlusion checks, framing or (later) XR teleport targets.
import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";
import { CLEARANCE, WALL_GAP } from "./layout.js";

const FONT = '"Segoe UI", system-ui, sans-serif';
const TAPE_W = 0.08; // floor tape width (m)

/** Largest font size (px) <= max that fits text in maxWidth. */
function fitFont(ctx, text, weight, max, maxWidth) {
  let size = max;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
  } while (ctx.measureText(text).width > maxWidth && --size > 8);
  return size;
}

function texture(scene, name, w, h, draw, { alpha = false } = {}) {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  tex.hasAlpha = alpha;
  draw(tex.getContext(), w, h);
  tex.update();
  return tex;
}

/** Unlit material (signage stays legible regardless of scene lighting). */
function signMaterial(scene, name, tex) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.emissiveTexture = tex;
  m.disableLighting = true;
  if (tex.hasAlpha) {
    m.opacityTexture = tex;
  }
  return m;
}

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

function benchSign(scene, b, frame) {
  const fb = frame ?? b;
  const width = Math.min(1.1, (fb.max.x - fb.min.x) * 0.8);
  const H = 0.2;
  const tex = texture(scene, "labBenchSignTex", 1024, 186, (ctx, w, h) => {
    ctx.fillStyle = "#f4f6f8";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#123a6b";
    ctx.fillRect(0, 0, 18, h);
    const title = "LABORATÓRIO DE MANUTENÇÃO PREDITIVA";
    const subtitle = "Bancada didática · Bomba centrífuga P-01 · Motor M-01";
    ctx.fillStyle = "#16202b";
    ctx.textBaseline = "middle";
    fitFont(ctx, title, 800, 54, w - 80);
    ctx.fillText(title, 46, h * 0.36);
    ctx.fillStyle = "#4a5866";
    fitFont(ctx, subtitle, 600, 36, w - 80);
    ctx.fillText(subtitle, 46, h * 0.74);
  });
  const sign = MeshBuilder.CreatePlane("labBenchSign", { width, height: H }, scene);
  sign.position.set((fb.min.x + fb.max.x) / 2, fb.max.y - H / 2 - 0.06, fb.max.z + 0.006);
  sign.rotation.y = Math.PI;
  sign.material = signMaterial(scene, "labBenchSignMat", tex);
  return [sign];
}

// ---------- room ----------
function safetySign(scene, name, kind, lines) {
  return texture(scene, name, 512, 360, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d6dbe0";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    const cx = w / 2;
    if (kind === "mandatory") {
      ctx.fillStyle = "#1f5fbf"; // ISO 7010 mandatory blue
      ctx.beginPath();
      ctx.arc(cx, 112, 82, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 64px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EPI", cx, 116);
    } else {
      ctx.fillStyle = "#f2c200"; // ISO 7010 warning yellow
      ctx.strokeStyle = "#16181b";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(cx, 26);
      ctx.lineTo(cx + 96, 192);
      ctx.lineTo(cx - 96, 192);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#16181b";
      ctx.font = `900 92px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", cx, 128);
    }
    ctx.fillStyle = "#16202b";
    ctx.textAlign = "center";
    ctx.font = `800 34px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, cx, 250 + i * 44));
  });
}

function backWall(scene, b, width) {
  const z = b.min.z - WALL_GAP;
  const H = 3.2;
  const wm = new StandardMaterial("labWallMat", scene);
  wm.diffuseColor = Color3.FromHexString("#9aa1a9");
  wm.specularColor = Color3.Black();
  wm.emissiveColor = new Color3(0.14, 0.15, 0.16); // keeps walls facing away from the sun from going black
  const wall = MeshBuilder.CreatePlane("labWall", { width, height: H }, scene);
  wall.position.set(0, H / 2, z);
  wall.rotation.y = Math.PI; // faces the bench (+z); invisible from behind (back-face culling)
  wall.material = wm;

  // Side walls close the corner so a standing (VR) user never looks into the void.
  const depth = width / 2 - z;
  const sides = [-1, 1].map((s) => {
    const w = MeshBuilder.CreatePlane(`labWallSide${s > 0 ? "R" : "L"}`, { width: depth, height: H }, scene);
    w.position.set((s * width) / 2, H / 2, z + depth / 2);
    w.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; // plane normal is -Z: rotate it to face inward
    w.material = wm;
    return w;
  });

  const band = MeshBuilder.CreatePlane("labWallBand", { width, height: 0.12 }, scene);
  band.position.set(0, 1.05, z + 0.005);
  band.rotation.y = Math.PI;
  const bm = new StandardMaterial("labWallBandMat", scene);
  bm.diffuseColor = Color3.FromHexString("#123a6b");
  bm.specularColor = Color3.Black();
  band.material = bm;

  const signs = [
    // Outside the bench frame's silhouette from the usual viewpoints.
    { name: "labSignEPI", kind: "mandatory", lines: ["USO OBRIGATÓRIO", "DE EPI"], x: -1.8 },
    { name: "labSignOp", kind: "warning", lines: ["ATENÇÃO", "EQUIPAMENTO EM OPERAÇÃO"], x: 1.8 },
  ].map((s) => {
    const p = MeshBuilder.CreatePlane(s.name, { width: 0.5, height: 0.35 }, scene);
    p.position.set(s.x, 1.65, z + 0.01);
    p.rotation.y = Math.PI;
    p.material = signMaterial(scene, `${s.name}Mat`, safetySign(scene, `${s.name}Tex`, s.kind, s.lines));
    return p;
  });
  return [wall, ...sides, band, ...signs];
}

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
 * @param {{ pump: { bounds: { min: Vector3, max: Vector3 } }, ground: Mesh, groundSize: number }} opts
 */
export function createLab(scene, { pump, ground, groundSize }) {
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

  const meshes = finalize([
    ...hazardTape(scene, b),
    ...floorText(scene, b),
    ...plateMeshes,
    ...benchSign(scene, b, frame),
    ...backWall(scene, b, groundSize),
    ...ceilingFixtures(scene, b),
  ]);
  return { meshes, plates };
}
