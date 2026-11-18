// Unit tests for pure logic modules (no browser). Usage: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { KPIS, KPI_BY_KEY } from "../src/config/kpis.js";
import { classify, evaluate, kpiScore, trend } from "../src/health.js";

const T = KPI_BY_KEY.temperature;
const V = KPI_BY_KEY.vibration;

test("classify: bandas de temperatura", () => {
  assert.equal(classify(45, T), "normal");
  assert.equal(classify(60, T), "normal");
  assert.equal(classify(61.4, T), "alert");
  assert.equal(classify(80, T), "critical");
});

test("classify: vibração segue ISO 10816-3 (2,8 / 4,5 mm/s)", () => {
  assert.equal(classify(2.8, V), "normal");
  assert.equal(classify(3.0, V), "alert");
  assert.equal(classify(4.6, V), "critical");
});

test("KPIs: temperatura, vibração, corrente e nível do óleo (sem RPM)", () => {
  assert.deepEqual(KPIS.map((k) => k.key), ["temperature", "vibration", "current", "oil"]);
});

test("classify: nível do óleo baixo é ruim (alerta < 40 %, crítico < 20 %)", () => {
  const O = KPI_BY_KEY.oil;
  assert.equal(classify(78, O), "normal");
  assert.equal(classify(100, O), "normal");
  assert.equal(classify(35, O), "alert");
  assert.equal(classify(10, O), "critical");
  assert.equal(kpiScore(95, O), 100, "acima da referência não perde pontos");
  assert.equal(kpiScore(40, O), 85);
});

test("kpiScore: 100 na referência, 85 no limite normal, 55 no limite de alerta", () => {
  assert.equal(kpiScore(T.ref, T), 100);
  assert.equal(kpiScore(60, T), 85);
  assert.equal(kpiScore(75, T), 55);
  assert.equal(kpiScore(30, T), 100); // below ref on a one-sided limit
  assert.ok(kpiScore(200, T) >= 0);
});

test("evaluate: amostra nominal → NORMAL com saúde alta", () => {
  const r = evaluate({ temperature: 55, vibration: 2.3, current: 3.5, oil: 78 });
  assert.equal(r.state, "normal");
  assert.ok(r.score >= 80 && r.score <= 100, `score ${r.score}`);
  assert.equal(Object.keys(r.kpis).length, KPIS.length);
});

test("evaluate: estado global = pior KPI", () => {
  assert.equal(evaluate({ temperature: 55, vibration: 3.5, current: 3.5 }).state, "alert");
  assert.equal(evaluate({ temperature: 80, vibration: 3.5, current: 3.5 }).state, "critical");
});

test("evaluate: saúde cai com a degradação", () => {
  const ok = evaluate({ temperature: 50, vibration: 2.0, current: 3.4 }).score;
  const bad = evaluate({ temperature: 70, vibration: 4.0, current: 4.4 }).score;
  assert.ok(bad < ok, `${bad} < ${ok}`);
});

test("evaluate: ignora valores ausentes/inválidos", () => {
  const r = evaluate({ temperature: 50, vibration: NaN });
  assert.deepEqual(Object.keys(r.kpis), ["temperature"]);
  assert.equal(evaluate({}).score, null);
});

test("trend: estável, subindo, caindo e histórico curto", () => {
  assert.equal(trend([1, 2, 3], 0.1).dir, "flat");
  assert.equal(trend(Array(10).fill(5), 0.1).dir, "flat");
  assert.equal(trend([1, 1, 1, 1, 1, 2, 2, 2, 2, 2], 0.1).dir, "up");
  assert.equal(trend([2, 2, 2, 2, 2, 1, 1, 1, 1, 1], 0.1).dir, "down");
});

// ---------- Etapa 3: telemetry ----------
import { EventEmitter } from "node:events";
import { normalizeSample } from "../src/telemetry/normalize.js";
import { createTelemetryService } from "../src/telemetry/telemetryService.js";
import { createProvider, resolveTelemetryConfig } from "../src/telemetry/index.js";
import { TELEMETRY } from "../src/config/telemetry.js";
import { websocketProvider } from "../src/telemetry/websocketProvider.js";
import { mqttProvider } from "../src/telemetry/mqttProvider.js";

const NOW = 1_780_000_000_000;

test("normalize: chaves canônicas, aliases, strings numéricas e JSON", () => {
  assert.deepEqual(normalizeSample({ temperature: 50, vibration: 2, current: 3 }, NOW), { temperature: 50, vibration: 2, current: 3, timestamp: NOW });
  assert.deepEqual(normalizeSample('{"Temp":"61.4","vrms":3.1,"I":4.1,"RPM":1748}', NOW), { temperature: 61.4, vibration: 3.1, current: 4.1, timestamp: NOW }, "RPM do ESP32 é ignorado");
  assert.deepEqual(normalizeSample(new TextEncoder().encode('{"t":40}'), NOW), { temperature: 40, timestamp: NOW });
});

test("normalize: rejeita payload inválido e ignora campos não numéricos", () => {
  assert.equal(normalizeSample("não é json", NOW), null);
  assert.equal(normalizeSample({ foo: 1 }, NOW), null);
  assert.equal(normalizeSample(null, NOW), null);
  assert.deepEqual(normalizeSample({ temp: "abc", corrente: 3.3 }, NOW), { current: 3.3, timestamp: NOW });
  assert.equal(normalizeSample({ rpm: 1700 }, NOW), null, "só RPM: nada a exibir");
});

test("normalize: timestamp em s/ms e relógio do ESP32 fora de sincronia", () => {
  assert.equal(normalizeSample({ t: 1, ts: (NOW - 2000) / 1000 }, NOW).timestamp, NOW - 2000);
  assert.equal(normalizeSample({ t: 1, timestamp: NOW - 1000 }, NOW).timestamp, NOW - 1000);
  assert.equal(normalizeSample({ t: 1, ts: 12345 }, NOW).timestamp, NOW); // boot-relative millis
});

