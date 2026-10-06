// Keeps the camera target centered in the part of the screen NOT covered by HTML panels, using
// ArcRotateCamera.targetScreenOffset (a view-space shift: target, orbit and zoom are unchanged).
// Active only while a sensor is focused; eases back to 0 when released.

const BAND_WIDTH = 0.6; // elements wider than this fraction of the viewport are horizontal bands
const BAND_HEIGHT = 0.25; // ...as are short elements (header, dock)
const EASE = 0.18;

/** Largest rectangle left free by the overlay panels (header/dock = bands, side panels = columns). */
export function freeRect(elements, W, H) {
  let top = 0;
  let bottom = H;
  let left = 0;
  let right = W;
  for (const el of elements) {
    if (!el || el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const band = r.width >= W * BAND_WIDTH || r.height < H * BAND_HEIGHT;
    if (band) {
      if (r.top + r.height / 2 < H / 2) top = Math.max(top, r.bottom);
      else bottom = Math.min(bottom, r.top);
    } else if (r.left + r.width / 2 < W / 2) left = Math.max(left, r.right);
    else right = Math.min(right, r.left);
  }
  if (bottom - top < 40 || right - left < 40) return { top: 0, bottom: H, left: 0, right: W };
  return { top, bottom, left, right };
}

export function createFraming(scene, camera, getElements) {
  let active = false;

  scene.onBeforeRenderObservable.add(() => {
    let tx = 0;
    let ty = 0;
    if (active) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const r = freeRect(getElements(), W, H);
      const scale = (camera.radius * Math.tan(camera.fov / 2)) / (H / 2); // world units per CSS px
      tx = ((r.left + r.right) / 2 - W / 2) * scale;
      ty = (H / 2 - (r.top + r.bottom) / 2) * scale;
    }
    const o = camera.targetScreenOffset;
    o.x = Math.abs(tx - o.x) < 1e-5 ? tx : o.x + (tx - o.x) * EASE;
    o.y = Math.abs(ty - o.y) < 1e-5 ? ty : o.y + (ty - o.y) * EASE;
  });

  return {
    get active() {
      return active;
    },
    set active(v) {
      active = v;
    },
    reset() {
      active = false;
      camera.targetScreenOffset.set(0, 0);
    },
  };
}
