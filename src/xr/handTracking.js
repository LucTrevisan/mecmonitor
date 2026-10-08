// HandTrackingManager: WebXR hand tracking (Meta Quest) as an OPTIONAL feature.
//  - never required: devices/browsers without hand tracking still enter VR with controllers;
//  - no default hand mesh (no CDN download, no "videogame" hands): only two discreet fingertip markers
//    (thumb + index) per hand, so the user knows the hand is recognized;
//  - exposes RAW joint positions (refreshed every frame, no per-frame allocation). Smoothing, point and
//    pinch belong to the interaction layer (Fase 8) and work on top of these raw values;
//  - tracks the active input per hand ("controller" | "hand" | "none") so the app can switch automatically
//    when the Quest swaps controllers ↔ hands, without reloading.
import { Color3, MeshBuilder, StandardMaterial, Vector3, WebXRFeatureName } from "@babylonjs/core";

/** WebXR joint names used by the app (all 25 joints remain available through joint()). */
export const KEY_JOINTS = ["wrist", "thumb-tip", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "pinky-finger-tip"];
const MARKER_JOINTS = ["thumb-tip", "index-finger-tip"];
const SIDES = ["left", "right"];

export function setupHandTracking(scene, xr) {
  let feature = null;
  try {
    feature = xr.baseExperience.featuresManager.enableFeature(
      WebXRFeatureName.HAND_TRACKING,
      "latest",
      { xrInput: xr.input, jointMeshes: { invisible: true }, handMeshes: { disableDefaultMeshes: true } },
      true,
      false, // optional: the session must not fail where hand tracking is unavailable
    );
  } catch (e) {
    console.warn("Hand tracking indisponível neste navegador:", e?.message ?? e);
  }

  const markerMat = new StandardMaterial("handMarkerMat", scene);
  markerMat.emissiveColor = new Color3(0.92, 0.95, 1);
  markerMat.disableLighting = true;
  markerMat.alpha = 0.7;

  // Per side: Babylon hand, raw joint cache, fingertip markers.
  const state = Object.fromEntries(
    SIDES.map((side) => [
      side,
      {
        hand: null,
        raw: Object.fromEntries(KEY_JOINTS.map((j) => [j, new Vector3()])),
        valid: false,
        markers: MARKER_JOINTS.map((j) => {
          const m = MeshBuilder.CreateSphere(`hand-${side}-${j}`, { diameter: 0.009, segments: 8 }, scene);
          m.material = markerMat;
          m.isPickable = false;
          m.setEnabled(false);
          m.metadata = { handMarker: side, joint: j };
          return m;
        }),
      },
    ]),
  );

  const modes = { left: "none", right: "none" };
  const modeListeners = new Set();
  const recomputeModes = () => {
    const next = { left: "none", right: "none" };
    for (const c of xr.input.controllers) {
      const side = c.inputSource.handedness;
      if (side in next) next[side] = c.inputSource.hand ? "hand" : "controller";
    }
    const changed = SIDES.filter((s) => next[s] !== modes[s]);
    if (!changed.length) return;
    Object.assign(modes, next);
    modeListeners.forEach((fn) => fn({ ...modes }));
  };
  xr.input.onControllerAddedObservable.add(recomputeModes);
  xr.input.onControllerRemovedObservable.add(() => setTimeout(recomputeModes, 0)); // after removal settles

  if (feature) {
    feature.onHandAddedObservable.add((hand) => {
      const side = hand.xrController.inputSource.handedness;
      if (!state[side]) return;
      state[side].hand = hand;
    });
    feature.onHandRemovedObservable.add((hand) => {
      const side = hand.xrController.inputSource.handedness;
      if (!state[side] || state[side].hand !== hand) return;
      state[side].hand = null;
      state[side].valid = false;
      state[side].markers.forEach((m) => m.setEnabled(false));
    });
  }

  // Refresh raw joints + markers once per frame (only while a hand exists).
  scene.onBeforeRenderObservable.add(() => {
    for (const side of SIDES) {
      const s = state[side];
      if (!s.hand) continue;
      let ok = true;
      for (const j of KEY_JOINTS) {
        const mesh = s.hand.getJointMesh(j);
        if (!mesh) {
          ok = false;
          continue;
        }
        s.raw[j].copyFrom(mesh.getAbsolutePosition());
      }
      // A lost/untracked hand reports joints at the origin: do not show or use it.
      ok = ok && s.raw.wrist.lengthSquared() > 1e-6;
      s.valid = ok;
      s.markers.forEach((m, i) => {
        m.setEnabled(ok);
        if (ok) m.position.copyFrom(s.raw[MARKER_JOINTS[i]]);
      });
    }
  });

  return {
    available: Boolean(feature),
    feature,
    /** Active input per side: "controller" | "hand" | "none". */
    get modes() {
      return { ...modes };
    },
    onModeChange(fn) {
      modeListeners.add(fn);
      return () => modeListeners.delete(fn);
    },
    /** True when that hand is tracked this frame. */
    isTracked: (side) => Boolean(state[side]?.valid),
    /** Raw world position of a joint (shared Vector3 — copy it if you keep it), or null. */
    joint(side, name) {
      const s = state[side];
      if (!s?.valid) return null;
      if (s.raw[name]) return s.raw[name];
      return s.hand?.getJointMesh(name)?.getAbsolutePosition() ?? null;
    },
    markers: (side) => state[side]?.markers ?? [],
  };
}
