// Realidade aumentada (immersive-ar): the bench at REAL scale in the real room — Meta Quest 3 (passthrough)
// and Chrome on Android with ARCore. iPhone/iPad have no WebXR (Safari), so AR is not offered there.
// The GLB is never moved or scaled: like the VR start pose, the XR reference space is offset so that the real
// point the user chose (hit-test reticle) corresponds to the base of the bench, with the bench facing the user.
// In AR the virtual workshop is hidden (the real room is the scenery); the bench, its plates and boards and
// the sensors stay, and so do the panels. Teleport is detached (the user walks in the real room).
import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3, WebXRFeatureName } from "@babylonjs/core";
import { placementPose, yawTowards } from "./arPlacement.js";

const NO_HIT_FALLBACK_MS = 3000; // no hit-test result for this long: reticle on the floor ahead (local-floor y = 0)
const FALLBACK_DISTANCE = 1.5; // m
const FRESH_HIT_MS = 500;
const UI_GRACE_MS = 300; // a panel/sensor selection this close to the press is not a placement
const SAME_PRESS_MS = 50; // a "select" dispatched with the "selectstart" of the same press (emulator order)
const KEEP_IN_AR = /^(labBenchSign|labPlate|labCab)/; // dressing that belongs to the bench itself
const COLOR = "#4cb1ff";

const AR_UNAVAILABLE = "RA não disponível neste dispositivo (requer Chrome no Android com ARCore ou Meta Quest 3).";

export async function checkARSupport() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!window.isSecureContext) return { supported: false, reason: "Requer HTTPS (contexto seguro)." };
  if (ios) return { supported: false, reason: "RA não disponível no iPhone/iPad: o Safari não tem WebXR." };
  if (!navigator.xr) return { supported: false, reason: AR_UNAVAILABLE };
  try {
    return (await navigator.xr.isSessionSupported("immersive-ar")) ? { supported: true } : { supported: false, reason: AR_UNAVAILABLE };
  } catch {
    return { supported: false, reason: AR_UNAVAILABLE };
  }
}

