// Training flow (MODO TREINAMENTO) — pure logic, no DOM / Babylon (unit-tested). The desktop panel and the
// VR panel render the same view() and call the same actions.
// INSPEÇÃO → LOCALIZAÇÃO DOS SENSORES → LEITURA DOS DADOS → IDENTIFICAÇÃO DE ANOMALIA → DIAGNÓSTICO →
// AÇÃO RECOMENDADA → FEEDBACK. Each step unlocks the next only when done; answers are graded only in
// FEEDBACK (the student never gets the answer while investigating), and the scenario's name/analysis are
// not exposed before that either.
import {
  ACTION_OPTIONS,
  ANOMALY_OPTIONS,
  DIAGNOSIS_OPTIONS,
  INSPECTION_CHECKLIST,
  SCENARIOS,
  SENSORS_TO_LOCATE,
  TRAINING_STEPS,
} from "../config/training.js";

export const QUESTIONS = { anomaly: ANOMALY_OPTIONS, diagnosis: DIAGNOSIS_OPTIONS, action: ACTION_OPTIONS };
const FEEDBACK = TRAINING_STEPS.findIndex((s) => s.id === "feedback");

/** Scenario signal at t seconds: ramp from → to after delay, plus uniform noise (rand ∈ [0, 1)). */
export function scenarioValue(p, t, rand = Math.random) {
  const k = p.ramp ? Math.min(1, Math.max(0, t - (p.delay ?? 0)) / p.ramp) : 1;
  return p.from + (p.to - p.from) * k + (rand() * 2 - 1) * (p.noise ?? 0);
}

export function createTrainingEngine({ scenarios = SCENARIOS, now = () => Date.now(), random = Math.random } = {}) {
  const idle = () => ({ active: false, scenario: null, step: 0, checks: [], located: [], readings: null, answers: {}, startedAt: 0, finishedAt: 0 });
  let s = idle();
  const listeners = new Set();
  const stepId = () => TRAINING_STEPS[s.step]?.id;

  function canAdvance() {
    if (!s.active) return false;
    switch (stepId()) {
      case "inspection":
        return s.checks.length === INSPECTION_CHECKLIST.length && s.checks.every(Boolean);
      case "location":
        return SENSORS_TO_LOCATE.every((id) => s.located.includes(id));
      case "reading":
        return Boolean(s.readings);
      case "anomaly":
      case "diagnosis":
      case "action":
        return Boolean(s.answers[stepId()]);
      default:
        return false;
    }
  }

  function result() {
    const items = Object.entries(QUESTIONS).map(([q, opts]) => {
      const chosen = s.answers[q] ?? null;
      const correct = s.scenario.answer[q];
      return {
        id: q,
        title: TRAINING_STEPS.find((st) => st.id === q).title,
        chosen,
        chosenText: opts.find((o) => o.id === chosen)?.text ?? "—",
        correct,
        correctText: opts.find((o) => o.id === correct)?.text,
        ok: chosen === correct,
      };
    });
    return { items, score: items.filter((i) => i.ok).length, total: items.length, durationS: Math.round(((s.finishedAt || now()) - s.startedAt) / 1000) };
  }

  function view() {
    const step = TRAINING_STEPS[s.step];
    const done = step?.id === "feedback";
    return {
      active: s.active,
      startedAt: s.startedAt,
      // the scenario's name and analysis only exist in the view once the student reaches FEEDBACK
      scenario: s.scenario ? { id: s.scenario.id, briefing: s.scenario.briefing, ...(done ? { title: s.scenario.title, analysis: s.scenario.analysis } : {}) } : null,
      stepIndex: s.step,
      stepCount: TRAINING_STEPS.length,
      step,
      checklist: INSPECTION_CHECKLIST.map((text, i) => ({ text, done: Boolean(s.checks[i]) })),
      located: SENSORS_TO_LOCATE.map((id) => ({ id, done: s.located.includes(id) })),
      readings: s.readings,
      options: QUESTIONS[step?.id] ?? null,
      answer: s.answers[step?.id] ?? null,
      canAdvance: canAdvance(),
      canGoBack: s.active && s.step > 0 && s.step < FEEDBACK,
      result: done ? result() : null,
    };
  }
  const emit = () => {
    const v = view();
    listeners.forEach((fn) => fn(v));
  };

  function start(id = "random") {
    const sc = id === "random" ? scenarios[Math.floor(random() * scenarios.length)] : scenarios.find((x) => x.id === id);
    if (!sc) return null;
    s = { ...idle(), active: true, scenario: sc, startedAt: now(), checks: INSPECTION_CHECKLIST.map(() => false) };
    emit();
    return sc.id;
  }

  return {
    get state() {
      return view();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** id: scenario id ("A".."D") or "random" (the student does not know which one). */
    start,
    toggleCheck(i) {
      if (stepId() !== "inspection" || !(i >= 0 && i < s.checks.length)) return;
      s.checks[i] = !s.checks[i];
      emit();
    },
    /** A sensor selected ON THE BENCH (scene interaction, any device) while in LOCALIZAÇÃO. */
    sensorLocated(id) {
      if (!s.active || stepId() !== "location" || !SENSORS_TO_LOCATE.includes(id) || s.located.includes(id)) return;
      s.located.push(id);
      emit();
    },
    /** readings: { temperature: { value, state }, vibration: …, current: … } captured from the dashboard. */
    recordReadings(readings) {
      if (stepId() !== "reading" || !readings) return;
      s.readings = { ...readings, at: now() };
      emit();
    },
    answer(optionId) {
      const q = stepId();
      if (!QUESTIONS[q]?.some((o) => o.id === optionId)) return;
      s.answers[q] = optionId;
      emit();
    },
    next() {
      if (!canAdvance()) return false;
      s.step++;
      if (s.step === FEEDBACK) s.finishedAt = now();
      emit();
      return true;
    },
    back() {
      if (!view().canGoBack) return false;
      s.step--;
      emit();
      return true;
    },
    /** Same scenario again (fresh data and answers). */
    restart() {
      return s.scenario ? start(s.scenario.id) : null;
    },
    exit() {
      s = idle();
      emit();
    },
  };
}
