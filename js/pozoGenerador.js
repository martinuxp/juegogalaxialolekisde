/* =========================================================
   pozoGenerador.js · Arma el POZO de Ícaro con una semilla
   (sin dibujo ni DOM: lo usan el juego y pruebas/pozo.test.mjs).
   La explicación completa está arriba de js/pozo.js.
   ========================================================= */
import { rng } from './util.js';
import { CFG } from './config.js';

export const R_SET = 2000;                        // la esfera invisible de la cueva (nivel2-icaro.js)
export const G = 20;                              // gravedad en la cueva (m/s²)
export const POZO = { x: 0, z: -60, r: 18, alto: 64, puerta: 14, n: 7 };

/* ---------- física del validador ---------- */
/** Altura máxima de un salto que sale a v hacia arriba: h = v² / (2g). */
export const alturaMax = (v, g = G) => v * v / (2 * g);
/** Distancia horizontal que alcanzas si saltas a v y aterrizas dh más arriba (corriendo a vh). */
export function alcance(dh, v = CFG.botasV, g = G, vh = CFG.run) {
  const disc = v * v - 2 * g * dh;
  if (disc < 0) return 0;                  // no llegas a esa altura
  return vh * (v + Math.sqrt(disc)) / g;
}

/** La semilla: ?semilla=123 en la dirección, o la de la feria. */
export function semillaDeLaUrl(porDefecto = 27) {
  const s = typeof location === 'undefined' ? NaN : parseInt(new URLSearchParams(location.search).get('semilla'), 10);
  return Number.isFinite(s) && s > 0 ? s : porDefecto;
}

/**
 * Arma el pozo: una lista de repisas { x, z, h, m (media medida), giro }
 * y la salida { x, z, h }. Si un intento no cumple, prueba con otro.
 */
export function generarPozo(semilla) {
  const MIN = alturaMax(CFG.jump) + 0.6;          // 5,5 m: con salto normal no llegas
  const MAX = alturaMax(CFG.botasV) - 2;          // 8 m: con botas sí, con 2 m de sobra
  const dentro = c => Math.hypot(c.x, c.z) + c.m * 1.42 <= POZO.r - 0.8;   // (coordenadas desde el centro del pozo)
  const tapa = (c, reps) => reps.some(o => Math.abs(c.h - o.h) < 12 && Math.hypot(c.x - o.x, c.z - o.z) < (c.m + o.m) * 1.2 + 0.5);
  for (let intento = 0; intento < 400; intento++) {
    const r = rng(semilla * 977 + intento + 1);
    const reps = [];
    let prev = { x: 0, z: POZO.r - 5, h: 0, m: 0 };   // empiezas en el suelo, cerca de la puerta
    for (let k = 0; k < POZO.n; k++) {
      let puesto = null;
      for (let t = 0; t < 90 && !puesto; t++) {
        const dh = MIN + r() * (MAX - MIN);
        const m = 3 + r() * 1;                     // repisas de 6 a 8 m (grandes: el súper salto vuela lejos)
        const hueco = 2.5 + r() * 2.5;             // de borde a borde
        const a = r() * Math.PI * 2, dist = prev.m + hueco + m;
        const c = { x: prev.x + Math.cos(a) * dist, z: prev.z + Math.sin(a) * dist, h: prev.h + dh, m, giro: r() * Math.PI / 2, dh, hueco };
        if (!dentro(c) || tapa(c, reps)) continue;
        if (hueco > 0.5 * alcance(dh)) continue;   // ¿alcanza el vuelo?
        puesto = c;
      }
      if (!puesto) break;
      reps.push(puesto); prev = puesto;
    }
    if (reps.length < POZO.n) continue;
    const salida = { x: prev.x, z: prev.z, h: prev.h + 6.5 };   // 6,5 m: más que un salto normal
    return { semilla, intento, repisas: reps, salida };
  }
  throw new Error('No pude armar el pozo con la semilla ' + semilla);
}