test("config: padrão simulação e overrides via URL", () => {
  assert.deepEqual(resolveTelemetryConfig(""), { source: "simulation" });
  assert.deepEqual(resolveTelemetryConfig("?source=ws&url=ws://esp32:81"), { source: "websocket", url: "ws://esp32:81" });
  const m = resolveTelemetryConfig("?source=mqtt&url=wss://b:8884/mqtt&topic=a/b&user=x&pass=y");
  assert.equal(m.source, "mqtt");
  assert.equal(m.topic, "a/b");
  assert.equal(m.username, TELEMETRY.mqtt.username, "credenciais não vêm da URL (só do config)");
  assert.notEqual(m.username, "x");
  assert.deepEqual(resolveTelemetryConfig("?source=desconhecido"), { source: "simulation" });
  assert.equal(createProvider({ source: "simulation" }).kind, "simulation");
  assert.equal(createProvider({ source: "websocket", url: "ws://x" }).kind, "realtime");
  assert.equal(createProvider({ source: "mqtt", url: "x", topic: "y" }).kind, "realtime");
});

test("config: botão ESP32 salva a fonte; a URL ainda manda", () => {
  const esp = resolveTelemetryConfig("", TELEMETRY, "mqtt");
  assert.deepEqual([esp.source, esp.url, esp.topic], ["mqtt", "wss://public.cloud.shiftr.io", "mecmonitor/luctrevisan/p01/telemetry"]);
  assert.equal(esp.url.startsWith("wss://"), true, "site em HTTPS só abre wss://");
  assert.equal(resolveTelemetryConfig("", TELEMETRY, "simulation").source, "simulation");
  assert.equal(resolveTelemetryConfig("?source=sim", TELEMETRY, "mqtt").source, "simulation", "?source= vence o salvo");
  assert.equal(resolveTelemetryConfig("", TELEMETRY, null).source, "simulation", "padrão continua simulação");
});

test("normalize: payload do ESP32 com nível do óleo; null é ignorado", () => {
  assert.deepEqual(normalizeSample('{"temp":54.2,"i":3.48,"vrms":1.96,"nivel":71}', NOW), { temperature: 54.2, current: 3.48, vibration: 1.96, oil: 71, timestamp: NOW });
  assert.deepEqual(normalizeSample({ temp: null, i: 2, nivel_pct: "" }, NOW), { current: 2, timestamp: NOW }, "null não vira 0");
  assert.equal(normalizeSample({ temp: null }, NOW), null);
});

function fakeProvider(kind, id = kind) {
  return { id, kind, label: id, ctx: null, stopped: false, start(ctx) { this.ctx = ctx; }, stop() { this.stopped = true; } };
}

test("service: carimba a origem pelo provider (payload não pode se passar por real)", async () => {
  const svc = createTelemetryService();
  const got = [];
  svc.onSample((s) => got.push(s));
  const sim = fakeProvider("simulation");
  await svc.use(sim);
  sim.ctx.emit({ temperature: 50, timestamp: NOW, source: "realtime" });
  assert.equal(got[0].source, "simulation");
  assert.equal(svc.status.connection, "online");
});

test("service: troca de provider para o anterior e ignora callbacks dele", async () => {
  const svc = createTelemetryService();
  const got = [];
  const statuses = [];
  svc.onSample((s) => got.push(s));
  svc.onStatus((s) => statuses.push(`${s.providerId}:${s.connection}`));
  const a = fakeProvider("simulation", "a");
  const b = fakeProvider("realtime", "b");
  await svc.use(a);
  await svc.use(b);
  assert.ok(a.stopped);
  a.ctx.emit({ current: 1, timestamp: NOW });
  a.ctx.setStatus("error");
  assert.equal(got.length, 0);
  b.ctx.emit({ current: 2, timestamp: NOW });
  assert.equal(got[0].source, "realtime");
  assert.equal(got[0].provider, "b");
  assert.ok(statuses.includes("b:connecting") && statuses.at(-1) === "b:online", statuses.join());
});

test("service: erro no start vira status error", async () => {
  const svc = createTelemetryService();
  await svc.use({ id: "x", kind: "realtime", label: "x", start() { throw new Error("falhou"); }, stop() {} });
  assert.equal(svc.status.connection, "error");
  assert.match(svc.status.detail, /falhou/);
});

test("simulationProvider: emite amostras como simulação", async () => {
  const svc = createTelemetryService();
  const got = [];
  svc.onSample((s) => got.push(s));
  await svc.use(createProvider({ source: "simulation" }));
  svc.stop();
  assert.equal(got.length, 1);
  assert.equal(got[0].source, "simulation");
  assert.ok(["temperature", "vibration", "current"].every((k) => Number.isFinite(got[0][k])));
  assert.equal("rpm" in got[0], false, "simulação sem RPM");
});

test("websocketProvider: conecta, recebe, normaliza e reconecta", async () => {
  const sockets = [];
  class FakeWS { constructor(url) { this.url = url; sockets.push(this); } close() { this.closed = true; } }
  const svc = createTelemetryService();
  const got = [];
  svc.onSample((s) => got.push(s));
  await svc.use(websocketProvider({ url: "ws://esp32:81", WebSocketImpl: FakeWS, maxBackoffMs: 10 }));
  assert.equal(svc.status.connection, "connecting");
  sockets[0].onopen();
  assert.equal(svc.status.connection, "online");
  sockets[0].onmessage({ data: '{"temp":61.4,"vib":3.2}' });
  sockets[0].onmessage({ data: "lixo" });
  assert.equal(got.length, 1);
  assert.equal(got[0].temperature, 61.4);
  assert.equal(got[0].source, "realtime");
  sockets[0].onclose();
  assert.equal(svc.status.connection, "offline");
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(sockets.length, 2, "reconectou");
  svc.stop();
  assert.ok(sockets[1].closed);
});

