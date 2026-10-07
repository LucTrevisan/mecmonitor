// Physical representation of each sensor + an invisible interaction volume around it.
// Bodies are small, real-scale meshes parented to the sensor anchor (they follow the part and never
// touch the GLB). Interaction volumes are larger than the sensor so selection never needs millimetric
// precision (mouse, touch and, later, hands); they are the ONLY pickable sensor geometry.
import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";

export const COLLIDER_RADIUS = 0.06; // m — ~12 cm interaction sphere

function material(scene, name, hex, { metallic = false } = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = metallic ? new Color3(0.6, 0.6, 0.6) : new Color3(0.08, 0.08, 0.08);
  m.specularPower = metallic ? 64 : 16;
  return m;
}

// Anchors sit 1 cm off the mounting surface (see config/sensors.js), so "surface" is local -0.01
// along the mounting normal. Builders return meshes positioned in the anchor's local space.
const BUILDERS = {
  // MPU6050 breakout board lying on the bearing housing.
  mems(scene, id, mats) {
    const pcb = MeshBuilder.CreateBox(`${id}-pcb`, { width: 0.021, height: 0.0016, depth: 0.016 }, scene);
    pcb.position.y = -0.01 + 0.0008;
    pcb.material = mats.pcb;
    const chip = MeshBuilder.CreateBox(`${id}-chip`, { width: 0.004, height: 0.001, depth: 0.004 }, scene);
    chip.position.y = -0.01 + 0.0021;
    chip.material = mats.black;
    const header = MeshBuilder.CreateBox(`${id}-hdr`, { width: 0.019, height: 0.0025, depth: 0.0025 }, scene);
    header.position.set(0, -0.01 + 0.0028, -0.0065);
    header.material = mats.black;
    return [pcb, chip, header];
  },
  // Type-K thermocouple with a hex bayonet boss (MAX6675 converter sits off-board).
  thermocouple(scene, id, mats) {
    const boss = MeshBuilder.CreateCylinder(`${id}-boss`, { diameter: 0.012, height: 0.006, tessellation: 6 }, scene);
    boss.position.y = -0.01 + 0.003;
    boss.material = mats.brass;
    const probe = MeshBuilder.CreateCylinder(`${id}-probe`, { diameter: 0.005, height: 0.03, tessellation: 12 }, scene);
    probe.position.y = -0.01 + 0.006 + 0.015;
    probe.material = mats.steel;
    const cable = MeshBuilder.CreateCylinder(`${id}-lead`, { diameter: 0.004, height: 0.012, tessellation: 8 }, scene);
    cable.position.y = -0.01 + 0.006 + 0.03 + 0.006;
    cable.material = mats.amber;
    return [boss, probe, cable];
  },
  // Split-core current transformer clamped on a motor phase conductor (shown at the panel face).
  "ct-clamp"(scene, id, mats) {
    const cable = MeshBuilder.CreateCylinder(`${id}-cable`, { diameter: 0.008, height: 0.09, tessellation: 12 }, scene);
    cable.material = mats.black;
    const clamp = MeshBuilder.CreateTorus(`${id}-clamp`, { diameter: 0.028, thickness: 0.009, tessellation: 24 }, scene);
    clamp.material = mats.graphite;
    return [cable, clamp];
  },
  // M12 inductive/optical speed sensor on top of the coupling guard, pointing down.
  proximity(scene, id, mats) {
    const bracket = MeshBuilder.CreateBox(`${id}-bracket`, { width: 0.03, height: 0.002, depth: 0.02 }, scene);
    bracket.position.y = -0.01 + 0.001;
    bracket.material = mats.steel;
    const body = MeshBuilder.CreateCylinder(`${id}-body`, { diameter: 0.012, height: 0.04, tessellation: 16 }, scene);
    body.position.y = -0.01 + 0.002 + 0.02;
    body.material = mats.steel;
    const cap = MeshBuilder.CreateCylinder(`${id}-cap`, { diameter: 0.0125, height: 0.006, tessellation: 16 }, scene);
    cap.position.y = -0.01 + 0.002 + 0.04 + 0.003;
    cap.material = mats.amber;
    return [bracket, body, cap];
  },
};

/**
 * @param anchors { [sensorId]: TransformNode } — the hotspot anchors (already parented to the parts)
 * @returns {{ bodies: Record<string, Mesh[]>, colliders: Record<string, Mesh>, idOf(mesh): string|null }}
 */
export function createSensorBodies(scene, sensors, anchors) {
  const mats = {
    pcb: material(scene, "sensorPcb", "#1f3f9a"),
    black: material(scene, "sensorBlack", "#15171a"),
    steel: material(scene, "sensorSteel", "#b9bec5", { metallic: true }),
    brass: material(scene, "sensorBrass", "#b08d3a", { metallic: true }),
    graphite: material(scene, "sensorGraphite", "#2b2f36"),
    amber: material(scene, "sensorAmber", "#e0761a"),
  };
  const colliderMat = new StandardMaterial("sensorColliderMat", scene);
  colliderMat.alpha = 0;

  const bodies = {};
  const colliders = {};
  for (const s of sensors) {
    const anchor = anchors[s.id];
    if (!anchor) continue;
    const build = BUILDERS[s.body];
    bodies[s.id] = (build ? build(scene, s.id, mats) : []).map((m) => {
      m.parent = anchor;
      m.isPickable = false;
      m.metadata = { ...m.metadata, sensorBody: s.id };
      return m;
    });

    const collider = MeshBuilder.CreateSphere(`${s.id}-collider`, { diameter: COLLIDER_RADIUS * 2, segments: 8 }, scene);
    collider.parent = anchor;
    collider.material = colliderMat;
    collider.isVisible = false; // never rendered; picked only with the explicit predicate below
    collider.isPickable = true;
    collider.metadata = { sensorCollider: s.id };
    colliders[s.id] = collider;
  }
  Object.values(mats).forEach((m) => m.freeze());

  return {
    bodies,
    colliders,
    /** Predicate for scene.pick*: only sensor interaction volumes. */
    isCollider: (m) => Boolean(m.metadata?.sensorCollider),
    idOf: (m) => m?.metadata?.sensorCollider ?? null,
  };
}
