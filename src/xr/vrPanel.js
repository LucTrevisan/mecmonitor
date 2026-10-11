// VR hub panel (HTML overlays are not visible inside an immersive session).
// World-space Babylon GUI panel to the LEFT of the view (never between the user and the bench) that
// "tags along" (re-placed only when it leaves a comfort cone) or can be pinned in place:
//   header  P-01 · BOMBA CENTRÍFUGA + equipment state (icon + text + color) + data source
//   rows    TEMPERATURA · VIBRAÇÃO · CORRENTE (+ RPM sec.) — value, unit, state
//   menu    NORMAL · SENSORES · RAIO-X · TÉRMICO · TREINAMENTO (unbuilt modes shown as "em breve")
//   footer  Fixar/Seguir · Recentrar · Sair da imersão
// Buttons are named; the same press(name) runs from a controller (GUI pointer events) or a hand
// (InteractionManager target "vr:<name>"; hands only activate with a pinch, never by passing through).
import { MeshBuilder, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { STATES } from "../ui/states.js";

const WIDTH = 0.4; // meters
const HEIGHT = 0.56;
const TEX_W = 800;
const TEX_H = 1120;
const DISTANCE = 0.75; // from the user
const DROP = 0.32; // below eye level (panel center)
const SIDE = 0.55; // rad (~31°) to the LEFT of the view
const MAX_ANGLE = (40 * Math.PI) / 180; // re-place when it leaves this cone
const FOLLOW = 0.12;
const FONT = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const C = { text: "#eef2f6", text2: "#b4bfcc", muted: "#8592a3", border: "rgba(255,255,255,0.14)", accent: "#4cb1ff", sim: "#f2b233", ok: "#34d399" };

export const VR_MODES = [
  { id: "normal", label: "NORMAL", enabled: true },
  { id: "sensors", label: "SENSORES", enabled: false },
  { id: "xray", label: "RAIO-X", enabled: false },
  { id: "thermal", label: "TÉRMICO", enabled: false },
  { id: "training", label: "TREINAMENTO", enabled: false },
];

function text(name, value, size, color, { weight = "600", align = Control.HORIZONTAL_ALIGNMENT_LEFT } = {}) {
  const t = new TextBlock(name, value);
  t.fontFamily = FONT;
  t.fontSize = size;
  t.fontWeight = weight;
  t.color = color;
  t.textHorizontalAlignment = align;
  return t;
}

function button(name, label, { bg = "rgba(255,255,255,0.08)", fg = C.text, h = 84, w = "100%", size = 30 } = {}) {
  const b = Button.CreateSimpleButton(name, label);
  b.height = `${h}px`;
  b.width = w;
  b.cornerRadius = 18;
  b.thickness = 2;
  b.color = fg;
  b.background = bg;
  b.fontFamily = FONT;
  b.fontSize = size;
  b.fontWeight = "700";
  b.metadata = { bg };
  return b;
}

export function createVRPanel(scene, { onExit, onRecenter, onMode } = {}) {
  const plane = MeshBuilder.CreatePlane("vrControlPanel", { width: WIDTH, height: HEIGHT }, scene);
  plane.renderingGroupId = 1; // drawn on top: never hidden inside the machine
  plane.isPickable = true;
  plane.metadata = { xrInteractive: true }; // XR ray targets: VR panels and sensor volumes only
  plane.setEnabled(false);

  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_W, TEX_H, true);
  // UI must not be shaded by the scene lights (otherwise text and background look washed out).
  plane.material.disableLighting = true;
  plane.material.useAlphaFromDiffuseTexture = true;

  const bg = new Rectangle("vrBg");
  bg.background = "rgba(11, 15, 20, 0.94)";
  bg.color = C.border;
  bg.thickness = 3;
  bg.cornerRadius = 36;
  ui.addControl(bg);

  const stack = new StackPanel("vrStack");
  stack.isVertical = true;
  stack.width = "90%";
  stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  stack.paddingTop = "28px";
  bg.addControl(stack);

  // ---------- header ----------
  const title = text("vrTitle", "P-01 · BOMBA CENTRÍFUGA", 40, C.text, { weight: "800" });
  title.height = "58px";
  stack.addControl(title);
  const statusRow = new Rectangle("vrStatusRow");
  statusRow.height = "56px";
  statusRow.thickness = 0;
  const statusText = text("vrStatus", "– SEM DADOS", 32, STATES.nodata.color, { weight: "800" });
  const sourceText = text("vrSource", "", 26, C.sim, { weight: "700", align: Control.HORIZONTAL_ALIGNMENT_RIGHT });
  statusRow.addControl(statusText);
  statusRow.addControl(sourceText);
  stack.addControl(statusRow);

  // ---------- telemetry rows ----------
  const rows = {};
  const addRow = (key, label) => {
    const r = new Rectangle(`vrRow-${key}`);
    r.height = key === "rpm" ? "104px" : "112px";
    r.thickness = 0;
    r.paddingTop = "8px";
    const box = new Rectangle(`vrRowBox-${key}`);
    box.cornerRadius = 16;
    box.thickness = 2;
    box.color = C.border;
    box.background = "rgba(255,255,255,0.04)";
    r.addControl(box);
    const name = text(`vrRowName-${key}`, label, 24, C.text2, { weight: "700" });
    name.paddingLeft = "22px";
    name.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    name.paddingTop = "12px";
    const value = text(`vrRowValue-${key}`, "—", key === "rpm" ? 36 : 48, C.text, { weight: "800" });
    value.paddingLeft = "22px";
    value.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    value.paddingBottom = "8px";
    const state = text(`vrRowState-${key}`, "–", 26, STATES.nodata.color, { weight: "800", align: Control.HORIZONTAL_ALIGNMENT_RIGHT });
    state.paddingRight = "22px";
    box.addControl(name);
    box.addControl(value);
    box.addControl(state);
    stack.addControl(r);
    rows[key] = { value, state, box };
  };

  // ---------- menu ----------
  const buttons = {}; // name → { control, action, enabled }
  const register = (name, control, action, enabled = true) => {
    buttons[name] = { control, action, enabled };
    control.isEnabled = enabled;
    control.alpha = enabled ? 1 : 0.38;
    control.onPointerUpObservable.add(() => api.press(name)); // controller ray / mouse
    control.pointerEnterAnimation = () => setHover(name, true);
    control.pointerOutAnimation = () => setHover(name, false);
  };
  const setHover = (name, on) => {
    const b = buttons[name];
    if (!b?.enabled) return;
    b.control.thickness = on ? 5 : 2;
    b.control.color = on ? C.accent : b.control.metadata?.fg ?? C.text;
  };

  const sectionLabel = (name, label) => {
    const t = text(name, label, 22, C.muted, { weight: "800" });
    t.height = "52px";
    t.paddingTop = "16px";
    stack.addControl(t);
  };

  let mode = "normal";
  const modeButtons = {};
  const modeRow = (ids) => {
    const row = new StackPanel(`vrModeRow-${ids.join("-")}`);
    row.isVertical = false;
    row.height = "92px";
    row.paddingTop = "8px";
    for (const id of ids) {
      const m = VR_MODES.find((x) => x.id === id);
      const b = button(`vrMode-${id}`, m.enabled ? m.label : `${m.label}\nem breve`, { h: 84, w: `${Math.floor((TEX_W * 0.9) / ids.length) - 4}px`, size: m.enabled ? 26 : 20 });
      b.paddingLeft = "4px";
      b.paddingRight = "4px";
      row.addControl(b);
      modeButtons[id] = b;
      register(`mode-${id}`, b, () => {
        mode = id;
        paintModes();
        onMode?.(id);
      }, m.enabled);
    }
    stack.addControl(row);
  };
  const paintModes = () => {
    for (const [id, b] of Object.entries(modeButtons)) {
      const active = id === mode;
      b.background = active ? C.text : b.metadata.bg;
      b.color = active ? "#0b0f14" : C.text;
      b.metadata.fg = active ? "#0b0f14" : C.text;
    }
  };

  // ---------- assemble ----------
  addRow("temperature", "TEMPERATURA · T-01");
  addRow("vibration", "VIBRAÇÃO · VIB-01");
  addRow("current", "CORRENTE · I-01");
  addRow("rpm", "RPM · RPM-01 (sec.)");
  sectionLabel("vrMenuLabel", "VISUALIZAÇÃO");
  modeRow(["normal", "sensors", "xray"]);
  modeRow(["thermal", "training"]);
  paintModes();

  sectionLabel("vrViewLabel", "PAINEL E POSIÇÃO");
  const ctlRow = new StackPanel("vrCtlRow");
  ctlRow.isVertical = false;
  ctlRow.height = "92px";
  ctlRow.paddingTop = "8px";
  const pinBtn = button("vrPin", "Fixar painel", { w: `${TEX_W * 0.45 - 4}px`, size: 28 });
  const recenterBtn = button("vrRecenter", "Recentrar", { w: `${TEX_W * 0.45 - 4}px`, size: 28 });
  pinBtn.paddingRight = "6px";
  recenterBtn.paddingLeft = "6px";
  ctlRow.addControl(pinBtn);
  ctlRow.addControl(recenterBtn);
  stack.addControl(ctlRow);

  const exitWrap = new Rectangle("vrExitWrap");
  exitWrap.height = "130px";
  exitWrap.thickness = 0;
  exitWrap.paddingTop = "18px";
  const exit = button("vrExit", "Sair da imersão", { bg: "#e5484d", fg: "#ffffff", h: 112, size: 40 });
  exit.thickness = 0;
  exitWrap.addControl(exit);
  stack.addControl(exitWrap);

  let camera = null;
  let distance = DISTANCE;
  let drop = DROP;
  let side = SIDE;
  let pinned = false;
  let exitRequests = 0;
  register("exit", exit, () => {
    exitRequests++;
    onExit?.();
  });
  register("recenter", recenterBtn, () => onRecenter?.());
  register("pin", pinBtn, () => {
    pinned = !pinned;
    pinBtn.textBlock.text = pinned ? "Seguir olhar" : "Fixar painel";
  });

  // ---------- placement ----------
  const desired = new Vector3();
  const right = new Vector3();
  const along = new Vector3();
  const flat = new Vector3();
  function computeDesired(cam) {
    const eye = cam.globalPosition;
    const fwd = cam.getForwardRay(1).direction;
    flat.set(fwd.x, 0, fwd.z);
    if (flat.lengthSquared() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();
    // left of the view: forward·cos(side) − right·sin(side) (side = 0 → straight ahead)
    cam.getDirectionToRef(Vector3.RightReadOnly, right);
    right.y = 0;
    right.normalize();
    along.copyFrom(flat).scaleInPlace(Math.cos(side)).addInPlace(right.scaleInPlace(-Math.sin(side))).normalize();
    desired.copyFrom(eye).addInPlace(along.scale(distance));
    desired.y = eye.y - drop;
    return along;
  }

  function faceUser(eye) {
    // Plane front faces -Z: look from the eye toward the panel so the GUI reads correctly.
    const dx = plane.position.x - eye.x;
    const dz = plane.position.z - eye.z;
    if (dx * dx + dz * dz > 1e-6) plane.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  const follow = scene.onBeforeRenderObservable.add(() => {
    if (!camera || !plane.isEnabled()) return;
    const eye = camera.globalPosition;
    if (!pinned) {
      const dir = computeDesired(camera);
      const toPanel = plane.position.subtract(eye);
      toPanel.y = 0;
      const dist = toPanel.length();
      const angle = dist > 1e-6 ? Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(toPanel.normalize(), dir)))) : Math.PI;
      if (angle > MAX_ANGLE || dist > distance * 1.8 || dist < distance * 0.4 || Math.abs(plane.position.y - desired.y) > 0.35) {
        plane.position = Vector3.Lerp(plane.position, desired, FOLLOW);
      }
    }
    faceUser(eye);
  });

  // ---------- helpers ----------
  const toTexture = (p) => {
    const local = Vector3.TransformCoordinates(p, plane.computeWorldMatrix(true).clone().invert());
    return { px: (local.x / WIDTH + 0.5) * TEX_W, py: (0.5 - local.y / HEIGHT) * TEX_H };
  };
  const buttonWorld = (name) => {
    const c = buttons[name]?.control;
    if (!c) return null;
    const local = new Vector3((c.centerX / TEX_W - 0.5) * WIDTH, (0.5 - c.centerY / TEX_H) * HEIGHT, 0);
    return Vector3.TransformCoordinates(local, plane.computeWorldMatrix(true));
  };

  const api = {
    mesh: plane,
    ui,
    exitButton: exit,
    get exitRequests() {
      return exitRequests;
    },
    get mode() {
      return mode;
    },
    get pinned() {
      return pinned;
    },
    /** Names of the buttons that can be activated (disabled modes are excluded). */
    buttonNames: () => Object.keys(buttons).filter((n) => buttons[n].enabled),
    /** World position of a button center (tests/tooling). */
    buttonWorld,
    exitButtonWorld: () => buttonWorld("exit"),
    /** Enabled button under a world point of the panel (hand-ray hit), or null. */
    buttonAt(p) {
      const { px, py } = toTexture(p);
      for (const [name, b] of Object.entries(buttons)) {
        if (!b.enabled) continue;
        const c = b.control;
        if (Math.abs(px - c.centerX) <= c.widthInPixels / 2 && Math.abs(py - c.centerY) <= c.heightInPixels / 2) return name;
      }
      return null;
    },
    setButtonHover: setHover,
    press(name) {
      const b = buttons[name];
      if (b?.enabled) b.action();
    },
    /** Live telemetry from the dashboard evaluation (icon + text + color per state). */
    update(result, sample, kpiDefs, fmt) {
      if (!result) return;
      const st = STATES[result.state] ?? STATES.nodata;
      statusText.text = `${st.glyph} ${st.label}`;
      statusText.color = st.color;
      sourceText.text = sample?.source === "realtime" ? "● DADOS REAIS" : sample ? "◐ SIMULAÇÃO" : "";
      sourceText.color = sample?.source === "realtime" ? C.ok : C.sim;
      for (const [key, r] of Object.entries(rows)) {
        const item = result.kpis[key];
        const def = kpiDefs[key];
        const s = STATES[item?.state] ?? STATES.nodata;
        r.value.text = item?.value == null ? "—" : `${fmt(item.value, def.decimals)} ${def.unit}`;
        r.value.alpha = item?.state === "nodata" ? 0.5 : 1;
        r.state.text = `${s.glyph} ${s.label}`;
        r.state.color = s.color;
        r.box.color = item?.state && item.state !== "normal" ? s.color : C.border;
      }
    },
    /** Read back what the panel shows (tests). */
    readout: () => ({
      status: statusText.text,
      source: sourceText.text,
      rows: Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, { value: r.value.text, state: r.state.text }])),
    }),
    get visible() {
      return plane.isEnabled();
    },
    /** Shows the panel next to the given camera (the XR camera inside a session). */
    show(cam, opts = {}) {
      camera = cam;
      distance = opts.distance ?? DISTANCE;
      drop = opts.drop ?? DROP;
      side = opts.side ?? SIDE;
      cam.computeWorldMatrix(true); // the pose may have changed this frame (e.g. XR start pose)
      computeDesired(cam);
      plane.position.copyFrom(desired);
      faceUser(cam.globalPosition);
      plane.setEnabled(true);
    },
    hide() {
      plane.setEnabled(false);
      camera = null;
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(follow);
      ui.dispose();
      plane.dispose();
    },
  };
  return api;
}
