// Training panel (desktop / mobile). Renders the training engine's view; the VR panel renders the same view.
// The scenario is always labeled as simulated data; correctness is only shown in the FEEDBACK step.
import { SCENARIOS } from "../config/training.js";
import { SENSOR_BY_ID } from "../config/sensors.js";
import { STATES } from "./states.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function createTrainingPanel(root, { engine, onRecord, fmt, kpiDefs }) {
  let open = false;
  // On narrow screens the sheet would cover the bench: it can be collapsed (header, progress and buttons
  // only) and collapses by itself when the student has to find the sensors on the bench.
  let collapsed = false;
  let lastStep = null;
  const narrow = () => window.matchMedia("(max-width: 1120px)").matches;

  function readingsHtml(r) {
    if (!r) return "";
    const rows = ["temperature", "vibration", "current"]
      .map((k) => {
        const it = r[k];
        const def = kpiDefs[k];
        const st = STATES[it?.state] ?? STATES.nodata;
        const value = it?.value == null ? "SEM DADOS" : `${fmt(it.value, def.decimals)} ${def.unit}`;
        return `<li><b>${SENSOR_BY_ID[{ temperature: "max6675", vibration: "mpu6050", current: "sct013" }[k]].tag}</b> ${value} <span class="tr-state" style="color:${st.color}">${st.glyph} ${st.label}</span></li>`;
      })
      .join("");
    return `<ul class="tr-readings">${rows}</ul>`;
  }

  function stepBody(v) {
    switch (v.step.id) {
      case "inspection":
        return `<div class="tr-list">${v.checklist
          .map((c, i) => `<button type="button" class="tr-opt" data-check="${i}" aria-pressed="${c.done}"><span class="tr-box" aria-hidden="true">${c.done ? "✓" : ""}</span>${esc(c.text)}</button>`)
          .join("")}</div>`;
      case "location":
        return `<p class="tr-hint">Selecione cada sensor na própria bancada (mouse, toque, controle ou mão). Clicar no KPI não conta.</p>
          <div class="tr-located">${v.located
            .map((l) => `<span class="tr-chip" data-done="${l.done}">${l.done ? "✓" : "○"} ${SENSOR_BY_ID[l.id].tag}</span>`)
            .join("")}</div>`;
      case "reading":
        return `<button type="button" class="btn tr-record" data-record>${v.readings ? "Registrar novamente" : "Registrar leituras"}</button>${readingsHtml(v.readings)}`;
      case "anomaly":
      case "diagnosis":
      case "action":
        return `<div class="tr-list" role="radiogroup">${v.options
          .map((o) => `<button type="button" class="tr-opt" role="radio" data-answer="${o.id}" aria-checked="${v.answer === o.id}" aria-pressed="${v.answer === o.id}"><span class="tr-radio" aria-hidden="true"></span>${esc(o.text)}</button>`)
          .join("")}</div>`;
      case "feedback": {
        const r = v.result;
        const a = v.scenario.analysis;
        return `<p class="tr-score"><b>${r.score} de ${r.total}</b> respostas compatíveis com a análise · ${Math.floor(r.durationS / 60)} min ${r.durationS % 60} s</p>
          <p class="tr-scn">Cenário ${v.scenario.id}: <b>${esc(v.scenario.title)}</b></p>
          <ul class="tr-results">${r.items
            .map((i) => `<li data-ok="${i.ok}"><span class="tr-mark">${i.ok ? "✓" : "✖"}</span><div><b>${esc(i.title)}</b><br>Sua resposta: ${esc(i.chosenText)}${i.ok ? "" : `<br>Esperado: ${esc(i.correctText)}`}</div></li>`)
            .join("")}</ul>
          <div class="tr-analysis">
            <p><b>Observado:</b> ${esc(a.observed)}</p>
            <p><b>Indício compatível com:</b> ${esc(a.compatible)}</p>
            <p><b>Possíveis causas:</b></p><ul>${a.causes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
            <p><b>Ação recomendada:</b> ${esc(a.action)}</p>
          </div>
          ${readingsHtml(v.readings)}
          <p class="tr-note">Análise didática baseada em regras; não substitui a avaliação de um especialista.</p>`;
      }
      default:
        return "";
    }
  }

  // re-rendering replaces the buttons: keep keyboard focus on the equivalent one
  const FOCUS_KEYS = ["check", "answer", "start", "next", "back", "record", "exit", "restart", "other", "close", "collapse"];
  function render() {
    const prev = root.contains(document.activeElement) ? document.activeElement.dataset : null;
    const key = prev && FOCUS_KEYS.find((k) => k in prev);
    draw();
    if (key) root.querySelector(`[data-${key}${prev[key] ? `="${prev[key]}"` : ""}]:not([disabled])`)?.focus();
  }
  function draw() {
    const v = engine.state;
    const stepId = v.active ? v.step.id : null;
    if (stepId !== lastStep) {
      collapsed = stepId === "location" && narrow();
      lastStep = stepId;
    }
    root.classList.toggle("collapsed", collapsed && v.active);
    root.hidden = !open && !v.active;
    document.body.classList.toggle("training-open", !root.hidden);
    if (root.hidden) return;
    if (!v.active) {
      root.innerHTML = `<div class="tr-scroll">
        <div class="tr-head"><span class="tr-title">Modo treinamento</span><button type="button" class="tr-close" data-close aria-label="Fechar">×</button></div>
        <p class="tr-text">Investigue a bancada como num chamado real: inspeção, sensores, leituras, anomalia, diagnóstico e ação. A resposta só aparece no final.</p>
        <p class="tr-sim">◐ Os cenários usam dados simulados.</p>
        <button type="button" class="btn btn-primary tr-start" data-start="random">Iniciar cenário aleatório</button>
        <div class="tr-instructor"><span>Instrutor: cenário</span>${SCENARIOS.map((s) => `<button type="button" class="btn" data-start="${s.id}">${s.id}</button>`).join("")}</div></div>`;
      return;
    }
    root.innerHTML = `<div class="tr-scroll">
      <div class="tr-head"><span class="tr-title">Treinamento · cenário ${v.scenario.id}</span><span class="tr-simtag">◐ SIMULAÇÃO</span><button type="button" class="tr-close" data-collapse aria-expanded="${!collapsed}" aria-label="${collapsed ? "Expandir painel" : "Recolher painel"}">${collapsed ? "▴" : "▾"}</button></div>
      <ol class="tr-steps" aria-label="Etapas">${Array.from({ length: v.stepCount }, (_, i) => `<li data-state="${i < v.stepIndex ? "done" : i === v.stepIndex ? "current" : "todo"}"></li>`).join("")}</ol>
      <p class="tr-stepname" aria-live="polite">${v.stepIndex + 1}/${v.stepCount} · ${v.step.title}</p>
      <p class="tr-brief">${esc(v.scenario.briefing)}</p>
      <p class="tr-text">${esc(v.step.instruction)}</p>
      <div class="tr-body">${stepBody(v)}</div></div>
      <div class="tr-foot">
        ${v.step.id === "feedback"
          ? `<button type="button" class="btn" data-restart>Repetir cenário</button><button type="button" class="btn" data-other>Outro cenário</button><button type="button" class="btn" data-exit>Encerrar</button>`
          : `<button type="button" class="btn" data-exit>Sair</button>${v.canGoBack ? `<button type="button" class="btn" data-back>Voltar</button>` : ""}<button type="button" class="btn btn-primary" data-next ${v.canAdvance ? "" : "disabled"}>Próximo</button>`}
      </div>`;
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if ("close" in d) toggle(false);
    else if ("collapse" in d) {
      collapsed = !collapsed;
      render();
    }
    else if (d.start) engine.start(d.start);
    else if (d.check != null) engine.toggleCheck(Number(d.check));
    else if ("record" in d) onRecord();
    else if (d.answer) engine.answer(d.answer);
    else if ("next" in d) engine.next();
    else if ("back" in d) engine.back();
    else if ("restart" in d) engine.restart();
    else if ("other" in d) engine.start("random");
    else if ("exit" in d) {
      engine.exit();
      toggle(false);
    }
  });
  engine.onChange(render);

  function toggle(on = !open) {
    open = on;
    render();
  }
  render();
  return {
    toggle,
    get open() {
      return !root.hidden;
    },
  };
}
