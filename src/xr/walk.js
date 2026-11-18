import { isWalkable } from "../scene/layout.js";

// Passo de caminhada do VR (puro, sem Babylon: testado em scripts/unit-test.mjs). Ligação aos controles: locomotion.js.
//
// Andar no VR com o direcional (thumbstick) do controle ESQUERDO, na direção para onde a pessoa olha.
// O controle direito continua com o teletransporte (empurrar para frente e soltar) e o giro em passos
// (para os lados). Só anda pelo piso livre: nunca atravessa a fita de segurança da bancada nem as
// paredes — encostou, desliza ao longo do limite. Desligado em RA (lá a pessoa anda na sala real).

export const WALK_SPEED = 1.3; // m/s com o direcional todo para frente (passo normal de uma pessoa)
export const DEADZONE = 0.15; // folga do direcional parado (drift dos controles)

/**
 * Um passo de caminhada (puro, testado em scripts/unit-test.mjs).
 * @param {{x:number, z:number}} pos   posição da cabeça no piso
 * @param {{x:number, z:number}} fwd   para onde a cabeça aponta, no piso (não precisa ser unitário)
 * @param {{x:number, y:number}} axes  direcional: y negativo = para frente, x positivo = direita
 * @param {number} dt                  segundos desde o último quadro
 * @returns {{x:number, z:number} | null}  nova posição, ou null para ficar parado
 */
export function walkStep(pos, fwd, axes, dt, layout, speed = WALK_SPEED) {
  const mag = Math.hypot(axes.x, axes.y);
  const fl = Math.hypot(fwd.x, fwd.z);
  if (mag < DEADZONE || fl < 1e-6 || !(dt > 0)) return null;
  const f = { x: fwd.x / fl, z: fwd.z / fl };
  const r = { x: f.z, z: -f.x }; // direita de quem olha para f (Babylon: mão esquerda, y para cima)
  // resposta suave: 0 na folga, 1 no fim do curso, nunca mais rápido na diagonal
  const k = (Math.min(1, (mag - DEADZONE) / (1 - DEADZONE)) / mag) * speed * Math.min(dt, 0.05);
  const dx = (r.x * axes.x - f.x * axes.y) * k;
  const dz = (r.z * axes.x - f.z * axes.y) * k;
  const ok = (x, z) => isWalkable(x, z, layout) || (!isWalkable(pos.x, pos.z, layout) && farther(x, z, pos, layout));
  if (ok(pos.x + dx, pos.z + dz)) return { x: pos.x + dx, z: pos.z + dz };
  if (Math.abs(dx) > 1e-9 && ok(pos.x + dx, pos.z)) return { x: pos.x + dx, z: pos.z }; // desliza no limite
  if (Math.abs(dz) > 1e-9 && ok(pos.x, pos.z + dz)) return { x: pos.x, z: pos.z + dz };
  return null;
}

// Fora do piso livre (a pessoa se inclinou de verdade sobre a fita): só deixa andar para longe da bancada.
function farther(x, z, pos, L) {
  const d = (px, pz) => Math.hypot(px - L.center.x, pz - L.center.z);
  return d(x, z) > d(pos.x, pos.z);
}
