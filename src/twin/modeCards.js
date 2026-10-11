// World-space cards of the visualization modes. Unlike the 2D labels they are also visible in the headset:
// a canvas texture on a plane that turns (around Y) to face the viewer every frame, drawn over the scene
// (renderingGroupId 1), with a thin leader line down to what it describes. Redrawn only when the content
// changes; created lazily by the modes and hidden when their mode is off.
// Not a Babylon billboard: a billboard's world matrix is only refreshed while rendering, so pointer / ray /
// hand picking would see a stale card (at the origin). Turning the plane keeps picking exact.
import { Color3, MeshBuilder, Vector3 } from "@babylonjs/core";
import { FONT, fitFont, signMaterial, texture } from "../scene/canvasTex.js";
import { legendPosition, thermalColor } from "./thermalScale.js";

const PX_PER_M = 2000;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, w, h, accent) {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 3, 3, w - 6, h - 6, 22);
  ctx.fillStyle = "rgba(11, 15, 20, 0.92)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.stroke();
  if (accent) {
    ctx.save();
    roundRect(ctx, 3, 3, w - 6, h - 6, 22);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(3, 3, 12, h - 6);
    ctx.restore();
  }
}

/** Sensor card (SENSORES): tag + state (icon + text + color), value, model · name. */
export function drawSensorCard(ctx, w, h, d) {
  panel(ctx, w, h, d.accent);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#eef2f6";
  fitFont(ctx, d.title, 800, 46, w * 0.5);
  ctx.fillText(d.title, 34, 60);
  ctx.textAlign = "right";
  ctx.fillStyle = d.stateColor;
  fitFont(ctx, d.state, 800, 32, w * 0.42);
  ctx.fillText(d.state, w - 24, 58);
  ctx.textAlign = "left";
  ctx.fillStyle = "#eef2f6";
  fitFont(ctx, d.value, 800, 58, w - 60);
  ctx.fillText(d.value, 34, 136);
  ctx.fillStyle = "#b4bfcc";
  fitFont(ctx, d.detail, 600, 24, w - 60);
  ctx.fillText(d.detail, 34, h - 28);
}

/** Component label (RAIO-X): name + one line of explanation. */
export function drawPartCard(ctx, w, h, d) {
  panel(ctx, w, h, d.accent);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#eef2f6";
  fitFont(ctx, d.title, 800, 46, w - 60);
  ctx.fillText(d.title, 34, 62);
  ctx.fillStyle = "#b4bfcc";
  fitFont(ctx, d.detail, 600, 26, w - 60);
  ctx.fillText(d.detail, 34, h - 30);
}

