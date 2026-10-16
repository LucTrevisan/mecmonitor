// Realismo da bancada no próprio GLB, a partir das fotos da bancada real (public/foto/*.jpeg fora do repo).
// Uso: node scripts/glb-realismo.mjs <entrada.glb> <saida.glb>
//   A entrada é o modelo ORIGINAL (por exemplo: git show xr-f14-ra:public/models/bomba-draco.glb > base.glb).
//
// O que muda (somente aparência):
//  - cores: materiais NOVOS só para as peças-alvo (reservatórios, flanges, funil, suporte e tampas de mancal
//    em verde de máquina; volantes, alavancas e proteção do acoplamento em laranja; corpo das válvulas de
//    esfera niquelado; quadro elétrico em RAL 7032). Os materiais existentes e a geometria (Draco) ficam
//    byte a byte iguais, nenhum nó muda de nome, posição ou hierarquia.
//  - peças novas, cada uma num nó próprio filho da raiz (nunca do quadro CEMAR-1, cujo contorno ancora o I-01):
//    estrutura tubular branca (40×40 mm) e IHM WEG na porta do quadro.
//    Tudo dentro do contorno atual do modelo: o layout do laboratório, os sensores e a pose inicial não mudam.
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("uso: node scripts/glb-realismo.mjs <entrada.glb> <saida.glb>");
  process.exit(1);
}

// ---------- GLB ----------
const glb = readFileSync(input);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error("não é um GLB");
const jsonLen = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const binHeader = 20 + jsonLen;
const binLen = glb.readUInt32LE(binHeader);
let bin = Buffer.from(glb.subarray(binHeader + 8, binHeader + 8 + binLen));
if (gltf.asset?.extras?.mecmonitorRealismo) throw new Error("este GLB já recebeu o realismo: use o modelo original como entrada");

