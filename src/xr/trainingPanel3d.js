// Training panel for the headset (MODO TREINAMENTO). Renders the same training-engine view as the desktop
// panel. World-space Babylon GUI to the RIGHT of the view (the hub panel is on the left), tag-along like
// the hub. Fixed button slots (s0…s5, back, exit, next) are relabelled per step, so the interaction targets
// "vrt:<slot>" stay stable; a controller ray (GUI events) or a pinch (InteractionManager) calls press(slot).
import { MeshBuilder, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { SCENARIOS } from "../config/training.js";
import { SENSOR_BY_ID } from "../config/sensors.js";
import { STATES } from "../ui/states.js";

const WIDTH = 0.44;
const HEIGHT = 0.66;
const TEX_W = 880;
const TEX_H = 1320;
const DISTANCE = 0.75;
const DROP = 0.3;
const SIDE = -0.55; // rad (~31°) to the RIGHT of the view
const MAX_ANGLE = (40 * Math.PI) / 180;
const FOLLOW = 0.12;
const FONT = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const C = { text: "#eef2f6", text2: "#b4bfcc", muted: "#8592a3", border: "rgba(255,255,255,0.14)", accent: "#4cb1ff", sim: "#f2b233", ok: "#34d399", bad: "#f87171" };
export const TRAINING_SLOTS = ["s0", "s1", "s2", "s3", "s4", "s5", "back", "exit", "next"];
const TAG = { temperature: "max6675", vibration: "mpu6050", current: "sct013" };

function text(name, value, size, color, weight = "600") {
  const t = new TextBlock(name, value);
  t.fontFamily = FONT;
  t.fontSize = size;
  t.fontWeight = weight;
  t.color = color;
  t.textWrapping = true;
  t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  t.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  return t;
}

export function createTrainingPanel3D(scene, { engine, onRecord, onClose, fmt, kpiDefs }) {
  const plane = MeshBuilder.CreatePlane("vrTrainingPanel", { width: WIDTH, height: HEIGHT }, scene);
  plane.renderingGroupId = 1;
  plane.isPickable = true;
  plane.metadata = { xrInteractive: true };
  plane.setEnabled(false);
  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_W, TEX_H, true);
  plane.material.disableLighting = true;
  plane.material.useAlphaFromDiffuseTexture = true;

  const bg = new Rectangle("vrtBg");
  bg.background = "rgba(11, 15, 20, 0.95)";
  bg.color = C.border;
  bg.thickness = 3;
  bg.cornerRadius = 36;
  ui.addControl(bg);
  const stack = new StackPanel("vrtStack");
  stack.width = "90%";
  stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  stack.paddingTop = "26px";
  bg.addControl(stack);

  const header = new Rectangle("vrtHeader");
  header.height = "60px";
  header.thickness = 0;
  const title = text("vrtTitle", "MODO TREINAMENTO", 34, C.text, "800");
  const sim = text("vrtSim", "◐ SIMULAÇÃO", 24, C.sim, "700");
  sim.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  sim.paddingTop = "8px";
  header.addControl(title);
  header.addControl(sim);
  stack.addControl(header);
  const stepLine = text("vrtStep", "", 30, C.accent, "800");
  stepLine.height = "48px";
  stack.addControl(stepLine);
  const progress = new StackPanel("vrtProgress");
  progress.isVertical = false;
  progress.height = "22px";
  const segs = Array.from({ length: 7 }, (_, i) => {
    const r = new Rectangle(`vrtSeg${i}`);
    r.width = `${Math.floor((TEX_W * 0.9) / 7)}px`;
    r.thickness = 0;
    r.paddingLeft = "3px";
    r.paddingRight = "3px";
    const fill = new Rectangle(`vrtSegFill${i}`);
    fill.cornerRadius = 4;
    fill.thickness = 0;
    r.addControl(fill);
    progress.addControl(r);
    return fill;
  });
  stack.addControl(progress);
  const brief = text("vrtBrief", "", 24, C.text2, "600");
  brief.height = "84px";
  brief.paddingTop = "12px";
  stack.addControl(brief);
  const instruction = text("vrtInstruction", "", 28, C.text, "700");
  instruction.height = "88px";
  stack.addControl(instruction);
  const info = text("vrtInfo", "", 26, C.text, "600");
  info.height = "0px";
  stack.addControl(info);

  // ---------- slots ----------
  const buttons = {};
  let actions = {};
  const mkButton = (name, w = "100%", h = 92) => {
    const b = Button.CreateSimpleButton(`vrt-${name}`, "");
    b.width = w;
    b.height = `${h}px`;
    b.cornerRadius = 16;
    b.thickness = 2;
    b.color = C.text;
    b.background = "rgba(255,255,255,0.08)";
    b.fontFamily = FONT;
    b.fontSize = 24;
    b.fontWeight = "700";
    b.textBlock.textWrapping = true;
    b.paddingTop = "6px";
    b.metadata = { bg: b.background, fg: C.text };
    b.onPointerUpObservable.add(() => api.press(name));
    b.pointerEnterAnimation = () => setHover(name, true);
    b.pointerOutAnimation = () => setHover(name, false);
    buttons[name] = b;
    return b;
  };
  for (const n of ["s0", "s1", "s2", "s3", "s4", "s5"]) stack.addControl(mkButton(n));
  const foot = new StackPanel("vrtFoot");
  foot.isVertical = false;
  foot.height = "104px";
  foot.paddingTop = "12px";
  for (const n of ["back", "exit", "next"]) {
    const b = mkButton(n, `${Math.floor((TEX_W * 0.9) / 3) - 6}px`, 92);
    b.paddingLeft = "4px";
    b.paddingRight = "4px";
    foot.addControl(b);
  }
  stack.addControl(foot);

  const setHover = (name, on) => {
    const b = buttons[name];
    if (!b?.isVisible || !b.isEnabled) return;
    b.thickness = on ? 5 : 2;
    b.color = on ? C.accent : b.metadata.fg;
  };
  /** label, action (null = hidden), { enabled, selected, primary } */
  const slot = (name, label, action, { enabled = true, selected = false, primary = false } = {}) => {
    const b = buttons[name];
    b.isVisible = Boolean(action);
    if (!action) return;
    actions[name] = action;
    b.textBlock.text = label;
    b.isEnabled = enabled;
    b.alpha = enabled ? 1 : 0.38;
    b.metadata.bg = selected ? C.text : primary ? "rgba(76,177,255,0.28)" : "rgba(255,255,255,0.08)";
    b.metadata.fg = selected ? "#0b0f14" : C.text;
    b.background = b.metadata.bg;
    b.color = b.metadata.fg;
    b.thickness = 2;
  };

  const readingLines = (r) =>
    ["temperature", "vibration", "current"]
      .map((k) => {
        const it = r[k];
        const def = kpiDefs[k];
        const st = STATES[it?.state] ?? STATES.nodata;
        return `${SENSOR_BY_ID[TAG[k]].tag}: ${it?.value == null ? "SEM DADOS" : `${fmt(it.value, def.decimals)} ${def.unit}`} · ${st.glyph} ${st.label}`;
      })
      .join("\n");

  function render(v) {
    actions = {};
    for (const n of TRAINING_SLOTS) slot(n, "", null);
    info.text = "";
    info.height = "0px";
    sim.isVisible = v.active;
    segs.forEach((f, i) => (f.background = !v.active ? "transparent" : i < v.stepIndex ? C.ok : i === v.stepIndex ? C.accent : "rgba(255,255,255,0.14)"));
    if (!v.active) {
      title.text = "MODO TREINAMENTO";
      stepLine.text = "Escolha um cenário";
      brief.text = "Investigue a bancada como num chamado real. A resposta só aparece no final.";
      instruction.text = "◐ Os cenários usam dados simulados.";
      slot("s0", "Iniciar cenário aleatório", () => engine.start("random"), { primary: true });
      SCENARIOS.slice(0, 4).forEach((s, i) => slot(`s${i + 1}`, `Instrutor: cenário ${s.id}`, () => engine.start(s.id)));
      slot("exit", "Fechar", () => onClose?.());
      return;
    }
    title.text = `TREINAMENTO · CENÁRIO ${v.scenario.id}`;
    stepLine.text = `${v.stepIndex + 1}/${v.stepCount} · ${v.step.title}`;
    brief.text = v.scenario.briefing;
    instruction.text = v.step.instruction;
    const setInfo = (t, h) => {
      info.text = t;
      info.height = `${h}px`;
    };
    switch (v.step.id) {
      case "inspection":
        v.checklist.forEach((c, i) => slot(`s${i}`, `${c.done ? "☑" : "☐"}  ${c.text}`, () => engine.toggleCheck(i), { selected: c.done }));
        break;
      case "location":
        setInfo(`${v.located.map((l) => `${l.done ? "✓" : "○"} ${SENSOR_BY_ID[l.id].tag}`).join("     ")}\n\nAponte e pince (ou gatilho) em cada sensor na bancada.`, 170);
        break;
      case "reading":
        slot("s0", v.readings ? "Registrar novamente" : "Registrar leituras", () => onRecord(), { primary: !v.readings });
        if (v.readings) setInfo(readingLines(v.readings), 130);
        break;
      case "anomaly":
      case "diagnosis":
      case "action":
        v.options.forEach((o, i) => slot(`s${i}`, `${v.answer === o.id ? "◉" : "○"}  ${o.text}`, () => engine.answer(o.id), { selected: v.answer === o.id }));
        break;
      case "feedback": {
        const r = v.result;
        setInfo(
          `${v.scenario.title.toUpperCase()} · ${r.score} de ${r.total}\n` +
            r.items.map((i) => `${i.ok ? "✓" : "✖"} ${i.title}: ${i.ok ? i.chosenText : `esperado ${i.correctText}`}`).join("\n") +
            `\n\nIndício compatível com: ${v.scenario.analysis.compatible}\nAção: ${v.scenario.analysis.action}`,
          470,
        );
        slot("s0", "Repetir cenário", () => engine.restart());
        slot("s1", "Outro cenário", () => engine.start("random"));
        slot("s2", "Encerrar", () => engine.exit());
        return;
      }
    }
    if (v.canGoBack) slot("back", "Voltar", () => engine.back());
    slot("exit", "Sair", () => engine.exit());
    slot("next", "Próximo", () => engine.next(), { enabled: v.canAdvance, primary: v.canAdvance });
  }
  engine.onChange(render);
  render(engine.state);

  // ---------- placement (tag-along to the right of the view) ----------
  let camera = null;
  const desired = new Vector3();
  const along = new Vector3();
  const right = new Vector3();
  function computeDesired(cam) {
    const eye = cam.globalPosition;
    const fwd = cam.getForwardRay(1).direction;
    along.set(fwd.x, 0, fwd.z);
    if (along.lengthSquared() < 1e-6) along.set(0, 0, 1);
    along.normalize();
    cam.getDirectionToRef(Vector3.RightReadOnly, right);
    right.y = 0;
    right.normalize();
    along.scaleInPlace(Math.cos(SIDE)).addInPlace(right.scaleInPlace(-Math.sin(SIDE))).normalize();
    desired.copyFrom(eye).addInPlace(along.scale(DISTANCE));
    desired.y = eye.y - DROP;
  }
  const face = (eye) => {
    const dx = plane.position.x - eye.x;
    const dz = plane.position.z - eye.z;
    if (dx * dx + dz * dz > 1e-6) plane.rotation.set(0, Math.atan2(dx, dz), 0);
  };
  scene.onBeforeRenderObservable.add(() => {
    if (!camera || !plane.isEnabled()) return;
    const eye = camera.globalPosition;
    computeDesired(camera);
    const to = plane.position.subtract(eye);
    to.y = 0;
    const dist = to.length();
    const angle = dist > 1e-6 ? Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(to.normalize(), along)))) : Math.PI;
    if (angle > MAX_ANGLE || dist > DISTANCE * 1.8 || dist < DISTANCE * 0.4 || Math.abs(plane.position.y - desired.y) > 0.35) {
      plane.position = Vector3.Lerp(plane.position, desired, FOLLOW);
    }
    face(eye);
  });

  const toTexture = (p) => {
    const local = Vector3.TransformCoordinates(p, plane.computeWorldMatrix(true).clone().invert());
    return { px: (local.x / WIDTH + 0.5) * TEX_W, py: (0.5 - local.y / HEIGHT) * TEX_H };
  };
  const api = {
    mesh: plane,
    ui,
    slots: TRAINING_SLOTS,
    get visible() {
      return plane.isEnabled();
    },
    show(cam) {
      camera = cam;
      cam.computeWorldMatrix(true);
      computeDesired(cam);
      plane.position.copyFrom(desired);
      face(cam.globalPosition);
      plane.setEnabled(true);
    },
    hide() {
      plane.setEnabled(false);
      camera = null;
    },
    /** Slot under a world point (hand-ray hit), or null; hidden / disabled slots never match. */
    buttonAt(p) {
      const { px, py } = toTexture(p);
      for (const n of TRAINING_SLOTS) {
        const b = buttons[n];
        if (!b.isVisible || !b.isEnabled) continue;
        if (Math.abs(px - b.centerX) <= b.widthInPixels / 2 && Math.abs(py - b.centerY) <= b.heightInPixels / 2) return n;
      }
      return null;
    },
    buttonWorld(name) {
      const b = buttons[name];
      if (!b?.isVisible) return null;
      const local = new Vector3((b.centerX / TEX_W - 0.5) * WIDTH, (0.5 - b.centerY / TEX_H) * HEIGHT, 0);
      return Vector3.TransformCoordinates(local, plane.computeWorldMatrix(true));
    },
    setButtonHover: setHover,
    press(name) {
      const b = buttons[name];
      if (!b?.isVisible || !b.isEnabled) return false;
      actions[name]?.();
      return true;
    },
    readout: () => ({
      title: title.text,
      step: stepLine.text,
      info: info.text,
      slots: Object.fromEntries(TRAINING_SLOTS.filter((n) => buttons[n].isVisible).map((n) => [n, { label: buttons[n].textBlock.text, enabled: buttons[n].isEnabled }])),
    }),
  };
  return api;
}
