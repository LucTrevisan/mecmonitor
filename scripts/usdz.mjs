// RA nos celulares sem WebXR: converte o GLB da aplicação (Draco) para os visualizadores de RA do sistema,
// sem dependências novas.
// Uso: node scripts/usdz.mjs [entrada.glb] [pasta de saída]
//   padrão: public/models/bomba-draco.glb → dist/models/ (roda no "npm run build", depois do Vite):
//   - bomba.usdz   iPhone/iPad: AR Quick Look (src/xr/nativeAR.js);
//   - bomba-ar.glb Android sem WebXR: Google Scene Viewer (mesma geometria simplificada, sem Draco).
//
// O Safari não tem WebXR, então no iOS o botão "Entrar em RA" abre o AR Quick Look da Apple com este arquivo:
// a bancada em tamanho real, apoiada no chão (âncora em plano horizontal). É um modelo estático: as leituras
// ao vivo dos sensores ficam no site.
//
// Conversão:
//  - geometria decodificada com o decodificador Draco do próprio projeto (public/draco/draco_decoder_gltf.js);
//  - transformações dos nós aplicadas aos vértices (normais com a inversa transposta; espelhamento inverte a
//    ordem dos triângulos); a bancada fica centrada em x/z com a base em y = 0, como em modelLoader.placePump;
//  - um Mesh por primitiva, material UsdPreviewSurface (cor, metálico, rugosidade, opacidade);
//  - USDZ = ZIP sem compressão, cada arquivo alinhado em 64 bytes, a camada raiz (.usda) primeiro;
//  - malha simplificada numa grade de 2 mm (simplify): ~5 MB em vez de ~18 MB, mesma aparência na RA.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- GLB ----------
export function parseGLB(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("não é um GLB");
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < dv.byteLength) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    const chunk = new Uint8Array(buf.buffer, buf.byteOffset + offset + 8, len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + len;
  }
  if (!json) throw new Error("GLB sem JSON");
  return { json, bin };
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const ARRAYS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

/** Plain (non-Draco) accessor → typed array copy (handles byteStride). */
export function readAccessor(json, bin, index) {
  const a = json.accessors[index];
  const n = COMPONENTS[a.type];
  const Arr = ARRAYS[a.componentType];
  const out = new Arr(a.count * n);
  if (a.bufferView === undefined) return out;
  const bv = json.bufferViews[a.bufferView];
  const size = Arr.BYTES_PER_ELEMENT;
  const stride = bv.byteStride || n * size;
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const get = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv[get](base + i * stride + k * size, true);
  if (a.normalized) throw new Error("acessor normalizado não suportado");
  return out;
}

// ---------- Draco ----------
let dracoModule = null;
/** The project's own Draco decoder (pure JS build), loaded in Node without any package. */
export async function loadDraco(file = resolve(ROOT, "public/draco/draco_decoder_gltf.js")) {
  if (dracoModule) return dracoModule;
  const src = readFileSync(file, "utf8");
  const mod = { exports: {} };
  new Function("module", "exports", "require", "__filename", "__dirname", src)(mod, mod.exports, createRequire(file), file, dirname(file));
  dracoModule = await mod.exports();
  return dracoModule;
}

