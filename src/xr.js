import { WebXRState } from "@babylonjs/core";

// Minimal WebXR setup. Etapa 7 will add the VR-specific UI, snap turn and hand tracking.

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

export async function setupXR(scene, ground) {
  const xr = await scene.createDefaultXRExperienceAsync({
    floorMeshes: [ground],
    disableDefaultUI: true,
  });
  return {
    xr,
    enter: () => xr.baseExperience.enterXRAsync("immersive-vr", "local-floor"),
    exit: () => xr.baseExperience.exitXRAsync(),
    /** Calls fn(true, xrCamera) when the immersive session starts and fn(false) when it ends. */
    onImmersiveChange(fn) {
      xr.baseExperience.onStateChangedObservable.add((state) => {
        if (state === WebXRState.IN_XR) fn(true, xr.baseExperience.camera);
        else if (state === WebXRState.NOT_IN_XR) fn(false);
      });
    },
  };
}
