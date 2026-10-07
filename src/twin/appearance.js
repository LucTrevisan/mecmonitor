// Applies COLOR_OVERRIDES without touching the GLB or the shared materials of other parts.
import { Color3 } from "@babylonjs/core";

function meshesOf(node) {
  const own = typeof node.getTotalVertices === "function" && node.getTotalVertices() > 0 ? [node] : [];
  return own.concat(node.getChildMeshes(false));
}

function targetNodes(scene, o) {
  const byName = (o.nodes ?? []).map((name) => {
    const node = scene.getNodeByName(name);
    if (!node) console.warn(`Cor: nó "${name}" não encontrado no modelo`);
    return node;
  });
  const byPrefix = (o.prefixes ?? []).flatMap((p) => scene.getNodes().filter((n) => n.name.startsWith(p)));
  return [...new Set(byName.concat(byPrefix).filter(Boolean))];
}

export function applyColorOverrides(scene, overrides) {
  const applied = [];
  for (const o of overrides) {
    const linear = Color3.FromHexString(o.color).toLinearSpace();
    const targets = new Set(targetNodes(scene, o).flatMap(meshesOf));

    // Instances share their source mesh's material: recolor the source only when the source and
    // every one of its instances belong to this group, otherwise the color would leak to other parts.
    const meshes = new Set();
    for (const mesh of targets) {
      if (mesh.getClassName() !== "InstancedMesh") {
        meshes.add(mesh);
        continue;
      }
      const src = mesh.sourceMesh;
      if (targets.has(src) && src.instances.every((i) => targets.has(i))) meshes.add(src);
      else console.warn(`Cor: "${mesh.name}" compartilha geometria com peças fora do grupo; mantida`);
    }

    for (const mesh of meshes) {
      if (!mesh.material) continue;
      mesh.metadata = { ...mesh.metadata, originalMaterial: mesh.metadata?.originalMaterial ?? mesh.material };
      const mat = mesh.material.clone(`${mesh.material.name}__${mesh.name}`);
      if ("albedoColor" in mat) mat.albedoColor = linear.clone();
      else if ("diffuseColor" in mat) mat.diffuseColor = linear.clone();
      if (o.metallic !== undefined && "metallic" in mat) mat.metallic = o.metallic;
      mesh.material = mat;
      applied.push(mesh.name, ...(mesh.instances ?? []).map((i) => i.name));
    }
  }
  return applied;
}