function decodeDraco(draco, json, bin, prim) {
  const ext = prim.extensions.KHR_draco_mesh_compression;
  const bv = json.bufferViews[ext.bufferView];
  const data = new Int8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
  const decoder = new draco.Decoder();
  const buffer = new draco.DecoderBuffer();
  buffer.Init(data, data.length);
  const mesh = new draco.Mesh();
  try {
    const status = decoder.DecodeBufferToMesh(buffer, mesh);
    if (!status.ok() || mesh.ptr === 0) throw new Error(`Draco: ${status.error_msg()}`);
    const attr = (id) => {
      const att = decoder.GetAttributeByUniqueId(mesh, id);
      const count = mesh.num_points() * att.num_components();
      const bytes = count * 4;
      const ptr = draco._malloc(bytes);
      try {
        decoder.GetAttributeDataArrayForAllPoints(mesh, att, draco.DT_FLOAT32, bytes, ptr);
        return new Float32Array(draco.HEAPF32.buffer, ptr, count).slice();
      } finally {
        draco._free(ptr);
      }
    };
    const faces = mesh.num_faces();
    const ibytes = faces * 3 * 4;
    const iptr = draco._malloc(ibytes);
    let indices;
    try {
      decoder.GetTrianglesUInt32Array(mesh, ibytes, iptr);
      indices = new Uint32Array(draco.HEAPU32.buffer, iptr, faces * 3).slice();
    } finally {
      draco._free(iptr);
    }
    return {
      positions: attr(ext.attributes.POSITION),
      normals: ext.attributes.NORMAL !== undefined ? attr(ext.attributes.NORMAL) : null,
      indices,
    };
  } finally {
    draco.destroy(mesh);
    draco.destroy(buffer);
    draco.destroy(decoder);
  }
}

// ---------- matrices (column-major, glTF) ----------
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
/** Inverse-transpose of the upper 3×3 (row-major 3×3 result) and its determinant sign. */
function normalMatrix(m) {
  const a = m[0], b = m[4], c = m[8];
  const d = m[1], e = m[5], f = m[9];
  const g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  // cofactor matrix = det · inverse-transpose (the scale does not matter: normals are renormalized)
  const n = [A, B, C, -(b * i - c * h), a * i - c * g, -(a * h - b * g), b * f - c * e, -(a * f - c * d), a * e - b * d];
  return { n, det };
}

/** Local (untransformed) geometry of one primitive. */
function readPrimitive(json, bin, draco, prim) {
  if (prim.extensions?.KHR_draco_mesh_compression) {
    if (!draco) throw new Error("GLB com Draco: decodificador necessário");
    return decodeDraco(draco, json, bin, prim);
  }
  const positions = Float32Array.from(readAccessor(json, bin, prim.attributes.POSITION));
  return {
    positions,
    normals: prim.attributes.NORMAL !== undefined ? Float32Array.from(readAccessor(json, bin, prim.attributes.NORMAL)) : null,
    indices: prim.indices !== undefined ? Uint32Array.from(readAccessor(json, bin, prim.indices)) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i),
  };
}

/**
 * The default scene as prototypes (each triangle primitive decoded once, in its own space) and instances
 * (node world matrix + prototype + material): meshes reused by several nodes are written only once.
 * @returns {{ prototypes: { key: string, name: string, positions: Float32Array, normals: Float32Array|null, indices: Uint32Array }[],
 *             instances: { name: string, proto: number, material: number, matrix: number[] }[] }}
 */
export function collectScene(json, bin, draco) {
  const prototypes = [];
  const protoIndex = new Map();
  const instances = [];
  const scene = json.scenes?.[json.scene ?? 0] ?? { nodes: json.nodes.map((_, i) => i) };
  const visit = (index, parent) => {
    const node = json.nodes[index];
    const world = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = json.meshes[node.mesh];
      mesh.primitives.forEach((prim, p) => {
        if ((prim.mode ?? 4) !== 4) return; // triangles only (no lines/points in this model)
        const key = `${node.mesh}_${p}`;
        if (!protoIndex.has(key)) {
          protoIndex.set(key, prototypes.length);
          prototypes.push({ key, name: mesh.name ?? node.name ?? `mesh_${node.mesh}`, ...readPrimitive(json, bin, draco, prim) });
        }
        instances.push({ name: node.name ?? mesh.name ?? "parte", proto: protoIndex.get(key), material: prim.material ?? -1, matrix: world });
      });
    }
    (node.children ?? []).forEach((c) => visit(c, world));
  };
  scene.nodes.forEach((i) => visit(i, IDENTITY));
  return { prototypes, instances };
}

