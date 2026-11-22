/* =========================================================
   Pruebas de KEPLER · node pruebas/kepler.test.mjs
   ---------------------------------------------------------
   Revisa con números la física del nivel 3:
     · 3ª ley de Kepler: T²/a³ igual para las dos lunas
     · las esferas de Hill: adentro manda la luna, y no se tocan
     · el camino va sobre el relieve (y la luna no choca con los cerros)
     · deslizar: la velocidad límite √(g(senθ − μcosθ)/c) se alcanza
     · el resorte: hay ventanas de lanzamiento y el tiro llega a la luna
     · el salto orbital de MeiMei da una vuelta completa sin caer
     · el resorte de salida alcanza para escapar de Kepler
   ========================================================= */
import * as K from '../js/keplerDatos.js';
import { V3 } from '../js/util.js';

let fallas = 0;
function revisar(nombre, ok, detalle = '') {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? '  (' + detalle + ')' : ''}`);
  if (!ok) fallas++;
}
const f2 = n => n.toFixed(2);
const [L1, L2] = K.LUNAS;

// 1) TERCERA LEY DE KEPLER: T² / a³ = 4π² / (G·M) para las dos
const k1 = L1.T ** 2 / L1.a ** 3, k2 = L2.T ** 2 / L2.a ** 3, kTeo = 4 * Math.PI ** 2 / K.GM_K;
revisar('T²/a³ es igual para las dos lunas', Math.abs(k1 - k2) / kTeo < 1e-9, `${(k1 * 1e5).toFixed(4)}·10⁻⁵ y ${(k2 * 1e5).toFixed(4)}·10⁻⁵`);
revisar('y vale 4π²/(G·M)', Math.abs(k1 - kTeo) / kTeo < 1e-9);
revisar('la más lejana tarda más', L2.T > L1.T, `T1 = ${f2(L1.T)} s, T2 = ${f2(L2.T)} s`);
// la velocidad de la órbita: v = √(GM/a) = 2πa/T
revisar('v = 2πa/T = √(GM/a)', Math.abs(2 * Math.PI * L2.a / L2.T - L2.v) < 1e-9, `v2 = ${f2(L2.v)} m/s`);
// la luna sí está en el círculo de radio a, y su velocidad es perpendicular al radio
const c = K.posLuna(L2, 13.7), vL = K.velLuna(L2, 13.7);
revisar('la luna está a la distancia a', Math.abs(c.length() - L2.a) < 1e-9);
revisar('su velocidad es perpendicular al radio', Math.abs(c.dot(vL)) < 1e-6);
// velocidad = derivada de la posición (diferencia finita)
const c2 = K.posLuna(L2, 13.7 + 1e-4), dv = c2.sub(c).divideScalar(1e-4).sub(vL).length();
revisar('velLuna = d(posLuna)/dt', dv < 1e-2, `error ${dv.toExponential(1)} m/s`);

// 2) ESFERAS DE HILL: r_H = a·∛(m / 3M). Adentro manda la luna.
for (const L of K.LUNAS) {
  const rH = L.a * Math.cbrt(L.gm / (3 * K.GM_K));
  revisar(`${L.nombre}: radio de Hill = ${f2(rH)} m (más grande que la luna, R = ${L.R})`, Math.abs(rH - L.hill) < 1e-9 && rH > L.R + 5);
}
// las dos esferas nunca se tocan: su distancia mínima es ≥ la diferencia de radios de las órbitas
revisar('las esferas de Hill no se tocan', L2.a - L1.a > L1.hill + L2.hill || (() => {
  let min = Infinity;
  for (let t = 0; t < 600; t += 0.25) min = Math.min(min, K.posLuna(L1, t).distanceTo(K.posLuna(L2, t)));
  return min > L1.hill + L2.hill;
})());

// 3) EL CAMINO Y EL RELIEVE
const rel = K.crearRelieve();
let peor = 0;
for (const m of K.CAMINO) peor = Math.max(peor, Math.abs(rel.radio(m.u) - (K.R + m.h)));
revisar('el suelo del camino está a la altura del camino', peor < 1.2, `diferencia máx ${f2(peor)} m`);
revisar(`el camino mide ${K.LARGO} m y va cuesta abajo`, K.alturaCamino(10) > K.alturaCamino(K.S_LAGO[0]) + 40);
// las lunas nunca tocan los cerros: bajo cada punto de su órbita, el suelo está más abajo que la luna
for (const L of K.LUNAS) {
  let margen = Infinity;
  for (let t = 0; t < L.T; t += 0.1) { const c = K.posLuna(L, t); margen = Math.min(margen, c.length() - L.R - rel.radio(c.clone().normalize())); }
  revisar(`${L.nombre} pasa sobre los cerros`, margen > 2, `queda al menos a ${f2(margen)} m del suelo`);
}

// 4) DESLIZAR: con g, μ y c fijos, en una bajada recta llegas a v_límite = √(g(senθ − μcosθ)/c)
{
  const ang = 20 * Math.PI / 180, mu = K.DESLIZ.mu[0], g = K.G0;
  const n = new V3(0, Math.cos(ang), Math.sin(ang)), up = new V3(0, 1, 0);
  const vel = new V3(), gv = new V3(0, -g, 0), mv = new V3();
  const save = K.DESLIZ.max; K.DESLIZ.max = 99;
  for (let i = 0; i < 120 * 60; i++) {             // 60 s
    vel.addScaledVector(gv, 1 / 120);
    vel.addScaledVector(n, -Math.min(0, vel.dot(n)));   // el suelo no deja hundirse
    K.pasoDeslizar(vel, n, up, g, mu, mv, 1 / 120);
  }
  K.DESLIZ.max = save;
  const teo = K.velLimite(20, mu);
  revisar('deslizar llega a la velocidad límite', Math.abs(vel.length() - teo) < 0.3, `simulada ${f2(vel.length())}, teoría ${f2(teo)} m/s`);
  revisar('en el hielo (μ menor) la límite es mayor', K.velLimite(20, K.DESLIZ.mu[1]) > teo);
}

// 5) EL RESORTE: ½kx² = ½mv² y hay ventanas para llegar a la Luna 2
{
  const v = 44, k = K.kResorte(v);
  revisar('Hooke: ½kx² = ½mv²', Math.abs(0.5 * k * K.RESORTE.x ** 2 - 0.5 * K.RESORTE.m * v * v) < 1e-6, `k = ${Math.round(k)} N/m`);
  const base = K.baseResorte(rel);
  let abiertas = 0, primera = null;
  const n = Math.ceil(L2.T / 0.5);
  for (let i = 0; i < n; i++) { const s = K.tiroALaLuna(base, i * 0.5, 1 / 30); if (s) { abiertas++; primera ||= { s, t0: i * 0.5 }; } }
  revisar('hay ventana de lanzamiento en cada vuelta', abiertas > 0, `${abiertas * 0.5} s de ${f2(L2.T)} s`);
  // el tiro elegido de verdad llega: lo simulamos aparte con salto de rana
  if (primera) {
    const pos = base.pos.clone().addScaledVector(base.arriba, 1.2), vel = primera.s.vel.clone(), g = new V3();
    let llega = false;
    for (let t = 0; t < 20; t += 1 / 120) {
      const r = pos.length(); g.copy(pos).multiplyScalar(-K.GM_K / r ** 3);
      vel.addScaledVector(g, 1 / 240); pos.addScaledVector(vel, 1 / 120);
      const r2 = pos.length(); g.copy(pos).multiplyScalar(-K.GM_K / r2 ** 3); vel.addScaledVector(g, 1 / 240);
      if (pos.distanceTo(K.posLuna(L2, primera.t0 + t + 1 / 120)) < L2.hill) { llega = true; break; }
    }
    revisar('el tiro del resorte entra a la esfera de Hill de la Luna 2', llega, `v = ${primera.s.v} m/s a ${primera.s.ang}°`);
  }
}

// 6) SALTO ORBITAL DE MEIMEI: v = √(Gm/r) a 1,5 m del suelo → vuelta completa sin caer ni escaparse
{
  const r0 = L2.R + K.PELEA.alturaOrbita, v0 = K.PELEA.vOrbita();
  const p = new V3(r0, 0, 0), v = new V3(0, 0, v0);
  let rmin = Infinity, rmax = 0;
  const dt = 1 / 120, T = K.PELEA.tOrbita();
  for (let t = 0; t < T; t += dt) {
    let r = p.length(); v.addScaledVector(p, -L2.gm / r ** 3 * dt / 2);
    p.addScaledVector(v, dt);
    r = p.length(); v.addScaledVector(p, -L2.gm / r ** 3 * dt / 2);
    rmin = Math.min(rmin, r); rmax = Math.max(rmax, r);
  }
  revisar('el salto orbital es una órbita circular', rmax - rmin < 0.05, `r entre ${f2(rmin)} y ${f2(rmax)} m`);
  revisar('y vuelve al punto de partida en T = 2πr/v', p.distanceTo(new V3(r0, 0, 0)) < 0.5, `T = ${f2(T)} s, v = ${f2(v0)} m/s`);
  revisar('esa velocidad es menor que la de escape de la luna', v0 < Math.sqrt(2 * L2.gm / r0));
}

// 7) SALIR DE KEPLER: v_esc = √2·v_luna. El resorte suma 32 m/s respecto a la luna
{
  revisar('v_esc en la órbita = √2 · v_luna', Math.abs(K.PELEA.vEscape() - Math.SQRT2 * L2.v) < 1e-9, `${f2(K.PELEA.vEscape())} m/s`);
  // peor caso que permite el juego: el 60 % del disparo va en la dirección de la luna (meimei.js espera hasta eso)
  // al salir de la esfera de Hill la luna ya te frenó: ½v² − Gm/R → ½v'² − Gm/r_H
  const vS = K.PELEA.vSalida, vRel = Math.sqrt(vS ** 2 - 2 * L2.gm * (1 / L2.R - 1 / L2.hill));
  const vTot = Math.hypot(L2.v + 0.6 * vRel, 0.8 * vRel);
  const E = 0.5 * vTot ** 2 - K.GM_K / (L2.a + L2.hill);
  revisar('con el resorte de salida escapas (energía ≥ 0)', E > 0, `v total ≈ ${f2(vTot)} m/s, E = ${Math.round(E)} J/kg`);
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas de Kepler pasaron');
process.exit(fallas ? 1 : 0);
