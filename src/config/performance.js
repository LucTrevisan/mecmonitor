// Performance settings for the headset (Fase 12). URL overrides, for testing on the Quest without rebuilding:
//   ?foveation=0..1   fixed foveated rendering (0 = off; the periphery is rendered at lower resolution)
//   ?perf=1           performance HUD (FPS, frame time, draw calls, triangles) on the page and in the VR panel
export const FOVEATION_DEFAULT = 0.5; // moderate: saves GPU fill-rate without blurring the side panels much

export function resolvePerformanceConfig(search = "") {
  const q = new URLSearchParams(search);
  const f = Number(q.get("foveation"));
  return {
    foveation: q.has("foveation") && Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : FOVEATION_DEFAULT,
    hud: q.get("perf") === "1",
  };
}