/** Exact world bounds of all instances. */
export function sceneBounds({ prototypes, instances }) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const inst of instances) {
    const P = prototypes[inst.proto].positions;
    const m = inst.matrix;
    for (let v = 0; v < P.length; v += 3) {
      const x = P[v], y = P[v + 1], z = P[v + 2];
      for (let k = 0; k < 3; k++) {
        const c = m[k] * x + m[4 + k] * y + m[8 + k] * z + m[12 + k];
        if (c < min[k]) min[k] = c;
        if (c > max[k]) max[k] = c;
      }
    }
  }
  return { min, max };
}

/** Instance matrices that center the model in x/z and rest its base on y = 0 (as modelLoader.placePump). */
export function placeOnFloor(sceneData) {
  const { min, max } = sceneBounds(sceneData);
  const off = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
  for (const inst of sceneData.instances) {
    inst.matrix = inst.matrix.slice();
    for (let k = 0; k < 3; k++) inst.matrix[12 + k] += off[k];
  }
  return { size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/**
 * Vertex clustering on a grid of `cell` (model units): vertices in the same cell share one position (the
 * mean), so no cracks open; normals are averaged per cell AND normal direction (~20° buckets), so hard edges
 * stay hard. Triangles that collapse (two corners in one cell) or repeat are dropped.
 */
export function simplify(geo, cell) {
  if (!cell) return geo;
  const P = geo.positions;
  const N = geo.normals;
  const n = P.length / 3;
  const cellOf = new Int32Array(n);
  const cells = new Map();
  const sums = [];
  for (let v = 0; v < n; v++) {
    const k = `${Math.floor(P[v * 3] / cell)},${Math.floor(P[v * 3 + 1] / cell)},${Math.floor(P[v * 3 + 2] / cell)}`;
    let c = cells.get(k);
    if (c === undefined) {
      c = sums.length;
      cells.set(k, c);
      sums.push([0, 0, 0, 0]);
    }
    const s = sums[c];
    s[0] += P[v * 3];
    s[1] += P[v * 3 + 1];
    s[2] += P[v * 3 + 2];
    s[3]++;
    cellOf[v] = c;
  }
  // output vertices: (cell, normal bucket)
  const outIndex = new Int32Array(n);
  const verts = new Map();
  const pos = [];
  const nrm = [];
  for (let v = 0; v < n; v++) {
    const c = cellOf[v];
    const b = N ? `${Math.round(N[v * 3] * 3)},${Math.round(N[v * 3 + 1] * 3)},${Math.round(N[v * 3 + 2] * 3)}` : "";
    const k = `${c}|${b}`;
    let o = verts.get(k);
    if (o === undefined) {
      o = pos.length / 3;
      verts.set(k, o);
      const s = sums[c];
      pos.push(s[0] / s[3], s[1] / s[3], s[2] / s[3]);
      nrm.push(0, 0, 0);
    }
    if (N) {
      nrm[o * 3] += N[v * 3];
      nrm[o * 3 + 1] += N[v * 3 + 1];
      nrm[o * 3 + 2] += N[v * 3 + 2];
    }
    outIndex[v] = o;
  }
  for (let o = 0; o < nrm.length; o += 3) {
    const l = Math.hypot(nrm[o], nrm[o + 1], nrm[o + 2]) || 1;
    nrm[o] /= l;
    nrm[o + 1] /= l;
    nrm[o + 2] /= l;
  }
  const I = geo.indices;
  const tris = [];
  const seen = new Set();
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    if (cellOf[a] === cellOf[b] || cellOf[b] === cellOf[c] || cellOf[a] === cellOf[c]) continue;
    const ia = outIndex[a], ib = outIndex[b], ic = outIndex[c];
    // the same triangle in any rotation of its corners
    const r = ia < ib && ia < ic ? `${ia},${ib},${ic}` : ib < ic ? `${ib},${ic},${ia}` : `${ic},${ia},${ib}`;
    if (seen.has(r)) continue;
    seen.add(r);
    tris.push(ia, ib, ic);
  }
  // drop vertices no triangle uses
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const P2 = [];
  const N2 = [];
  const I2 = new Uint32Array(tris.length);
  for (let i = 0; i < tris.length; i++) {
    let r = remap[tris[i]];
    if (r < 0) {
      r = remap[tris[i]] = P2.length / 3;
      P2.push(pos[tris[i] * 3], pos[tris[i] * 3 + 1], pos[tris[i] * 3 + 2]);
      N2.push(nrm[tris[i] * 3], nrm[tris[i] * 3 + 1], nrm[tris[i] * 3 + 2]);
    }
    I2[i] = r;
  }
  return { ...geo, positions: Float32Array.from(P2), normals: N ? Float32Array.from(N2) : null, indices: I2 };
}

// ---------- USDA ----------
const ident = (s, used) => {
  let id = String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_]/g, "_");
  if (!/^[A-Za-z_]/.test(id)) id = `_${id}`;
  let unique = id;
  for (let i = 2; used.has(unique); i++) unique = `${id}_${i}`;
  used.add(unique);
  return unique;
};
const num = (x, d) => {
  const s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};
