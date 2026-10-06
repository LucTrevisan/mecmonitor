// Smooth ArcRotateCamera transitions (target, radius, alpha, beta). Any user input on the canvas
// cancels the running transition so the camera never fights the user.
import { Vector3 } from "@babylonjs/core";

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;
const shortestAngle = (from, to) => from + ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;

export function createCameraFocus(scene, camera, canvas) {
  let anim = null;

  const cancel = () => {
    if (anim) scene.onBeforeRenderObservable.remove(anim.observer);
    anim = null;
  };
  ["pointerdown", "wheel", "touchstart"].forEach((ev) => canvas.addEventListener(ev, cancel, { passive: true }));

  function focus(target, { alpha = camera.alpha, beta = camera.beta, radius = camera.radius, duration = 900 } = {}) {
    cancel();
    const from = { target: camera.target.clone(), alpha: camera.alpha, beta: camera.beta, radius: camera.radius };
    const to = {
      target: target.clone(),
      alpha: shortestAngle(camera.alpha, alpha),
      beta: Math.min(Math.max(beta, camera.lowerBetaLimit ?? 0.01), camera.upperBetaLimit ?? Math.PI - 0.01),
      radius: Math.min(Math.max(radius, camera.lowerRadiusLimit ?? 0), camera.upperRadiusLimit ?? Infinity),
    };
    const start = performance.now();
    return new Promise((resolve) => {
      const observer = scene.onBeforeRenderObservable.add(() => {
        const t = Math.min(1, (performance.now() - start) / duration);
        const k = ease(t);
        camera.setTarget(Vector3.Lerp(from.target, to.target, k));
        camera.alpha = from.alpha + (to.alpha - from.alpha) * k;
        camera.beta = from.beta + (to.beta - from.beta) * k;
        camera.radius = from.radius + (to.radius - from.radius) * k;
        if (t >= 1) {
          cancel();
          resolve(true);
        }
      });
      anim = { observer };
    });
  }

  return { focus, cancel, get animating() { return anim !== null; } };
}
