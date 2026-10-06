// Real-time telemetry over MQTT (browser → broker via WebSockets, e.g. wss://broker:8884/mqtt).
// The mqtt library is loaded lazily, only when this provider is used.
import { normalizeSample } from "./normalize.js";

const defaultConnect = async (url, options) => {
  const mod = await import("mqtt");
  const mqtt = mod.default ?? mod;
  return mqtt.connect(url, options);
};

export function mqttProvider({ url, topic, username, password, connect = defaultConnect } = {}) {
  let client = null;
  let stopped = false;

  return {
    id: "mqtt",
    kind: "realtime",
    label: "MQTT",
    async start(ctx) {
      if (!url || !topic) throw new Error("mqttProvider: url e topic são obrigatórios");
      stopped = false;
      ctx.setStatus("connecting", url);
      client = await connect(url, {
        username,
        password,
        reconnectPeriod: 3000,
        connectTimeout: 10000,
        clientId: `mecmonitor-${Math.random().toString(16).slice(2, 10)}`,
      });
      if (stopped) {
        client.end(true);
        return;
      }
      client.on("connect", () => {
        ctx.setStatus("online", `${url} · ${topic}`);
        client.subscribe(topic, (err) => err && ctx.setStatus("error", `subscribe: ${err.message}`));
      });
      client.on("reconnect", () => ctx.setStatus("connecting", "reconectando"));
      client.on("offline", () => ctx.setStatus("offline", "broker inacessível"));
      client.on("error", (err) => ctx.setStatus("error", err?.message ?? String(err)));
      client.on("message", (_topic, payload) => {
        const sample = normalizeSample(payload);
        if (sample) ctx.emit(sample);
      });
    },
    stop() {
      stopped = true;
      client?.end(true);
      client = null;
    },
  };
}