const tuple = (arr, i, d) => `(${num(arr[i], d)},${num(arr[i + 1], d)},${num(arr[i + 2], d)})`;
function list(count, fn) {
  const parts = new Array(count);
  for (let i = 0; i < count; i++) parts[i] = fn(i);
  return parts.join(",");
}
const header = (defaultPrim) => `#usda 1.0
(
    customLayerData = {
        string creator = "MecMonitor scripts/usdz.mjs"
    }
    defaultPrim = "${defaultPrim}"
    metersPerUnit = 1
    upAxis = "Y"
)
`;

// Geometry is written in millimetres (shorter numbers); each instance matrix carries the 1/1000 scale.
export const GEOMETRY_UNIT = 0.001;

/** Geometry layer of one prototype (referenced by every instance, like three.js' USDZExporter). */
export function buildGeometryUSDA(geo) {
  const s = 1 / GEOMETRY_UNIT;
  const P = geo.positions;
  const tris = geo.indices.length / 3;
  let normals = "";
  if (geo.normals) {
    normals = `        normal3f[] normals = [${list(geo.normals.length / 3, (i) => tuple(geo.normals, i * 3, 2))}] (
            interpolation = "vertex"
        )
`;
  }
  return `${header("Geometry")}
def "Geometry"
{
    def Mesh "Geometry"
    {
        int[] faceVertexCounts = [${list(tris, () => "3")}]
        int[] faceVertexIndices = [${geo.indices.join(",")}]
${normals}        point3f[] points = [${list(P.length / 3, (i) => `(${num(P[i * 3] * s, 1)},${num(P[i * 3 + 1] * s, 1)},${num(P[i * 3 + 2] * s, 1)})`)}]
        uniform token subdivisionScheme = "none"
    }
}
`;
}

