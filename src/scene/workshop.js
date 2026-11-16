// Signage of the lab room (scene/room.js builds the room itself): school identity, instructor whiteboard,
// 5S tool board, safety signs, 5S poster. Procedural (no external assets), static and non-pickable.
import { Color3, MeshBuilder } from "@babylonjs/core";
import { KPI_BY_KEY } from "../config/kpis.js";
import { SENSOR_BY_KPI } from "../config/sensors.js";
import { SCHOOL } from "../config/school.js";
import { FONT, drawSignImage, fitFont, flatMaterial, signMaterial, texture } from "./canvasTex.js";
import { createRoom } from "./room.js";

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Plane on the back wall (faces +z, towards the bench). */
function onBackWall(scene, name, w, h, x, y, z, material) {
  const p = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
  p.position.set(x, y, z);
  p.rotation.y = Math.PI;
  p.material = material;
  return p;
}

// ---------- identity ----------
/**
 * School sign: official logo (SCHOOL.logoUrl) + school name + course. Drawn first with a text fallback,
 * then redrawn when the logo loads; the logo is rasterized into the sign's own canvas (no extra
 * 4096-px texture on the GPU). mesh.metadata.logo = "loaded" | "fallback" | "pending".
 */
function schoolSign(scene, L) {
  const W = 2.6;
  const H = 0.474;
  const CW = 2048;
  const CH = 374;
  const at = SCHOOL.name.indexOf(SCHOOL.network);
  const line1 = at >= 0 ? SCHOOL.name.slice(0, at + SCHOOL.network.length) : SCHOOL.name; // "Escola SENAI"
  const line2 = at >= 0 ? SCHOOL.name.slice(at + SCHOOL.network.length).trim() : ""; // "Antonio Adolpho Lobbe"
  const logoH = Math.round(CH * 0.62);
  const logoW = Math.round(logoH * (SCHOOL.logoAspect ?? 3.9));
  const logoX = 56;
  const logoY = Math.round((CH - logoH) / 2) - 6;

  const draw = (ctx, w, h, logo) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = SCHOOL.accent;
    ctx.fillRect(0, h - 14, w, 14);
    if (logo) {
      ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    } else {
      // fallback while loading / if the file is missing: the network name on the accent color
      ctx.fillRect(logoX, logoY, logoW, logoH);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      fitFont(ctx, SCHOOL.network, 900, 200, logoW - 80);
      ctx.fillText(SCHOOL.network, logoX + logoW / 2, logoY + logoH / 2 + 6);
      ctx.textAlign = "left";
    }
    const x0 = logoX + logoW + 70;
    const tw = w - x0 - 50;
    ctx.fillStyle = "#d5dae0";
    ctx.fillRect(x0 - 36, 56, 6, h - 112);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#4a5866";
    fitFont(ctx, line1, 600, 56, tw);
    ctx.fillText(line1, x0, h * 0.25);
    ctx.fillStyle = "#16202b";
    fitFont(ctx, line2 || SCHOOL.name, 800, 96, tw);
    ctx.fillText(line2 || SCHOOL.name, x0, h * 0.5);
    ctx.fillStyle = SCHOOL.accent;
    fitFont(ctx, SCHOOL.course, 700, 52, tw);
    ctx.fillText(SCHOOL.course, x0, h * 0.77);
  };

  const tex = texture(scene, "wsSchoolSignTex", CW, CH, (ctx, w, h) => draw(ctx, w, h, null));
  const sign = onBackWall(scene, "wsSchoolSign", W, H, 0, 2.5, L.wallZ + 0.012, signMaterial(scene, "wsSchoolSignMat", tex));
  drawSignImage(sign, tex, SCHOOL.logoUrl, draw);
  return [sign];
}