test("mqttProvider: conecta, assina o tópico e normaliza mensagens", async () => {
  const client = new EventEmitter();
  client.subscribe = (topic, cb) => { client.subscribed = topic; cb(null); };
  client.end = () => { client.ended = true; };
  let opts;
  const svc = createTelemetryService();
  const got = [];
  svc.onSample((s) => got.push(s));
  await svc.use(mqttProvider({ url: "wss://b/mqtt", topic: "mecmonitor/p01/telemetry", username: "u", connect: async (url, o) => { opts = o; return client; } }));
  assert.equal(opts.username, "u");
  client.emit("connect");
  assert.equal(client.subscribed, "mecmonitor/p01/telemetry");
  assert.equal(svc.status.connection, "online");
  client.emit("message", "mecmonitor/p01/telemetry", new TextEncoder().encode('{"corrente":4.1,"rpm":1745}'));
  assert.deepEqual([got[0].current, got[0].rpm, got[0].source], [4.1, undefined, "realtime"]);
  client.emit("offline");
  assert.equal(svc.status.connection, "offline");
  svc.stop();
  assert.ok(client.ended);
});

test("mqttProvider: exige url e tópico", async () => {
  const svc = createTelemetryService();
  await svc.use(mqttProvider({ url: "", topic: "" }));
  assert.equal(svc.status.connection, "error");
});

// ---------- Fase 3 (plano XR): estados, SEM DADOS por KPI, tendência % ----------
import { evaluateLatest } from "../src/health.js";
import { STATES, stateIcon, trendText } from "../src/ui/states.js";

test("trend: variação percentual em relação à janela anterior", () => {
  const t = trend([2, 2, 2, 2, 2, 2.1, 2.1, 2.1, 2.1, 2.1], 0.05);
  assert.equal(t.dir, "up");
  assert.ok(Math.abs(t.pct - 5) < 1e-9, String(t.pct));
  assert.equal(trend([0, 0, 0, 0, 0, 1, 1, 1, 1, 1], 0.1).pct, null, "base ~0 → sem %");
});

test("trendText: ↑/↓ com %, estável e base zero", () => {
  assert.equal(trendText({ dir: "up", delta: 0.1, pct: 4.2 }), "↑ +4%");
  assert.equal(trendText({ dir: "down", delta: -0.01, pct: -0.4 }), "↓ −0,4%");
  assert.equal(trendText({ dir: "flat", delta: 0, pct: 0 }), "→ estável");
  assert.equal(trendText({ dir: "up", delta: 1, pct: null }, 1), "↑ +1.0");
  assert.equal(trendText(null), "→ estável");
});

test("evaluateLatest: KPI sem leitura recente vira SEM DADOS sem afetar os demais", () => {
  const now = 100_000;
  const latest = {
    temperature: { value: 61.4, at: now - 1000 },
    vibration: { value: 2.0, at: now - 9000 }, // stale
    current: { value: 3.4, at: now - 500 },
  };
  const r = evaluateLatest(latest, now, 5000);
  assert.equal(r.kpis.temperature.state, "alert");
  assert.equal(r.kpis.vibration.state, "nodata");
  assert.equal(r.kpis.vibration.value, 2.0, "mantém o último valor para exibição esmaecida");
  assert.equal(r.kpis.rpm, undefined, "RPM não é mais um KPI");
  assert.equal(r.state, "alert", "estado global usa apenas KPIs com dados recentes");
});

test("evaluateLatest: nenhum dado recente → estado global SEM DADOS e saúde nula", () => {
  const r = evaluateLatest({ temperature: { value: 50, at: 0 } }, 10_000, 5000);
  assert.equal(r.state, "nodata");
  assert.equal(r.score, null);
  assert.equal(evaluateLatest({}, 0, 5000).state, "nodata");
});

test("estados: cada um tem ícone, texto e cor distintos", () => {
  const keys = ["normal", "alert", "critical", "nodata"];
  assert.deepEqual(keys.map((k) => STATES[k].label), ["NORMAL", "ALERTA", "CRÍTICO", "SEM DADOS"]);
  assert.equal(new Set(keys.map((k) => STATES[k].glyph)).size, 4);
  assert.equal(new Set(keys.map((k) => STATES[k].color)).size, 4);
  assert.equal(new Set(keys.map((k) => stateIcon(k))).size, 4);
});

// ---------- Fase 6 (plano XR): planta do laboratório, área segura e pose inicial ----------
import { computeLayout, isWalkable, safeFloorRects } from "../src/scene/layout.js";

// Bounds of the bench as loaded (meters): 1.758 × 1.853 × 1.003, centered, base on y = 0.
const BENCH = { min: { x: -0.879, y: 0, z: -0.5015 }, max: { x: 0.879, y: 1.853, z: 0.5015 } };
const L = computeLayout(BENCH); // real room: 6 × 5 m

test("layout: pose inicial em frente à bancada, olhando para ela, fora da faixa de segurança", () => {
  assert.ok(Math.abs(L.start.x) < 1e-9);
  assert.ok(Math.abs(L.start.z - (0.5015 + 1.5)) < 1e-9);
  assert.ok(Math.abs(Math.abs(L.start.yaw) - Math.PI) < 1e-9, "olhando para -z (bancada)");
  assert.ok(isWalkable(L.start.x, L.start.z, L));
});

test("layout: não se pode ficar dentro da bancada nem atrás da parede", () => {
  assert.equal(isWalkable(0, 0, L), false, "centro da bomba");
  assert.equal(isWalkable(0.3, 0.2, L), false, "sobre a bancada");
  assert.equal(isWalkable(0, 0.5015 + 0.2, L), false, "dentro da faixa zebrada");
  assert.equal(isWalkable(0, L.wallZ - 0.1, L), false, "atrás da parede");
  assert.equal(isWalkable(6, 1, L), false, "fora da sala");
  assert.equal(isWalkable(-2, -1.2, L), true, "corredor atrás da bancada");
});

test("layout: retângulos do piso seguro cobrem só área caminhável e não se sobrepõem", () => {
  const rects = safeFloorRects(L);
  assert.deepEqual(rects.map((r) => r.name), ["front", "back", "left", "right"]);
  for (const r of rects) {
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    assert.ok(isWalkable(cx, cz, L), `${r.name} caminhável`);
  }
  const area = rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  const room = (L.room.x1 - L.room.x0) * (L.room.z1 - L.room.z0);
  const tape = (L.tape.x1 - L.tape.x0) * (L.tape.z1 - L.tape.z0);
  assert.ok(Math.abs(area - (room - tape)) < 1e-6, "sala − faixa da bancada");
});