function hintPlane(scene) {
  const tex = new DynamicTexture("arHintTex", { width: 512, height: 96 }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.fillStyle = "rgba(11, 15, 20, 0.82)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(4, 4, 504, 88, 22);
  else ctx.rect(4, 4, 504, 88);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Gatilho, pinça ou toque: posicionar", 256, 50);
  tex.update();
  const mat = new StandardMaterial("arHintMat", scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = Color3.White();
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.backFaceCulling = false;
  const plane = MeshBuilder.CreatePlane("arHint", { width: 0.64, height: 0.12 }, scene);
  plane.material = mat;
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.isPickable = false;
  plane.renderingGroupId = 1;
  return plane;
}

/**
 * @param {{ scene, xr, scenery: () => AbstractMesh[], bounds: { min: Vector3, max: Vector3 }, overlay?: HTMLElement,
 *           uiSelectedSince?: (t: number) => boolean, onPlaced?: (cam) => void, onStatus?: (text: string) => void }} o
 *   scenery: lab / workshop meshes (all but the bench dressing are hidden in AR); bounds: model bounds;
 *   uiSelectedSince(t): true when a panel button or sensor was selected after performance.now() = t
 */
export function createARMode({ scene, xr, scenery, bounds, overlay, uiSelectedSince, onPlaced, onStatus }) {
  const base = xr.baseExperience;
  const fm = base.featuresManager;
  // floor point under the centre of the bench (the model sits on y = 0)
  const anchor = new Vector3((bounds.min.x + bounds.max.x) / 2, 0, (bounds.min.z + bounds.max.z) / 2);

  // ---------- reticle: ring + bench footprint at real size, laid out as the bench will be ----------
  const mat = new StandardMaterial("arReticleMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(COLOR);
  const reticle = MeshBuilder.CreateTorus("arReticle", { diameter: 0.22, thickness: 0.012, tessellation: 40 }, scene);
  reticle.material = mat;
  const hx = (bounds.max.x - bounds.min.x) / 2;
  const hz = (bounds.max.z - bounds.min.z) / 2;
  const footprint = MeshBuilder.CreateLines(
    "arFootprint",
    { points: [new Vector3(-hx, 0.003, -hz), new Vector3(hx, 0.003, -hz), new Vector3(hx, 0.003, hz), new Vector3(-hx, 0.003, hz), new Vector3(-hx, 0.003, -hz)] },
    scene,
  );
  footprint.color = Color3.FromHexString(COLOR);
  // front edge marker (+z, towards the user): a short arrow so the orientation is readable
  const front = MeshBuilder.CreateLines("arFootprintFront", { points: [new Vector3(-0.12, 0.003, hz - 0.1), new Vector3(0, 0.003, hz + 0.04), new Vector3(0.12, 0.003, hz - 0.1)] }, scene);
  front.color = Color3.FromHexString(COLOR);
  const hint = hintPlane(scene);
  hint.position.y = 0.35;
  for (const m of [footprint, front, hint]) m.parent = reticle;
  for (const m of [reticle, footprint, front, hint]) {
    m.isPickable = false;
    m.renderingGroupId = 1;
  }
  reticle.setEnabled(false);

  let active = false;
  let placing = false;
  let hitTest = null;
  let lastHitAt = 0;
  let startedAt = 0;
  let armedAt = -1; // performance.now() of a press that started while placing (−1: none)
  let selectAt = -Infinity; // last completed press ("select")
  let hidden = [];
  let savedClear = null;
  let session = null;
  let placements = 0;
  const hitPos = new Vector3();

  const status = (t) => onStatus?.(t);

  function showReticleAt(p) {
    reticle.position.copyFrom(p);
    // the bench front (+z) will face the user
    reticle.rotationQuaternion = Quaternion.RotationAxis(Vector3.UpReadOnly, yawTowards(p, base.camera.globalPosition));
    reticle.setEnabled(true);
  }

  // while placing, without a fresh hit-test pose: reticle on the floor straight ahead
  const frameObs = scene.onBeforeRenderObservable.add(() => {
    if (!active || !placing) return;
    const now = performance.now();
    if (now - lastHitAt < FRESH_HIT_MS) return;
    if (hitTest?.attached && now - startedAt < NO_HIT_FALLBACK_MS) return;
    const cam = base.camera;
    const fwd = cam.getForwardRay(1).direction;
    const flat = new Vector3(fwd.x, 0, fwd.z);
    if (flat.lengthSquared() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();
    hitPos.set(cam.globalPosition.x + flat.x * FALLBACK_DISTANCE, 0, cam.globalPosition.z + flat.z * FALLBACK_DISTANCE);
    showReticleAt(hitPos);
  });

  function onHits(results) {
    if (!active || !placing || !results.length) return;
    hitPos.copyFrom(results[0].position);
    lastHitAt = performance.now();
    showReticleAt(hitPos);
  }

  /** Offsets the XR reference space so that the real point p becomes the base of the bench, facing the user. */
  function placeAt(p) {
    const cam = base.camera;
    const pose = placementPose(cam.position, p, anchor);
    cam.position.set(pose.x, pose.y, pose.z);
    cam.rotationQuaternion = Quaternion.RotationAxis(Vector3.UpReadOnly, pose.yaw).multiply(cam.rotationQuaternion ?? Quaternion.Identity());
    placing = false;
    placements++;
    if (hitTest) hitTest.paused = true;
    reticle.setEnabled(false);
    status("Bancada posicionada em tamanho real. Toque nos sensores para ver as leituras.");
    // the new reference space is in effect from the next frame: then re-place the world-space UI
    base.sessionManager.onXRFrameObservable.addOnce(() => base.sessionManager.onXRFrameObservable.addOnce(() => onPlaced?.(cam)));
  }

  // A press places the bench only if it STARTED while placing (the "Recentrar"/"Reposicionar" press itself
  // never places), was completed (a "select" belongs to it; a cancelled press only ends) and did not select
  // a panel button or a sensor meanwhile. Decided on "selectend", whatever the order of "select": the spec
  // fires it just before "selectend", the IWER emulator just before "selectstart".
  const onSelectStart = () => {
    armedAt = active && placing ? performance.now() : -1;
  };
  const onSelect = () => {
    selectAt = performance.now();
  };
  const onSelectEnd = () => {
    const t = armedAt;
    armedAt = -1;
    if (t < 0 || selectAt < t - SAME_PRESS_MS || !active || !placing || !reticle.isEnabled()) return;
    if (uiSelectedSince?.(t - UI_GRACE_MS)) return;
    placeAt(reticle.position.clone());
  };

  function replace() {
    if (!active) return;
    placing = true;
    startedAt = performance.now();
    lastHitAt = 0;
    armedAt = -1;
    if (hitTest) hitTest.paused = false;
    status("Aponte para um espaço livre no chão e toque para posicionar a bancada em tamanho real.");
  }

  /** Disables the AR-only features (after the session, or when entering failed). */
  function release() {
    for (const f of [WebXRFeatureName.HIT_TEST, WebXRFeatureName.DOM_OVERLAY]) {
      try {
        fm.disableFeature(f);
      } catch {
        /* not enabled */
      }
    }
    hitTest = null;
  }

  return {
    get active() {
      return active;
    },
    get placing() {
      return placing;
    },
    get placements() {
      return placements;
    },
    get hitTestAttached() {
      return Boolean(hitTest?.attached);
    },
    reticle,
    anchor,
    /** AR-only features, all optional (the session never fails because of them). Call before entering. */
    prepare() {
      try {
        hitTest = fm.enableFeature(WebXRFeatureName.HIT_TEST, "latest", {}, true, false);
        hitTest.onHitTestResultObservable.add(onHits);
      } catch (e) {
        hitTest = null;
        console.warn("RA: hit-test indisponível:", e);
      }
      if (overlay) {
        try {
          // select events from the bar's buttons are suppressed by the bar itself (main.js), not by the
          // full-screen overlay root: a tap on the camera image must still place the bench
          fm.enableFeature(WebXRFeatureName.DOM_OVERLAY, "latest", { element: overlay }, true, false);
        } catch (e) {
          console.warn("RA: sobreposição DOM indisponível:", e);
        }
      }
    },
    release,
    /** Called when the AR session is running. */
    start() {
      active = true;
      // the real room is the scenery
      hidden = scenery().filter((m) => m && m.isEnabled() && !KEEP_IN_AR.test(m.name));
      hidden.forEach((m) => m.setEnabled(false));
      savedClear = scene.clearColor.clone();
      scene.clearColor = new Color4(0, 0, 0, 0);
      try {
        fm.detachFeature(WebXRFeatureName.TELEPORTATION); // re-attached by Babylon on the next session
      } catch {
        /* not enabled */
      }
      session = base.sessionManager.session;
      session?.addEventListener("selectstart", onSelectStart);
      session?.addEventListener("select", onSelect);
      session?.addEventListener("selectend", onSelectEnd);
      document.body.classList.add("ar-active");
      replace();
    },
    /** Called when the AR session has ended: everything back for the desktop / VR. */
    stop() {
      if (!active) return;
      active = false;
      placing = false;
      session?.removeEventListener("selectstart", onSelectStart);
      session?.removeEventListener("select", onSelect);
      session?.removeEventListener("selectend", onSelectEnd);
      session = null;
      hidden.forEach((m) => m.setEnabled(true));
      hidden = [];
      if (savedClear) scene.clearColor = savedClear;
      savedClear = null;
      base.camera.compensateOnFirstFrame = true; // Babylon turns it off for AR; VR sessions expect it
      reticle.setEnabled(false);
      document.body.classList.remove("ar-active");
      release();
    },
    replace,
    placeAt,
    dispose() {
      scene.onBeforeRenderObservable.remove(frameObs);
      reticle.dispose(false, true);
    },
  };
}
