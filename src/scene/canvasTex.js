// Small helpers for procedural scenery: canvas-drawn textures and flat materials (no external assets).
import { Color3, DynamicTexture, StandardMaterial } from "@babylonjs/core";

export const FONT = '"Segoe UI", system-ui, sans-serif';

/** Largest font size (px) <= max that fits text in maxWidth. */
export function fitFont(ctx, text, weight, max, maxWidth) {
  let size = max;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
  } while (ctx.measureText(text).width > maxWidth && --size > 8);
  return size;
}

export function texture(scene, name, w, h, draw, { alpha = false } = {}) {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  tex.hasAlpha = alpha;
  draw(tex.getContext(), w, h);
  tex.update();
  return tex;
}

/** Unlit material (signage stays legible regardless of scene lighting). */
export function signMaterial(scene, name, tex) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.emissiveTexture = tex;
  m.disableLighting = true;
  if (tex.hasAlpha) m.opacityTexture = tex;
  return m;
}

/** Plain lit material. emissive lifts surfaces that face away from the sun (no black walls). */
export function flatMaterial(scene, name, hex, { metallic = false, emissive = 0 } = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = metallic ? new Color3(0.55, 0.55, 0.55) : new Color3(0.05, 0.05, 0.05);
  m.specularPower = metallic ? 64 : 16;
  if (emissive) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  return m;
}
