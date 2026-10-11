// Performance HUD (?perf=1, Fase 12): FPS, CPU time of a frame, draw calls and triangles — on the page and
// on a line of the VR panel, so the app can be measured on the real Quest (the emulator renders in
// software). In the headset both eyes are drawn in the same frame: draw calls and triangles are totals.
export function createPerfHud({ scene, engine, getVRPanel }) {
  const el = document.createElement("div");
  el.id = "perfHud";
  el.className = "glass";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  const dc = engine._drawCalls; // Babylon's per-frame draw-call counter (reset here every frame)
  let t0 = 0;
  let cpu = 0;
  let draws = 0;
  let last = 0;
  scene.onBeforeRenderObservable.add(() => {
    t0 = performance.now();
    dc?.fetchNewFrame();
  }, undefined, true);
  scene.onAfterRenderObservable.add(() => {
    dc?.addCount(0, true);
    draws = dc?.current ?? 0;
    cpu = cpu ? cpu * 0.9 + (performance.now() - t0) * 0.1 : performance.now() - t0;
    const now = performance.now();
    if (now - last < 500) return;
    last = now;
    const tri = Math.round(scene.getActiveIndices() / 3 / 1000);
    const text = `${Math.round(engine.getFps())} FPS · CPU ${cpu.toFixed(1)} ms · ${draws} draws · ${tri} mil triângulos`;
    el.textContent = text;
    getVRPanel()?.setDebugText(text);
  });
  return {
    el,
    get text() {
      return el.textContent;
    },
  };
}
