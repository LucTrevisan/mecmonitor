// Training scenario as a telemetry provider. Its kind is "simulation": every sample is labeled ◐ SIMULAÇÃO
// (never DADOS REAIS), like the default simulation. Values follow the scenario profile from its start.
import { scenarioValue } from "../training/trainingEngine.js";

export function trainingProvider(scenario, { intervalMs = 1000 } = {}) {
  let timer = null;
  return {
    id: "training",
    kind: "simulation",
    label: `Treinamento · cenário ${scenario.id}`,
    start(ctx) {
      ctx.setStatus("online");
      const t0 = Date.now();
      const tick = () => {
        const t = (Date.now() - t0) / 1000;
        const sample = { timestamp: Date.now() };
        for (const [key, p] of Object.entries(scenario.profile)) sample[key] = scenarioValue(p, t);
        ctx.emit(sample);
      };
      tick();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}