/** Root layer: anchored scene, one Xform per instance (matrix + reference + material), materials. */
export function buildRootUSDA({ instances }, materials, geometryFile, { name = "MecMonitor" } = {}) {
  const used = new Set();
  const matNames = materials.map((m, i) => ident(m.name ? `${m.name}_${i}` : `Material_${i}`, used));
  const fallback = ident("Default", used);
  const g = (x) => (Math.abs(x) < 1e-12 ? "0" : String(Number(x.toPrecision(10))));
  const out = [header("Root")];
  out.push(`
def Xform "Root"
{
    def Scope "Scenes" (
        kind = "sceneLibrary"
    )
    {
        def Xform "Scene" (
            customData = {
                bool preliminary_collidesWithEnvironment = 0
                string sceneName = "${name}"
            }
            sceneName = "${name}"
        )
        {
            token preliminary:anchoring:type = "plane"
            token preliminary:planeAnchoring:alignment = "horizontal"
`);
  const names = new Set();
  for (const inst of instances) {
    const m = inst.matrix.map((x, i) => (i < 12 && i % 4 < 3 ? x * GEOMETRY_UNIT : x));
    const rows = [0, 1, 2, 3].map((r) => `(${g(m[r * 4])}, ${g(m[r * 4 + 1])}, ${g(m[r * 4 + 2])}, ${g(m[r * 4 + 3])})`).join(", ");
    const mat = inst.material >= 0 ? matNames[inst.material] : fallback;
    out.push(`
            def Xform "${ident(inst.name, names)}" (
                prepend references = @./${geometryFile(inst.proto)}@</Geometry>
                prepend apiSchemas = ["MaterialBindingAPI"]
            )
            {
                matrix4d xformOp:transform = ( ${rows} )
                uniform token[] xformOpOrder = ["xformOp:transform"]
                rel material:binding = </Root/Materials/${mat}>
            }
`);
  }
  out.push(`        }
    }

    def "Materials"
    {
`);
  const material = (id, m) => {
    const pbr = m?.pbrMetallicRoughness ?? {};
    const [r, gg, b, a] = pbr.baseColorFactor ?? [0.8, 0.8, 0.8, 1];
    const opacity = m?.alphaMode === "BLEND" ? a : 1;
    return `        def Material "${id}"
        {
            token outputs:surface.connect = </Root/Materials/${id}/PreviewSurface.outputs:surface>

            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = (${num(r, 4)}, ${num(gg, 4)}, ${num(b, 4)})
                float inputs:metallic = ${num(pbr.metallicFactor ?? 1, 3)}
                float inputs:roughness = ${num(pbr.roughnessFactor ?? 1, 3)}
                float inputs:opacity = ${num(opacity, 3)}
                int inputs:useSpecularWorkflow = 0
                token outputs:surface
            }
        }
`;
  };
  materials.forEach((m, i) => out.push(material(matNames[i], m)));
  out.push(material(fallback, null));
  out.push(`    }
}
`);
  return out.join("");
}

// ---------- USDZ (ZIP, stored, 64-byte aligned) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @param {{ name: string, data: Uint8Array }[]} files  first file = root layer */
export function zipUSDZ(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    // the file data must start on a 64-byte boundary: pad with an extra field (id 0x1986, as Pixar's writer)
    let pad = (64 - ((offset + 30 + name.length) % 64)) % 64;
    if (pad > 0 && pad < 4) pad += 64;
    const extra = new Uint8Array(pad);
    if (pad) {
      const dv = new DataView(extra.buffer);
      dv.setUint16(0, 0x1986, true);
      dv.setUint16(2, pad - 4, true);
    }
    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, 0, true); // time
    lv.setUint16(12, 0x21, true); // date 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true);
    lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, pad, true);
    chunks.push(local, name, extra, f.data);
    const cd = new Uint8Array(46);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true); // no extra in the central directory
    cv.setUint32(42, offset, true);
    central.push(cd, name);
    offset += 30 + name.length + pad + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// ---------- GLB (plain: no Draco, for Scene Viewer) ----------
