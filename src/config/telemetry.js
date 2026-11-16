// Default telemetry source. "simulation" needs no hardware.
// The "ESP32" button in the dock switches to MQTT (choice saved on the device); URL parameters
// (?source=sim|ws|mqtt&url=...&topic=...) override both at runtime.
// Do not commit real broker passwords; anything here ships in the public JS bundle.
//
// MQTT: the ESP32 (sketch mecmonitor_esp32c3) publishes to the public shiftr.io test broker over secure
// WebSocket on port 443 — the only port school/company firewalls usually leave open. "public"/"public"
// are that broker's published test credentials, not a secret. Anyone who knows the topic can read (or
// write) it: fine for sensor readings in a classroom, not for anything private.

export const TELEMETRY = {
  source: "simulation",
  websocket: { url: "" },
  mqtt: {
    url: "wss://public.cloud.shiftr.io",
    topic: "mecmonitor/luctrevisan/p01/telemetry",
    username: "public",
    password: "public",
  },
};

/** localStorage key of the source chosen with the dock button ("simulation" | "mqtt"). */
export const SOURCE_STORAGE_KEY = "mecmonitor-fonte";
