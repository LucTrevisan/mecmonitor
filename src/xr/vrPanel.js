// In-headset control panel (HTML overlays are not visible inside an immersive session).
// A 3D GUI panel that "tags along": it stays slightly below and in front of the user's view and
// only moves when it drifts out of a comfortable zone. Minimal for now — Etapa 7 will extend it.
import { MeshBuilder, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";

const WIDTH = 0.42; // meters
const HEIGHT = 0.24;
const TEX_W = 840;
const TEX_H = 480;
const DISTANCE = 0.85; // in front of the user
const DROP = 0.32; // below eye level
const MAX_ANGLE = (40 * Math.PI) / 180; // re-place when it leaves this cone
const FOLLOW = 0.12;
const FONT = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';

export function createVRPanel(scene, { onExit } = {}) {
  const plane = MeshBuilder.CreatePlane("vrControlPanel", { width: WIDTH, height: HEIGHT }, scene);
  plane.renderingGroupId = 1; // drawn on top: never hidden inside the machine
  plane.isPickable = true;
  plane.setEnabled(false);

  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_W, TEX_H, true);
  // UI must not be shaded by the scene lights (otherwise text and background look washed out).
  plane.material.disableLighting = true;
  plane.material.useAlphaFromDiffuseTexture = true;

  const bg = new Rectangle("vrBg");
  bg.background = "rgba(14, 19, 26, 0.92)";
  bg.color = "rgba(255, 255, 255, 0.18)";
  bg.thickness = 3;
  bg.cornerRadius = 36;
  ui.addControl(bg);

  const stack = new StackPanel("vrStack");
  stack.isVertical = true;
  stack.width = "88%";
  bg.addControl(stack);

  const title = new TextBlock("vrTitle", "MECMONITOR");
  title.height = "70px";
  title.color = "#eef2f6";
  title.fontFamily = FONT;
  title.fontSize = 46;
  title.fontWeight = "700";
  stack.addControl(title);

  const sub = new TextBlock("vrSub", "Bomba Centrífuga · P-01 · Modo imersivo");
  sub.height = "56px";
  sub.color = "#b4bfcc";
  sub.fontFamily = FONT;
  sub.fontSize = 28;
  stack.addControl(sub);

  const spacer = new Rectangle("vrSpacer");
  spacer.height = "40px";
  spacer.thickness = 0;
  stack.addControl(spacer);

  const exit = Button.CreateSimpleButton("vrExit", "Sair da imersão");
  exit.height = "150px";
  exit.width = "100%";
  exit.cornerRadius = 28;
  exit.thickness = 0;
  exit.background = "#e5484d";
  exit.color = "#ffffff";
  exit.fontFamily = FONT;
  exit.fontSize = 48;
  exit.fontWeight = "700";
  exit.pointerEnterAnimation = () => (exit.background = "#f06a6e");
  exit.pointerOutAnimation = () => (exit.background = "#e5484d");
  exit.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  stack.addControl(exit);

  let camera = null;
  let distance = DISTANCE;
  let drop = DROP;
  let exitRequests = 0;
  exit.onPointerUpObservable.add(() => {
    exitRequests++;
    onExit?.();
  });

  const desired = new Vector3();
  function computeDesired(cam) {
    const eye = cam.globalPosition;
    const fwd = cam.getForwardRay(1).direction;
    const flat = new Vector3(fwd.x, 0, fwd.z);
    if (flat.lengthSquared() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();
    desired.copyFrom(eye).addInPlace(flat.scale(distance));
    desired.y = eye.y - drop;
    return flat;
  }

  function faceUser(eye) {
    // Plane front faces -Z: look from the eye toward the panel so the GUI reads correctly.
    const dir = plane.position.subtract(eye);
    dir.y = 0;
    if (dir.lengthSquared() > 1e-6) plane.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
  }

  const follow = scene.onBeforeRenderObservable.add(() => {
    if (!camera || !plane.isEnabled()) return;
    const eye = camera.globalPosition;
    const flat = computeDesired(camera);
    const toPanel = plane.position.subtract(eye);
    toPanel.y = 0;
    const dist = toPanel.length();
    const angle = dist > 1e-6 ? Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(toPanel.normalize(), flat)))) : Math.PI;
    if (angle > MAX_ANGLE || dist > distance * 1.8 || dist < distance * 0.4 || Math.abs(plane.position.y - desired.y) > 0.35) {
      plane.position = Vector3.Lerp(plane.position, desired, FOLLOW);
    }
    faceUser(eye);
  });

  return {
    mesh: plane,
    ui,
    exitButton: exit,
    get exitRequests() {
      return exitRequests;
    },
    /** World position of the exit button center (tests/tooling). */
    exitButtonWorld() {
      const local = new Vector3((exit.centerX / TEX_W - 0.5) * WIDTH, (0.5 - exit.centerY / TEX_H) * HEIGHT, 0);
      return Vector3.TransformCoordinates(local, plane.computeWorldMatrix(true));
    },
    get visible() {
      return plane.isEnabled();
    },
    /** Shows the panel in front of the given camera (the XR camera inside a session). */
    show(cam, opts = {}) {
      camera = cam;
      distance = opts.distance ?? DISTANCE;
      drop = opts.drop ?? DROP;
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
}
