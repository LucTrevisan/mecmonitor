// Visual overrides applied at load time. The GLB is never modified: materials are cloned per part
// (they are shared across many parts in the CAD export) and the original is kept in
// mesh.metadata.originalMaterial for later visualization modes (Raio-X / Térmico).
//   nodes: GLB node names (the node and all of its child meshes are recolored)
//   color: sRGB hex

export const COLOR_OVERRIDES = [
  {
    label: "Carcaça da bomba (voluta, tampa/suporte e caixa do mancal)",
    // "coupling-1" is the casing cover/bracket in the CAD file despite its name.
    nodes: ["casing oficial-1", "coupling-1", "House Bearing-1"],
    color: "#2E8B47",
  },
];
