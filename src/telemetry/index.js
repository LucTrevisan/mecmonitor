// Chooses the telemetry provider. Default: simulation.
// URL overrides (no rebuild needed):
//   ?source=ws&url=ws://192.168.0.50:81
//   ?source=mqtt&url=wss://broker.example:8884/mqtt&topic=mecmonitor/p01/telemetry
// Broker credentials are NOT read from the URL; set them in src/config/telemetry.js (do not commit secrets).
import { TELEMETRY } from "../config/telemetry.js";
import { mqttProvider } from "./mqttProvider.js";
import { simulationProvider } from "./simulationProvider.js";
import { websocketProvider } from "./websocketProvider.js";

export { createTelemetryService } from "./telemetryService.js";

const SOURCE_ALIASES = { sim: "simulation", simulation: "simulation", ws: "websocket", websocket: "websocket", mqtt: "mqtt" };

export function resolveTelemetryConfig(search = "", defaults = TELEMETRY) {
  const q = new URLSearchParams(search);
  const source = SOURCE_ALIASES[(q.get("source") ?? defaults.source ?? "simulation").toLowerCase()] ?? "simulation";
  if (source === "websocket") return { source, url: q.get("url") ?? defaults.websocket?.url };
  if (source === "mqtt") {
    return {
      source,
      url: q.get("url") ?? defaults.mqtt?.url,
      topic: q.get("topic") ?? defaults.mqtt?.topic,
      username: defaults.mqtt?.username,
      password: defaults.mqtt?.password,
    };
  }
  return { source: "simulation" };
}

export function createProvider(config) {
  if (config.source === "websocket") return websocketProvider(config);
  if (config.source === "mqtt") return mqttProvider(config);
  return simulationProvider();
}
