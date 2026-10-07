// Visual overrides applied at load time. The GLB is never modified: materials are cloned per part
// (they are shared across many parts in the CAD export) and the original is kept in
// mesh.metadata.originalMaterial for later visualization modes (Raio-X / Térmico).
//   nodes: GLB node names (the node and all of its child meshes are recolored)
//   prefixes: node-name prefixes (every node whose name starts with one of them)
//   color: sRGB hex; metallic / roughness (optional, 0–1): needed when recoloring a metal part

export const COLOR_OVERRIDES = [
  {
    label: "Carcaça da bomba (voluta, tampa/suporte e caixa do mancal)",
    // "coupling-1" is the casing cover/bracket in the CAD file despite its name.
    nodes: ["casing oficial-1", "coupling-1", "House Bearing-1"],
    color: "#2E8B47",
  },
  {
    label: "Tubulação (tubos)",
    prefixes: ["PIPE MASTER", "PIPE part"],
    color: "#2E8B47",
  },
  {
    label: "Tubulação (curvas 90°)",
    // Polished steel in the CAD file: drop metallic so the green matches the painted pipes.
    prefixes: ["Curva 90°"],
    color: "#2E8B47",
    metallic: 0,
    roughness: 0.17,
  },
];
