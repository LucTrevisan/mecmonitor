// Identification board on top of the bench's frame, as on the real bench at the school (photo supplied by
// the user): pump manufacturer on the left board; FIESP-system box + SENAI logo on the right board.
// The manufacturer is typographic until its official logo file is supplied: put it in public/brand/ and set
// makerLogoUrl (e.g. "brand/imbil-logo.png"); it is then drawn above the tagline.
export const BENCH = {
  maker: "IMBIL",
  makerTagline: "Soluções em Bombeamento",
  makerColor: "#e0232e", // red of the IMBIL lettering on the real board (close to the SENAI red in the photo)
  makerLogoUrl: null,
  system: ["FIESP", "SESI", "SENAI", "IRS"],
};

// Electrical cabinet (enclosure "CEMAR-1" of the GLB) dressed like the real one: legend plates and controls
// overlaid on its door (the GLB is untouched). u = fraction of the door width from the viewer's left,
// v = fraction of the door height from the top. Legends transcribed from the photo of the real bench;
// the yellow button's and the selector's were only partly legible (confirm with the school).
export const CABINET = {
  node: "CEMAR-1",
  sticker: { u: 0.2, v: 0.05 }, // asset tag (white, QR-like pattern; decorative)
  plates: [{ u: 0.8, v: 0.06, lines: ["ALIMENTAÇÃO", "3~220VAC"] }],
  controls: [
    { id: "lock", kind: "lock", u: 0.08, v: 0.5 },
    { id: "safety-on", kind: "button", color: "#1f62d8", u: 0.38, v: 0.6, legend: ["RELÉ DE", "SEGURANÇA", "LIGADO"] },
    { id: "energized", kind: "pilot", color: "#f4f4f2", u: 0.66, v: 0.6, legend: ["PAINEL", "ENERGIZADO"] },
    { id: "safety-reset", kind: "button", color: "#f2c200", u: 0.36, v: 0.84, legend: ["REARME RELÉ", "SEGURANÇA"] },
    { id: "selector", kind: "selector", u: 0.62, v: 0.84, legend: ["DESLIGA   LIGA", "COMANDO"] },
    { id: "emergency", kind: "emergency", color: "#d81e1e", u: 0.87, v: 0.82, legend: ["EMERGÊNCIA"] },
  ],
};
