// Default telemetry source. "simulation" needs no hardware.
// URL parameters (?source=ws|mqtt&url=...&topic=...) override these values at runtime.
// Do not commit real broker passwords; anything here ships in the public JS bundle.

export const TELEMETRY = {
  source: "simulation",
  websocket: { url: "" },
  mqtt: { url: "", topic: "mecmonitor/p01/telemetry", username: undefined, password: undefined },
};
