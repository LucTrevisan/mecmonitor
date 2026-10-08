// Sensor hotspots on the 3D model: a GUI pill (model · live value) on a stem, anchored to a
// TransformNode parented to the mounting part, so it follows any later model transform.
// The model geometry and materials are not modified; selection uses a HighlightLayer.
import { Color3, HighlightLayer, Ray, TransformNode, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";

import { STATES } from "../ui/states.js";

// State = glyph + text/value + color (never color alone).
const COLORS = Object.fromEntries(Object.entries(STATES).map(([k, v]) => [k, v.color]));
const FONT = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const PILL_H = 24;
const STEM_H = 14;
const DOT = 10;
const OCCLUSION_MS = 400;
const OCCLUDED_ALPHA = 0.35;

function anchorPosition(node, { at, offset = [0, 0, 0] }) {
  const { min, max } = node.getHierarchyBoundingVectors(true);
  const p = new Vector3(min.x + (max.x - min.x) * at[0], min.y + (max.y - min.y) * at[1], min.z + (max.z - min.z) * at[2]);
  return p.add(Vector3.FromArray(offset));
}

function partMeshes(node) {
  const list = node.getClassName() === "Mesh" ? [node] : [];
  // Instanced meshes are not supported by HighlightLayer; they keep their normal look.
  return list.concat(node.getChildMeshes(false).filter((m) => m.getClassName() === "Mesh"));
}

export function createHotspots(scene, sensors, { onSelect } = {}) {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("hotspotsUI", true, scene);
  const highlight = new HighlightLayer("sensorHighlight", scene, { blurHorizontalSize: 0.6, blurVerticalSize: 0.6 });
  const items = {};
  let selected = null;

  for (const s of sensors) {
    const node = scene.getNodeByName(s.anchor.node);
    if (!node) {
      console.warn(`Hotspot ${s.id}: nó "${s.anchor.node}" não encontrado no modelo`);
      continue;
    }
    const anchor = new TransformNode(`hotspot-${s.id}`, scene);
    anchor.position = anchorPosition(node, s.anchor);
    anchor.setParent(node);

    const root = new StackPanel(`hs-${s.id}`);
    root.isVertical = true;
    root.width = "220px";
    root.isPointerBlocker = false;
    root.isHitTestVisible = false;

    const pill = new Rectangle(`hs-pill-${s.id}`);
    pill.height = `${PILL_H}px`;
    pill.adaptWidthToChildren = true;
    pill.cornerRadius = PILL_H / 2;
    pill.thickness = 1.5;
    pill.background = "rgba(14, 19, 26, 0.85)";
    pill.hoverCursor = "pointer";
    pill.isPointerBlocker = true;

    const text = new TextBlock(`hs-text-${s.id}`, s.tag);
    text.resizeToFit = true;
    text.fontFamily = FONT;
    text.fontSize = 12;
    text.fontWeight = "600";
    text.color = "#eef2f6";
    text.paddingLeft = "10px";
    text.paddingRight = "10px";
    pill.addControl(text);

    const stem = new Rectangle(`hs-stem-${s.id}`);
    stem.width = "2px";
    const stemH = s.stem ?? STEM_H;
    stem.height = `${stemH}px`;
    stem.thickness = 0;
    stem.isHitTestVisible = false;

    const dot = new Ellipse(`hs-dot-${s.id}`);
    dot.width = `${DOT}px`;
    dot.height = `${DOT}px`;
    dot.thickness = 2;
    dot.color = "#0e1218";
    dot.isHitTestVisible = false;

    root.addControl(pill);
    root.addControl(stem);
    root.addControl(dot);
    ui.addControl(root);
    root.linkWithMesh(anchor);
    root.linkOffsetY = -((PILL_H + stemH + DOT) / 2 - DOT / 2);
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

    pill.onPointerUpObservable.add(() => onSelect?.(s.id));
    pill.onPointerEnterObservable.add(() => (pill.thickness = 2.5));
    pill.onPointerOutObservable.add(() => (pill.thickness = 1.5));

    items[s.id] = { sensor: s, node, anchor, root, pill, text, stem, dot, meshes: partMeshes(node), state: "nodata", label: `${STATES.nodata.glyph} ${s.tag}`, occluded: false };
    paint(items[s.id]);
  }

  // Labels behind geometry are dimmed (not hidden) so they never read as "on top of" another part.
  const pickable = (m) => m.isPickable && m.isEnabled() && m.isVisible && m.getTotalVertices() > 0;
  let lastCheck = 0;
  scene.onAfterRenderObservable.add(() => {
    const now = performance.now();
    if (now - lastCheck < OCCLUSION_MS || !scene.activeCamera) return;
    lastCheck = now;
    const eye = scene.activeCamera.globalPosition;
    for (const it of Object.values(items)) {
      const p = it.anchor.getAbsolutePosition();
      const dir = p.subtract(eye);
      const dist = dir.length();
      const hit = scene.pickWithRay(new Ray(eye, dir.normalize(), dist), pickable, true);
      it.occluded = Boolean(hit?.hit && hit.distance < dist - 0.005);
      it.root.alpha = it.occluded && selected !== it.sensor.id ? OCCLUDED_ALPHA : 1;
    }
  });

  function paint(it) {
    const c = COLORS[it.state] ?? COLORS.nodata;
    const isSel = selected === it.sensor.id;
    it.pill.color = isSel ? "#4cb1ff" : c;
    it.pill.background = isSel ? "rgba(76, 177, 255, 0.92)" : "rgba(14, 19, 26, 0.85)";
    it.text.color = isSel ? "#06121f" : "#eef2f6";
    it.text.text = it.label;
    it.stem.background = isSel ? "#4cb1ff" : c;
    it.dot.background = isSel ? "#4cb1ff" : c;
    it.root.zIndex = isSel ? 10 : 1;
  }

  return {
    items,
    ui,
    /** Updates label/color from the latest evaluation (health.evaluate result). */
    update(result, kpiDefs, fmt) {
      for (const it of Object.values(items)) {
        const k = result.kpis[it.sensor.kpi];
        if (!k) continue;
        const def = kpiDefs[it.sensor.kpi];
        it.state = k.state;
        const glyph = STATES[k.state]?.glyph ?? STATES.nodata.glyph;
        it.label = k.state === "nodata" ? `${glyph} ${it.sensor.tag} · SEM DADOS` : `${glyph} ${it.sensor.tag} · ${fmt(k.value, def.decimals)} ${def.unit}`;
        paint(it);
      }
    },
    /** Hover feedback driven by the 3D interaction volumes (same look as hovering the label). */
    setHover(ids) {
      const set = ids instanceof Set ? ids : new Set(ids ? [ids] : []);
      for (const it of Object.values(items)) it.pill.thickness = set.has(it.sensor.id) ? 2.5 : 1.5;
    },
    /** Sensor anchors (TransformNodes parented to the mounting parts). */
    get anchors() {
      return Object.fromEntries(Object.values(items).map((it) => [it.sensor.id, it.anchor]));
    },
    setSelected(id) {
      selected = id;
      highlight.removeAllMeshes();
      const it = items[id];
      if (it) it.meshes.forEach((m) => highlight.addMesh(m, Color3.FromHexString("#4cb1ff")));
      Object.values(items).forEach(paint);
    },
    /** World position of a sensor anchor. */
    position(id) {
      return items[id]?.anchor.getAbsolutePosition().clone();
    },
    /** Console helper: move a hotspot to world coordinates (meters). */
    move(id, x, y, z) {
      const it = items[id];
      if (!it) return;
      it.anchor.setParent(null);
      it.anchor.position.set(x, y, z);
      it.anchor.setParent(it.node);
    },
  };
}