// ---------- Andar no VR (direcional do controle esquerdo) ----------
import { DEADZONE, WALK_SPEED, walkStep } from "../src/xr/walk.js";

test("VR andar: para frente na direção do olhar, de lado, e parado dentro da folga", () => {
  const p = { x: L.start.x, z: L.start.z }; // olhando para a bancada (-z)
  const f = { x: 0, z: -1 };
  const a = walkStep(p, f, { x: 0, y: -1 }, 0.02, L);
  assert.ok(Math.abs(a.x - p.x) < 1e-9 && Math.abs(a.z - (p.z - WALK_SPEED * 0.02)) < 1e-9, "frente = -z");
  const b = walkStep(p, f, { x: 1, y: 0 }, 0.02, L);
  assert.ok(Math.abs(b.x - (p.x - WALK_SPEED * 0.02)) < 1e-9 && Math.abs(b.z - p.z) < 1e-9, "direita de quem olha para -z = -x");
  const back = walkStep(p, f, { x: 0, y: 1 }, 0.02, L);
  assert.ok(back.z > p.z, "para trás");
  assert.equal(walkStep(p, f, { x: 0.05, y: -DEADZONE * 0.9 }, 0.02, L), null, "folga do direcional");
  const d = walkStep(p, f, { x: 0.7071, y: -0.7071 }, 0.02, L);
  assert.ok(Math.abs(Math.hypot(d.x - p.x, d.z - p.z) - WALK_SPEED * 0.02) < 1e-6, "diagonal não é mais rápida");
  const lag = walkStep(p, f, { x: 0, y: -1 }, 2, L);
  assert.ok(Math.abs(p.z - lag.z - WALK_SPEED * 0.05) < 1e-9, "quadro travado não dá salto");
});

test("VR andar: não entra na faixa da bancada nem passa da parede; encostou, desliza", () => {
  const f = { x: 0, z: -1 };
  let p = { x: 0.3, z: L.start.z };
  for (let i = 0; i < 500; i++) p = walkStep(p, f, { x: 0, y: -1 }, 0.02, L) ?? p;
  assert.ok(isWalkable(p.x, p.z, L) && p.z >= L.tape.z1 && p.z - L.tape.z1 < 0.03, "para na fita da frente");
  const s = walkStep(p, f, { x: -0.6, y: -0.8 }, 0.02, L);
  assert.ok(s && s.z === p.z && s.x > p.x, "na diagonal desliza ao longo da fita");
  let w = { x: 0, z: L.start.z };
  for (let i = 0; i < 500; i++) w = walkStep(w, { x: 0, z: 1 }, { x: 0, y: -1 }, 0.02, L) ?? w;
  assert.ok(isWalkable(w.x, w.z, L) && L.room.z1 - w.z < 0.03, "para antes da parede da frente");
  // inclinado de verdade sobre a fita (fora do piso livre): só sai, não entra mais
  const inside = { x: 0, z: L.tape.z1 - 0.05 };
  assert.equal(walkStep(inside, f, { x: 0, y: -1 }, 0.02, L), null, "não avança para a bancada");
  assert.ok(walkStep(inside, f, { x: 0, y: 1 }, 0.02, L).z > inside.z, "pode recuar");
});

// ---------- Cenário SENAI: faixa de mobiliário junto à parede de fundo ----------
test("layout: faixa da bancada de ajustagem e do extintor não é caminhável (nem alvo de teleporte)", () => {
  assert.ok(L.propsEdgeZ > L.wallZ && L.room.z0 > L.propsEdgeZ, "sala começa depois da faixa de móveis");
  assert.equal(isWalkable(2, L.wallZ + 0.35, L), false, "sobre a bancada de ajustagem");
  assert.equal(isWalkable(-0.75, L.wallZ + 0.35, L), false, "sobre a marcação do extintor");
  assert.ok(safeFloorRects(L).every((r) => r.z0 >= L.room.z0 - 1e-9), "nenhum piso seguro na faixa de móveis");
  assert.equal(isWalkable(-2, -1.2, L), true, "corredor atrás da bomba continua livre");
});

// ---------- Fase 8 (plano XR): pinça robusta e filtragem ----------
import { createPinchDetector, pinchRatio, PINCH_EVENTS as PE } from "../src/interaction/pinch.js";
import { createOneEuro } from "../src/interaction/oneEuro.js";

const P = (x, y, z) => ({ x, y, z });

test("pinça: razão relativa à palma (mesma pinça em mão pequena e grande)", () => {
  const small = pinchRatio(P(0, 0, 0), P(0.02, 0, 0), P(0, 0, 0), P(0, 0.08, 0));
  const big = pinchRatio(P(0, 0, 0), P(0.025, 0, 0), P(0, 0, 0), P(0, 0.1, 0));
  assert.ok(Math.abs(small - big) < 1e-9, `${small} vs ${big}`);
  assert.ok(Number.isNaN(pinchRatio(null, P(0, 0, 0), P(0, 0, 0), P(0, 1, 0))), "junta ausente → NaN");
});

test("pinça: estados OPEN → PINCH_START → PINCH → PINCH_END, um único START por pinça", () => {
  const d = createPinchDetector({ debounceMs: 40, cooldownMs: 250 });
  const seq = [];
  let t = 0;
  const feed = (r, n = 1) => { for (let i = 0; i < n; i++) { seq.push(d.update(r, t)); t += 16; } };
  feed(0.8, 3); // open
  feed(0.1, 10); // close and hold
  feed(0.8, 2); // release
  assert.equal(seq.filter((e) => e === PE.START).length, 1, "segurar não dispara de novo");
  assert.equal(seq.filter((e) => e === PE.END).length, 1);
  const iStart = seq.indexOf(PE.START);
  assert.ok(iStart >= 5, "debounce de ~40 ms antes do START");
  assert.equal(seq[iStart + 1], PE.HOLD);
});

