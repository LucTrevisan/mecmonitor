// Wraps the existing simulation (src/simulation.js) as a telemetry provider.
import { startSimulation } from "../simulation.js";

export function simulationProvider({ intervalMs = 1000 } = {}) {
  let stopSim = null;
  return {
    id: "simulation",
    kind: "simulation",
    label: "Simulação",
    start(ctx) {
      ctx.setStatus("online");
      stopSim = startSimulation((s) => {
        const { source, ...values } = s;
        ctx.emit(values);
      }, intervalMs);
    },
    stop() {
      stopSim?.();
      stopSim = null;
    },
  };
}
