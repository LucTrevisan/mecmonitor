// SENAI mechanical-maintenance workshop around the bench: two-tone walls, school identity, instructor
// whiteboard, fitting bench with vise and 5S tool board, fire extinguisher with floor marking, 5S poster.
// Everything is procedural (no external assets), static and non-pickable (lab.js finalizes it).
// Furniture stays inside the back-wall strip (layout.propsEdgeZ), which XR never uses as a teleport target.
import { Color3, MeshBuilder } from "@babylonjs/core";
import { KPI_BY_KEY } from "../config/kpis.js";
import { SENSOR_BY_KPI } from "../config/sensors.js";
import { SCHOOL } from "../config/school.js";
import { FONT, fitFont, flatMaterial, signMaterial, texture } from "./canvasTex.js";

const WALL_H = 3.2;
const WAINSCOT_H = 1.1; // darker lower band, typical of school workshops
const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Plane on the back wall (faces +z, towards the bench). */
function onBackWall(scene, name, w, h, x, y, z, material) {
  const p = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
  p.position.set(x, y, z);
  p.rotation.y = Math.PI;
  p.material = material;
  return p;
}

// ---------- walls ----------
function walls(scene, L) {
  const width = L.half * 2;
  const z = L.wallZ;
  const lower = flatMaterial(scene, "wsWallLower", "#4f5b68", { emissive: 0.35 });
  const upper = flatMaterial(scene, "wsWallUpper", "#c9ced4", { emissive: 0.2 });
  const stripe = flatMaterial(scene, "wsWallStripe", SCHOOL.accent, { emissive: 0.35 });
  const meshes = [];
  const depth = L.half - z; // side walls run from the back wall to the front edge of the floor
  const faces = [
    { id: "B", len: width, pos: (y) => [0, y, z], rot: Math.PI, d: [0, 0, 0.004] },
    { id: "L", len: depth, pos: (y) => [-L.half, y, z + depth / 2], rot: -Math.PI / 2, d: [0.004, 0, 0] },
    { id: "R", len: depth, pos: (y) => [L.half, y, z + depth / 2], rot: Math.PI / 2, d: [-0.004, 0, 0] },
    { id: "F", len: width, pos: (y) => [0, y, L.half], rot: 0, d: [0, 0, -0.004] },
  ];
  for (const f of faces) {
    const parts = [
      ["Lower", WAINSCOT_H, WAINSCOT_H / 2, lower, [0, 0, 0]],
      ["Upper", WALL_H - WAINSCOT_H, WAINSCOT_H + (WALL_H - WAINSCOT_H) / 2, upper, [0, 0, 0]],
      ["Stripe", 0.06, WAINSCOT_H, stripe, f.d],
    ];
    for (const [part, h, y, mat, d] of parts) {
      const p = MeshBuilder.CreatePlane(`wsWall${f.id}${part}`, { width: f.len, height: h }, scene);
      const [px, py, pz] = f.pos(y);
      p.position.set(px + d[0], py, pz + d[2]);
      p.rotation.y = f.rot;
      p.material = mat;
      meshes.push(p);
    }
  }
  // Ceiling (faces down; invisible from above, so an orbiting desktop camera still sees the bench).
  const ceiling = MeshBuilder.CreatePlane("wsCeiling", { width, height: depth }, scene);
  ceiling.position.set(0, WALL_H, z + depth / 2);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.material = flatMaterial(scene, "wsCeilingMat", "#b4bac1", { emissive: 0.4 });
  meshes.push(ceiling);
  // Floor line marking the furniture strip along the back wall.
  const line = MeshBuilder.CreateGround("wsFloorLine", { width: width, height: 0.08 }, scene);
  line.position.set(0, 0.003, L.propsEdgeZ);
  line.material = flatMaterial(scene, "wsFloorLineMat", "#f2c200", { emissive: 0.25 });
  meshes.push(line);
  return meshes;
}