// ---------- materiais ----------
const lin = (hex) => {
  const c = hex.replace("#", "");
  return [0, 2, 4].map((i) => {
    const s = parseInt(c.slice(i, i + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
};
const addMaterial = (name, hex, { metallic = 0, roughness = 0.5 } = {}) => {
  gltf.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [...lin(hex), 1], metallicFactor: metallic, roughnessFactor: roughness } });
  return gltf.materials.length - 1;
};
// Verde igual ao da tubulação e da carcaça (COLOR_OVERRIDES em src/config/appearance.js): tudo pintado com a mesma tinta.
const GREEN = addMaterial("Pintura verde de máquina (bancada)", "#2E8B47", { roughness: 0.35 });
const ORANGE = addMaterial("Laranja de segurança (volantes, alavancas, proteção)", "#E8641E", { roughness: 0.45 });
const CABINET = addMaterial("Pintura eletrostática RAL 7032 (quadro elétrico)", "#C2BFB0", { roughness: 0.6 });
const NICKEL = addMaterial("Latão niquelado (válvulas de esfera)", "#C9C6BE", { metallic: 1, roughness: 0.35 });
const WHITE = addMaterial("Tubo 40×40 pintado de branco (estrutura)", "#E6E2D8", { roughness: 0.5 });
const HMI_BEZEL = addMaterial("IHM WEG: moldura", "#B9C4D2", { roughness: 0.45 });
const HMI_FACE = addMaterial("IHM WEG: teclado", "#9FB0C6", { roughness: 0.4 });
const HMI_LCD = addMaterial("IHM WEG: display", "#4E5953", { roughness: 0.15 });
const HMI_KEY = addMaterial("IHM WEG: teclas", "#E6E8EB", { roughness: 0.35 });
const HMI_GO = addMaterial("IHM WEG: tecla liga", "#2E9E4F", { roughness: 0.35 });
const HMI_STOP = addMaterial("IHM WEG: tecla desliga", "#D8362F", { roughness: 0.35 });
const HMI_LOGO = addMaterial("IHM WEG: logotipo", "#1F3B73", { roughness: 0.4 });

// Reatribui materiais por (nó → malha, material antigo → novo). Uma malha compartilhada só muda se TODOS os
// nós que a usam forem alvo (senão a cor vazaria para outras peças).
const users = new Map();
gltf.nodes.forEach((n) => n.mesh != null && users.set(n.mesh, [...(users.get(n.mesh) ?? []), n.name]));
const recolor = (targets, from, to) => {
  const meshes = new Set(gltf.nodes.filter((n) => n.mesh != null && targets.some((t) => (t instanceof RegExp ? t.test(n.name) : n.name === t))).map((n) => n.mesh));
  if (!meshes.size) throw new Error(`nenhum nó encontrado: ${targets}`);
  let changed = 0;
  for (const m of meshes) {
    const names = users.get(m);
    if (!names.every((name) => targets.some((t) => (t instanceof RegExp ? t.test(name) : name === t)))) throw new Error(`malha ${m} compartilhada com peças fora do grupo: ${names}`);
    for (const p of gltf.meshes[m].primitives) {
      if (p.material === from) {
        p.material = to;
        changed++;
      }
    }
  }
  if (!changed) throw new Error(`material ${from} não encontrado em ${targets}`);
  return changed;
};
const log = [];
const paint = (label, targets, from, to) => log.push(`${label}: ${recolor(targets, from, to)} primitiva(s)`);
paint("reservatórios → verde", ["reservatorio.stp-1", "reservatorio_2.stp-1"], 38, GREEN);
paint("funil de escorva → verde", ["hopperfunnel 2-1"], 4, GREEN);
paint("flanges → verde", [/^SLIP-ON FLANGE/], 0, GREEN);
paint("suporte do mancal → verde", ["SUPPORT-1"], 11, GREEN);
paint("tampas dos mancais → verde", [/^Bearing Cover-/], 9, GREEN);
paint("proteção do acoplamento → laranja", ["PUMP PROTECTION-1"], 10, ORANGE);
paint("volantes dos registros → laranja", [/^Manopla-/], 27, ORANGE);
paint("volante da válvula globo → laranja", ["Peça 10-3"], 19, ORANGE);
paint("alavancas das válvulas de esfera → laranja", [/^VÁLVULA DE ESFERA/], 31, ORANGE);
paint("corpo das válvulas de esfera → niquelado", [/^VÁLVULA DE ESFERA/], 30, NICKEL);
paint("quadro elétrico (caixa) → RAL 7032", ["CEMAR-1"], 36, CABINET);
paint("quadro elétrico (porta) → RAL 7032", ["CEMAR-1"], 37, CABINET);

// ---------- geometria nova (caixas, sem Draco) ----------
// Coordenadas do glTF (iguais às do modelo; a raiz não tem transformação). Piso do modelo: y = 0.3063.
const FACES = [
  // [normal, u, v] com u × v = normal (triângulos anti-horários vistos de fora)
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];
/** Caixa alinhada aos eixos de [x0,y0,z0] a [x1,y1,z1]. */
const box = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });
function primitiveData(boxes) {
  const pos = [];
  const nrm = [];
  const idx = [];
  for (const b of boxes) {
    const c = b.min.map((v, k) => (v + b.max[k]) / 2);
    const h = b.min.map((v, k) => (b.max[k] - v) / 2);
    for (const [n, u, v] of FACES) {
      const base = pos.length / 3;
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        for (let k = 0; k < 3; k++) pos.push(c[k] + n[k] * h[k] + su * u[k] * h[k] + sv * v[k] * h[k]);
        nrm.push(...n);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}
const appendView = (typed, target) => {
  const pad = (4 - (bin.length % 4)) % 4;
  if (pad) bin = Buffer.concat([bin, Buffer.alloc(pad)]);
  const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  gltf.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length, target });
  bin = Buffer.concat([bin, bytes]);
  return gltf.bufferViews.length - 1;
};
const appendAccessor = (view, componentType, count, type, extra = {}) => {
  gltf.accessors.push({ bufferView: view, componentType, count, type, ...extra });
  return gltf.accessors.length - 1;
};
function addPart(name, groups) {
  const primitives = groups.map(([material, boxes]) => {
    const { pos, nrm, idx } = primitiveData(boxes);
    const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)));
    const max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)));
    const POSITION = appendAccessor(appendView(pos, 34962), 5126, pos.length / 3, "VEC3", { min, max });
    const NORMAL = appendAccessor(appendView(nrm, 34962), 5126, nrm.length / 3, "VEC3");
    const indices = appendAccessor(appendView(idx, 34963), 5123, idx.length, "SCALAR");
    return { attributes: { POSITION, NORMAL }, indices, material };
  });
  gltf.meshes.push({ name, primitives });
  gltf.nodes.push({ name, mesh: gltf.meshes.length - 1, extras: { mecmonitorRealismo: true } });
  const root = gltf.nodes.find((n) => n.name === "projeto_bomba_centrifuga1609final");
  root.children.push(gltf.nodes.length - 1);
  log.push(`${name}: ${groups.reduce((s, [, b]) => s + b.length, 0)} caixa(s), ${primitives.length} material(is)`);
}