/** Thermal legend (TÉRMICO, in the headset): T-01 value + level, color scale with ticks, source, disclaimer. */
export function drawThermalCard(ctx, w, h, d) {
  panel(ctx, w, h, null);
  const x0 = 34;
  const bw = w - 68;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#b4bfcc";
  fitFont(ctx, d.title, 700, 28, bw * 0.6);
  ctx.fillText(d.title, x0, 50);
  ctx.textAlign = "right";
  ctx.fillStyle = d.sourceColor;
  fitFont(ctx, d.source, 700, 26, bw * 0.38);
  ctx.fillText(d.source, x0 + bw, 50);
  ctx.textAlign = "left";
  ctx.fillStyle = "#eef2f6";
  fitFont(ctx, d.value, 800, 64, bw * 0.55);
  ctx.fillText(d.value, x0, 124);
  if (d.levelColor) {
    ctx.fillStyle = d.levelColor;
    ctx.fillRect(x0 + bw * 0.58, 88, 34, 34);
  }
  ctx.fillStyle = "#eef2f6";
  fitFont(ctx, d.level, 800, 40, bw * 0.34);
  ctx.fillText(d.level, x0 + bw * 0.58 + 46, 120);
  // color bar (segments of the same ramp used on the model)
  const by = 150;
  const bh = 34;
  const n = 90;
  for (let i = 0; i < n; i++) {
    const t = d.ticks[0] + ((d.ticks.at(-1) - d.ticks[0]) * (i + 0.5)) / n;
    const c = thermalColor(t, d.stops);
    ctx.fillStyle = `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;
    ctx.fillRect(x0 + (bw * i) / n, by, bw / n + 1, bh);
  }
  // level boundaries + names
  ctx.fillStyle = "rgba(11, 15, 20, 0.9)";
  let prev = 0;
  ctx.textAlign = "center";
  for (const l of d.levels) {
    const p = Number.isFinite(l.max) ? legendPosition(l.max, d.ticks) : 1;
    if (p < 1) ctx.fillRect(x0 + bw * p - 2, by, 4, bh);
    ctx.fillStyle = "#eef2f6";
    fitFont(ctx, l.label, 700, 20, bw * (p - prev) - 6);
    ctx.fillText(l.label, x0 + (bw * (prev + p)) / 2, by + bh + 26);
    ctx.fillStyle = "rgba(11, 15, 20, 0.9)";
    prev = p;
  }
  // ticks
  ctx.fillStyle = "#8592a3";
  ctx.font = `600 20px ${FONT}`;
  for (const t of d.ticks) {
    const p = legendPosition(t, d.ticks);
    ctx.textAlign = p === 0 ? "left" : p === 1 ? "right" : "center";
    ctx.fillText(`${t}`, x0 + bw * p, by - 8);
  }
  // marker at the current value
  if (d.marker != null) {
    const mx = x0 + bw * d.marker;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(mx, by + bh + 2);
    ctx.lineTo(mx - 11, by + bh + 16);
    ctx.lineTo(mx + 11, by + bh + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(mx - 2, by - 4, 4, bh + 8);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#8592a3";
  fitFont(ctx, d.note, 600, 20, bw);
  ctx.fillText(d.note, x0, h - 22);
}

/**
 * A card: create(scene, name, { width, height, draw }). set(data) redraws only when data changed.
 * place(anchor, lift, color) puts it lift meters above the anchor with a leader line down to it.
 */
export function createModeCard(scene, name, { width, height, draw }) {
  const W = Math.round(width * PX_PER_M);
  const H = Math.round(height * PX_PER_M);
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene);
  plane.renderingGroupId = 1;
  plane.isPickable = false;
  plane.metadata = { modeCard: true };
  plane.setEnabled(false);
  const tex = texture(scene, `${name}Tex`, W, H, (ctx) => ctx.clearRect(0, 0, W, H), { alpha: true });
  plane.material = signMaterial(scene, `${name}Mat`, tex);
  let line = null;
  let key = "";
  let data = null;
  const face = () => {
    const eye = scene.activeCamera?.globalPosition;
    if (!eye) return;
    const dx = plane.position.x - eye.x;
    const dz = plane.position.z - eye.z;
    if (dx * dx + dz * dz > 1e-8) plane.rotation.y = Math.atan2(dx, dz); // plane front faces -Z
  };
  const observer = scene.onBeforeRenderObservable.add(() => plane.isEnabled() && face());
  return {
    mesh: plane,
    get visible() {
      return plane.isEnabled();
    },
    get data() {
      return data;
    },
    set(d) {
      const k = JSON.stringify(d);
      if (k === key) return;
      key = k;
      data = d;
      draw(tex.getContext(), W, H, d);
      tex.update();
    },
    place(anchor, lift, color = "#b4bfcc") {
      plane.position.set(anchor.x, anchor.y + lift, anchor.z);
      face();
      plane.computeWorldMatrix(true);
      const points = [anchor.add(new Vector3(0, 0.012, 0)), new Vector3(anchor.x, anchor.y + lift - height / 2, anchor.z)];
      line = line ? MeshBuilder.CreateLines(null, { points, instance: line }) : MeshBuilder.CreateLines(`${name}Leader`, { points, updatable: true }, scene);
      line.color = Color3.FromHexString(color);
      line.alpha = 0.85;
      line.isPickable = false;
      line.metadata = { modeCard: true };
      line.setEnabled(plane.isEnabled());
    },
    show() {
      plane.setEnabled(true);
      line?.setEnabled(true);
    },
    hide() {
      plane.setEnabled(false);
      line?.setEnabled(false);
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      line?.dispose();
      plane.material.dispose();
      tex.dispose();
      plane.dispose();
    },
  };
}
