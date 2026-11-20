/* =========================================================
   Pruebas del LABERINTO de Ícaro · node pruebas/pozo.test.mjs
   ---------------------------------------------------------
   Para muchas semillas revisa que el laberinto SIEMPRE se pueda
   pasar: todas las cámaras conectadas, la chimenea lejos de la
   entrada, y que el salto por la chimenea funcione con botas y
   NO con un salto normal. El salto no se calcula con la fórmula:
   se SIMULA con pasoNewton, la misma física del juego, sobre la
   esfera de la cueva (R = 2 000 m, g = 20 m/s²).
   ========================================================= */
import { generarPozo, distancias, alturaMax, R_SET, G, POZO } from '../js/pozoGenerador.js';
import { definirMundo, pasoNewton } from '../js/fisica.js';
import { CFG } from '../js/config.js';
import { V3 } from '../js/util.js';

let fallas = 0;
function revisar(nombre, ok, detalle = '') {
  if (!ok || detalle) console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? '  (' + detalle + ')' : ''}`);
  if (!ok) fallas++;
}
definirMundo([{ c: new V3(0, -R_SET, 0), R: R_SET, g: G }], []);

const RADIO = 0.5;   // radio del jugador (aprox.)
/**
 * Salto por la chimenea: parte quieto bajo el centro del hoyo, sale a vy hacia arriba y,
 * apenas su cabeza pasa la losa, acelera hacia un lado (control en el aire: 22 m/s² hasta 9 m/s).
 * ¿Termina parado sobre la losa de arriba (fuera del hoyo)?
 */
function chimenea(vy) {
  const pos = new V3(0, RADIO, 0), vel = new V3(0, vy, 0), dt = 1 / 120;
  const techo = POZO.H - POZO.losa, borde = POZO.hoyo / 2;
  for (let t = 0; t < 4; t += dt) {
    pasoNewton(pos, vel, dt);
    if (pos.y - RADIO > POZO.H) vel.x = Math.min(CFG.run, vel.x + CFG.airAccel * dt);   // ya pasó la losa: se corre
    if (vel.y < 0 && pos.y - RADIO <= POZO.H) return pos.x - RADIO > borde;               // bajando: ¿quedó sobre la losa?
    if (pos.y + RADIO > techo && pos.y - RADIO < POZO.H && Math.abs(pos.x) + RADIO > borde) return false;  // chocó el borde
  }
  return false;
}
revisar('con botas se sube por la chimenea', chimenea(CFG.botasV));
revisar('sin botas NO se sube por la chimenea', !chimenea(CFG.jump));
revisar('la altura entre pisos pide botas', POZO.H > alturaMax(CFG.jump) && POZO.H < alturaMax(CFG.botasV),
  `H = ${POZO.H} m · salto ${alturaMax(CFG.jump).toFixed(1)} m · botas ${alturaMax(CFG.botasV).toFixed(1)} m`);

const semillas = Array.from({ length: 80 }, (_, i) => i + 1).concat([27]);
const igual = (a, b) => a.i === b.i && a.j === b.j;
let celdas = 0, largo = 0;
for (const s of semillas) {
  const p = generarPozo(s);
  p.pisos.forEach((piso, k) => {
    const { dist } = distancias(new Set(piso.abiertas), piso.entrada);
    revisar(`semilla ${s} piso ${k}: todas las cámaras conectadas`, dist.size === POZO.cols * POZO.filas);
    revisar(`semilla ${s} piso ${k}: la chimenea queda lejos`, dist.get(`${piso.hoyo.i},${piso.hoyo.j}`) >= 3);
    if (k > 0) revisar(`semilla ${s} piso ${k}: llegas por la chimenea de abajo`, igual(piso.entrada, p.pisos[k - 1].hoyo));
    for (const f of piso.fragiles) revisar(`semilla ${s} piso ${k}: frágil fuera de entrada y chimenea`, !igual(f, piso.entrada) && !igual(f, piso.hoyo));
    for (const e of piso.estalactitas) revisar(`semilla ${s} piso ${k}: estalactita fuera de la chimenea`, !igual(e, piso.hoyo));
    if (piso.corazon) revisar(`semilla ${s} piso ${k}: corazón en un callejón`, piso.callejones.some(c => igual(c, piso.corazon)));
    celdas += dist.size; largo += piso.camino.length;
  });
}
const feria = generarPozo(27);
revisar('la semilla de la feria arma siempre el mismo laberinto', JSON.stringify(feria) === JSON.stringify(generarPozo(27)),
  `camino: ${feria.pisos.map(p => p.camino.length).join(' + ')} cámaras`);
console.log(`${semillas.length} laberintos revisados · camino promedio por piso: ${(largo / semillas.length / POZO.pisos).toFixed(1)} cámaras`);
console.log(fallas ? `\n${fallas} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
