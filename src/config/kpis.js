// KPI definitions and PROVISIONAL operating limits for pump P-01.
// Review with the real nameplate/process data before using them for decisions.
//   normal / alert: [min, max] bands; outside "alert" is critical.
//   ref: healthy operating reference used by the health index.
//   Vibration bands follow ISO 10816-3 (group 2, rigid foundation): 2.8 / 4.5 mm/s RMS.

export const KPIS = [
  {
    key: "temperature",
    label: "Temperatura",
    short: "Temp.",
    unit: "°C",
    decimals: 1,
    sensor: "MAX6675",
    ref: 40,
    normal: [-Infinity, 60],
    alert: [-Infinity, 75],
    weight: 0.3,
    trendEps: 0.3,
  },
  {
    key: "vibration",
    label: "Vibração",
    unit: "mm/s RMS",
    decimals: 2,
    sensor: "MPU6050",
    ref: 1.0,
    normal: [-Infinity, 2.8],
    alert: [-Infinity, 4.5],
    weight: 0.35,
    trendEps: 0.12,
  },
  {
    key: "current",
    label: "Corrente",
    unit: "A",
    decimals: 2,
    sensor: "SCT013",
    ref: 3.0,
    normal: [-Infinity, 4.0],
    alert: [-Infinity, 4.6],
    weight: 0.2,
    trendEps: 0.06,
  },
  {
    key: "rpm",
    label: "RPM",
    unit: "rpm",
    decimals: 0,
    sensor: "Sensor RPM",
    ref: 1750,
    normal: [1700, 1800],
    alert: [1650, 1850],
    weight: 0.15,
    trendEps: 5,
  },
];

export const KPI_BY_KEY = Object.fromEntries(KPIS.map((k) => [k.key, k]));

export const STATE_LABEL = { normal: "NORMAL", alert: "ALERTA", critical: "CRÍTICO", nodata: "SEM DADOS" };

/** A KPI without a new reading for longer than this is shown as SEM DADOS. */
export const STALE_MS = 5000;
