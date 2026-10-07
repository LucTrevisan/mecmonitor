// Unit tests for pure logic modules (no browser). Usage: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { KPIS, KPI_BY_KEY } from "../src/config/kpis.js";
import { classify, evaluate, kpiScore, trend } from "../src/health.js";

const T = KPI_BY_KEY.temperature;
const V = KPI_BY_KEY.vibration;
const R = KPI_BY_KEY.rpm;

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

test("classify: RPM bilateral", () => {
  assert.equal(classify(1750, R), "normal");
  assert.equal(classify(1680, R), "alert");
  assert.equal(classify(1860, R), "critical");
  assert.equal(classify(0, R), "critical");
});

test("kpiScore: 100 na referência, 85 no limite normal, 55 no limite de alerta", () => {
  assert.equal(kpiScore(T.ref, T), 100);
  assert.equal(kpiScore(60, T), 85);
  assert.equal(kpiScore(75, T), 55);
  assert.equal(kpiScore(30, T), 100); // below ref on a one-sided limit
  assert.ok(kpiScore(200, T) >= 0);
});

test("evaluate: amostra nominal → NORMAL com saúde alta", () => {
  const r = evaluate({ temperature: 55, vibration: 2.3, current: 3.5, rpm: 1750 });
  assert.equal(r.state, "normal");
  assert.ok(r.score >= 80 && r.score <= 100, `score ${r.score}`);
  assert.equal(Object.keys(r.kpis).length, KPIS.length);
});

test("evaluate: estado global = pior KPI", () => {
  assert.equal(evaluate({ temperature: 55, vibration: 3.5, current: 3.5, rpm: 1750 }).state, "alert");
  assert.equal(evaluate({ temperature: 80, vibration: 3.5, current: 3.5, rpm: 1750 }).state, "critical");
});

test("evaluate: saúde cai com a degradação", () => {
  const ok = evaluate({ temperature: 50, vibration: 2.0, current: 3.4, rpm: 1750 }).score;
  const bad = evaluate({ temperature: 70, vibration: 4.0, current: 4.4, rpm: 1690 }).score;
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
import { websocketProvider } from "../src/telemetry/websocketProvider.js";
import { mqttProvider } from "../src/telemetry/mqttProvider.js";

const NOW = 1_780_000_000_000;

test("normalize: chaves canônicas, aliases, strings numéricas e JSON", () => {
  assert.deepEqual(normalizeSample({ temperature: 50, vibration: 2, current: 3, rpm: 1750 }, NOW), { temperature: 50, vibration: 2, current: 3, rpm: 1750, timestamp: NOW });
  assert.deepEqual(normalizeSample('{"Temp":"61.4","vrms":3.1,"I":4.1,"RPM":1748}', NOW), { temperature: 61.4, vibration: 3.1, current: 4.1, rpm: 1748, timestamp: NOW });
  assert.deepEqual(normalizeSample(new TextEncoder().encode('{"t":40}'), NOW), { temperature: 40, timestamp: NOW });
});

test("normalize: rejeita payload inválido e ignora campos não numéricos", () => {
  assert.equal(normalizeSample("não é json", NOW), null);
  assert.equal(normalizeSample({ foo: 1 }, NOW), null);
  assert.equal(normalizeSample(null, NOW), null);
  assert.deepEqual(normalizeSample({ temp: "abc", rpm: 1700 }, NOW), { rpm: 1700, timestamp: NOW });
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
  assert.equal(m.username, undefined, "credenciais não vêm da URL");
  assert.deepEqual(resolveTelemetryConfig("?source=desconhecido"), { source: "simulation" });
  assert.equal(createProvider({ source: "simulation" }).kind, "simulation");
  assert.equal(createProvider({ source: "websocket", url: "ws://x" }).kind, "realtime");
  assert.equal(createProvider({ source: "mqtt", url: "x", topic: "y" }).kind, "realtime");
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
  a.ctx.emit({ rpm: 1, timestamp: NOW });
  a.ctx.setStatus("error");
  assert.equal(got.length, 0);
  b.ctx.emit({ rpm: 2, timestamp: NOW });
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
  assert.ok(["temperature", "vibration", "current", "rpm"].every((k) => Number.isFinite(got[0][k])));
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
  assert.deepEqual([got[0].current, got[0].rpm, got[0].source], [4.1, 1745, "realtime"]);
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
  assert.equal(r.kpis.rpm.state, "nodata");
  assert.equal(r.kpis.rpm.value, null);
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

// ---------- Fase 5 (plano XR): histórico ----------
import { createHistoryStore, RANGES } from "../src/telemetry/historyStore.js";

test("historyStore: buffer circular descarta o mais antigo", () => {
  const h = createHistoryStore(["t"], 3);
  [1, 2, 3, 4].forEach((v, i) => h.push("t", 1000 + i, v));
  const got = [];
  h.each("t", 0, 1e9, (t, v) => got.push(v));
  assert.deepEqual(got, [2, 3, 4]);
  assert.equal(h.size("t"), 3);
});

test("historyStore: ignora valores inválidos e chaves desconhecidas", () => {
  const h = createHistoryStore(["t"], 10);
  h.push("t", 1, NaN);
  h.push("x", 1, 5);
  assert.equal(h.size("t"), 0);
});

test("historyStore: buckets com min/média/máx e lacunas nulas", () => {
  const h = createHistoryStore(["v"], 100);
  // 0–10 s: values 1..10 every second; 10–20 s: nothing (gap); 20–30 s: 5
  for (let s = 0; s < 10; s++) h.push("v", s * 1000, s + 1);
  h.push("v", 25_000, 5);
  const b = h.buckets("v", 0, 30_000, 3);
  assert.deepEqual([b[0].min, b[0].max, b[0].count], [1, 10, 10]);
  assert.equal(b[0].mean, 5.5);
  assert.equal(b[1], null, "lacuna vira null");
  assert.equal(b[2].mean, 5);
});

test("historyStore: summary e intervalos pedidos (5 min · 30 min · 1 h · 24 h)", () => {
  const h = createHistoryStore(["c"], 100);
  h.push("c", 1000, 3);
  h.push("c", 2000, 5);
  const s = h.summary("c", 0, 5000);
  assert.deepEqual([s.min, s.max, s.mean, s.last.v], [3, 5, 4, 5]);
  assert.equal(h.summary("c", 10_000, 20_000), null);
  assert.deepEqual(Object.values(RANGES).map((r) => r.label), ["5 min", "30 min", "1 h", "24 h"]);
  assert.equal(createHistoryStore(["c"]).capacity, 86400, "24 h a 1 Hz");
});

// ---------- Fase 6 (plano XR): planta do laboratório, área segura e pose inicial ----------
import { computeLayout, isWalkable, safeFloorRects } from "../src/scene/layout.js";

// Bounds of the bench as loaded (meters): 1.758 × 1.853 × 1.003, centered, base on y = 0.
const BENCH = { min: { x: -0.879, y: 0, z: -0.5015 }, max: { x: 0.879, y: 1.853, z: 0.5015 } };
const L = computeLayout(BENCH, 10.8);

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
  assert.equal(isWalkable(-2, -1.5, L), true, "corredor atrás da bancada");
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
