// Converts a raw payload (ESP32 JSON) into the internal sample format.
// Accepted keys (case-insensitive): temperature|temp|temperatura|t, vibration|vib|vibracao|vrms|v,
// current|corrente|i|irms, rpm|rotacao|n, timestamp|ts (ms epoch; seconds are also accepted).

const ALIASES = {
  temperature: ["temperature", "temp", "temperatura", "t"],
  vibration: ["vibration", "vib", "vibracao", "vibração", "vrms", "v"],
  current: ["current", "corrente", "i", "irms"],
  rpm: ["rpm", "rotacao", "rotação", "n"],
};

export const FIELDS = Object.keys(ALIASES);

export function normalizeSample(raw, now = Date.now()) {
  if (raw == null) return null;
  let obj = raw;
  if (typeof raw === "string" || raw instanceof Uint8Array) {
    try {
      obj = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object") return null;

  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  const sample = {};
  let count = 0;
  for (const [field, keys] of Object.entries(ALIASES)) {
    const key = keys.find((k) => k in lower);
    if (key === undefined) continue;
    const value = Number(lower[key]);
    if (Number.isFinite(value)) {
      sample[field] = value;
      count++;
    }
  }
  if (!count) return null;

  let ts = Number(lower.timestamp ?? lower.ts);
  if (Number.isFinite(ts) && ts > 0) {
    if (ts < 1e12) ts *= 1000; // seconds → ms
    // Device clocks without NTP are unreliable; fall back to arrival time when far off.
    if (Math.abs(ts - now) > 5 * 60 * 1000) ts = now;
  } else {
    ts = now;
  }
  sample.timestamp = ts;
  return sample;
}