test("pinça: histerese não oscila na fronteira", () => {
  const d = createPinchDetector({ debounceMs: 0, cooldownMs: 0 });
  let t = 0;
  assert.equal(d.update(0.2, (t += 16)), PE.START);
  // noise around the start threshold while pinched: stays PINCH (needs > 0.4 to release)
  for (const r of [0.26, 0.24, 0.3, 0.35, 0.27]) assert.equal(d.update(r, (t += 16)), PE.HOLD);
  assert.equal(d.update(0.45, (t += 16)), PE.END);
});

test("pinça: pico isolado de tracking não clica (debounce) e cooldown evita duplo clique", () => {
  const d = createPinchDetector({ debounceMs: 40, cooldownMs: 250 });
  let t = 0;
  d.update(0.8, t);
  assert.equal(d.update(0.1, (t += 16)), PE.OPEN, "1 frame fechado não basta");
  assert.equal(d.update(0.8, (t += 16)), PE.OPEN);
  for (let i = 0; i < 5; i++) d.update(0.1, (t += 16));
  assert.ok(d.pinched);
  assert.equal(d.update(0.8, (t += 16)), PE.END);
  // immediate re-pinch inside the cooldown window: no START
  const events = [];
  for (let i = 0; i < 8; i++) events.push(d.update(0.1, (t += 16)));
  assert.ok(!events.includes(PE.START), "cooldown de 250 ms");
  for (let i = 0; i < 12; i++) events.push(d.update(0.1, (t += 16)));
  assert.ok(events.includes(PE.START), "depois do cooldown volta a funcionar");
});

test("pinça: perda de tracking solta a pinça com PINCH_END e nunca inicia", () => {
  const d = createPinchDetector({ debounceMs: 0, cooldownMs: 0 });
  assert.equal(d.update(0.1, 0), PE.START);
  assert.equal(d.update(NaN, 16), PE.END);
  assert.equal(d.update(NaN, 32), PE.OPEN);
});

test("One Euro: reduz tremor parado e acompanha movimento rápido com pouco atraso", () => {
  const f = createOneEuro({ minCutoff: 1.5, beta: 6 });
  let t = 0;
  const outs = [];
  for (let i = 0; i < 120; i++) outs.push(f.filter(0.5 + (i % 2 ? 0.004 : -0.004), (t += 1 / 72)));
  const jitter = Math.max(...outs.slice(60)) - Math.min(...outs.slice(60));
  assert.ok(jitter < 0.008 * 0.3, `tremor 8 mm → ${(jitter * 1000).toFixed(2)} mm`);
  const g = createOneEuro({ minCutoff: 1.5, beta: 6 });
  let x = 0;
  let y = 0;
  t = 0;
  for (let i = 0; i < 36; i++) y = g.filter((x += 1 / 72), (t += 1 / 72)); // 1 m/s for 0.5 s
  assert.ok(x - y < 0.03, `atraso a 1 m/s: ${((x - y) * 1000).toFixed(1)} mm`);
});

import { createInteractionManager } from "../src/interaction/interactionManager.js";

test("InteractionManager: mesma ação de negócio para mouse, toque, controle e mão", () => {
  const m = createInteractionManager();
  const calls = [];
  m.addTarget({ id: "vib", kind: "sensor", onSelect: (src) => calls.push(src) });
  for (const src of ["mouse", "touch", "xr-pointer-1", "hand-right"]) assert.equal(m.select("vib", src), true);
  assert.deepEqual(calls, ["mouse", "touch", "xr-pointer-1", "hand-right"]);
  assert.equal(m.select("nao-existe", "mouse"), false);
  assert.deepEqual(m.log.map((e) => e.source), calls);
});

test("InteractionManager: hover por fonte, alvo destacado enquanto qualquer fonte aponta", () => {
  const m = createInteractionManager();
  const states = [];
  m.addTarget({ id: "t01", onHover: (on) => states.push(on) });
  m.hover("t01", "hand-left");
  m.hover("t01", "hand-right");
  m.hover(null, "hand-left");
  assert.equal(m.isHovered("t01"), true, "a mão direita ainda aponta");
  m.hover(null, "hand-right");
  assert.equal(m.isHovered("t01"), false);
  assert.deepEqual(states, [true, true, true, false]);
  m.hover("desconhecido", "mouse");
  assert.equal(m.hoveredBy("mouse"), null);
});

// ---------- Fase 10: escala térmica (modo TÉRMICO, ligado ao T-01) ----------
import { THERMAL } from "../src/config/viewModes.js";
import { legendPosition, regionTemperature, thermalColor, thermalLevel } from "../src/twin/thermalScale.js";

test("escala térmica: BAIXA / NORMAL / ELEVADA / CRÍTICA coerentes com os limites do KPI de temperatura", () => {
  const lv = (t) => thermalLevel(t, THERMAL.levels)?.label;
  assert.equal(lv(30), "BAIXA");
  assert.equal(lv(40), "BAIXA");
  assert.equal(lv(40.1), "NORMAL");
  assert.equal(lv(60), "NORMAL");
  assert.equal(lv(60.1), "ELEVADA");
  assert.equal(lv(75), "ELEVADA");
  assert.equal(lv(75.1), "CRÍTICA");
  assert.equal(lv(120), "CRÍTICA");
  assert.equal(thermalLevel(null, THERMAL.levels), null, "sem dado não tem nível");
  assert.equal(thermalLevel(NaN, THERMAL.levels), null);
  // the scale follows the KPI limits (never disagrees with the dashboard)
  const T = KPI_BY_KEY.temperature;
  for (const [t, kpiState, level] of [[59.9, "normal", "NORMAL"], [70, "alert", "ELEVADA"], [80, "critical", "CRÍTICA"]]) {
    assert.equal(classify(t, T), kpiState);
    assert.equal(lv(t), level);
  }
});

