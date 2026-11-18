import { Vector3, WebXRState } from "@babylonjs/core";
import { WALK_SPEED, walkStep } from "./walk.js";

const FORWARD = new Vector3(0, 0, 1); // Babylon: sistema de mão esquerda, +z para frente

// Liga o direcional do controle esquerdo à caminhada (regras do passo em walk.js).

/**
 * Liga a caminhada no helper do WebXR. `isVR()` diz se a sessão atual é VR (em RA fica desligada).
 * Devolve { enabled } para ligar/desligar (por exemplo, durante um cenário de treinamento).
 */
export function setupLocomotion(scene, xr, { layout, isVR, hand = "left" }) {
  const sticks = new Map(); // controle → componente thumbstick
  xr.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((mc) => {
      if (controller.inputSource.handedness !== hand) return;
      const stick = mc.getComponentOfType("thumbstick") ?? mc.getComponentOfType("touchpad");
      if (stick) sticks.set(controller.uniqueId, stick);
    });
  });
  xr.input.onControllerRemovedObservable.add((controller) => sticks.delete(controller.uniqueId));

  const api = { enabled: true, speed: WALK_SPEED };
  const base = xr.baseExperience;
  base.sessionManager.onXRFrameObservable.add(() => {
    if (!api.enabled || base.state !== WebXRState.IN_XR || !isVR()) return;
    let axes = null;
    for (const s of sticks.values()) if (!axes || Math.hypot(s.axes.x, s.axes.y) > Math.hypot(axes.x, axes.y)) axes = s.axes;
    if (!axes) return;
    const cam = base.camera;
    const dir = cam.getDirection(FORWARD);
    const next = walkStep({ x: cam.position.x, z: cam.position.z }, { x: dir.x, z: dir.z }, axes, scene.getEngine().getDeltaTime() / 1000, layout, api.speed);
    if (!next) return;
    // Mesma técnica da pose inicial: o Babylon transforma a mudança de posição num novo espaço de
    // referência, e o rastreamento da cabeça continua normal a partir dali.
    cam.position.x = next.x;
    cam.position.z = next.z;
  });
  return api;
}