// ---------- identity ----------
function schoolSign(scene, L) {
  const W = 3.4;
  const H = 0.62;
  const tex = texture(scene, "wsSchoolSignTex", 2048, 374, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = SCHOOL.accent;
    ctx.fillRect(0, 0, 28, h);
    ctx.fillRect(0, h - 14, w, 14);
    // network name, typographic (no official logo reproduced)
    ctx.fillStyle = SCHOOL.accent;
    ctx.textBaseline = "middle";
    fitFont(ctx, SCHOOL.network, 900, 190, 560);
    ctx.fillText(SCHOOL.network, 80, h * 0.48);
    const x0 = 80 + ctx.measureText(SCHOOL.network).width + 60;
    ctx.fillStyle = "#d5dae0";
    ctx.fillRect(x0 - 30, 60, 6, h - 120);
    ctx.fillStyle = "#16202b";
    fitFont(ctx, SCHOOL.name, 800, 92, w - x0 - 60);
    ctx.fillText(SCHOOL.name, x0, h * 0.34);
    ctx.fillStyle = "#3d4a57";
    const sub = `${SCHOOL.course} · ${SCHOOL.room}`;
    fitFont(ctx, sub, 600, 62, w - x0 - 60);
    ctx.fillText(sub, x0, h * 0.7);
  });
  return [onBackWall(scene, "wsSchoolSign", W, H, 0, 2.62, L.wallZ + 0.012, signMaterial(scene, "wsSchoolSignMat", tex))];
}

// ---------- instructor whiteboard (limits come from the same config as the KPIs) ----------
function whiteboard(scene, L, x) {
  const z = L.wallZ;
  const W = 1.8;
  const H = 1.0;
  const y = 1.55;
  const limitLine = (key, label) => {
    const k = KPI_BY_KEY[key];
    const d = key === "temperature" || k.decimals === 0 ? 0 : 1;
    return `${SENSOR_BY_KPI[key]?.tag ?? ""}  ${label}: alerta > ${fmt(k.normal[1], d)} · crítico > ${fmt(k.alert[1], d)} ${k.unit}`;
  };
  const tex = texture(scene, "wsWhiteboardTex", 1440, 800, (ctx, w, h) => {
    ctx.fillStyle = "#f7f8f6";
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#1d4fa3"; // blue marker
    fitFont(ctx, "Manutenção Preditiva · Bomba P-01", 700, 72, w - 120);
    ctx.fillText("Manutenção Preditiva · Bomba P-01", 60, 120);
    ctx.fillRect(60, 142, 760, 5);
    ctx.fillStyle = "#1c1f24"; // black marker
    const lines = [
      limitLine("vibration", "Vibração"),
      limitLine("temperature", "Temperatura do mancal"),
      limitLine("current", "Corrente do motor"),
    ];
    lines.forEach((l, i) => {
      fitFont(ctx, l, 500, 46, w - 140);
      ctx.fillText(`• ${l}`, 70, 250 + i * 92);
    });
    ctx.fillStyle = "#b3261e"; // red marker
    const flow = "Inspecionar → Medir → Comparar → Diagnosticar → Agir";
    fitFont(ctx, flow, 700, 48, w - 140);
    ctx.fillText(flow, 70, 600);
    ctx.fillStyle = "#6a717a";
    ctx.font = `500 34px ${FONT}`;
    ctx.fillText("Vibração conforme ISO 10816-3 (grupo 2, base rígida)", 70, 690);
  });
  const frame = MeshBuilder.CreateBox("wsWhiteboardFrame", { width: W + 0.05, height: H + 0.05, depth: 0.03 }, scene);
  frame.position.set(x, y, z + 0.015);
  frame.material = flatMaterial(scene, "wsAluminium", "#c3c7cc", { metallic: true, emissive: 0.15 });
  const board = onBackWall(scene, "wsWhiteboard", W, H, x, y, z + 0.032, signMaterial(scene, "wsWhiteboardMat", tex));
  const tray = MeshBuilder.CreateBox("wsWhiteboardTray", { width: 1.2, height: 0.02, depth: 0.06 }, scene);
  tray.position.set(x, y - H / 2 - 0.035, z + 0.04);
  tray.material = frame.material;
  return [frame, board, tray];
}