// ---------- instructor whiteboard (limits come from the same config as the KPIs) ----------
function whiteboard(scene, L, x) {
  const W = 1.8;
  const H = 1.0;
  const y = 1.55;
  const limitLine = (key, label) => {
    const k = KPI_BY_KEY[key];
    const d = key === "temperature" || k.decimals === 0 ? 0 : 1;
    const tag = SENSOR_BY_KPI[key]?.tag ?? "";
    // low-is-bad KPIs (oil level) alarm below the band
    if (k.normal[1] === Infinity) return `${tag}  ${label}: alerta < ${fmt(k.normal[0], d)} · crítico < ${fmt(k.alert[0], d)} ${k.unit}`;
    return `${tag}  ${label}: alerta > ${fmt(k.normal[1], d)} · crítico > ${fmt(k.alert[1], d)} ${k.unit}`;
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
      limitLine("oil", "Nível do óleo"),
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
  // on the left wall (x = -half), facing +x
  const wx = -L.half;
  const frame = MeshBuilder.CreateBox("wsWhiteboardFrame", { width: 0.03, height: H + 0.05, depth: W + 0.05 }, scene);
  frame.position.set(wx + 0.015, y, x);
  frame.material = flatMaterial(scene, "wsAluminium", "#c3c7cc", { metallic: true, emissive: 0.15 });
  const board = MeshBuilder.CreatePlane("wsWhiteboard", { width: W, height: H }, scene);
  board.position.set(wx + 0.032, y, x);
  board.rotation.y = -Math.PI / 2;
  board.material = signMaterial(scene, "wsWhiteboardMat", tex);
  const tray = MeshBuilder.CreateBox("wsWhiteboardTray", { width: 0.06, height: 0.02, depth: 1.2 }, scene);
  tray.position.set(wx + 0.04, y - H / 2 - 0.035, x);
  tray.material = frame.material;
  return [frame, board, tray];
}

// ---------- 5S tool board ----------
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
    { name: "labSignEPI", kind: "mandatory", lines: ["USO OBRIGATÓRIO", "DE EPI"], x: -1.55 },
    { name: "labSignOp", kind: "warning", lines: ["ATENÇÃO", "EQUIPAMENTO EM OPERAÇÃO"], x: 1.55 },
  ].map((s) => onBackWall(scene, s.name, 0.5, 0.35, s.x, 2.2, L.wallZ + 0.012, signMaterial(scene, `${s.name}Mat`, safetySign(scene, `${s.name}Tex`, s.kind, s.lines))));
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
  p.position.set(L.half - 0.012, 1.7, 0.45);
  p.rotation.y = Math.PI / 2; // faces -x (into the room)
  p.material = signMaterial(scene, "ws5SPosterMat", tex);
  return [p];
}

/** Builds the lab room and its signage. Returns meshes (finalized by lab.js) and furniture footprints. */
export function createWorkshop(scene, L) {
  const room = createRoom(scene, L); // shell, furniture, doors / windows, trays, luminaires (batched)
  const meshes = [
    ...room.meshes,
    ...schoolSign(scene, L),
    ...whiteboard(scene, L, -0.9),
    // 5S shadow board over the blue workbench
    onBackWall(scene, "wsToolBoard", 1.7, 0.8, L.half - 1.0, 1.6, L.wallZ + 0.012, signMaterial(scene, "wsToolBoardMat", toolBoardTexture(scene))),
    ...safetySigns(scene, L),
    ...poster5S(scene, L),
  ];
  return { meshes, footprints: room.footprints, accent: Color3.FromHexString(SCHOOL.accent) };
}
// Signage of the lab room (scene/room.js builds the room itself): school identity, instructor whiteboard,
// 5S tool board, safety signs, 5S poster. Procedural (no external assets), static and non-pickable.
import { Color3, MeshBuilder } from "@babylonjs/core";
import { KPI_BY_KEY } from "../config/kpis.js";
import { SENSOR_BY_KPI } from "../config/sensors.js";
import { SCHOOL } from "../config/school.js";
import { FONT, drawSignImage, fitFont, flatMaterial, signMaterial, texture } from "./canvasTex.js";
import { createRoom } from "./room.js";

const fmt = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Plane on the back wall (faces +z, towards the bench). */
function onBackWall(scene, name, w, h, x, y, z, material) {
  const p = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
  p.position.set(x, y, z);
  p.rotation.y = Math.PI;
  p.material = material;
  return p;
}

// ---------- identity ----------
/**
 * School sign: official logo (SCHOOL.logoUrl) + school name + course. Drawn first with a text fallback,
 * then redrawn when the logo loads; the logo is rasterized into the sign's own canvas (no extra
 * 4096-px texture on the GPU). mesh.metadata.logo = "loaded" | "fallback" | "pending".
 */
