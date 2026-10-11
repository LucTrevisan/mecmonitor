// Visualization modes of the Digital Twin (desktop dock and VR menu). Nothing here changes the GLB: modes
// swap materials at runtime and NORMAL restores the exact materials that were on screen before.
import { KPI_BY_KEY } from "./kpis.js";

export const VIEW_MODES = [
  { id: "normal", label: "Normal" },
  { id: "sensors", label: "Sensores" },
  { id: "xray", label: "Raio-X" },
  { id: "thermal", label: "Térmico" },
];

// SENSORES: a 3D card above each sensor (tag, value, state, model) + a ring in the state color.
// lift: card height above the sensor (m). VIB-01, T-01 and RPM-01 sit within ~25 cm of each other along
// the shaft, so their cards are staggered in three tiers (cards are 11 cm tall).
export const SENSOR_TAGS = {
  mpu6050: { lift: 0.16 },
  rpm: { lift: 0.3 },
  max6675: { lift: 0.44 },
  sct013: { lift: 0.16 },
};

// RAIO-X: selective transparency. Only the shells around the rotating parts become translucent (plus the
// fasteners sitting on them); the parts below stay solid and get a label. Everything else is untouched.
export const XRAY = {
  shells: ["casing oficial-1", "coupling-1", "Seal chamber-1", "House Bearing-1", "Bearing Cover-1", "Bearing Cover-2", "bbcover-1", "bbcover-2", "PUMP PROTECTION-1"],
  fastenerPrefixes: ["stud2d_din", "hex nut", "hex screw", "plain washer", "curved spring lock washer"],
  parts: [
    { id: "impeller", label: "ROTOR", detail: "Impulsor da bomba", nodes: ["IMPELLER-2"], lift: 0.2 },
    { id: "shaft", label: "EIXO", detail: "Transmite a rotação do motor", nodes: ["Shaft-1"], lift: 0.34 },
    { id: "bearings", label: "MANCAIS", detail: "Rolamentos de esferas (2×)", nodes: ["radial ball bearing_68_din-1", "radial ball bearing_68_din-2"], lift: 0.16 },
    { id: "coupling", label: "ACOPLAMENTO", detail: "Liga o motor ao eixo da bomba", nodes: ["coupling As"], lift: 0.26 },
    { id: "motor", label: "MOTOR M-01", detail: "Motor elétrico de acionamento", nodes: ["Motor teste-2"], lift: 0.16 },
  ],
};

// TÉRMICO: only the region monitored by T-01 (bearing housing and its covers) is colored, from T-01's value;
// the rest of the equipment turns neutral gray ("not measured"), so the heat colors stand out.
// Levels follow the temperature KPI limits (NORMAL ≤ 60 °C, ALERTA ≤ 75 °C), so the scale never disagrees
// with the dashboard; BAIXA (≤ 40 °C) marks a cold / idle bearing.
const T = KPI_BY_KEY.temperature;
export const THERMAL = {
  sensor: "max6675",
  kpi: "temperature",
  region: ["House Bearing-1", "Bearing Cover-1", "Bearing Cover-2", "bbcover-1", "bbcover-2"],
  ambient: 25, // °C — far from the bearing the housing tends to ambient
  falloff: 0.35, // m — gentle spatial gradient: hottest at T-01, ~70 % of the excess 20 cm away
  levels: [
    { id: "low", label: "BAIXA", max: 40 },
    { id: "normal", label: "NORMAL", max: T.normal[1] },
    { id: "high", label: "ELEVADA", max: T.alert[1] },
    { id: "critical", label: "CRÍTICA", max: Infinity },
  ],
  // color ramp (sRGB), interpolated: blue → cyan → green → yellow → orange → red
  stops: [
    [25, "#2c4fb5"],
    [40, "#2a9fd6"],
    [50, "#3cb878"],
    [60, "#e8d33a"],
    [75, "#ef7a22"],
    [90, "#d42a2a"],
  ],
  ticks: [25, 40, 60, 75, 90],
  nodataColor: "#7d8794",
  contextColor: "#6f7782", // the rest of the equipment while TÉRMICO is on
};
