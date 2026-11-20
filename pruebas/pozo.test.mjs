/* =========================================================
   Pruebas del POZO de Ícaro · node pruebas/pozo.test.mjs
   ---------------------------------------------------------
   Para muchas semillas revisa que el laberinto SIEMPRE se pueda
   pasar con las botas y NUNCA con un salto normal. No confía en
   la fórmula del validador: simula cada salto con pasoNewton,
   la misma función de física del juego, sobre la esfera de la
   cueva (R = 2 000 m, g = 20 m/s²).
   ========================================================= */
import { generarPozo, alturaMax, R_SET, G, POZO } from '../js/pozoGenerador.js';
import { definirMundo, pasoNewton } from '../js/fisica.js';
import { CFG } from '../js/config.js';
import { V3 } from '../js/util.js';

let fallas = 0;
function revisar(nombre, ok, detalle = '') {
  if (!ok || detalle) console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? '  (' + detalle + ')' : ''}`);
  if (!ok) fallas++;
}

definirMundo([{ c: new V3(0, -R_SET, 0), R: R_SET, g: G }], []);

/** Sube saltando a vy y corriendo a vh: ¿llega a "dh" metros de altura habiendo avanzado "hueco" metros, bajando? */
function llega(vy, vh, dh, hueco) {
  const pos = new V3(0, 0, 0), vel = new V3(vh, vy, 0), dt = 1 / 120;
  for (let t = 0; t < 4; t += dt) {
    pasoNewton(pos, vel, dt);
    if (pos.x >= hueco && pos.y >= dh) return true;      // pasó el borde estando más arriba que la repisa
    if (vel.y < 0 && pos.y < dh) return false;           // ya viene bajando y quedó corto
  }
  return false;
}

const semillas = Array.from({ length: 60 }, (_, i) => i + 1).concat([27]);
let saltos = 0;
for (const s of semillas) {
  const p = generarPozo(s);
  let prev = { x: 0, z: POZO.r - 5, h: 0, m: 0 };
  for (const [k, r] of p.repisas.entries()) {
    const dh = r.h - prev.h;
    // hueco real de borde a borde (las repisas son cuadradas: usamos el peor caso, la mitad de la diagonal)
    const hueco = Math.max(0, Math.hypot(r.x - prev.x, r.z - prev.z) - prev.m - r.m);
    revisar(`semilla ${s} repisa ${k + 1}: con botas llega`, llega(CFG.botasV, CFG.run * 0.7, dh, hueco));
    revisar(`semilla ${s} repisa ${k + 1}: sin botas NO llega`, !llega(CFG.jump, CFG.run, dh, 0));
    revisar(`semilla ${s} repisa ${k + 1}: dentro del pozo`, Math.hypot(r.x, r.z) + r.m * 1.42 <= POZO.r);
    saltos++;
    prev = r;
  }
  revisar(`semilla ${s}: la salida pide botas`, p.salida.h - prev.h > alturaMax(CFG.jump) && p.salida.h - prev.h < alturaMax(CFG.botasV));
}
const feria = generarPozo(27);
revisar('la semilla de la feria arma siempre el mismo pozo', JSON.stringify(feria) === JSON.stringify(generarPozo(27)),
  `${feria.repisas.length} repisas, salida a ${feria.salida.h.toFixed(1)} m`);
console.log(`${saltos} saltos revisados en ${semillas.length} semillas (con botas al 70 % de la rapidez de carrera)`);
console.log(fallas ? `\n${fallas} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
