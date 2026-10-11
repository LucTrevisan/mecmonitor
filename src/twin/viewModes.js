// Visualization modes: NORMAL · SENSORES · RAIO-X · TÉRMICO (desktop dock and VR menu).
// Rules:
//  - the GLB is never modified: modes swap materials at runtime, every swap is recorded and leaving a
//    mode restores the exact material each mesh had (including the green color overrides);
//  - only what a mode is about is touched: RAIO-X ghosts the shells around the rotating parts, TÉRMICO
//    colors only the region monitored by T-01; sensor bodies, colliders, indicators and lab scenery never;
//  - SEM DADOS is never painted as a temperature (the region turns neutral gray).
import { Color3, MeshBuilder, StandardMaterial, Vector3, VertexBuffer } from "@babylonjs/core";
import { SENSOR_TAGS, THERMAL, VIEW_MODES, XRAY } from "../config/viewModes.js";
import { STATES } from "../ui/states.js";
import { createModeCard, drawPartCard, drawSensorCard, drawThermalCard } from "./modeCards.js";
import { legendPosition, regionTemperature, thermalColor, thermalLevel } from "./thermalScale.js";

const isSensorPart = (m) => Boolean(m.metadata?.sensorBody || m.metadata?.sensorCollider || m.metadata?.sensorIndicator || m.metadata?.modeCard);
const hex = (c) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
const SMOOTH_S = 0.8; // s — displayed temperature eases towards the reading (gradual response)
const PAINT_MS = 100; // max vertex-color repaint rate while easing

function meshesOf(scene, name) {
  const node = scene.getNodeByName(name);
  if (!node) {
    console.warn(`Modo de visualização: nó "${name}" não encontrado no modelo`);
    return [];
  }
  const own = typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0 ? [node] : [];
  return own.concat(node.getChildMeshes(false)).filter((m) => m.getTotalVertices() > 0 && !isSensorPart(m));
}

/** Meshes whose material can be swapped for a group: instances share their source's material, so an
 *  instanced part is only swapped when its source and every instance belong to the group. */
function materialOwners(meshes) {
  const set = new Set(meshes);
  const owners = new Set();
  for (const m of set) {
    if (m.getClassName() !== "InstancedMesh") owners.add(m);
    else if (set.has(m.sourceMesh) && m.sourceMesh.instances.every((i) => set.has(i))) owners.add(m.sourceMesh);
  }
  return [...owners];
}

function worldBox(meshes) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    min.minimizeInPlace(bb.minimumWorld);
    max.maximizeInPlace(bb.maximumWorld);
  }
  return { min, max };
}

/**
 * @param {{ scene, pump, twin, sensors, kpiDefs, fmt }} deps  twin: hotspots (sensor positions/2D labels),
 *        onSelectionChange; kpiDefs: KPI_BY_KEY; fmt(value, decimals) → localized number
 */
