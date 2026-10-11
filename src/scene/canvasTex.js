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

const images = new Map();
/** Loads an image from public/ once (shared by every sign that uses it). */
function loadImage(url) {
  if (!images.has(url)) {
    images.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `${import.meta.env.BASE_URL}${url}`;
      }),
    );
  }
  return images.get(url);
}

/**
 * Redraws a sign with an image (logo) once it loads: the image is rasterized into the sign's own canvas
 * (no extra large texture on the GPU). Until then / if the file is missing, the sign keeps its text
 * fallback. mesh.metadata.logo = "pending" | "loaded" | "fallback".
 */
export function drawSignImage(mesh, tex, url, redraw) {
  mesh.metadata = { ...mesh.metadata, logo: url ? "pending" : "fallback" };
  if (!url) return;
  loadImage(url).then(
    (img) => {
      const { width, height } = tex.getSize();
      redraw(tex.getContext(), width, height, img);
      tex.update();
      mesh.metadata = { ...mesh.metadata, logo: "loaded" };
    },
    () => {
      console.warn(`Logo não encontrado: ${url} (mantida a placa em texto)`);
      mesh.metadata = { ...mesh.metadata, logo: "fallback" };
    },
  );
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