/** Prototypes as meshes, instances as nodes (matrices already on the floor), the same materials. */
export function buildGLB({ prototypes, instances }, materials) {
  const views = [];
  const accessors = [];
  const chunks = [];
  let length = 0;
  const add = (array, target, type, componentType, extra = {}) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    views.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target });
    chunks.push(bytes);
    length += bytes.length;
    const pad = (4 - (length % 4)) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      length += pad;
    }
    const count = array.length / { SCALAR: 1, VEC3: 3 }[type];
    accessors.push({ bufferView: views.length - 1, componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  const meshes = prototypes.map((p) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < p.positions.length; v += 3) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.positions[v + k]);
      max[k] = Math.max(max[k], p.positions[v + k]);
    }
    const attributes = { POSITION: add(p.positions, 34962, "VEC3", 5126, { min, max }) };
    if (p.normals) attributes.NORMAL = add(p.normals, 34962, "VEC3", 5126);
    return { attributes, indices: add(p.indices, 34963, "SCALAR", 5125) };
  });
  // one glTF mesh per (prototype, material) pair actually used
  const meshIndex = new Map();
  const gltfMeshes = [];
  const nodes = instances.map((inst) => {
    const key = `${inst.proto}|${inst.material}`;
    if (!meshIndex.has(key)) {
      meshIndex.set(key, gltfMeshes.length);
      const prim = { ...meshes[inst.proto], mode: 4 };
      if (inst.material >= 0) prim.material = inst.material;
      gltfMeshes.push({ primitives: [prim] });
    }
    return { name: inst.name, mesh: meshIndex.get(key), matrix: inst.matrix };
  });
  const json = {
    asset: { version: "2.0", generator: "MecMonitor scripts/usdz.mjs" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: gltfMeshes,
    materials: materials.map((m) => ({ name: m.name, pbrMetallicRoughness: m.pbrMetallicRoughness ?? {}, ...(m.alphaMode ? { alphaMode: m.alphaMode } : {}), ...(m.doubleSided ? { doubleSided: true } : {}) })),
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: length }],
  };
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20);
  jsonChunk.set(jsonBytes);
  const total = 12 + 8 + jsonChunk.length + 8 + length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonChunk.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  let p = 20 + jsonChunk.length;
  dv.setUint32(p, length, true);
  dv.setUint32(p + 4, 0x004e4942, true);
  p += 8;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/**
 * GLB bytes → USDZ bytes (+ the plain GLB for Scene Viewer).
 * cell: simplification grid in metres (0 = keep every triangle).
 */
export async function glbToUSDZ(glbBytes, { draco = null, cell = DEFAULT_CELL } = {}) {
  const { json, bin } = parseGLB(glbBytes);
  const needsDraco = (json.extensionsUsed ?? []).includes("KHR_draco_mesh_compression");
  const sceneData = collectScene(json, bin, needsDraco ? draco ?? (await loadDraco()) : null);
  const placement = placeOnFloor(sceneData);
  sceneData.prototypes = sceneData.prototypes.map((p) => simplify(p, cell));
  const enc = new TextEncoder();
  const file = (i) => `geometries/G${i}.usda`;
  const files = [{ name: "bomba.usda", data: enc.encode(buildRootUSDA(sceneData, json.materials ?? [], file)) }];
  sceneData.prototypes.forEach((p, i) => files.push({ name: file(i), data: enc.encode(buildGeometryUSDA(p)) }));
  const used = new Set(sceneData.instances.map((i) => i.proto));
  return {
    bytes: zipUSDZ(files),
    glb: buildGLB(sceneData, json.materials ?? []),
    prototypes: sceneData.prototypes.length,
    instances: sceneData.instances.length,
    triangles: sceneData.instances.reduce((s, i) => s + sceneData.prototypes[i.proto].indices.length / 3, 0),
    unused: sceneData.prototypes.length - used.size,
    size: placement.size,
  };
}

// 2 mm: about half of the triangles go (dense CAD tessellation of fillets, threads and small holes); the
// bench reads the same at AR distance and the file stays small enough to open on a phone over 4G.
export const DEFAULT_CELL = 0.002;

// ---------- CLI ----------
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const input = resolve(process.argv[2] ?? resolve(ROOT, "public/models/bomba-draco.glb"));
  const outDir = resolve(process.argv[3] ?? resolve(ROOT, "dist/models"));
  const t0 = Date.now();
  const cell = process.env.USDZ_CELL !== undefined ? Number(process.env.USDZ_CELL) : DEFAULT_CELL;
  const r = await glbToUSDZ(readFileSync(input), { cell });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "bomba.usdz"), r.bytes);
  writeFileSync(resolve(outDir, "bomba-ar.glb"), r.glb);
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`RA nativa em ${outDir}: bomba.usdz ${mb(r.bytes.length)} MB, bomba-ar.glb ${mb(r.glb.length)} MB — ${r.prototypes} geometrias, ${r.instances} peças, ${r.triangles} triângulos, ${r.size.map((s) => s.toFixed(2)).join(" × ")} m, ${Date.now() - t0} ms`);
}
