/* =========================================================
   Pruebas de física · se corren con:   node pruebas/fisica.test.mjs
   ---------------------------------------------------------
   Revisan que el juego cumpla las fórmulas, sin abrir el navegador.
   Si algo falla, el programa lo dice y termina con error.
   ========================================================= */
import { mundo, definirMundo, gravedadEn, velocidadEscape, simularTrayectoria, GM } from '../js/fisica.js';
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

/* ---- 4. Nivel 1: el cañón de Columba llega a Ícaro con menos que v_esc ---- */
const { default: nivel1 } = await import('../js/niveles/nivel1-columba.js');
{
  const [C, I] = nivel1.planetas;
  definirMundo([C, I], []);
  const dir = I.c.clone().sub(C.c).normalize();
  const boca = C.c.clone().addScaledVector(dir, (C.mar + nivel1.islas[2].alto) + 1.7);
  const ve = velocidadEscape(C, boca.length());
  let minimo = null;
  for (let v = 1; v < ve * 1.2; v += 0.1) {
    if (simularTrayectoria(boca, dir.clone().multiplyScalar(v), { tMax: 30, cadaN: 1000 }).choca === I) { minimo = v; break; }
  }
  revisar('desde el cañón se puede llegar a Ícaro', minimo !== null);
  if (minimo) revisar('la velocidad mínima para llegar es menor que v_esc', minimo < ve,
    `mínima ${minimo.toFixed(1)} m/s = ${(100 * minimo / ve).toFixed(0)}% de v_esc (${ve.toFixed(1)} m/s)`);
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