// ---------- fitting bench + vise + 5S tool board ----------
function toolBoardTexture(scene) {
  return texture(scene, "wsToolBoardTex", 1360, 640, (ctx, w, h) => {
    ctx.fillStyle = "#e3e6e9";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c2c7cc"; // pegboard holes
    for (let y = 110; y < h; y += 34) for (let x = 20; x < w; x += 34) ctx.fillRect(x, y, 6, 6);
    ctx.fillStyle = SCHOOL.accent;
    ctx.fillRect(0, 0, w, 84);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    fitFont(ctx, "PAINEL DE FERRAMENTAS · 5S", 800, 50, w - 80);
    ctx.fillText("PAINEL DE FERRAMENTAS · 5S", 40, 44);
    // 5S shadow board: each tool has its outline painted on the board
    const shadow = "#4a525c";
    ctx.fillStyle = shadow;
    ctx.strokeStyle = shadow;
    // combination wrenches
    [0, 1, 2, 3].forEach((i) => {
      const x = 90 + i * 80;
      const len = 300 - i * 40;
      ctx.fillRect(x - 9, 150, 18, len);
      ctx.beginPath();
      ctx.arc(x, 150, 24, 0, Math.PI * 2);
      ctx.arc(x, 150 + len, 20, 0, Math.PI * 2);
      ctx.fill();
    });
    // hammer
    ctx.fillRect(480, 170, 20, 330);
    ctx.fillRect(430, 140, 120, 46);
    // screwdrivers
    [0, 1, 2].forEach((i) => {
      const x = 640 + i * 70;
      ctx.fillRect(x - 15, 150, 30, 120);
      ctx.fillRect(x - 5, 270, 10, 170 - i * 20);
    });
    // pliers
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(900, 160);
    ctx.lineTo(950, 330);
    ctx.lineTo(930, 500);
    ctx.moveTo(1000, 160);
    ctx.lineTo(950, 330);
    ctx.lineTo(975, 500);
    ctx.stroke();
    // dial indicator / caliper outline (measuring instruments)
    ctx.lineWidth = 10;
    ctx.strokeRect(1080, 150, 50, 360);
    ctx.fillRect(1130, 150, 120, 30);
    ctx.beginPath();
    ctx.arc(1200, 330, 70, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function fittingBench(scene, L, cx) {
  const z0 = L.wallZ;
  const W = 1.8;
  const D = 0.7;
  const TOP = 0.9;
  const cz = z0 + D / 2 + 0.02;
  const frameMat = flatMaterial(scene, "wsBenchFrame", "#2f3e52", { emissive: 0.2 });
  const steel = flatMaterial(scene, "wsSteel", "#9aa3ad", { metallic: true, emissive: 0.15 });
  const vise = flatMaterial(scene, "wsVise", "#2b5c8a", { emissive: 0.15 });
  const meshes = [];
  const box = (name, w, h, d, x, y, z, mat) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.material = mat;
    meshes.push(m);
    return m;
  };
  box("wsBenchTop", W, 0.05, D, cx, TOP - 0.025, cz, flatMaterial(scene, "wsBenchTopMat", "#7f8790", { emissive: 0.12 }));
  for (const [i, [dx, dz]] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].entries()) {
    box(`wsBenchLeg${i}`, 0.05, TOP - 0.05, 0.05, cx + dx * (W / 2 - 0.05), (TOP - 0.05) / 2, cz + dz * (D / 2 - 0.05), frameMat);
  }
  box("wsBenchShelf", W - 0.1, 0.03, D - 0.1, cx, 0.16, cz, frameMat);
  const cab = box("wsBenchCabinet", 0.5, 0.62, D - 0.08, cx + W / 2 - 0.32, TOP - 0.05 - 0.31, cz, flatMaterial(scene, "wsCabinet", "#3d4f66", { emissive: 0.2 }));
  // drawer lines on the cabinet front
  const drawers = texture(scene, "wsDrawersTex", 256, 320, (ctx, w, h) => {
    ctx.fillStyle = "#3d4f66";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#22303f";
    ctx.lineWidth = 6;
    [0, 1, 2].forEach((i) => ctx.strokeRect(10, 10 + i * 100, w - 20, 90));
    ctx.fillStyle = "#c9ced4";
    [0, 1, 2].forEach((i) => ctx.fillRect(w / 2 - 40, 50 + i * 100, 80, 12));
  });
  const front = MeshBuilder.CreatePlane("wsBenchDrawers", { width: 0.48, height: 0.6 }, scene);
  front.position.set(cab.position.x, cab.position.y, cz + (D - 0.08) / 2 + 0.002);
  front.rotation.y = Math.PI;
  front.material = signMaterial(scene, "wsDrawersMat", drawers);
  meshes.push(front);
  // bench vise at the left end
  const vx = cx - W / 2 + 0.3;
  const vz = cz + D / 2 - 0.12;
  box("wsViseBase", 0.2, 0.04, 0.22, vx, TOP + 0.02, vz, vise);
  box("wsViseBody", 0.13, 0.1, 0.2, vx, TOP + 0.09, vz, vise);
  box("wsViseJawFixed", 0.16, 0.07, 0.025, vx, TOP + 0.13, vz - 0.07, steel);
  box("wsViseJawMoving", 0.16, 0.07, 0.025, vx, TOP + 0.13, vz + 0.06, steel);
  const screw = MeshBuilder.CreateCylinder("wsViseScrew", { diameter: 0.018, height: 0.16, tessellation: 10 }, scene);
  screw.rotation.x = Math.PI / 2;
  screw.position.set(vx, TOP + 0.09, vz + 0.16);
  screw.material = steel;
  const handle = MeshBuilder.CreateCylinder("wsViseHandle", { diameter: 0.012, height: 0.22, tessellation: 8 }, scene);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(vx, TOP + 0.09, vz + 0.24);
  handle.material = steel;
  meshes.push(screw, handle);
  // 5S tool board above the bench
  meshes.push(onBackWall(scene, "wsToolBoard", W - 0.1, 0.8, cx, 1.6, z0 + 0.012, signMaterial(scene, "wsToolBoardMat", toolBoardTexture(scene))));
  return { meshes, footprint: { name: "bancada de ajustagem", x0: cx - W / 2, x1: cx + W / 2, z0, z1: z0 + D + 0.02 } };
}

// ---------- fire extinguisher (sign + red floor marking) ----------
function extinguisher(scene, L, x) {
  const z = L.wallZ;
  const red = flatMaterial(scene, "wsExtRed", "#c8102e", { emissive: 0.2 });
  const black = flatMaterial(scene, "wsExtBlack", "#16181b");
  const body = MeshBuilder.CreateCylinder("wsExtBody", { diameter: 0.16, height: 0.52, tessellation: 20 }, scene);
  body.position.set(x, 1.2, z + 0.1);
  body.material = red;
  const valve = MeshBuilder.CreateCylinder("wsExtValve", { diameter: 0.05, height: 0.09, tessellation: 12 }, scene);
  valve.position.set(x, 1.5, z + 0.1);
  valve.material = black;
  const hose = MeshBuilder.CreateCylinder("wsExtHose", { diameter: 0.016, height: 0.34, tessellation: 8 }, scene);
  hose.position.set(x + 0.095, 1.28, z + 0.1);
  hose.material = black;
  const signTex = texture(scene, "wsExtSignTex", 256, 320, (ctx, w, h) => {
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    // simple extinguisher pictogram (NBR 13434 style: white symbol on red)
    ctx.fillRect(98, 70, 60, 150);
    ctx.beginPath();
    ctx.arc(128, 70, 30, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(120, 22, 16, 22);
    ctx.fillRect(136, 26, 50, 10);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText("EXTINTOR", w / 2, 275);
  });
  const sign = onBackWall(scene, "wsExtSign", 0.24, 0.3, x, 1.78, z + 0.012, signMaterial(scene, "wsExtSignMat", signTex));
  const floorTex = texture(scene, "wsExtFloorTex", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f2c200";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(18, 18, w - 36, h - 36);
  });
  const mark = MeshBuilder.CreateGround("wsExtFloor", { width: 0.7, height: 0.7 }, scene);
  mark.position.set(x, 0.004, z + 0.37);
  mark.material = signMaterial(scene, "wsExtFloorMat", floorTex);
  return { meshes: [body, valve, hose, sign, mark], footprint: { name: "extintor", x0: x - 0.35, x1: x + 0.35, z0: z, z1: z + 0.72 } };
}

// ---------- safety signs (ISO 7010 style) ----------
function safetySign(scene, name, kind, lines) {
  return texture(scene, name, 512, 360, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d6dbe0";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    const cx = w / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (kind === "mandatory") {
      ctx.fillStyle = "#1f5fbf";
      ctx.beginPath();
      ctx.arc(cx, 112, 82, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 64px ${FONT}`;
      ctx.fillText("EPI", cx, 116);
    } else {
      ctx.fillStyle = "#f2c200";
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
      ctx.fillText("!", cx, 128);
    }
    ctx.fillStyle = "#16202b";
    ctx.font = `800 34px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, cx, 250 + i * 44));
  });
}

