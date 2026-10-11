// Training mode (MODO TREINAMENTO): independent scenarios on simulated data. The student must investigate
// the bench — scenario names and briefings are neutral, answers are only revealed in the FEEDBACK step.
// Diagnoses are didactic rules ("indício compatível com" / "possíveis causas"), never presented as AI or
// as a definitive diagnosis. Scenario data is SIMULATED and always labeled as such.
//
// profile: per KPI, value(t) = from + (to − from) · min(1, max(0, t − delay) / ramp) + noise (t in s)

export const TRAINING_STEPS = [
  { id: "inspection", title: "INSPEÇÃO", instruction: "Inspecione a bancada antes de qualquer leitura e confirme os itens." },
  { id: "location", title: "LOCALIZAÇÃO DOS SENSORES", instruction: "Encontre e selecione na bancada os sensores T-01, VIB-01 e I-01." },
  { id: "reading", title: "LEITURA DOS DADOS", instruction: "Leia temperatura, vibração e corrente (painéis, histórico, modos) e registre as leituras." },
  { id: "anomaly", title: "IDENTIFICAÇÃO DE ANOMALIA", instruction: "Qual grandeza está fora do comportamento normal?" },
  { id: "diagnosis", title: "DIAGNÓSTICO", instruction: "Com base nas leituras, o comportamento é compatível com:" },
  { id: "action", title: "AÇÃO RECOMENDADA", instruction: "Qual ação você recomenda?" },
  { id: "feedback", title: "FEEDBACK", instruction: "Compare suas respostas com a análise do cenário." },
];

export const INSPECTION_CHECKLIST = [
  "Área de inspeção sinalizada e EPI em uso",
  "Placas P-01 e M-01 identificadas",
  "Sem vazamentos, ruídos ou odores anormais à vista",
];

// sensors the student must locate on the bench (scene interaction only: mouse/touch, controller ray, hand)
export const SENSORS_TO_LOCATE = ["max6675", "mpu6050", "sct013"];

export const ANOMALY_OPTIONS = [
  { id: "temperature", text: "Temperatura (T-01)" },
  { id: "vibration", text: "Vibração (VIB-01)" },
  { id: "current", text: "Corrente (I-01)" },
  { id: "none", text: "Nenhuma: operação normal" },
];

// Same options for every scenario, so the list never hints at the answer.
export const DIAGNOSIS_OPTIONS = [
  { id: "ok", text: "Operação dentro dos limites, sem indício de falha" },
  { id: "lubrication", text: "Problema de lubrificação do rolamento (falta ou excesso de graxa)" },
  { id: "unbalance", text: "Desbalanceamento ou desalinhamento (rotor, acoplamento, base)" },
  { id: "overload", text: "Sobrecarga do motor ou tensão de alimentação baixa" },
  { id: "cavitation", text: "Cavitação por baixa pressão na sucção" },
];

export const ACTION_OPTIONS = [
  { id: "keep", text: "Manter a operação e seguir o plano de inspeção" },
  { id: "lubricate", text: "Verificar a lubrificação do mancal e acompanhar a temperatura" },
  { id: "align", text: "Programar parada para verificar alinhamento, balanceamento e fixação da base" },
  { id: "electrical", text: "Verificar tensão e corrente por fase e a carga; desligar se persistir acima do limite" },
  { id: "replace", text: "Substituir o motor imediatamente" },
];

const nominal = {
  temperature: { from: 47, to: 47, noise: 0.3 },
  vibration: { from: 1.7, to: 1.7, noise: 0.12 },
  current: { from: 3.3, to: 3.3, noise: 0.05 },
  rpm: { from: 1755, to: 1755, noise: 5 },
};

export const SCENARIOS = [
  {
    id: "A",
    title: "Operação normal",
    briefing: "Inspeção de rotina da bomba P-01 no início do turno.",
    profile: nominal,
    answer: { anomaly: "none", diagnosis: "ok", action: "keep" },
    analysis: {
      observed: "Temperatura, vibração e corrente estáveis e dentro dos limites durante todo o cenário.",
      compatible: "Operação normal da bomba P-01.",
      causes: ["Sem indício de falha: registrar as leituras como referência para comparações futuras."],
      action: "Manter a operação e seguir o plano de inspeção.",
    },
  },
  {
    id: "B",
    title: "Temperatura elevada",
    briefing: "Chamado do operador: comportamento diferente da bomba após a última manutenção.",
    profile: {
      ...nominal,
      temperature: { from: 52, to: 71, ramp: 45, noise: 0.25 },
      vibration: { from: 2.0, to: 2.3, ramp: 45, noise: 0.1 },
    },
    answer: { anomaly: "temperature", diagnosis: "lubrication", action: "lubricate" },
    analysis: {
      observed: "T-01 subiu de ~52 °C para ~71 °C (faixa ELEVADA, acima de 60 °C); vibração e corrente quase estáveis.",
      compatible: "Problema de lubrificação do rolamento do lado da bomba.",
      causes: ["Falta de graxa ou graxa inadequada", "Excesso de graxa (aquecimento por agitação)", "Rolamento no início de desgaste"],
      action: "Verificar a lubrificação do mancal (quantidade e tipo de graxa) e acompanhar a temperatura.",
    },
  },
  {
    id: "C",
    title: "Vibração elevada",
    briefing: "Chamado do operador: a bancada parece diferente do habitual.",
    profile: {
      ...nominal,
      vibration: { from: 2.2, to: 5.2, ramp: 45, noise: 0.15 },
      temperature: { from: 54, to: 58, ramp: 45, noise: 0.25 },
    },
    answer: { anomaly: "vibration", diagnosis: "unbalance", action: "align" },
    analysis: {
      observed: "VIB-01 subiu de ~2,2 para ~5,2 mm/s RMS (ALERTA acima de 2,8; CRÍTICO acima de 4,5, ISO 10816-3); temperatura e corrente pouco alteradas.",
      compatible: "Desbalanceamento ou desalinhamento.",
      causes: ["Desalinhamento entre motor e bomba no acoplamento", "Rotor desbalanceado ou com incrustação", "Base ou chumbadores soltos"],
      action: "Programar parada para verificar alinhamento, balanceamento e fixação da base.",
    },
  },
  {
    id: "D",
    title: "Sobrecorrente",
    briefing: "Chamado da produção: o motor da bomba P-01 desarmou uma vez nesta semana.",
    profile: {
      ...nominal,
      current: { from: 3.6, to: 4.9, ramp: 45, noise: 0.05 },
      temperature: { from: 54, to: 61, ramp: 45, noise: 0.25 },
      rpm: { from: 1750, to: 1735, ramp: 45, noise: 5 },
    },
    answer: { anomaly: "current", diagnosis: "overload", action: "electrical" },
    analysis: {
      observed: "I-01 subiu de ~3,6 A para ~4,9 A (ALERTA acima de 4,0 A; CRÍTICO acima de 4,6 A), com leve queda de rotação; vibração normal.",
      compatible: "Sobrecarga do motor ou tensão de alimentação baixa.",
      causes: ["Vazão acima do ponto de projeto (registro de recalque muito aberto)", "Atrito mecânico (gaxetas apertadas, rolamento)", "Tensão de alimentação baixa ou desequilibrada entre fases"],
      action: "Verificar tensão e corrente por fase e as condições de carga; desligar se persistir acima do limite.",
    },
  },
];

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