// Estrutura tubular branca (foto "painel e frente da bancada"): tubo 40×40 mm.
const T = 0.04;
const FLOOR = 0.3063197433948517; // fundo do reservatório 1 = ponto mais baixo do modelo (o contorno não muda)
const frame = [];
{
  // 1) suportes abertos sob o reservatório 2 (hoje flutua 32 cm acima do piso): x 0.623–1.323, z 1.5096–2.2096
  const [x0, x1, z0, z1, top] = [0.623, 1.323, 1.5096, 2.2096, 0.6281];
  const xm = (x0 + x1) / 2;
  for (const y of [FLOOR, top - T]) {
    frame.push(box(x0, y, z1 - T, x1, y + T, z1), box(x0, y, z0, x1, y + T, z0 + T)); // frente / fundo
    frame.push(box(x0, y, z0 + T, x0 + T, y + T, z1 - T), box(x1 - T, y, z0 + T, x1, y + T, z1 - T)); // laterais
  }
  for (const x of [x0, xm - T / 2, x1 - T]) for (const z of [z0, z1 - T]) frame.push(box(x, FLOOR + T, z, x + T, top - T, z + T)); // montantes (3 por face)

  // 2) quadro sob a base da bomba (Base-1: x 0.173–1.023, z 1.474–1.855, fundo y 0.944): longarinas apoiadas no
  //    reservatório 2 à direita e em pés até o piso à esquerda do reservatório 1 e entre os reservatórios.
  const [yb, yt] = [0.883, 0.944];
  const [zb0, zf0] = [1.474, 1.815]; // longarina traseira / dianteira
  frame.push(box(-0.229, yb, zb0, 1.023, yt, zb0 + T)); // traseira até o fim da base
  frame.push(box(-0.229, yb, zf0, 0.84, yt, zf0 + T)); // dianteira (para antes do quadro elétrico)
  for (const x of [-0.229, 0.558]) {
    frame.push(box(x, yb, zb0 + T, x + T, yt, zf0)); // travessa no topo
    for (const z of [zb0, zf0]) frame.push(box(x, FLOOR, z, x + T, yb, z + T)); // pés
  }

  // 3) quadro baixo em volta do reservatório 1 (x −0.187–0.533, z 1.466–2.186), rente ao piso
  const [ax0, ax1, az0, az1, h, t] = [-0.187, 0.533, 1.466, 2.186, T, 0.02];
  frame.push(box(ax0 - t - 0.002, FLOOR, az0 - t - 0.002, ax1 + t + 0.002, FLOOR + h, az0 - 0.002)); // fundo
  frame.push(box(ax0 - t - 0.002, FLOOR, az1 + 0.002, ax1 + t + 0.002, FLOOR + h, az1 + t + 0.002)); // frente
  frame.push(box(ax0 - t - 0.002, FLOOR, az0 - 0.002, ax0 - 0.002, FLOOR + h, az1 + 0.002)); // esquerda
  frame.push(box(ax1 + 0.002, FLOOR, az0 - 0.002, ax1 + t + 0.002, FLOOR + h, az1 + 0.002)); // direita
}
addPart("Estrutura tubular da bancada", [[WHITE, frame]]);

// IHM WEG na porta do quadro (foto "painel"): centro a 75,5 % da largura (da esquerda) e 53 % da altura (do topo).
{
  const [xMin, yMax, W, H, zf] = [0.851, 1.511, 0.6, 0.6, 2.0915]; // caixa CEMAR-1 e frente da porta
  // No glTF, visto de frente (+z), a esquerda do observador é −x (o carregador do Babylon espelha o x).
  const cx = xMin + 0.755 * W;
  const cy = yMax - 0.53 * H;
  const [w, h, d] = [0.09, 0.146, 0.016];
  const z1 = zf + d;
  const at = (dx, dy, bw, bh, z0, dz) => box(cx + dx - bw / 2, cy + dy - bh / 2, z0, cx + dx + bw / 2, cy + dy + bh / 2, z0 + dz); // dx > 0: direita do observador
  const keys = [];
  for (const [dx, dy] of [[-0.024, -0.012], [0.024, -0.012], [-0.024, -0.03], [0.024, -0.03], [-0.024, -0.048]]) keys.push(at(dx, dy, 0.014, 0.008, z1 + 0.001, 0.003));
  keys.push(at(0, -0.021, 0.022, 0.022, z1 + 0.001, 0.004)); // cursor (setas)
  addPart("IHM WEG (inversor de frequência)", [
    [HMI_BEZEL, [box(cx - w / 2, cy - h / 2, zf, cx + w / 2, cy + h / 2, z1)]],
    [HMI_LOGO, [at(0, 0.064, 0.016, 0.007, z1, 0.0008)]],
    [HMI_LCD, [at(0, 0.03, 0.066, 0.046, z1, 0.0015)]],
    [HMI_FACE, [at(0, -0.031, 0.074, 0.064, z1, 0.0008)]],
    [HMI_KEY, keys],
    [HMI_GO, [at(0.024, -0.048, 0.012, 0.008, z1 + 0.001, 0.003)]],
    [HMI_STOP, [at(0, -0.048, 0.012, 0.008, z1 + 0.001, 0.003)]],
  ]);
}

// A chave seccionadora (placa amarela + manopla vermelha) fica na lateral direita do quadro, que é justamente o
// limite do modelo em x: ela aumentaria o contorno em 3 cm e deslocaria o layout do laboratório. Fica de fora.

// ---------- gravação ----------
gltf.buffers[0].byteLength = bin.length;
gltf.asset.extras = { ...gltf.asset.extras, mecmonitorRealismo: "estrutura tubular, IHM WEG e cores conforme as fotos da bancada real" };
const json = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + binPad.length, 8);
const chunk = (type, data) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(data.length, 0);
  h.writeUInt32LE(type, 4);
  return Buffer.concat([h, data]);
};
writeFileSync(output, Buffer.concat([header, chunk(0x4e4f534a, jsonPad), chunk(0x004e4942, binPad)]));
console.log(log.join("\n"));
console.log(`${input} (${glb.length} B) → ${output} (${12 + 8 + jsonPad.length + 8 + binPad.length} B)`);