function safetySigns(scene, L) {
  return [
    { name: "labSignEPI", kind: "mandatory", lines: ["USO OBRIGATÓRIO", "DE EPI"], x: -1.6 },
    { name: "labSignOp", kind: "warning", lines: ["ATENÇÃO", "EQUIPAMENTO EM OPERAÇÃO"], x: 1.6 },
  ].map((s) => onBackWall(scene, s.name, 0.5, 0.35, s.x, 1.65, L.wallZ + 0.012, signMaterial(scene, `${s.name}Mat`, safetySign(scene, `${s.name}Tex`, s.kind, s.lines))));
}

// ---------- 5S poster on the right wall ----------
function poster5S(scene, L) {
  const tex = texture(scene, "ws5STex", 1040, 800, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = SCHOOL.accent;
    ctx.fillRect(0, 0, w, 120);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    fitFont(ctx, "PROGRAMA 5S", 900, 70, w - 80);
    ctx.fillText("PROGRAMA 5S", 50, 62);
    const rows = [
      ["Seiri", "Senso de utilização"],
      ["Seiton", "Senso de organização"],
      ["Seiso", "Senso de limpeza"],
      ["Seiketsu", "Senso de padronização"],
      ["Shitsuke", "Senso de autodisciplina"],
    ];
    rows.forEach(([jp, pt], i) => {
      const y = 190 + i * 120;
      ctx.fillStyle = SCHOOL.accent;
      ctx.beginPath();
      ctx.arc(95, y, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = `900 50px ${FONT}`;
      ctx.fillText(String(i + 1), 95, y + 2);
      ctx.textAlign = "left";
      ctx.fillStyle = "#16202b";
      ctx.font = `800 52px ${FONT}`;
      ctx.fillText(jp, 170, y - 18);
      ctx.fillStyle = "#4a5866";
      ctx.font = `500 40px ${FONT}`;
      ctx.fillText(pt, 170, y + 30);
    });
  });
  const p = MeshBuilder.CreatePlane("ws5SPoster", { width: 1.3, height: 1.0 }, scene);
  p.position.set(L.half - 0.012, 1.7, 0);
  p.rotation.y = Math.PI / 2; // faces -x (into the room)
  p.material = signMaterial(scene, "ws5SPosterMat", tex);
  return [p];
}

/** Builds the workshop. Returns meshes (to be finalized by lab.js) and furniture footprints. */
export function createWorkshop(scene, L) {
  const bench = fittingBench(scene, L, Math.min(3.3, L.half - 1.1));
  const ext = extinguisher(scene, L, -(L.half - 0.7));
  const meshes = [
    ...walls(scene, L),
    ...schoolSign(scene, L),
    ...whiteboard(scene, L, -3.1),
    ...safetySigns(scene, L),
    ...bench.meshes,
    ...ext.meshes,
    ...poster5S(scene, L),
  ];
  return { meshes, footprints: [bench.footprint, ext.footprint], accent: Color3.FromHexString(SCHOOL.accent) };
}
