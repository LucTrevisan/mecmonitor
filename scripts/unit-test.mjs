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
