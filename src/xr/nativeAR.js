// RA nos celulares sem WebXR de realidade aumentada: os visualizadores de RA do próprio sistema.
//  - iPhone/iPad (Safari e qualquer navegador do iOS, todos WebKit): AR Quick Look com models/bomba.usdz,
//    gerado no build a partir do GLB da aplicação (scripts/usdz.mjs);
//  - Android sem WebXR "immersive-ar" (outros navegadores, WebView): Google Scene Viewer com models/bomba-ar.glb
//    (o mesmo modelo simplificado, sem Draco, que o Scene Viewer não garante), gerado junto.
// Nos dois a bancada aparece em tamanho real, apoiada no chão, mas é um modelo estático: as leituras ao vivo
// ficam no site. Com WebXR (Chrome no Android com ARCore, Meta Quest 3) a RA completa de xr/ar.js continua.

export const AR_UNAVAILABLE = "RA não disponível neste dispositivo (use um celular Android ou iPhone, ou o Meta Quest 3).";

/**
 * Which AR the device offers, from facts gathered by the caller (pure: unit-tested).
 * @param {{ secure: boolean, ua: string, platform?: string, maxTouchPoints?: number, quickLook: boolean, webxrAR: boolean }} env
 * @returns {{ supported: boolean, kind: "webxr"|"quicklook"|"sceneviewer"|null, reason?: string }}
 */
export function detectARKind({ secure, ua, platform = "", maxTouchPoints = 0, quickLook, webxrAR }) {
  if (!secure) return { supported: false, kind: null, reason: "Requer HTTPS (contexto seguro)." };
  // iPadOS asks for the desktop site by default: it reports "MacIntel" with a touch screen
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (ios) {
    return quickLook
      ? { supported: true, kind: "quicklook" }
      : { supported: false, kind: null, reason: "RA indisponível: este navegador do iOS não abre o AR Quick Look." };
  }
  if (webxrAR) return { supported: true, kind: "webxr" };
  if (/Android/i.test(ua)) return { supported: true, kind: "sceneviewer" };
  return { supported: false, kind: null, reason: AR_UNAVAILABLE };
}

/**
 * Google Scene Viewer intent through the Google app: AR where the phone supports it, 3D viewer otherwise;
 * browser_fallback_url (required for links in a page) brings the user back here when the app is missing.
 */
export function sceneViewerURL(modelUrl, { title = "Bancada MecMonitor", fallbackUrl } = {}) {
  const params = new URLSearchParams({ file: modelUrl, mode: "ar_preferred", title });
  const fallback = `S.browser_fallback_url=${encodeURIComponent(fallbackUrl ?? modelUrl)};`;
  return `intent://arvr.google.com/scene-viewer/1.0?${params}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;${fallback}end;`;
}

/** Opens AR Quick Look: a link with rel="ar" that contains an image, clicked during the user's tap. */
export function openQuickLook(usdzUrl, doc = document) {
  const a = doc.createElement("a");
  a.setAttribute("rel", "ar");
  a.setAttribute("href", usdzUrl);
  a.appendChild(doc.createElement("img"));
  a.click();
  return a;
}

/** True where Safari/WebKit can open AR Quick Look links. */
export function supportsQuickLook(doc = document) {
  try {
    return Boolean(doc.createElement("a").relList?.supports?.("ar"));
  } catch {
    return false;
  }
}
