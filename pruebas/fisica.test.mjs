/* =========================================================
   Pruebas de física · se corren con:   node pruebas/fisica.test.mjs
   ---------------------------------------------------------
   Revisan que el juego cumpla las fórmulas, sin abrir el navegador.
   Si algo falla, el programa lo dice y termina con error.
   ========================================================= */
import { mundo, definirMundo, gravedadEn, velocidadEscape, simularTrayectoria, GM, agregarMuro, collide, makeBody, pasoNewton } from '../js/fisica.js';
import { V3 } from '../js/util.js';

let fallas = 0;
function revisar(nombre, ok, detalle = '') {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? '  (' + detalle + ')' : ''}`);
  if (!ok) fallas++;
}
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---- 1. Gravedad de Newton: g = G·M / r² ---- */
const P = { name: 'Prueba', c: new V3(0, 0, 0), R: 10, g: 20 };
definirMundo([P], []);
const g1 = gravedadEn(new V3(0, 10, 0)).g;
const g2 = gravedadEn(new V3(0, 20, 0)).g;
revisar('en la superficie g = g0', cerca(g1, 20, 1e-9), `g = ${g1}`);
revisar('al doble de distancia, g baja a 1/4', cerca(g2, 5, 1e-9), `g = ${g2}`);
revisar('G·M = g0·R²', cerca(GM(P), 20 * 100, 1e-9));

/* ---- 2. Velocidad de escape: v = √(2·G·M/r) ---- */
const r0 = 10.6;   // centro del jugador parado en el suelo (R + radio del jugador)
const vesc = velocidadEscape(P, r0);
revisar('v_esc = √(2·G·M/r)', cerca(vesc, Math.sqrt(2 * 2000 / r0), 1e-9), `v_esc = ${vesc.toFixed(3)}`);

// un poco menos que v_esc → vuelve a caer; un poco más → se va
const arriba = new V3(0, 1, 0), inicio = new V3(0, r0, 0);
const bajo = simularTrayectoria(inicio, arriba.clone().multiplyScalar(vesc * 0.95), { tMax: 120, cadaN: 1000 });
const alto = simularTrayectoria(inicio, arriba.clone().multiplyScalar(vesc * 1.05), { tMax: 120, cadaN: 1000 });
revisar('con 95% de v_esc vuelve a caer al planeta', bajo.choca === P, `tarda ${bajo.tiempo.toFixed(1)} s`);
revisar('con 105% de v_esc no vuelve (en 2 minutos)', alto.choca === null);

// la altura máxima con v < v_esc coincide con la energía: 1/r_max = 1/r0 − v²/(2·G·M)
{
  const v = vesc * 0.7;
  const rMaxTeoria = 1 / (1 / r0 - v * v / (2 * GM(P)));
  const pos = inicio.clone(), vel = arriba.clone().multiplyScalar(v);
  let rMax = 0;
  const sim = simularTrayectoria(pos, vel, { tMax: 60, cadaN: 1 });
  for (const q of sim.puntos) rMax = Math.max(rMax, q.length());
  revisar('altura máxima coincide con la conservación de energía (±1%)', cerca(rMax, rMaxTeoria, rMaxTeoria * 0.01),
    `simulada ${rMax.toFixed(2)} · teoría ${rMaxTeoria.toFixed(2)}`);
}

// la masa del jugador no aparece en ningún lado: v_esc no depende de ella (por construcción)

/* ---- 3. g× (multiplicador de gravedad) ---- */
mundo.gravMul = 2;
const vesc2 = velocidadEscape(P, r0);
revisar('con g×2, v_esc sube √2 veces', cerca(vesc2 / vesc, Math.SQRT2, 1e-9), `${vesc.toFixed(2)} → ${vesc2.toFixed(2)}`);
mundo.gravMul = 1;

/* ---- 4. Nivel 1: Ícaro está lejos → desde el cañón hay que pasar v_esc ---- */
const { default: nivel1 } = await import('../js/niveles/nivel1-columba.js');
{
  const [C] = nivel1.planetas;
  definirMundo([C], []);
  const dir = nivel1.lejano.dir.clone().normalize();
  const islaCanon = nivel1.islas.find(i => i.canon);
  const boca = C.c.clone().addScaledVector(dir, (C.mar + islaCanon.alto) + 1.7);
  const ve = velocidadEscape(C, boca.length());
  const energia = (pos, vel) => 0.5 * vel.lengthSq() - GM(C) / pos.length();
  // con 95 % de v_esc: la energía es negativa y la simulación vuelve a Columba
  const bajo = simularTrayectoria(boca, dir.clone().multiplyScalar(ve * 0.95), { tMax: 400, cadaN: 100000 });
  revisar('desde el cañón, con 95% de v_esc vuelves a Columba', bajo.choca === C, `tarda ${bajo.tiempo.toFixed(0)} s`);
  // con 101 %: energía ≥ 0 desde el principio, y se mantiene (se conserva) durante el vuelo
  const pos = boca.clone(), vel = dir.clone().multiplyScalar(ve * 1.01);
  const E0 = energia(pos, vel);
  for (let i = 0; i < 120 * 20; i++) pasoNewton(pos, vel, 1 / 120);
  revisar('con 101% de v_esc la energía es ≥ 0 (escapas)', E0 >= 0 && energia(pos, vel) >= 0,
    `E inicial ${E0.toFixed(1)} · a los 20 s ${energia(pos, vel).toFixed(1)} J/kg · v_esc = ${ve.toFixed(1)} m/s`);
  revisar('la barra del cañón alcanza v_esc', ve < 60, `tope 60 m/s`);
}

/* ---- 5. Muros (cajas): el jugador no los atraviesa ---- */
{
  definirMundo([{ name: 'Suelo', c: new V3(0, -1000, 0), R: 1000, g: 20 }], []);
  // muro de 1 m de grosor, 6 m de alto y 8 m de largo, parado en x = 0
  agregarMuro(new V3(0, 3, 0), new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1), new V3(0.5, 3, 4));
  const b = makeBody(0.6);
  b.pos.set(-0.8, 1, 0); b.vel.set(10, 0, 0);            // va hacia el muro
  collide(b);
  revisar('el muro empuja al jugador hacia afuera', cerca(b.pos.x, -1.1, 1e-9), `x = ${b.pos.x.toFixed(3)}`);
  revisar('y le quita la velocidad que iba hacia el muro', b.vel.x === 0);
  b.pos.set(0, 6.4, 0); b.vel.set(0, -5, 0);             // cae encima del muro
  collide(b);
  revisar('encima del muro se puede parar', b.grounded && cerca(b.pos.y, 6.6, 1e-9), `y = ${b.pos.y.toFixed(3)}`);
}

/* ---- 6. Órbita circular del ovni: v = √(G·M/r), T = 2πr/v ---- */
{
  const [C] = nivel1.planetas;
  definirMundo([C], []);
  const r = nivel1.ovni.radio;
  const v = Math.sqrt(GM(C) / r);
  const T = 2 * Math.PI * r / v;
  // lo mismo que hace js/ovni.js: posición en x, velocidad en z (perpendicular)
  const pos = new V3(r, 0, 0), vel = new V3(0, 0, v);
  let rMin = Infinity, rMax = 0, vueltaT = null, antes = pos.z;
  const dt = 1 / 120;
  for (let i = 1; i <= Math.round(1.5 * T / dt); i++) {
    pasoNewton(pos, vel, dt);
    const rr = pos.length(); rMin = Math.min(rMin, rr); rMax = Math.max(rMax, rr);
    if (vueltaT === null && i * dt > T / 2 && antes < 0 && pos.z >= 0) vueltaT = i * dt;   // volvió a cruzar el eje x
    antes = pos.z;
  }
  revisar('el ovni mantiene su radio de órbita (±0,5%)', rMax - rMin < r * 0.005, `r entre ${rMin.toFixed(2)} y ${rMax.toFixed(2)} m`);
  revisar('el período simulado coincide con T = 2πr/v (±1%)', vueltaT !== null && cerca(vueltaT, T, T * 0.01),
    `simulado ${vueltaT && vueltaT.toFixed(2)} s · teoría ${T.toFixed(2)} s · v = ${v.toFixed(1)} m/s`);
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