test("escala térmica: cor contínua (gradual), exata nas paradas e limitada nas pontas", () => {
  const hex = (c) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
  for (const [t, c] of THERMAL.stops) assert.equal(hex(thermalColor(t, THERMAL.stops)), c);
  assert.equal(hex(thermalColor(-10, THERMAL.stops)), THERMAL.stops[0][1]);
  assert.equal(hex(thermalColor(200, THERMAL.stops)), THERMAL.stops.at(-1)[1]);
  // gradual: a small change in temperature never makes a big jump in color
  let prev = thermalColor(20, THERMAL.stops);
  for (let t = 20.5; t <= 95; t += 0.5) {
    const c = thermalColor(t, THERMAL.stops);
    assert.ok(Math.max(...c.map((v, i) => Math.abs(v - prev[i]))) < 0.05, `salto de cor em ${t} °C`);
    prev = c;
  }
  // hotter = redder (red channel grows and blue falls from NORMAL to CRÍTICA)
  const [r50, , b50] = thermalColor(50, THERMAL.stops);
  const [r85, , b85] = thermalColor(85, THERMAL.stops);
  assert.ok(r85 > r50 && b85 < b50);
});

test("escala térmica: região mais quente no T-01, decaindo com a distância, nunca acima da leitura", () => {
  const { ambient, falloff } = THERMAL;
  assert.equal(regionTemperature(70, 0, ambient, falloff), 70);
  let prev = 70;
  for (let d = 0.02; d <= 0.5; d += 0.02) {
    const t = regionTemperature(70, d, ambient, falloff);
    assert.ok(t < prev && t >= ambient, `d=${d.toFixed(2)} → ${t.toFixed(1)}`);
    prev = t;
  }
  assert.ok(regionTemperature(70, 0.2, ambient, falloff) > 55, "gradiente suave na caixa do mancal");
  assert.equal(legendPosition(25, THERMAL.ticks), 0);
  assert.equal(legendPosition(90, THERMAL.ticks), 1);
  assert.equal(legendPosition(57.5, THERMAL.ticks), 0.5);
  assert.equal(legendPosition(150, THERMAL.ticks), 1);
});

// ---------- Fase 11: modo treinamento ----------
import { createTrainingEngine, scenarioValue } from "../src/training/trainingEngine.js";
import { SCENARIOS, TRAINING_STEPS } from "../src/config/training.js";

const READINGS = { temperature: { value: 70, state: "alert" }, vibration: { value: 2.1, state: "normal" }, current: { value: 3.4, state: "normal" } };
function walkTo(e, stepId) {
  const order = TRAINING_STEPS.map((s) => s.id);
  while (e.state.step.id !== stepId) {
    const id = e.state.step.id;
    if (id === "inspection") e.state.checklist.forEach((c, i) => !c.done && e.toggleCheck(i));
    if (id === "location") ["max6675", "mpu6050", "sct013"].forEach((s) => e.sensorLocated(s));
    if (id === "reading") e.recordReadings(READINGS);
    if (["anomaly", "diagnosis", "action"].includes(id)) e.answer(e.state.options[0].id);
    assert.ok(e.next(), `avançar de ${id}`);
    assert.ok(order.indexOf(e.state.step.id) > order.indexOf(id));
  }
}

test("treinamento: 7 etapas na ordem pedida; cada etapa só libera a próxima quando concluída", () => {
  assert.deepEqual(TRAINING_STEPS.map((s) => s.title), ["INSPEÇÃO", "LOCALIZAÇÃO DOS SENSORES", "LEITURA DOS DADOS", "IDENTIFICAÇÃO DE ANOMALIA", "DIAGNÓSTICO", "AÇÃO RECOMENDADA", "FEEDBACK"]);
  const e = createTrainingEngine();
  assert.equal(e.next(), false, "sem cenário não avança");
  e.start("B");
  assert.equal(e.next(), false, "inspeção incompleta");
  e.toggleCheck(0);
  e.toggleCheck(1);
  assert.equal(e.next(), false, "falta um item");
  e.toggleCheck(2);
  assert.ok(e.next());
  e.sensorLocated("max6675");
  e.sensorLocated("mpu6050");
  assert.equal(e.next(), false, "falta localizar I-01");
  e.sensorLocated("sct013");
  assert.ok(e.next());
  assert.equal(e.next(), false, "leituras não registradas");
  e.recordReadings(READINGS);
  assert.ok(e.next());
  assert.equal(e.next(), false, "sem resposta não avança");
});

test("treinamento: localização só conta na etapa certa e só para T-01, VIB-01 e I-01", () => {
  const e = createTrainingEngine();
  e.start("A");
  e.sensorLocated("max6675"); // still in INSPEÇÃO: ignored
  walkTo(e, "location");
  assert.deepEqual(e.state.located.filter((l) => l.done), []);
  e.sensorLocated("rpm"); // removed sensor: ignored
  e.sensorLocated("vr:exit"); // a VR button selection
  assert.equal(e.state.located.filter((l) => l.done).length, 0);
  e.sensorLocated("mpu6050");
  e.sensorLocated("mpu6050");
  assert.deepEqual(e.state.located.map((l) => l.done), [false, true, false]);
});

test("treinamento: a resposta e o nome do cenário só aparecem no FEEDBACK", () => {
  for (const sc of SCENARIOS) {
    const e = createTrainingEngine();
    e.start(sc.id);
    for (const id of ["inspection", "location", "reading", "anomaly", "diagnosis", "action"]) {
      walkTo(e, id);
      const v = JSON.stringify(e.state);
      assert.ok(!v.includes(sc.title) && !v.includes(sc.analysis.compatible) && e.state.result === null, `${sc.id}: revelado em ${id}`);
      assert.ok(!v.includes('"correct"'), `${sc.id}: gabarito exposto em ${id}`);
    }
    walkTo(e, "feedback");
    assert.equal(e.state.scenario.title, sc.title);
    assert.ok(e.state.result.items.every((i) => i.correctText));
  }
});

test("treinamento: pontuação no FEEDBACK, voltar antes do fim, repetir e sair", () => {
  const e = createTrainingEngine({ now: (() => { let t = 0; return () => (t += 30_000); })() });
  e.start("C"); // vibração elevada
  walkTo(e, "anomaly");
  e.answer("vibration");
  e.next();
  e.answer("lubrication"); // wrong on purpose
  assert.ok(e.back());
  assert.equal(e.state.step.id, "anomaly");
  assert.equal(e.state.answer, "vibration", "voltar mantém a resposta");
  e.next();
  e.answer("unbalance");
  e.next();
  e.answer("align");
  e.next();
  const r = e.state.result;
  assert.equal(r.score, 3);
  assert.equal(r.total, 3);
  assert.ok(r.durationS > 0);
  assert.equal(e.back(), false, "no FEEDBACK não volta");
  e.restart();
  assert.equal(e.state.step.id, "inspection");
  assert.equal(e.state.scenario.id, "C");
  assert.equal(e.state.answer, null);
  e.exit();
  assert.equal(e.state.active, false);
});

