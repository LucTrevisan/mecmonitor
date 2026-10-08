// Hand interaction layer (Meta Quest hand tracking): point, pinch and near interaction, feeding the
// shared InteractionManager — the same business actions as mouse, touch and controllers.
//
//  POINT  ray from an estimated shoulder through the pinch point (between thumb tip and index knuckle).
//         That point barely moves while pinching, so the ray stays still at the moment of selection.
//  PINCH  scale-invariant thumb–index ratio with hysteresis/debounce/cooldown (interaction/pinch.js):
//         one PINCH_START = one selection, holding never repeats it.
//  NEAR   index fingertip inside a sensor's interaction volume → that sensor is hovered (priority over
//         the ray); a pinch confirms. Passing through never selects anything.
//
// Raw joints come from HandTrackingManager; this layer smooths only what the UI uses (One Euro filter:
// low jitter at rest, low latency when moving). Babylon's own pointer ray is detached from hand inputs
// so there is never a duplicated pointer per hand; controllers keep Babylon's ray.
import { Color3, MeshBuilder, Ray, StandardMaterial, Vector3, WebXRState } from "@babylonjs/core";
import { createVec3Filter } from "./oneEuro.js";
import { createPinchDetector, pinchRatio, PINCH_EVENTS } from "./pinch.js";

const SIDES = ["left", "right"];
const RAY_LENGTH = 3; // m — hands reach shorter than controllers
const SHOULDER = { side: 0.17, down: 0.2 }; // m, from the head
const COLORS = { idle: new Color3(0.85, 0.88, 0.92), hover: Color3.FromHexString("#4cb1ff"), flash: new Color3(1, 1, 1) };
const FLASH_MS = 160;
const NEAR_STICKY = 1.6; // a near target stays hovered until the hand is this many radii away
const INTENT_MS = 250; // a pinch selects what was hovered up to this long before (fingers move while pinching)

/**
 * @param {{ scene, xr, hands, manager,
 *           pick: { meshPredicate(m): boolean, idForHit(pickInfo): string|null, near(): {id, center, radius}[] } }} o
 */
