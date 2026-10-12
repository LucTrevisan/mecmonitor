// AR placement math (Fase 14). Pure (no Babylon), unit-tested. Babylon yaw: forward = (sin θ, 0, cos θ);
// a yaw rotation φ maps (x, z) → (x cos φ + z sin φ, −x sin φ + z cos φ).

/** Yaw of the horizontal direction from p towards q. */
export function yawTowards(p, q) {
  return Math.atan2(q.x - p.x, q.z - p.z);
}

/**
 * New XR camera position that turns the real floor point p into the bench anchor a, with the bench front
 * (+z) facing the camera: position = a + R·(cam − p), R = yaw φ = −yawTowards(p, cam). The camera rotation
 * is then R·rotation (yaw returned). The user keeps the same distance and height relative to the point.
 */
export function placementPose(cam, p, a) {
  const yaw = -yawTowards(p, cam);
  const dx = cam.x - p.x;
  const dz = cam.z - p.z;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: a.x + dx * c + dz * s, y: a.y + cam.y - p.y, z: a.z - dx * s + dz * c, yaw };
}
