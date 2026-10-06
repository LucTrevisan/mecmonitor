// Applies COLOR_OVERRIDES without touching the GLB or the shared materials of other parts.
import { Color3 } from "@babylonjs/core";

function meshesOf(node) {
  const own = typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0 ? [node] : [];
  return own.concat(node.getChildMeshes(false));
}

export function applyColorOverrides(scene, overrides) {
  const applied = [];
  for (const o of overrides) {
    const linear = Color3.FromHexString(o.color).toLinearSpace();
    for (const name of o.nodes) {
      const node = scene.getNodeByName(name);
      if (!node) {
        console.warn(`Cor: nó "${name}" não encontrado no modelo`);
        continue;
      }
      for (const mesh of meshesOf(node)) {
        // Instances share their source mesh's material; recoloring would leak to other parts.
        if (mesh.getClassName() === "InstancedMesh" || !mesh.material) continue;
        mesh.metadata = { ...mesh.metadata, originalMaterial: mesh.metadata?.originalMaterial ?? mesh.material };
        const mat = mesh.material.clone(`${mesh.material.name}__${mesh.name}`);
        if ("albedoColor" in mat) mat.albedoColor = linear.clone();
        else if ("diffuseColor" in mat) mat.diffuseColor = linear.clone();
        mesh.material = mat;
        applied.push(mesh.name);
      }
    }
  }
  return applied;
}
