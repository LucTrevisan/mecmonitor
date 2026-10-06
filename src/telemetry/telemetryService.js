// Single source of telemetry for the app. Exactly one provider is active at a time.
//
// Provider contract:
//   {
//     id: string,                          // "simulation" | "websocket" | "mqtt" | ...
//     kind: "simulation" | "realtime",     // decides the SIMULAÇÃO / TEMPO REAL label
//     label: string,
//     start(ctx): void | Promise<void>,    // ctx.emit(sample), ctx.setStatus(connection, detail?)
//     stop(): void,
//   }
// connection: "connecting" | "online" | "offline" | "error"
//
// Every emitted sample is stamped with source = provider.kind by the service itself, so a payload
// can never present itself as real (or simulated) data.

export function createTelemetryService() {
  const sampleListeners = new Set();
  const statusListeners = new Set();
  let provider = null;
  let generation = 0;
  let status = { providerId: null, kind: null, label: "", connection: "offline", detail: "", lastSampleAt: 0 };

  const setStatus = (patch) => {
    status = { ...status, ...patch };
    statusListeners.forEach((fn) => fn(status));
  };

  async function use(next) {
    const gen = ++generation;
    if (provider) {
      try {
        provider.stop();
      } catch (e) {
        console.warn("Telemetria: falha ao parar provider", e);
      }
    }
    provider = next;
    setStatus({ providerId: next.id, kind: next.kind, label: next.label, connection: "connecting", detail: "", lastSampleAt: 0 });

    // Callbacks from a replaced provider are ignored (generation guard).
    const ctx = {
      emit(sample) {
        if (gen !== generation || !sample) return;
        const s = { ...sample, source: next.kind, provider: next.id };
        status.lastSampleAt = s.timestamp;
        if (status.connection !== "online") setStatus({ connection: "online", detail: "" });
        sampleListeners.forEach((fn) => fn(s));
      },
      setStatus(connection, detail = "") {
        if (gen === generation) setStatus({ connection, detail });
      },
    };
    try {
      await next.start(ctx);
    } catch (e) {
      if (gen === generation) setStatus({ connection: "error", detail: String(e?.message ?? e) });
    }
  }

  return {
    use,
    stop() {
      generation++;
      provider?.stop();
      provider = null;
      setStatus({ connection: "offline" });
    },
    onSample(fn) {
      sampleListeners.add(fn);
      return () => sampleListeners.delete(fn);
    },
    onStatus(fn) {
      statusListeners.add(fn);
      fn(status);
      return () => statusListeners.delete(fn);
    },
    get status() {
      return status;
    },
  };
}