test("treinamento: cenário aleatório usa o sorteio; perfis só com grandezas conhecidas e ruído limitado", () => {
  const e = createTrainingEngine({ random: () => 0.99 });
  assert.equal(e.start("random"), SCENARIOS.at(-1).id);
  assert.equal(createTrainingEngine().start("X"), null, "cenário inexistente");
  for (const sc of SCENARIOS) {
    assert.deepEqual(Object.keys(sc.profile).sort(), ["current", "oil", "temperature", "vibration"]);
    for (const p of Object.values(sc.profile)) {
      assert.equal(scenarioValue(p, 0, () => 0.5), p.from);
      assert.equal(scenarioValue(p, 1e6, () => 0.5), p.to);
      const v = scenarioValue(p, 1e6, () => 0.999);
      assert.ok(Math.abs(v - p.to) <= (p.noise ?? 0) + 1e-9);
    }
  }
  // the anomaly of each scenario really crosses its KPI's normal limit by the end
  for (const sc of SCENARIOS) {
    const k = sc.answer.anomaly;
    if (k === "none") Object.entries(sc.profile).forEach(([key, p]) => assert.equal(classify(p.to, KPI_BY_KEY[key]), "normal", `${sc.id} ${key}`));
    else assert.notEqual(classify(sc.profile[k].to, KPI_BY_KEY[k]), "normal", `${sc.id}: ${k} deveria sair do normal`);
  }
});

// ---------- Fase 12: desempenho ----------
import { FOVEATION_DEFAULT, resolvePerformanceConfig } from "../src/config/performance.js";

test("desempenho: foveação moderada por padrão, ajustável e limitada pela URL; HUD só com ?perf=1", () => {
  assert.deepEqual(resolvePerformanceConfig(""), { foveation: FOVEATION_DEFAULT, hud: false });
  assert.equal(resolvePerformanceConfig("?foveation=0").foveation, 0);
  assert.equal(resolvePerformanceConfig("?foveation=1").foveation, 1);
  assert.equal(resolvePerformanceConfig("?foveation=3").foveation, 1);
  assert.equal(resolvePerformanceConfig("?foveation=-2").foveation, 0);
  assert.equal(resolvePerformanceConfig("?foveation=abc").foveation, FOVEATION_DEFAULT);
  assert.equal(resolvePerformanceConfig("?perf=1").hud, true);
  assert.equal(resolvePerformanceConfig("?perf=0").hud, false);
});

// ---------- Fase 14: realidade aumentada (posicionamento) ----------
import { placementPose, yawTowards } from "../src/xr/arPlacement.js";

const angDiff = (a, b) => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

test("RA: yaw no padrão do Babylon (frente = (sen θ, 0, cos θ))", () => {
  const o = { x: 0, z: 0 };
  assert.ok(Math.abs(yawTowards(o, { x: 0, z: 1 })) < 1e-12);
  assert.ok(Math.abs(yawTowards(o, { x: 1, z: 0 }) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(Math.abs(yawTowards(o, { x: 0, z: -1 })) - Math.PI) < 1e-12);
});

test("RA: o ponto escolhido vira a base da bancada, de frente para o usuário, à mesma distância e altura", () => {
  const a = { x: 0.12, y: 0, z: -0.05 }; // bench floor anchor (bounds centre)
  for (const [cam, p] of [
    [{ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1.5 }],
    [{ x: 2.3, y: 1.45, z: -0.7 }, { x: 0.4, y: -1.2, z: 1.9 }], // "local" space: floor below 0
    [{ x: -4, y: 1.7, z: 3 }, { x: -2.5, y: 0.02, z: 2.2 }],
  ]) {
    const r = placementPose(cam, p, a);
    const dBefore = Math.hypot(cam.x - p.x, cam.z - p.z);
    const dAfter = Math.hypot(r.x - a.x, r.z - a.z);
    assert.ok(Math.abs(dAfter - dBefore) < 1e-9, "mesma distância horizontal");
    assert.ok(Math.abs(r.y - a.y - (cam.y - p.y)) < 1e-9, "mesma altura acima do ponto");
    assert.ok(Math.abs(r.x - a.x) < 1e-9 && r.z > a.z, "usuário diante da frente (+z) da bancada");
    // what the user was looking at (the point) is now the anchor: view direction rotated by the same yaw
    assert.ok(angDiff(yawTowards(r, a), yawTowards(cam, p) + r.yaw) < 1e-9, "direção do olhar rotacionada pelo mesmo yaw");
  }
});

// ---------- RA nos celulares sem WebXR (AR Quick Look / Scene Viewer) ----------
import { detectARKind, openQuickLook, sceneViewerURL } from "../src/xr/nativeAR.js";
import { buildGLB, collectScene, crc32, glbToUSDZ, parseGLB, sceneBounds, simplify, zipUSDZ } from "./usdz.mjs";
import { readFileSync } from "node:fs";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

test("RA: iPhone e iPad (modo desktop) abrem o AR Quick Look", () => {
  assert.deepEqual(detectARKind({ secure: true, ua: IPHONE, quickLook: true, webxrAR: false }), { supported: true, kind: "quicklook" });
  assert.equal(detectARKind({ secure: true, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5, quickLook: true, webxrAR: false }).kind, "quicklook");
  const noQL = detectARKind({ secure: true, ua: IPHONE, quickLook: false, webxrAR: false });
  assert.equal(noQL.supported, false);
  assert.ok(noQL.reason.length > 0);
});

test("RA: WebXR primeiro (Chrome Android/Quest); Android sem WebXR → Scene Viewer; desktop e HTTP sem RA", () => {
  assert.equal(detectARKind({ secure: true, ua: ANDROID, quickLook: false, webxrAR: true }).kind, "webxr");
  assert.equal(detectARKind({ secure: true, ua: ANDROID, quickLook: false, webxrAR: false }).kind, "sceneviewer");
  const desk = detectARKind({ secure: true, ua: DESKTOP, quickLook: false, webxrAR: false });
  assert.deepEqual([desk.supported, desk.kind], [false, null]);
  assert.equal(detectARKind({ secure: false, ua: IPHONE, quickLook: true, webxrAR: false }).supported, false);
});

test("RA: link do Scene Viewer e do Quick Look", () => {
  const url = sceneViewerURL("https://x.github.io/m/models/bomba-ar.glb", { fallbackUrl: "https://x.github.io/m/" });
  assert.ok(url.startsWith("intent://arvr.google.com/scene-viewer/1.0?file=https%3A%2F%2Fx.github.io%2Fm%2Fmodels%2Fbomba-ar.glb&mode=ar_preferred"));
  assert.ok(url.includes(";package=com.google.android.googlequicksearchbox;") && url.includes("S.browser_fallback_url=https%3A%2F%2Fx.github.io%2Fm%2F;") && url.endsWith("end;"));
  const made = [];
  const doc = { createElement: (tag) => { const el = { tag, attrs: {}, children: [], clicked: false, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); }, click() { this.clicked = true; } }; made.push(el); return el; } };
  const a = openQuickLook("https://x/models/bomba.usdz", doc);
  assert.deepEqual([a.attrs.rel, a.attrs.href, a.children[0]?.tag, a.clicked], ["ar", "https://x/models/bomba.usdz", "img", true]);
});