export function createViewModes({ scene, pump, twin, sensors, kpiDefs, fmt }) {
  let mode = "normal";
  const listeners = new Set();
  const base = new Map(); // mesh → material on screen before the current mode (restored on leave)
  const swap = (mesh, mat) => {
    if (!base.has(mesh)) base.set(mesh, mesh.material);
    mesh.material = mat;
  };
  let last = { result: null, sample: null };
  let immersive = false;
  let selectedId = null;

  // ---------- SENSORES ----------
  let sensorTags = null;
  function buildSensorTags() {
    sensorTags = {};
    for (const s of sensors) {
      const card = createModeCard(scene, `modeSensor-${s.id}`, { width: 0.22, height: 0.11, draw: drawSensorCard });
      // selectable like the sensor itself (mouse, controller ray, hand): same id as its interaction volume
      card.mesh.isPickable = true;
      card.mesh.metadata = { modeCard: "sensors", sensorCollider: s.id, xrInteractive: true };
      const ringMat = new StandardMaterial(`modeSensorRingMat-${s.id}`, scene);
      ringMat.disableLighting = true;
      const ring = MeshBuilder.CreateTorus(`modeSensorRing-${s.id}`, { diameter: 0.085, thickness: 0.006, tessellation: 36 }, scene);
      ring.material = ringMat;
      ring.isPickable = false;
      ring.metadata = { modeCard: "sensors" };
      ring.setEnabled(false);
      sensorTags[s.id] = { s, card, ring, ringMat, lift: SENSOR_TAGS[s.id]?.lift ?? 0.2 };
    }
  }
  function paintSensorTags() {
    if (!sensorTags) return;
    for (const t of Object.values(sensorTags)) {
      const k = last.result?.kpis[t.s.kpi];
      const def = kpiDefs[t.s.kpi];
      const st = STATES[k?.state] ?? STATES.nodata;
      const noData = !k || k.state === "nodata" || k.value == null;
      t.card.set({
        title: t.s.secondary ? `${t.s.tag} (sec.)` : t.s.tag,
        value: noData ? "SEM DADOS" : `${fmt(k.value, def.decimals)} ${def.unit}`,
        state: `${st.glyph} ${st.label}`,
        stateColor: st.color,
        accent: st.color,
        detail: `${t.s.model} · ${t.s.location.split(" — ")[0]}`,
      });
      t.ringMat.emissiveColor = Color3.FromHexString(st.color);
    }
  }
  function showSensorTags() {
    for (const t of Object.values(sensorTags)) {
      const p = twin.hotspots.position(t.s.id);
      t.ring.position.copyFrom(p);
      t.card.place(p, t.lift, STATES[last.result?.kpis[t.s.kpi]?.state]?.color ?? STATES.nodata.color);
      // in the headset the selected sensor's detailed card takes this place
      const hiddenBySelection = immersive && selectedId === t.s.id;
      if (hiddenBySelection) t.card.hide();
      else t.card.show();
      t.ring.setEnabled(true);
    }
  }

  // ---------- RAIO-X ----------
  let xray = null;
  function buildXray() {
    const ghost = new StandardMaterial("modeXrayGhost", scene);
    ghost.diffuseColor = Color3.FromHexString("#9cc3e6");
    ghost.emissiveColor = Color3.FromHexString("#1f3a57");
    ghost.specularColor = new Color3(0.15, 0.15, 0.15);
    ghost.alpha = 0.16;
    ghost.backFaceCulling = true;
    const shells = XRAY.shells.flatMap((n) => meshesOf(scene, n));
    const pad = new Vector3(0.01, 0.01, 0.01);
    const boxes = shells.map((m) => {
      const b = worldBox([m]);
      return { min: b.min.subtract(pad), max: b.max.add(pad) };
    });
    const inside = (p) => boxes.some((b) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y && p.z >= b.min.z && p.z <= b.max.z);
    const fasteners = pump.pivot
      .getChildMeshes(false)
      .filter((m) => XRAY.fastenerPrefixes.some((p) => m.name.startsWith(p)) && !isSensorPart(m) && inside(m.getBoundingInfo().boundingBox.centerWorld));
    const owners = materialOwners([...shells, ...fasteners]);
    const parts = XRAY.parts.map((p) => {
      const meshes = p.nodes.flatMap((n) => meshesOf(scene, n));
      const card = createModeCard(scene, `modeXray-${p.id}`, { width: 0.22, height: 0.075, draw: drawPartCard });
      card.set({ title: p.label, detail: p.detail, accent: "#9cc3e6" });
      return { ...p, meshes, card };
    });
    xray = { ghost, owners, parts };
  }
  function showXray() {
    for (const m of xray.owners) swap(m, xray.ghost);
    for (const p of xray.parts) {
      if (!p.meshes.length) continue;
      const { min, max } = worldBox(p.meshes);
      p.card.place(new Vector3((min.x + max.x) / 2, max.y, (min.z + max.z) / 2), p.lift, "#9cc3e6");
      p.card.show();
    }
  }

  // ---------- TÉRMICO ----------
  let thermal = null;
  const LUT_STEP = 0.25; // °C per color-table entry (no per-vertex allocations while repainting)
  const LUT = Array.from({ length: Math.round(130 / LUT_STEP) + 1 }, (_, i) => thermalColor(i * LUT_STEP, THERMAL.stops));
  const nodataRGB = thermalColor(0, [[0, THERMAL.nodataColor]]);
  function buildThermal() {
    const mat = new StandardMaterial("modeThermalMat", scene);
    mat.diffuseColor = Color3.White();
    mat.emissiveColor = new Color3(0.42, 0.42, 0.42); // readable on the shaded side
    mat.specularColor = new Color3(0.06, 0.06, 0.06);
    const anchor = twin.hotspots.position(THERMAL.sensor);
    const v = new Vector3();
    const items = materialOwners(THERMAL.region.flatMap((n) => meshesOf(scene, n)))
      .filter((m) => m.getClassName() === "Mesh")
      .map((m) => {
        if (m.geometry && m.geometry.meshes.length > 1) m.makeGeometryUnique(); // own color buffer
        const pos = m.getVerticesData(VertexBuffer.PositionKind);
        const wm = m.computeWorldMatrix(true);
        const n = pos.length / 3;
        const dist = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          Vector3.TransformCoordinatesFromFloatsToRef(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], wm, v);
          dist[i] = Vector3.Distance(v, anchor);
        }
        let nearest = 0;
        for (let i = 1; i < n; i++) if (dist[i] < dist[nearest]) nearest = i;
        return { mesh: m, dist, nearest, colors: new Float32Array(n * 4) };
      });
    // everything else of the equipment: neutral gray = not measured (never a heat color)
    const ctxMat = new StandardMaterial("modeThermalContext", scene);
    ctxMat.diffuseColor = Color3.FromHexString(THERMAL.contextColor);
    ctxMat.emissiveColor = Color3.FromHexString(THERMAL.contextColor).scale(0.25);
    ctxMat.specularColor = new Color3(0.04, 0.04, 0.04);
    const region = new Set(items.map((it) => it.mesh));
    for (const it of items) for (const i of it.mesh.instances ?? []) region.add(i);
    const context = materialOwners(pump.pivot.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0 && !isSensorPart(m) && !region.has(m))).filter((m) => !region.has(m));
    const card = createModeCard(scene, "modeThermalLegend", { width: 0.36, height: 0.17, draw: drawThermalCard });
    thermal = { mat, items, ctxMat, context, card, anchor, shown: null, painted: undefined, lastPaint: 0 };
  }
  const t01 = () => {
    const k = last.result?.kpis[THERMAL.kpi];
    return !k || k.state === "nodata" || !Number.isFinite(k.value) ? null : k.value;
  };
  function paintThermal(t) {
    for (const it of thermal.items) {
      const n = it.dist.length;
      for (let i = 0; i < n; i++) {
        const c = t == null ? nodataRGB : LUT[Math.min(LUT.length - 1, Math.max(0, Math.round(regionTemperature(t, it.dist[i], THERMAL.ambient, THERMAL.falloff) / LUT_STEP)))];
        it.colors[4 * i] = c[0];
        it.colors[4 * i + 1] = c[1];
        it.colors[4 * i + 2] = c[2];
        it.colors[4 * i + 3] = 1;
      }
      if (it.mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) it.mesh.updateVerticesData(VertexBuffer.ColorKind, it.colors);
      else it.mesh.setVerticesData(VertexBuffer.ColorKind, it.colors, true);
    }
    thermal.painted = t;
    thermal.lastPaint = performance.now();
  }
  function thermalState() {
    const value = thermal?.shown ?? t01();
    const reading = t01();
    const level = thermalLevel(reading, THERMAL.levels);
    const realtime = last.sample?.source === "realtime";
    return {
      value: reading,
      shown: value,
      level: level?.label ?? null,
      levelId: level?.id ?? null,
      color: reading == null ? THERMAL.nodataColor : hex(thermalColor(reading, THERMAL.stops)),
      marker: reading == null ? null : legendPosition(reading, THERMAL.ticks),
      source: last.sample ? (realtime ? "● DADOS REAIS" : "◐ SIMULAÇÃO") : "",
      sourceKind: last.sample ? (realtime ? "realtime" : "simulation") : null,
    };
  }
  function paintThermalCard() {
    if (!thermal) return;
    const st = thermalState();
    const def = kpiDefs[THERMAL.kpi];
    thermal.card.set({
      title: "MODO TÉRMICO · T-01",
      value: st.value == null ? "SEM DADOS" : `${fmt(st.value, def.decimals)} ${def.unit}`,
      level: st.level ?? "–",
      levelColor: st.value == null ? null : st.color,
      source: st.source,
      sourceColor: st.sourceKind === "realtime" ? "#34d399" : "#f2b233",
      marker: st.marker,
      ticks: THERMAL.ticks,
      stops: THERMAL.stops,
      levels: THERMAL.levels,
      note: "Estimativa a partir do T-01 · cinza = não medido · não é termografia",
    });
  }
  function showThermal() {
    for (const m of thermal.context) swap(m, thermal.ctxMat);
    for (const it of thermal.items) swap(it.mesh, thermal.mat);
    thermal.shown = t01();
    paintThermal(thermal.shown);
    paintThermalCard();
    thermal.card.place(thermal.anchor, 0.42, "#b4bfcc");
    if (immersive) thermal.card.show();
  }
  scene.onBeforeRenderObservable.add(() => {
    if (mode !== "thermal" || !thermal) return;
    const target = t01();
    if (target == null) {
      thermal.shown = null;
      if (thermal.painted !== null) paintThermal(null);
      return;
    }
    const dt = scene.getEngine().getDeltaTime() / 1000;
    thermal.shown = thermal.shown == null ? target : thermal.shown + (target - thermal.shown) * Math.min(1, dt / SMOOTH_S);
    const due = performance.now() - thermal.lastPaint >= PAINT_MS;
    if (due && (thermal.painted == null || Math.abs(thermal.shown - thermal.painted) > 0.1)) paintThermal(thermal.shown);
  });

  // ---------- switching ----------
  function leave() {
    for (const [m, mat] of base) m.material = mat;
    base.clear();
    if (thermal) {
      for (const it of thermal.items) if (it.mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) it.mesh.removeVerticesData(VertexBuffer.ColorKind);
      thermal.painted = undefined;
      thermal.shown = null;
      thermal.card.hide();
    }
    for (const t of Object.values(sensorTags ?? {})) {
      t.card.hide();
      t.ring.setEnabled(false);
    }
    if (xray) for (const p of xray.parts) p.card.hide();
    twin.hotspots.ui.rootContainer.isVisible = true;
  }
  function enter(id) {
    if (id === "sensors") {
      if (!sensorTags) buildSensorTags();
      paintSensorTags();
      showSensorTags();
      twin.hotspots.ui.rootContainer.isVisible = false; // the 3D cards replace the 2D labels
    } else if (id === "xray") {
      if (!xray) buildXray();
      showXray();
      twin.hotspots.ui.rootContainer.isVisible = false; // focus on the components (sensors stay selectable)
    } else if (id === "thermal") {
      if (!thermal) buildThermal();
      showThermal();
    }
  }

  twin.onSelectionChange((id) => {
    selectedId = id;
    if (mode === "sensors") showSensorTags();
  });

  return {
    modes: VIEW_MODES,
    get mode() {
      return mode;
    },
    set(id) {
      if (id === mode || !VIEW_MODES.some((m) => m.id === id)) return;
      leave();
      mode = id;
      enter(id);
      listeners.forEach((fn) => fn(id));
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Live values from the dashboard evaluation (every sample and every second). */
    update(result, sample) {
      last = { result, sample };
      if (mode === "sensors") {
        paintSensorTags();
        showSensorTags(); // leader colors follow the state
      }
      if (mode === "thermal") paintThermalCard();
    },
    /** Elements meant only for the headset (thermal legend card); the desktop has the HTML legend. */
    setImmersive(on) {
      immersive = on;
      if (mode === "thermal" && thermal) {
        if (on) thermal.card.show();
        else thermal.card.hide();
      }
      if (mode === "sensors") showSensorTags();
    },
    thermalState,
    /** Diagnostics for tests. */
    readout() {
      const hottest = thermal?.items[0] ? Array.from(thermal.items[0].colors.slice(4 * thermal.items[0].nearest, 4 * thermal.items[0].nearest + 3)) : null;
      return {
        mode,
        swapped: base.size,
        ghosted: xray ? xray.owners.filter((m) => m.material === xray.ghost).map((m) => m.name) : [],
        xrayLabels: xray ? xray.parts.filter((p) => p.card.visible).map((p) => p.label) : [],
        sensorCards: sensorTags ? Object.values(sensorTags).filter((t) => t.card.visible).map((t) => ({ id: t.s.id, ...t.card.data })) : [],
        thermalRegion: thermal ? thermal.items.filter((it) => it.mesh.material === thermal.mat && it.mesh.isVerticesDataPresent(VertexBuffer.ColorKind)).map((it) => it.mesh.name) : [],
        thermalContext: thermal ? thermal.context.filter((m) => m.material === thermal.ctxMat).length : 0,
        thermalHottest: hottest ? hex(hottest) : null,
        thermalPainted: thermal?.painted ?? null,
        thermalCard: thermal?.card.visible ? thermal.card.data : null,
      };
    },
  };
}
