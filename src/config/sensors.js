// Sensor placement on the Digital Twin. Positions are PROPOSALS derived from part names in the GLB;
// adjust to the real installation (live helper in the console: mecmonitor.twin.moveHotspot(id, x, y, z)).
//   anchor.node: GLB node the sensor is mounted on (also highlighted when selected)
//   anchor.at:   [fx, fy, fz] position inside the node's bounding box, 0 = min, 1 = max, per axis
//   anchor.offset: extra world offset in meters
//   view: camera framing used by "focus" (alpha/beta in radians, radius in meters)
//   stem: optional label stem length in px (stacks labels of sensors mounted close together)

export const SENSORS = [
  {
    id: "mpu6050",
    kpi: "vibration",
    model: "MPU6050",
    type: "Acelerômetro/giroscópio MEMS 3 eixos",
    quantity: "Vibração (velocidade RMS)",
    location: "Mancal de rolamentos — topo da caixa",
    interface: "I²C",
    notes: "Vibração RMS (mm/s) obtida a partir da aceleração, conforme ISO 10816-3.",
    anchor: { node: "House Bearing-1", at: [0.3, 1, 0.5], offset: [0, 0.01, 0] },
    stem: 44,
    view: { alpha: -1.25, beta: 1.05, radius: 0.75 },
  },
  {
    id: "max6675",
    kpi: "temperature",
    model: "MAX6675",
    type: "Conversor de termopar tipo K",
    quantity: "Temperatura da caixa do mancal",
    location: "Mancal de rolamentos — lado da bomba",
    interface: "SPI · resolução 0,25 °C",
    notes: "Termopar em contato com a caixa do mancal, próximo ao rolamento do lado da bomba.",
    anchor: { node: "House Bearing-1", at: [0.8, 1, 0.5], offset: [0, 0.01, 0] },
    view: { alpha: -1.85, beta: 1.05, radius: 0.75 },
  },
  {
    id: "sct013",
    kpi: "current",
    model: "SCT013",
    type: "Transformador de corrente não invasivo (núcleo dividido)",
    quantity: "Corrente do motor (RMS)",
    location: "Quadro elétrico — fase de alimentação do motor",
    interface: "Analógica (ADC do ESP32)",
    notes: "Abraça um condutor de fase do motor dentro do quadro elétrico.",
    anchor: { node: "CEMAR-1", at: [0.5, 0.65, 1], offset: [0, 0, 0.01] },
    view: { alpha: 1.45, beta: 1.3, radius: 1.5 },
  },
  {
    id: "rpm",
    kpi: "rpm",
    model: "Sensor RPM",
    type: "Sensor de rotação (pulsos por volta)",
    quantity: "Rotação do eixo",
    location: "Acoplamento motor–bomba",
    interface: "Digital (interrupção do ESP32)",
    notes: "Lê uma marca no acoplamento através da proteção; RPM = pulsos/min ÷ pulsos por volta.",
    anchor: { node: "PUMP PROTECTION-1", at: [0.5, 1, 0.5], offset: [0, 0.01, 0] },
    view: { alpha: -1.0, beta: 1.0, radius: 0.85 },
  },
];

export const SENSOR_BY_KPI = Object.fromEntries(SENSORS.map((s) => [s.kpi, s]));
export const SENSOR_BY_ID = Object.fromEntries(SENSORS.map((s) => [s.id, s]));