test("USDZ: CRC32 e ZIP sem compressão com dados alinhados em 64 bytes", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const files = [{ name: "a.usda", data: new Uint8Array(7).fill(65) }, { name: "geometries/G0.usda", data: new Uint8Array(100).fill(66) }];
  const zip = zipUSDZ(files);
  const dv = new DataView(zip.buffer);
  let off = 0;
  for (const f of files) {
    assert.equal(dv.getUint32(off, true), 0x04034b50);
    assert.equal(dv.getUint16(off + 8, true), 0, "stored");
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    assert.equal(start % 64, 0, `${f.name} alinhado`);
    assert.deepEqual(zip.subarray(start, start + f.data.length), f.data);
    off = start + f.data.length;
  }
  assert.equal(dv.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(zip.length - 12, true), 2);
});

test("USDZ: simplificação junta vértices da mesma célula sem abrir frestas e mantém arestas vivas", () => {
  // two triangles sharing an edge, plus a sliver that collapses (two corners in the same 1 cm cell)
  const geo = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1.001, 0.001, 0, 1, 1, 0, 0.5, 0.5, 0, 0.502, 0.501, 0, 0.9, 0.2, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 2, 5, 6, 7]),
  };
  const s = simplify(geo, 0.01);
  assert.equal(s.indices.length, 6, "o triângulo degenerado sai");
  assert.equal(s.positions.length / 3, 4, "vértices 1 e 3 viram um só");
  // hard edge: same cell, perpendicular normals → two vertices at the same position
  const edge = simplify({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.001, 1, 0, 0.001, 0, 0, 1]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2, 3, 4, 5]) }, 0.01);
  assert.equal(edge.positions.length / 3, 6);
  assert.equal(edge.positions[0], edge.positions[9], "mesma posição: sem fresta");
});

test("USDZ: modelo real da bancada → USDZ (Quick Look) e GLB sem Draco (Scene Viewer)", async () => {
  const r = await glbToUSDZ(readFileSync(new URL("../public/models/bomba-draco.glb", import.meta.url)));
  assert.ok(r.bytes.length < 9 * 1048576 && r.glb.length < 9 * 1048576, `tamanhos ${r.bytes.length} / ${r.glb.length}`);
  assert.ok(r.triangles > 100000 && r.instances > 100, `${r.triangles} triângulos, ${r.instances} peças`);
  assert.ok(Math.abs(r.size[0] - 1.76) < 0.05 && Math.abs(r.size[1] - 1.85) < 0.05, "tamanho real (m)");
  // root layer first, every referenced geometry layer present
  const dv = new DataView(r.bytes.buffer, r.bytes.byteOffset);
  const names = [];
  let off = 0;
  const texts = {};
  while (dv.getUint32(off, true) === 0x04034b50) {
    const n = dv.getUint16(off + 26, true);
    const name = new TextDecoder().decode(r.bytes.subarray(off + 30, off + 30 + n));
    const start = off + 30 + n + dv.getUint16(off + 28, true);
    const size = dv.getUint32(off + 18, true);
    assert.equal(start % 64, 0);
    names.push(name);
    texts[name] = new TextDecoder().decode(r.bytes.subarray(start, start + size));
    off = start + size;
  }
  assert.equal(names[0], "bomba.usda");
  const root = texts["bomba.usda"];
  assert.ok(root.startsWith("#usda 1.0") && root.includes('defaultPrim = "Root"') && root.includes('token preliminary:anchoring:type = "plane"'));
  const refs = [...root.matchAll(/references = @\.\/([^@]+)@/g)].map((m) => m[1]);
  assert.equal(refs.length, r.instances);
  assert.ok(refs.every((f) => names.includes(f)));
  const g0 = texts[refs[0]];
  assert.ok(g0.includes('def Mesh "Geometry"') && g0.includes("faceVertexIndices") && g0.includes('interpolation = "vertex"'));
  // the plain GLB: no Draco, same pieces, base on the floor
  const { json, bin } = parseGLB(r.glb);
  assert.equal(json.extensionsUsed, undefined);
  const scene = collectScene(json, bin, null);
  const b = sceneBounds(scene);
  assert.equal(scene.instances.length, r.instances);
  assert.ok(Math.abs(b.min[1]) < 1e-4 && Math.abs(b.min[0] + b.max[0]) < 1e-3 && Math.abs(b.min[2] + b.max[2]) < 1e-3, "centrada, base em y = 0");
  assert.ok(buildGLB({ prototypes: [], instances: [] }, []).length > 20);
});
