import { MeshBuilder, Quaternion, WebXRState } from "@babylonjs/core";
import { safeFloorRects } from "./scene/layout.js";
import { setupHandTracking } from "./xr/handTracking.js";

// WebXR session setup and tracking policy:
//  - reference space "local-floor" (XR floor = lab floor y = 0, the bench base);
//  - fixed start pose in front of the bench, facing it (never inherit the desktop camera position);
//  - teleport only onto the safe floor (room minus the bench safety tape); the bench blocks the arc;
//  - controller rays only consider interactive objects (VR panel, sensor volumes), never the 242 model meshes.

const MAX_POINTER_DISTANCE = 6; // m

export async function checkVRSupport() {
  if (!window.isSecureContext) return { supported: false, reason: "Requer HTTPS (contexto seguro)." };
  if (!navigator.xr) return { supported: false, reason: "VR não detectado neste dispositivo." };
  try {
    const ok = await navigator.xr.isSessionSupported("immersive-vr");
    return ok ? { supported: true } : { supported: false, reason: "VR não detectado neste dispositivo." };
  } catch {
    return { supported: false, reason: "VR não detectado neste dispositivo." };
  }
}

/** Invisible teleport targets covering only the walkable floor (never rendered, never desktop-pickable). */
export function createSafeFloor(scene, layout) {
  return safeFloorRects(layout).map((r) => {
    const m = MeshBuilder.CreateGround(`xrSafeFloor-${r.name}`, { width: r.x1 - r.x0, height: r.z1 - r.z0 }, scene);
    m.position.set((r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2);
    m.isVisible = false;
    m.isPickable = false; // teleport uses its own floor predicate; keeps desktop picking untouched
    m.metadata = { xrSafeFloor: r.name };
    m.freezeWorldMatrix();
    return m;
  });
}

/**
 * @param {Scene} scene
 * @param {{ layout, safeFloor: Mesh[], isBlocker: (m) => boolean, isInteractive: (m) => boolean, onStartPose?: (cam) => void }} o
 */
export async function setupXR(scene, { layout, safeFloor, isBlocker, isInteractive, onStartPose }) {
  const xr = await scene.createDefaultXRExperienceAsync({
    floorMeshes: safeFloor,
    disableDefaultUI: true,
    pointerSelectionOptions: { maxPointerDistance: MAX_POINTER_DISTANCE },
    teleportationOptions: { blockerMeshesPredicate: isBlocker },
  });
  if (xr.pointerSelection) xr.pointerSelection.raySelectionPredicate = isInteractive;
  // Hands (optional feature): controllers keep working where hand tracking is unavailable.
  const hands = setupHandTracking(scene, xr);

  const base = xr.baseExperience;
  const applyStartPose = (cam) => {
    // Keep the tracked head height (local-floor); set the floor position and heading only.
    // Babylon turns this into an offset reference space, so tracking stays continuous afterwards.
    cam.position.x = layout.start.x;
    cam.position.z = layout.start.z;
    cam.rotationQuaternion = Quaternion.FromEulerAngles(0, layout.start.yaw, 0);
  };
  // Applied on the 2nd XR frame: the 1st frame is where Babylon compensates the real head height
  // (local-floor). Setting the pose before that would be overwritten.
  base.onStateChangedObservable.add((state) => {
    if (state !== WebXRState.IN_XR) return;
    let frames = 0;
    const obs = base.sessionManager.onXRFrameObservable.add(() => {
      frames++;
      if (frames === 2) applyStartPose(base.camera);
      if (frames === 3) {
        // the new reference space is in effect: world-placed UI can be laid out around the user
        base.sessionManager.onXRFrameObservable.remove(obs);
        onStartPose?.(base.camera);
      }
    });
  });

  return {
    xr,
    hands,
    enter: () => base.enterXRAsync("immersive-vr", "local-floor"),
    exit: () => base.exitXRAsync(),
    /** Moves the user back to the start pose (in front of the bench). */
    recenter: () => applyStartPose(base.camera),
    /** Calls fn(true, xrCamera) when the immersive session starts and fn(false) when it ends. */
    onImmersiveChange(fn) {
      base.onStateChangedObservable.add((state) => {
        if (state === WebXRState.IN_XR) fn(true, base.camera);
        else if (state === WebXRState.NOT_IN_XR) fn(false);
      });
    },
  };
}