export function createHandInteraction({ scene, xr, hands, manager, pick }) {
  const base = xr.baseExperience;
  const ray = new Ray(Vector3.Zero(), Vector3.Forward(), RAY_LENGTH);
  const tmp = { a: new Vector3(), right: new Vector3(), end: new Vector3(), raw: new Vector3() }; // reused every frame

  const cursorMat = new StandardMaterial("handCursorMat", scene);
  cursorMat.disableLighting = true;
  cursorMat.emissiveColor = COLORS.idle.clone();

  const state = Object.fromEntries(
    SIDES.map((side) => {
      const line = MeshBuilder.CreateLines(`handRay-${side}`, { points: [Vector3.Zero(), Vector3.Forward()], updatable: true }, scene);
      line.isPickable = false;
      line.alpha = 0.35;
      line.color = COLORS.idle.clone();
      line.setEnabled(false);
      const cursor = MeshBuilder.CreateSphere(`handCursor-${side}`, { diameter: 0.012, segments: 8 }, scene);
      cursor.material = cursorMat.clone(`handCursorMat-${side}`);
      cursor.isPickable = false;
      cursor.setEnabled(false);
      return [
        side,
        {
          source: `hand-${side}`,
          detector: createPinchDetector(),
          fOrigin: createVec3Filter({ minCutoff: 1.5, beta: 6 }),
          fTip: createVec3Filter({ minCutoff: 1.5, beta: 6 }),
          fShoulder: createVec3Filter({ minCutoff: 1.0, beta: 2 }),
          origin: new Vector3(),
          tip: new Vector3(),
          shoulder: new Vector3(),
          dir: new Vector3(),
          line,
          linePoints: [new Vector3(), new Vector3()],
          cursor,
          flashUntil: 0,
          nearId: null,
          lastHover: { id: null, at: -Infinity },
          status: { active: false, hover: null, near: false, ratio: NaN, pinched: false, selections: 0 },
        },
      ];
    }),
  );

  const hide = (s) => {
    s.line.setEnabled(false);
    s.cursor.setEnabled(false);
  };

  /** Babylon's pointer selection also attaches to hand inputs: detach it (one pointer per hand). */
  const detachBabylonHandPointers = () => {
    const ps = xr.pointerSelection;
    if (!ps || typeof ps._detachController !== "function") return;
    for (const c of xr.input.controllers) {
      if (c.inputSource.hand && ps._controllers?.[c.uniqueId]) ps._detachController(c.uniqueId);
    }
  };

  const frame = () => {
    if (base.state !== WebXRState.IN_XR) {
      SIDES.forEach((side) => hide(state[side]));
      return;
    }
    detachBabylonHandPointers();
    const cam = base.camera;
    const eye = cam.globalPosition;
    cam.getDirectionToRef(Vector3.RightReadOnly, tmp.right);
    tmp.right.y = 0;
    tmp.right.normalize();
    const now = performance.now();
    const t = now / 1000;

    for (const side of SIDES) {
      const s = state[side];
      const thumb = hands.modes[side] === "hand" && hands.isTracked(side) ? hands.joint(side, "thumb-tip") : null;
      const index = thumb && hands.joint(side, "index-finger-tip");
      const wrist = thumb && hands.joint(side, "wrist");
      const midKnuckle = thumb && hands.joint(side, "middle-finger-phalanx-proximal");
      const idxKnuckle = thumb && hands.joint(side, "index-finger-phalanx-proximal");
      if (!thumb || !index || !wrist || !midKnuckle || !idxKnuckle) {
        // not a tracked hand (controller in that hand, or tracking lost): release cleanly
        if (s.detector.update(NaN, now) === PINCH_EVENTS.END) s.status.pinched = false;
        manager.hover(null, s.source);
        s.fOrigin.reset();
        s.fTip.reset();
        s.fShoulder.reset();
        s.status = { ...s.status, active: false, hover: null, near: false, ratio: NaN, pinched: false };
        hide(s);
        continue;
      }

      // smoothed geometry used by the UI (raw joints stay untouched in HandTrackingManager)
      tmp.raw.copyFrom(thumb).addInPlace(idxKnuckle).scaleInPlace(0.5);
      s.fOrigin.filter(tmp.raw, t, s.origin);
      s.fTip.filter(index, t, s.tip);
      tmp.right.scaleToRef(side === "right" ? SHOULDER.side : -SHOULDER.side, tmp.a);
      tmp.raw.copyFrom(eye).addInPlace(tmp.a);
      tmp.raw.y -= SHOULDER.down;
      s.fShoulder.filter(tmp.raw, t, s.shoulder);
      s.origin.subtractToRef(s.shoulder, s.dir);
      if (s.dir.lengthSquared() < 1e-8) s.dir.set(0, 0, 1);
      s.dir.normalize();

      // NEAR has priority over the ray. Distance from the fingertip OR the pinch point (whichever is
      // closer): when the user pinches, the index tip moves several cm towards the thumb.
      let nearId = null;
      let best = Infinity;
      for (const n of pick.near()) {
        const d = Math.min(Vector3.Distance(s.tip, n.center), Vector3.Distance(s.origin, n.center));
        const reach = n.id === s.nearId ? n.radius * NEAR_STICKY : n.radius; // sticky: no flicker at the edge
        if (d < reach && d < best) {
          best = d;
          nearId = n.id;
        }
      }
      s.nearId = nearId;
      let rayId = null;
      let hitPoint = null;
      s.status.rayMesh = null;
      if (!nearId) {
        ray.origin.copyFrom(s.origin);
        ray.direction.copyFrom(s.dir);
        ray.length = RAY_LENGTH;
        const hit = scene.pickWithRay(ray, pick.meshPredicate);
        if (hit?.hit) {
          hitPoint = hit.pickedPoint;
          rayId = pick.idForHit(hit);
          s.status.rayMesh = hit.pickedMesh.name; // diagnostics
        }
      }
      const hoverId = nearId ?? rayId;
      manager.hover(hoverId, s.source);
      if (hoverId) s.lastHover = { id: hoverId, at: now };

      const ratio = pinchRatio(thumb, index, wrist, midKnuckle);
      const ev = s.detector.update(ratio, now);
      // selection intent: what is hovered now, or was hovered just before the fingers started closing
      const intentId = hoverId ?? (now - s.lastHover.at < INTENT_MS ? s.lastHover.id : null);
      if (ev === PINCH_EVENTS.START && intentId) {
        manager.select(intentId, s.source);
        s.status.selections++;
        s.flashUntil = now + FLASH_MS;
      }
      s.status = { ...s.status, active: true, hover: hoverId, near: Boolean(nearId), ratio, pinched: s.detector.pinched };

      // discreet feedback: thin ray (hidden in near mode), cursor at the hit / fingertip, brief flash on select
      const color = hoverId ? COLORS.hover : COLORS.idle;
      s.status.origin = s.origin; // live Vector3 references (no per-frame allocation)
      s.status.dir = s.dir;
      s.status.shoulder = s.shoulder;
      s.dir.scaleToRef(RAY_LENGTH, tmp.a);
      const end = hitPoint ?? tmp.end.copyFrom(s.origin).addInPlace(tmp.a);
      s.line.setEnabled(!nearId);
      if (!nearId) {
        s.linePoints[0].copyFrom(s.origin);
        s.linePoints[1].copyFrom(end);
        MeshBuilder.CreateLines(s.line.name, { points: s.linePoints, instance: s.line });
        s.line.color.copyFrom(color);
        s.line.alpha = hoverId ? 0.75 : 0.3;
      }
      const flashing = now < s.flashUntil;
      s.cursor.setEnabled(Boolean(nearId || hitPoint));
      s.cursor.position.copyFrom(nearId ? s.tip : end);
      s.cursor.scaling.setAll(flashing ? 1.8 : s.detector.pinched ? 0.8 : 1);
      s.cursor.material.emissiveColor.copyFrom(flashing ? COLORS.flash : color);
    }
  };
  const observer = scene.onBeforeRenderObservable.add(frame);

  return {
    /** Per-hand interaction status (tests / diagnostics). */
    status: (side) => ({ ...state[side].status }),
    /** How many hand inputs still have Babylon's pointer attached (must be 0). */
    babylonHandPointers: () => {
      const ps = xr.pointerSelection;
      return xr.input.controllers.filter((c) => c.inputSource.hand && ps?._controllers?.[c.uniqueId]).length;
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      SIDES.forEach((side) => {
        state[side].line.dispose();
        state[side].cursor.dispose();
      });
    },
  };
}
