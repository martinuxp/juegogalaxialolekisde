/* =========================================================
   Pruebas de la SUPERFICIE de Ícaro · node pruebas/superficie.test.mjs
   ---------------------------------------------------------
   Revisa que el recorrido se pueda pasar y que cada parte pida
   lo que tiene que pedir, SIMULANDO los saltos con pasoNewton
   (la misma física del juego) sobre el planeta de verdad
   (arena R = 400 m, g ≈ 20 m/s²):
     · los huecos entre islas y pasillos se saltan sin botas
     · las fisuras NO se suben con un salto normal, y SÍ con botas
     · el "salto del susto" (al quemarte) cae en el lugar seguro
     · la picada exponencial de Meowl: s(t) = v₀·τ·(e^(t/τ) − 1)
   ========================================================= */
import { definirMundo, pasoNewton, agregarMuro, superficieEn, collide } from '../js/fisica.js';
import { R_ARENA, PIEZAS, H_FISURA, puntoXZ, localXZ, ejesEn, dirXZ, tiroDeVuelta, solidosRuinas } from '../js/superficieDatos.js';
import { mundo } from '../js/fisica.js';
import { CFG } from '../js/config.js';
import { V3 } from '../js/util.js';

let fallas = 0;
function revisar(nombre, ok, detalle = '') {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? '  (' + detalle + ')' : ''}`);
  if (!ok) fallas++;
}
const f1 = n => n.toFixed(1);

// el planeta de la superficie (como en nivel2-icaro-superficie.js) y sus rocas
const P = { c: new V3(0, 0, 0), R: 398, mar: 400, g: 20.2 };
definirMundo([P], []);
for (const k of PIEZAS) {
  const { ex, ey, ez } = ejesEn(k.x, k.z, k.giro || 0);
  const m = agregarMuro(puntoXZ(k.x, k.z, (k.h - 4) / 2), ex, ey, ez, new V3(k.w / 2, (k.h + 4) / 2, k.d / 2));
  m.planeta = P;
}
// las ruinas también chocan (las mismas cajas y esferas que pone el juego): los saltos de abajo las tienen en cuenta
const ruinas = solidosRuinas();
for (const k of ruinas.cajas) { const m = agregarMuro(k.c, k.ex, k.ey, k.ez, k.medio); m.planeta = P; }
for (const e of ruinas.esferas) mundo.solidos.push({ c: e.c, R: e.R, planeta: P });
const pieza = id => PIEZAS.find(k => k.id === id);
const g = P.g * (P.R / R_ARENA) ** 2;
revisar('la gravedad en la arena es ≈ 20 m/s²', Math.abs(g - 20) < 0.05, `g = ${g.toFixed(2)}`);
revisar('superficieEn encuentra la cara de arriba de las rocas', Math.abs(superficieEn(P, dirXZ(0, -150)) - (R_ARENA + 16)) < 0.05);

/**
 * Un salto APUNTADO: sale de (x, z) sobre una roca de altura h con vy hacia arriba y
 * la rapidez de lado justa para caer en (tx, tz) a la altura hB (tiro parabólico):
 *   t = (vy + √(vy² − 2·g·Δh)) / g      v_x = distancia / t   (tiene que ser ≤ 9 m/s, lo que corres)
 * Después se SIMULA con pasoNewton y los choques del juego, para ver dónde cae de verdad.
 */
function saltar(x, z, h, tx, tz, hB, vy) {
  const dh = hB - h, disc = vy * vy - 2 * g * dh;
  if (disc < 0) return { arena: true, motivo: 'no sube tanto' };
  const tVuelo = (vy + Math.sqrt(disc)) / g, dist = Math.hypot(tx - x, tz - z), vx = dist / tVuelo;
  if (vx > CFG.run) return { arena: true, motivo: `pide correr a ${f1(vx)} m/s` };
  const b = { pos: puntoXZ(x, z, h + CFG.r), vel: new V3(), r: CFG.r, up: new V3(), grounded: false };
  b.up.copy(b.pos).normalize();
  const dir = puntoXZ(tx, tz, h).sub(puntoXZ(x, z, h)); dir.addScaledVector(b.up, -dir.dot(b.up)).normalize();
  b.vel.copy(b.up).multiplyScalar(vy).addScaledVector(dir, vx);
  const dt = 1 / 120;
  for (let t = 0; t < 4; t += dt) {
    pasoNewton(b.pos, b.vel, dt);
    b.up.copy(b.pos).normalize();
    collide(b);
    const l = localXZ(b.pos);
    if (b.grounded && t > 0.1) return { ...l, arena: false, t, vx };
    if (l.h < 0) return { ...l, arena: true, motivo: 'cayó en la arena' };
  }
  return { arena: true, motivo: 'no aterrizó' };
}
/** ¿Aterrizó sobre la pieza? */
const sobre = (l, k) => !l.arena && Math.abs(l.h - k.h - CFG.r) < 0.3;
/** El borde de A que mira hacia B (medio metro adentro). */
function borde(A, B) {
  const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
  let x = A.x, z = A.z;
  for (let s = 0; s < L; s += 0.05) {
    const px = A.x + dx / L * s, pz = A.z + dz / L * s;
    if (superficieEn(P, dirXZ(px, pz)) < R_ARENA + A.h - 0.05) break;
    x = px; z = pz;
  }
  return { x: x - dx / L * 0.5, z: z - dz / L * 0.5 };
}

// 0) las ruinas no se meten en el camino: ningún punto de arriba de una roca (hasta 3 m) queda dentro de una ruina
{
  const dentroCaja = (q, k) => { const d = q.clone().sub(k.c); return Math.abs(d.dot(k.ex)) < k.medio.x + CFG.r && Math.abs(d.dot(k.ey)) < k.medio.y + CFG.r && Math.abs(d.dot(k.ez)) < k.medio.z + CFG.r; };
  let malos = 0, total = 0;
  for (const k of PIEZAS) {
    const { ex, ez } = ejesEn(k.x, k.z, k.giro || 0);
    for (let a = -0.5; a <= 0.5; a += 0.1) for (let b = -0.5; b <= 0.5; b += 0.1) for (const y of [0.6, 1.5, 3]) {
      const q = puntoXZ(k.x, k.z, k.h + y).addScaledVector(ex, a * k.w).addScaledVector(ez, b * k.d); total++;
      if (ruinas.cajas.some(c => dentroCaja(q, c)) || ruinas.esferas.some(e => q.distanceTo(e.c) < e.R + CFG.r)) malos++;
    }
  }
  revisar('las ruinas sólidas no tapan las rocas del camino', malos === 0, `${ruinas.cajas.length} cajas y ${ruinas.esferas.length} esferas · ${malos} de ${total} puntos tapados`);
}

// 1) los huecos del camino se saltan SIN botas (salto normal de 14 m/s), cayendo al centro de la siguiente roca
const tramos = [['salida', 'isla1'], ['isla1', 'isla2'], ['isla2', 'isla3'], ['isla3', 'isla4'], ['pasillo3', 'pasillo4']];
for (const [a, b] of tramos) {
  const A = pieza(a), B = pieza(b), o = borde(A, B);
  const l = saltar(o.x, o.z, A.h, B.x, B.z, B.h, CFG.jump);
  revisar(`salto normal: ${a} → ${b}`, sobre(l, B), l.arena ? l.motivo : `corriendo a ${f1(l.vx)} m/s, cae a ${f1(Math.hypot(l.x - B.x, l.z - B.z))} m del centro`);
}

// 2) las fisuras: sin botas NO, con botas SÍ (cayendo 2 m adentro de la roca de arriba)
const hMax = v => v * v / (2 * g);
revisar('la fisura es más alta que el salto normal', H_FISURA > hMax(CFG.jump) + 1, `fisura ${H_FISURA} m · salto ${f1(hMax(CFG.jump))} m`);
revisar('y más baja que el salto con botas', H_FISURA < hMax(CFG.botasV) - 2, `botas ${f1(hMax(CFG.botasV))} m`);
for (const [a, b] of [['mesaB', 'mesaC'], ['mesaC', 'mesaD']]) {
  const A = pieza(a), B = pieza(b), o = borde(A, B), d = borde(B, A);
  const L = Math.hypot(B.x - o.x, B.z - o.z), tx = d.x + (B.x - d.x) / Math.hypot(B.x - d.x, B.z - d.z) * 1.5, tz = d.z + (B.z - d.z) / Math.hypot(B.x - d.x, B.z - d.z) * 1.5;
  const normal = saltar(o.x, o.z, A.h, tx, tz, B.h, CFG.jump);
  revisar(`fisura ${a} → ${b}: con salto normal NO se sube`, !sobre(normal, B), normal.motivo || '');
  const botas = saltar(o.x, o.z, A.h, tx, tz, B.h, CFG.botasV);
  revisar(`fisura ${a} → ${b}: con botas SÍ`, sobre(botas, B), botas.arena ? botas.motivo : `corriendo a ${f1(botas.vx)} m/s, aterriza en t = ${f1(botas.t)} s`);
}

// 3) el salto del susto: las ecuaciones del tiro parabólico llegan EXACTO al lugar seguro
//    (en el juego la posición sale de x = v_x·t, y = v_y·t − ½·g·t²; aquí lo revisamos paso a paso)
for (const [h, d] of [[2.8, 3], [3, 8], [16, 6], [0.5, 12]]) {
  const { vy, vx, t: T } = tiroDeVuelta(h, d, g);
  let x = 0, y = 0, v = vy, cima = 0;
  const dt = 1 / 1200;
  for (let t = 0; t < T - 1e-9; t += dt) { x += vx * dt; y += (v - g * dt / 2) * dt; v -= g * dt; cima = Math.max(cima, y); }
  revisar(`salto del susto: sube ${h} m y avanza ${d} m`, Math.abs(x - d) < 0.05 && Math.abs(y - h) < 0.05 && cima > h + 2,
    `llega a (${f1(x)}, ${f1(y)}) · cima ${f1(cima)} m · v_y = ${f1(vy)} m/s, v_x = ${f1(vx)} m/s`);
}

// 4) la picada de Meowl: integrar v = v₀·e^(t/τ) paso a paso da lo mismo que la fórmula s(t)
for (const tau of [0.36, 0.3, 0.25]) {
  let s = 0, t = 0; const dt = 1 / 120, v0 = 5;
  while (t < 0.8) { s += v0 * Math.exp((t + dt / 2) / tau) * dt; t += dt; }
  const formula = v0 * tau * (Math.exp(t / tau) - 1);
  revisar(`picada τ = ${tau}: suma paso a paso = v₀·τ·(e^(t/τ) − 1)`, Math.abs(s - formula) / formula < 0.01, `${f1(s)} m vs ${f1(formula)} m en ${f1(t)} s`);
}

// 4b) el salto de un meowlito desde la arena: el tiro apuntado (cima H = dh + 1) cae donde estás
for (const [dh, d] of [[2.7, 4], [3.3, 7], [0, 5]]) {
  const H = Math.max(dh, 0) + 1, vy = Math.sqrt(2 * g * H), T = vy / g + Math.sqrt(2 * (H - dh) / g), vx = d / T;
  let x = 0, y = 0, v = vy; const dt = 1 / 1200;
  for (let t = 0; t < T - 1e-9; t += dt) { x += vx * dt; y += (v - g * dt / 2) * dt; v -= g * dt; }
  revisar(`meowlito desde la arena: sube ${dh} m y avanza ${d} m`, Math.abs(x - d) < 0.05 && Math.abs(y - dh) < 0.05, `v_y = ${f1(vy)} m/s, v_h = ${f1(vx)} m/s, vuela ${f1(T)} s`);
}

// 5) el cañón: la velocidad de escape desde la arena de Meowl cabe en la barra
const GM = P.g * P.R * P.R, r = R_ARENA + 16 + 1.7;
const vesc = Math.sqrt(2 * GM / r);
revisar('v_esc de Ícaro cabe en el cañón (150 m/s)', vesc < 150 && vesc > 100, `v_esc = ${f1(vesc)} m/s`);
// y simulando: a v_esc + 3 % se aleja para siempre; a 90 % vuelve
function lanzar(v) {
  const pos = new V3(0, r, 0), vel = new V3(0, v, 0);
  for (let t = 0; t < 150; t += 1 / 60) { pasoNewton(pos, vel, 1 / 60); if (vel.dot(pos) < 0) return 'vuelve'; }   // llegó arriba y empezó a caer de vuelta (tarda ~1 min)
  return 0.5 * vel.lengthSq() - GM / pos.length() >= 0 ? 'escapa' : 'sigue subiendo';
}
revisar('al 103 % de v_esc escapa', lanzar(vesc * 1.03) === 'escapa');
revisar('al 90 % de v_esc vuelve', lanzar(vesc * 0.9) === 'vuelve');

console.log(fallas ? `\n${fallas} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
