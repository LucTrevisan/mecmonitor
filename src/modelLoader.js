import { DracoDecoder, ImportMeshAsync, TransformNode, Vector3 } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const BASE = import.meta.env.BASE_URL;
const abs = (p) => new URL(`${BASE}${p}`, window.location.href).href;

// Local Draco decoder (no CDN dependency at runtime). Absolute URLs because the decoder runs in a worker.
DracoDecoder.DefaultConfiguration = {
  wasmUrl: abs("draco/draco_wasm_wrapper_gltf.js"),
  wasmBinaryUrl: abs("draco/draco_decoder_gltf.wasm"),
  fallbackUrl: abs("draco/draco_decoder_gltf.js"),
};

export const MODEL_URL = abs("models/bomba-draco.glb");

/**
 * Loads the pump into a pivot container (never rotate the imported root directly),
 * centers it on the origin and rests its base on y = 0. The part hierarchy is kept intact.
 */
export async function loadPump(scene, onProgress) {
  const cameraBefore = scene.activeCamera;
  const result = await ImportMeshAsync(MODEL_URL, scene, {
    onProgress: (e) => e.lengthComputable && onProgress?.(e.loaded / e.total),
  });

  // The SolidWorks export carries its own orthographic camera; drop it.
  scene.cameras.filter((c) => c !== cameraBefore).forEach((c) => c.dispose());
  scene.activeCamera = cameraBefore;

  const pivot = new TransformNode("pumpPivot", scene);
  const root = result.meshes[0];
  root.setParent(pivot);

  const parts = result.meshes.filter((m) => m.getTotalVertices() > 0);
  const placement = { pivot, parts, root, bounds: null };
  placePump(placement);
  return placement;
}

/** Re-centers the pivot after any rotation change and returns world bounds. */
export function placePump(placement) {
  const { pivot } = placement;
  pivot.position.setAll(0);
  pivot.computeWorldMatrix(true);
  let { min, max } = pivot.getHierarchyBoundingVectors(true);
  const center = min.add(max).scale(0.5);
  pivot.position = new Vector3(-center.x, -min.y, -center.z);
  pivot.computeWorldMatrix(true);
  ({ min, max } = pivot.getHierarchyBoundingVectors(true));
  placement.bounds = { min, max };
  return placement.bounds;
}
