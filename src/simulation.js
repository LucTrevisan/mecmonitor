// Minimal simulated signals. These are NOT real readings and must always be labeled "SIMULAÇÃO".
// Etapa 3 will move this behind TelemetryService as simulationProvider.

const SIGNALS = {
  temperature: { value: 52, min: 40, max: 85, step: 0.4, target: 55 }, // °C (MAX6675)
  vibration: { value: 2.1, min: 0.5, max: 12, step: 0.15, target: 2.3 }, // mm/s RMS (MPU6050)
  current: { value: 3.4, min: 0, max: 8, step: 0.08, target: 3.5 }, // A (SCT013)
  rpm: { value: 1750, min: 0, max: 3600, step: 6, target: 1750 }, // rpm
};

function nextValue(s) {
  const drift = (s.target - s.value) * 0.1;
  const noise = (Math.random() * 2 - 1) * s.step;
  s.value = Math.min(s.max, Math.max(s.min, s.value + drift + noise));
  return s.value;
}

export function startSimulation(onSample, intervalMs = 1000) {
  const tick = () =>
    onSample({
      source: "simulation",
      timestamp: Date.now(),
      temperature: nextValue(SIGNALS.temperature),
      vibration: nextValue(SIGNALS.vibration),
      current: nextValue(SIGNALS.current),
      rpm: nextValue(SIGNALS.rpm),
    });
  tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
