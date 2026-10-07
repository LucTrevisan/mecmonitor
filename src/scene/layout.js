// Lab floor plan derived from the model bounds (pure, unit-tested). Shared by the scenery (scene/lab.js)
// and WebXR (start pose, safe teleport area), so the safety tape, the walls and the walkable area can
// never disagree. Units: meters; bench centered on x/z, floor at y = 0, user's "front" is +z.

export const CLEARANCE = 0.45; // safety perimeter around the bench footprint (floor tape)
export const WALL_GAP = 2.2; // back wall distance behind the bench
export const ROOM_MARGIN = 0.3; // keep teleport targets this far from walls / room edge
export const START_DISTANCE = 1.5; // XR start: this far in front of the bench (m)

export function computeLayout(b, groundSize) {
  const half = groundSize / 2;
  const wallZ = b.min.z - WALL_GAP;
  const center = { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 };
  const tape = { x0: b.min.x - CLEARANCE, x1: b.max.x + CLEARANCE, z0: b.min.z - CLEARANCE, z1: b.max.z + CLEARANCE };
  const room = { x0: -half + ROOM_MARGIN, x1: half - ROOM_MARGIN, z0: wallZ + ROOM_MARGIN, z1: half - ROOM_MARGIN };
  const sx = center.x;
  const sz = b.max.z + START_DISTANCE;
  // Babylon yaw: forward = (sin θ, 0, cos θ) → face the bench center.
  const start = { x: sx, z: sz, yaw: Math.atan2(center.x - sx, center.z - sz) };
  return { wallZ, center, tape, room, start, clearance: CLEARANCE };
}

/** True when a standing user can be at (x, z): inside the room and outside the bench safety tape. */
export function isWalkable(x, z, L) {
  const inRoom = x >= L.room.x0 && x <= L.room.x1 && z >= L.room.z0 && z <= L.room.z1;
  const inTape = x > L.tape.x0 && x < L.tape.x1 && z > L.tape.z0 && z < L.tape.z1;
  return inRoom && !inTape;
}

/** Walkable floor as 4 non-overlapping rectangles around the bench (front, back, left, right). */
export function safeFloorRects(L) {
  const { room: r, tape: t } = L;
  return [
    { name: "front", x0: r.x0, x1: r.x1, z0: t.z1, z1: r.z1 },
    { name: "back", x0: r.x0, x1: r.x1, z0: r.z0, z1: t.z0 },
    { name: "left", x0: r.x0, x1: t.x0, z0: t.z0, z1: t.z1 },
    { name: "right", x0: t.x1, x1: r.x1, z0: t.z0, z1: t.z1 },
  ].filter((q) => q.x1 > q.x0 && q.z1 > q.z0);
}
