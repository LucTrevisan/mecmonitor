// Contextual sensor card for VR: appears next to the selected sensor (above it, slightly towards the
// user), always facing the user. Tag + name, live value, state (icon + text + color), trend, location and
// a short history (last 40 readings as bars, with the alert limit). "×" closes it (clears the selection).
// Built with Babylon GUI on a mesh; its close button is a named target like the hub panel buttons.
import { MeshBuilder, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { classify } from "../health.js";
import { STATES, trendText } from "../ui/states.js";

const WIDTH = 0.42;
const HEIGHT = 0.3;
const TEX_W = 840;
const TEX_H = 600;
const BARS = 40;
const ABOVE = 0.24; // m above the sensor anchor
const TOWARDS_USER = 0.15; // m towards the user (never inside the machine)
const FONT = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';

function text(name, value, size, color, weight = "700", align = Control.HORIZONTAL_ALIGNMENT_LEFT) {
  const t = new TextBlock(name, value);
  t.fontFamily = FONT;
  t.fontSize = size;
  t.fontWeight = weight;
  t.color = color;
  t.textHorizontalAlignment = align;
  return t;
}

export function createSensorCard(scene, { onClose } = {}) {
  const plane = MeshBuilder.CreatePlane("vrSensorCard", { width: WIDTH, height: HEIGHT }, scene);
  plane.renderingGroupId = 1;
  plane.isPickable = true;
  plane.metadata = { xrInteractive: true };
  plane.setEnabled(false);
  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_W, TEX_H, true);
  plane.material.disableLighting = true;
  plane.material.useAlphaFromDiffuseTexture = true;

  const bg = new Rectangle("cardBg");
  bg.background = "rgba(11, 15, 20, 0.95)";
  bg.color = "rgba(255,255,255,0.18)";
  bg.thickness = 3;
  bg.cornerRadius = 30;
  ui.addControl(bg);

  const place = (c, top, left = 34) => {
    c.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    c.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    c.top = `${top}px`;
    c.left = `${left}px`;
    bg.addControl(c);
    return c;
  };
  const tag = place(text("cardTag", "—", 52, "#eef2f6", "800"), 22);
  tag.resizeToFit = true;
  const name = place(text("cardName", "", 28, "#b4bfcc", "600"), 92);
  name.resizeToFit = true;
  const value = place(text("cardValue", "—", 64, "#eef2f6", "800"), 138);
  value.resizeToFit = true;
  const state = place(text("cardState", "–", 34, STATES.nodata.color, "800"), 228);
  state.resizeToFit = true;
  const meta = place(text("cardMeta", "", 26, "#b4bfcc", "600"), 280);
  meta.resizeToFit = true;

  const close = Button.CreateSimpleButton("cardClose", "×");
  close.width = "86px";
  close.height = "86px";
  close.cornerRadius = 43;
  close.thickness = 2;
  close.color = "#eef2f6";
  close.background = "rgba(255,255,255,0.08)";
  close.fontSize = 56;
  close.fontFamily = FONT;
  close.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  close.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  close.top = "22px";
  close.left = "-22px";
  bg.addControl(close);

  // short history: bars (height = value) + alert limit line
  const chart = new Rectangle("cardChart");
  chart.width = `${TEX_W - 68}px`;
  chart.height = "200px";
  chart.thickness = 0;
  place(chart, 340);
  const barW = Math.floor((TEX_W - 68) / BARS);
  const bars = Array.from({ length: BARS }, (_, i) => {
    const b = new Rectangle(`cardBar${i}`);
    b.width = `${barW - 4}px`;
    b.thickness = 0;
    b.cornerRadius = 3;
    b.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    b.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    b.left = `${i * barW}px`;
    b.height = "0px";
    chart.addControl(b);
    return b;
  });
  const limitLine = new Rectangle("cardLimit");
  limitLine.height = "3px";
  limitLine.thickness = 0;
  limitLine.background = STATES.alert.color;
  limitLine.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  chart.addControl(limitLine);
  const limitLabel = text("cardLimitLabel", "", 24, "#b4bfcc", "700", Control.HORIZONTAL_ALIGNMENT_RIGHT);
  limitLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  limitLabel.height = "30px";
  chart.addControl(limitLabel);

  let sensor = null;
  let kpi = null;
  let camera = null;
  const anchorPos = new Vector3();
  const toUser = new Vector3();

  const doClose = () => onClose?.();
  close.onPointerUpObservable.add(doClose); // controller ray / mouse
  const setHover = (on) => {
    close.thickness = on ? 5 : 2;
    close.color = on ? "#4cb1ff" : "#eef2f6";
  };
  close.pointerEnterAnimation = () => setHover(true);
  close.pointerOutAnimation = () => setHover(false);

  const reposition = () => {
    if (!camera) return;
    const eye = camera.globalPosition;
    toUser.set(eye.x - anchorPos.x, 0, eye.z - anchorPos.z);
    if (toUser.lengthSquared() > 1e-6) toUser.normalize();
    plane.position.set(anchorPos.x + toUser.x * TOWARDS_USER, anchorPos.y + ABOVE, anchorPos.z + toUser.z * TOWARDS_USER);
    const dx = plane.position.x - eye.x;
    const dz = plane.position.z - eye.z;
    plane.rotation.set(0, Math.atan2(dx, dz), 0); // face the user
  };
  const observer = scene.onBeforeRenderObservable.add(() => plane.isEnabled() && reposition());

  return {
    mesh: plane,
    ui,
    closeButton: close,
    get sensorId() {
      return sensor?.id ?? null;
    },
    get visible() {
      return plane.isEnabled();
    },
    /** @param s sensor config; @param def KPI definition; @param anchor world position; @param cam XR camera */
    show(s, def, anchor, cam) {
      sensor = s;
      kpi = def;
      camera = cam;
      anchorPos.copyFrom(anchor);
      tag.text = s.tag;
      name.text = s.secondary ? `${s.name} · secundário` : s.name;
      meta.text = s.location.split(" — ")[0];
      reposition();
      plane.setEnabled(true);
    },
    hide() {
      plane.setEnabled(false);
      sensor = null;
    },
    /** Live values: dashboard evaluation + that KPI's recent history. */
    update(result, history, fmt) {
      if (!sensor || !kpi) return;
      const item = result?.kpis[sensor.kpi];
      const st = STATES[item?.state] ?? STATES.nodata;
      value.text = item?.value == null ? "—" : `${fmt(item.value, kpi.decimals)} ${kpi.unit}`;
      value.alpha = item?.state === "nodata" ? 0.5 : 1;
      state.text = `${st.glyph} ${st.label}`;
      state.color = st.color;
      const tr = item?.state !== "nodata" && item?.trend ? `Tendência ${trendText(item.trend, kpi.decimals)} · ` : "";
      meta.text = `${tr}${sensor.location.split(" — ")[0]}`;
      const values = (history?.[sensor.kpi] ?? []).slice(-BARS);
      const limit = [kpi.normal[1], kpi.normal[0]].find(Number.isFinite);
      const lo = Math.min(...values, limit ?? Infinity) * 0.95;
      const hi = Math.max(...values, limit ?? -Infinity) * 1.05;
      const span = hi - lo || 1;
      bars.forEach((b, i) => {
        const v = values[values.length - BARS + i];
        if (v == null) {
          b.height = "0px";
          return;
        }
        b.height = `${Math.max(4, Math.round(((v - lo) / span) * 190))}px`;
        b.background = STATES[classify(v, kpi)].color;
      });
      if (Number.isFinite(limit)) {
        const y = Math.round(((limit - lo) / span) * 190);
        limitLine.top = `${-y}px`;
        limitLabel.top = `${-y - 6}px`;
        limitLabel.text = `⚠ ${fmt(limit, kpi.decimals === 0 ? 0 : 1)}`;
      }
    },
    /** Close button under a world point (hand-ray hit), or null. */
    buttonAt(p) {
      const local = Vector3.TransformCoordinates(p, plane.computeWorldMatrix(true).clone().invert());
      const px = (local.x / WIDTH + 0.5) * TEX_W;
      const py = (0.5 - local.y / HEIGHT) * TEX_H;
      return Math.abs(px - close.centerX) <= close.widthInPixels / 2 && Math.abs(py - close.centerY) <= close.heightInPixels / 2 ? "close" : null;
    },
    closeWorld() {
      const local = new Vector3((close.centerX / TEX_W - 0.5) * WIDTH, (0.5 - close.centerY / TEX_H) * HEIGHT, 0);
      return Vector3.TransformCoordinates(local, plane.computeWorldMatrix(true));
    },
    setButtonHover: (name, on) => name === "close" && setHover(on),
    press: (name) => name === "close" && doClose(),
    readout: () => ({ tag: tag.text, value: value.text, state: state.text, meta: meta.text, bars: bars.filter((b) => b.height !== "0px").length }),
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      ui.dispose();
      plane.dispose();
    },
  };
}