function schoolSign(scene, L) {
  const W = 2.6;
  const H = 0.474;
  const CW = 2048;
  const CH = 374;
  const at = SCHOOL.name.indexOf(SCHOOL.network);
  const line1 = at >= 0 ? SCHOOL.name.slice(0, at + SCHOOL.network.length) : SCHOOL.name; // "Escola SENAI"
  const line2 = at >= 0 ? SCHOOL.name.slice(at + SCHOOL.network.length).trim() : ""; // "Antonio Adolpho Lobbe"
  const logoH = Math.round(CH * 0.62);
  const logoW = Math.round(logoH * (SCHOOL.logoAspect ?? 3.9));
  const logoX = 56;
  const logoY = Math.round((CH - logoH) / 2) - 6;

  const draw = (ctx, w, h, logo) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = SCHOOL.accent;
    ctx.fillRect(0, h - 14, w, 14);
    if (logo) {
      ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    } else {
      // fallback while loading / if the file is missing: the network name on the accent color
      ctx.fillRect(logoX, logoY, logoW, logoH);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      fitFont(ctx, SCHOOL.network, 900, 200, logoW - 80);
      ctx.fillText(SCHOOL.network, logoX + logoW / 2, logoY + logoH / 2 + 6);
      ctx.textAlign = "left";
    }
    const x0 = logoX + logoW + 70;
    const tw = w - x0 - 50;
    ctx.fillStyle = "#d5dae0";
    ctx.fillRect(x0 - 36, 56, 6, h - 112);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#4a5866";
    fitFont(ctx, line1, 600, 56, tw);
    ctx.fillText(line1, x0, h * 0.25);
    ctx.fillStyle = "#16202b";
    fitFont(ctx, line2 || SCHOOL.name, 800, 96, tw);
    ctx.fillText(line2 || SCHOOL.name, x0, h * 0.5);
    ctx.fillStyle = SCHOOL.accent;
    fitFont(ctx, SCHOOL.course, 700, 52, tw);
    ctx.fillText(SCHOOL.course, x0, h * 0.77);
  };

  const tex = texture(scene, "wsSchoolSignTex", CW, CH, (ctx, w, h) => draw(ctx, w, h, null));
  const sign = onBackWall(scene, "wsSchoolSign", W, H, 0, 2.5, L.wallZ + 0.012, signMaterial(scene, "wsSchoolSignMat", tex));
  drawSignImage(sign, tex, SCHOOL.logoUrl, draw);
  return [sign];
}

// ---------- instructor whiteboard (limits come from the same config as the KPIs) ----------
function whiteboard(scene, L, x) {
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
  // on the left wall (x = -half), facing +x
  const wx = -L.half;
  const frame = MeshBuilder.CreateBox("wsWhiteboardFrame", { width: 0.03, height: H + 0.05, depth: W + 0.05 }, scene);
  frame.position.set(wx + 0.015, y, x);
  frame.material = flatMaterial(scene, "wsAluminium", "#c3c7cc", { metallic: true, emissive: 0.15 });
  const board = MeshBuilder.CreatePlane("wsWhiteboard", { width: W, height: H }, scene);
  board.position.set(wx + 0.032, y, x);
  board.rotation.y = -Math.PI / 2;
  board.material = signMaterial(scene, "wsWhiteboardMat", tex);
  const tray = MeshBuilder.CreateBox("wsWhiteboardTray", { width: 0.06, height: 0.02, depth: 1.2 }, scene);
  tray.position.set(wx + 0.04, y - H / 2 - 0.035, x);
  tray.material = frame.material;
  return [frame, board, tray];
}

// ---------- 5S tool board ----------
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
    { name: "labSignEPI", kind: "mandatory", lines: ["USO OBRIGATÓRIO", "DE EPI"], x: -1.55 },
    { name: "labSignOp", kind: "warning", lines: ["ATENÇÃO", "EQUIPAMENTO EM OPERAÇÃO"], x: 1.55 },
  ].map((s) => onBackWall(scene, s.name, 0.5, 0.35, s.x, 2.2, L.wallZ + 0.012, signMaterial(scene, `${s.name}Mat`, safetySign(scene, `${s.name}Tex`, s.kind, s.lines))));
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
  p.position.set(L.half - 0.012, 1.7, 0.45);
  p.rotation.y = Math.PI / 2; // faces -x (into the room)
  p.material = signMaterial(scene, "ws5SPosterMat", tex);
  return [p];
}

/** Builds the lab room and its signage. Returns meshes (finalized by lab.js) and furniture footprints. */
export function createWorkshop(scene, L) {
  const room = createRoom(scene, L); // shell, furniture, doors / windows, trays, luminaires (batched)
  const meshes = [
    ...room.meshes,
    ...schoolSign(scene, L),
    ...whiteboard(scene, L, -0.9),
    // 5S shadow board over the blue workbench
    onBackWall(scene, "wsToolBoard", 1.7, 0.8, L.half - 1.0, 1.6, L.wallZ + 0.012, signMaterial(scene, "wsToolBoardMat", toolBoardTexture(scene))),
    ...safetySigns(scene, L),
    ...poster5S(scene, L),
  ];
  return { meshes, footprints: room.footprints, accent: Color3.FromHexString(SCHOOL.accent) };
}
