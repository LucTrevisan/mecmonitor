// Real-time telemetry over a plain WebSocket (e.g. ESP32 running a WebSocket server, or a bridge).
// Each message is a JSON sample; see normalize.js for accepted keys. Reconnects with backoff.
import { normalizeSample } from "./normalize.js";

export function websocketProvider({ url, WebSocketImpl = globalThis.WebSocket, maxBackoffMs = 15000 } = {}) {
  let ws = null;
  let timer = null;
  let stopped = false;
  let backoff = 1000;

  return {
    id: "websocket",
    kind: "realtime",
    label: "WebSocket",
    start(ctx) {
      if (!url) throw new Error("websocketProvider: url não configurada");
      stopped = false;
      const connect = () => {
        ctx.setStatus("connecting", url);
        ws = new WebSocketImpl(url);
        ws.onopen = () => {
          backoff = 1000;
          ctx.setStatus("online", url);
        };
        ws.onmessage = (ev) => {
          const sample = normalizeSample(ev.data);
          if (sample) ctx.emit(sample);
        };
        ws.onclose = () => {
          if (stopped) return;
          ctx.setStatus("offline", `reconectando em ${Math.round(backoff / 1000)} s`);
          timer = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, maxBackoffMs);
        };
        ws.onerror = () => {}; // onclose handles reconnection
      };
      connect();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
      ws = null;
    },
  };
}
