// Board diagnostics (ESP32 sketch publishes JSON to <base>/diag every 30 s): turns it into what the
// header and the dashboard show — weak Wi-Fi, why/when the board last restarted, MPU6050 missing.
// Pure functions (unit-tested in Node).

/** Wi-Fi at or below this RSSI (dBm) is shown as weak. */
export const WEAK_RSSI = -80;

/** Diagnostics topic next to the telemetry topic (…/telemetry → …/diag); null when it can't be derived. */
export function diagTopicFor(topic) {
  return typeof topic === "string" && topic.endsWith("/telemetry") ? topic.slice(0, -"telemetry".length) + "diag" : null;
}

export function parseDiag(payload) {
  try {
    const d = JSON.parse(typeof payload === "string" ? payload : new TextDecoder().decode(payload));
    return d && typeof d === "object" && "uptime_s" in d ? d : null;
  } catch {
    return null;
  }
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function since(s) {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1).replace(".", ",")} h`;
}

/**
 * d: diagnostics JSON; ageMs: how long ago it arrived.
 * → { rssi, weak, mpuMissing, brownout, lines[] }   (lines go to the ESP32 chip tooltip)
 */
export function diagInfo(d, ageMs = 0) {
  if (!d) return null;
  const rssi = num(d.rssi);
  const weak = rssi !== null && rssi <= WEAK_RSSI;
  const modo = d.mpu?.modo;
  const mpuMissing = typeof modo === "string" && modo !== "fifo" && modo !== "direto";
  const reason = typeof d.motivo_reinicio === "string" ? d.motivo_reinicio : "";
  const brownout = /TENS/i.test(reason);
  const up = num(d.uptime_s);
  const lines = [];
  if (rssi !== null) lines.push(`Wi-Fi da placa: ${rssi} dBm${weak ? " (fraco — aproxime do roteador)" : ""}`);
  else lines.push("Wi-Fi da placa: sem sinal no último diagnóstico");
  if (up !== null) lines.push(`Placa ligada há ${since(up + ageMs / 1000)}${reason ? ` · último reinício: ${reason.toLowerCase()}` : ""}`);
  if (brownout) lines.push("Reinício por queda de tensão: troque a fonte/cabo USB (5 V, 2 A, cabo curto)");
  const drops = num(d.quedas_wifi);
  const site = num(d.reconexoes_site);
  if (drops !== null || site !== null) lines.push(`Desde que ligou: ${drops ?? 0} queda(s) de Wi-Fi, ${site ?? 0} conexão(ões) ao site`);
  if (d.queda_wifi?.motivo && d.queda_wifi.motivo !== "nenhuma") lines.push(`Última queda de Wi-Fi: ${d.queda_wifi.motivo}`);
  if (mpuMissing) lines.push("MPU6050 (vibração) não encontrado: fio solto ou mau contato");
  if (d.versao) lines.push(`Programa da placa: v${d.versao}`);
  return { rssi, weak, mpuMissing, brownout, lines };
}
