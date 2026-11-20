/* =========================================================
   pozoGenerador.js · Arma el LABERINTO de la cueva de Ícaro
   (sin dibujo ni DOM: lo usan el juego y pruebas/pozo.test.mjs)
   ---------------------------------------------------------
   Es un laberinto de 3 PISOS, uno encima del otro. Cada piso
   es una grilla de 3 × 4 cámaras de 12 m. Las cámaras se unen
   por puertas, y los pisos por CHIMENEAS: un hoyo en el techo
   que solo se alcanza con el súper salto.

   PROCEDURAL CON SEMILLA: el mismo número arma siempre el
   mismo laberinto (27 = la feria; ?semilla=5 en la dirección
   arma otro).

   Cómo se excava cada piso ("búsqueda en profundidad"):
     1. partes en la cámara donde llegas y la marcas
     2. eliges al azar una vecina NO visitada, botas la pared
        entre las dos y te mueves a ella
     3. si no quedan vecinas sin visitar, retrocedes
   Así todas las cámaras quedan conectadas por UN solo camino
   (un "laberinto perfecto") y aparecen callejones sin salida.
   La chimenea al piso de arriba va en la cámara MÁS LEJANA
   (búsqueda en anchura: cuenta puertas desde donde llegaste).

   FÍSICA (el validador):
     · entre pisos hay H = 6,5 m. Salto normal: v²/2g = 14²/40
       = 4,9 m → no llegas. Botas: 20²/40 = 10 m → sí, y te
       sobran 3,5 m para moverte de lado y caer junto al hoyo.
   ========================================================= */
import { rng } from './util.js';
import { CFG } from './config.js';

export const R_SET = 2000;                 // la esfera invisible de la cueva (nivel2-icaro.js)
export const G = 20;                       // gravedad en la cueva (m/s²)
export const POZO = {
  x: 0, z: -66,          // centro del laberinto (en coordenadas de la cueva)
  cols: 3, filas: 4, celda: 12,
  pisos: 3, H: 6.5, losa: 1.0,             // altura entre pisos y grosor del suelo de cada piso
  hoyo: 6,                                 // la chimenea: un hoyo de 6 × 6 m en el centro de la cámara
  puerta: 4.5,                             // ancho de las puertas entre cámaras
};

/* ---------- física del validador ---------- */
/** Altura máxima de un salto que sale a v hacia arriba: h = v² / (2g). */
export const alturaMax = (v, g = G) => v * v / (2 * g);
/** Distancia horizontal que alcanzas si saltas a v y aterrizas dh más arriba (corriendo a vh). */
export function alcance(dh, v = CFG.botasV, g = G, vh = CFG.run) {
  const disc = v * v - 2 * g * dh;
  if (disc < 0) return 0;
  return vh * (v + Math.sqrt(disc)) / g;
}

/** La semilla: ?semilla=123 en la dirección, o la de la feria. */
export function semillaDeLaUrl(porDefecto = 27) {
  const s = typeof location === 'undefined' ? NaN : parseInt(new URLSearchParams(location.search).get('semilla'), 10);
  return Number.isFinite(s) && s > 0 ? s : porDefecto;
}

/** Centro (x, z) de la cámara (i, j). j = 0 es la fila de adelante (hacia la sala, +z). */
export function centroCelda(i, j) {
  const { cols, filas, celda } = POZO;
  return { x: (i - (cols - 1) / 2) * celda, z: ((filas - 1) / 2 - j) * celda };
}
const VECINAS = [[1, 0, 'e'], [-1, 0, 'o'], [0, 1, 's'], [0, -1, 'n']];   // e/o = ±x, n = adelante, s = atrás
const clave = (i, j) => i + ',' + j;

/** Excava un piso desde "entrada". Devuelve las puertas abiertas (Set de "i,j|i2,j2"). */
function excavar(r, entrada) {
  const { cols, filas } = POZO, vis = new Set([clave(entrada.i, entrada.j)]), pila = [entrada], abiertas = new Set();
  while (pila.length) {
    const c = pila[pila.length - 1];
    const libres = VECINAS.map(([di, dj]) => ({ i: c.i + di, j: c.j + dj }))
      .filter(n => n.i >= 0 && n.i < cols && n.j >= 0 && n.j < filas && !vis.has(clave(n.i, n.j)));
    if (!libres.length) { pila.pop(); continue; }
    const n = libres[Math.floor(r() * libres.length)];
    vis.add(clave(n.i, n.j));
    abiertas.add(puertaClave(c, n));
    pila.push(n);
  }
  return abiertas;
}
export const puertaClave = (a, b) => {
  const [p, q] = (a.i < b.i || (a.i === b.i && a.j < b.j)) ? [a, b] : [b, a];
  return `${p.i},${p.j}|${q.i},${q.j}`;
};
/** Distancia (en puertas) desde "desde" a todas las cámaras, y el camino de vuelta. */
export function distancias(abiertas, desde) {
  const { cols, filas } = POZO, dist = new Map([[clave(desde.i, desde.j), 0]]), previo = new Map(), cola = [desde];
  while (cola.length) {
    const c = cola.shift();
    for (const [di, dj] of VECINAS) {
      const n = { i: c.i + di, j: c.j + dj };
      if (n.i < 0 || n.i >= cols || n.j < 0 || n.j >= filas || dist.has(clave(n.i, n.j))) continue;
      if (!abiertas.has(puertaClave(c, n))) continue;
      dist.set(clave(n.i, n.j), dist.get(clave(c.i, c.j)) + 1);
      previo.set(clave(n.i, n.j), c);
      cola.push(n);
    }
  }
  return { dist, previo };
}

/**
 * Arma el laberinto. Por piso: entrada, chimenea (hoyo), puertas abiertas,
 * camino principal, callejones, suelos frágiles, estalactitas y enemigos.
 */
export function generarPozo(semilla) {
  const MIN = alturaMax(CFG.jump) + 0.6, MAX = alturaMax(CFG.botasV) - 2;
  if (POZO.H < MIN || POZO.H > MAX) throw new Error('La altura entre pisos no cumple la física');
  for (let intento = 0; intento < 200; intento++) {
    const r = rng(semilla * 977 + intento + 1);
    const pisos = [];
    let entrada = { i: 1, j: 0 };                 // piso 0: entras por la puerta de adelante, al centro
    let ok = true;
    for (let k = 0; k < POZO.pisos; k++) {
      const abiertas = excavar(r, entrada);
      const { dist, previo } = distancias(abiertas, entrada);
      // la chimenea: en la cámara más lejana (si hay empate, al azar)
      const lejos = Math.max(...dist.values());
      const candidatas = [...dist.entries()].filter(([, d]) => d === lejos).map(([c]) => c.split(',').map(Number));
      const [hi, hj] = candidatas[Math.floor(r() * candidatas.length)];
      const hoyo = { i: hi, j: hj };
      if (lejos < 3) { ok = false; break; }     // muy cerca: que el piso tenga gracia
      // camino principal (de la chimenea hacia atrás hasta la entrada)
      const camino = [hoyo];
      for (let c = hoyo; clave(c.i, c.j) !== clave(entrada.i, entrada.j);) { c = previo.get(clave(c.i, c.j)); camino.unshift(c); }
      const enCamino = new Set(camino.map(c => clave(c.i, c.j)));
      // callejones sin salida: cámaras con una sola puerta que no son ni la entrada ni la chimenea
      const callejones = [];
      for (let i = 0; i < POZO.cols; i++) for (let j = 0; j < POZO.filas; j++) {
        if (enCamino.has(clave(i, j))) continue;
        const puertas = VECINAS.filter(([di, dj]) => abiertas.has(puertaClave({ i, j }, { i: i + di, j: j + dj }))).length;
        if (puertas === 1) callejones.push({ i, j });
      }
      // peligros en el camino (no en la entrada ni en la chimenea)
      const medio = camino.slice(1, -1);
      const mezclar = a => a.map(x => [r(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
      const fragiles = k === 0 ? [] : mezclar(medio).slice(0, Math.min(2, medio.length));        // suelos que se desmoronan
      const estalactitas = mezclar(medio.concat(callejones)).slice(0, 3);
      // gatos-alien: 1 en el piso 0, 2 en el 1, 3 en el 2 (en cámaras del camino sin suelo frágil)
      const enemigos = mezclar(medio.filter(c => !fragiles.includes(c))).slice(0, k + 1);
      const corazon = callejones.length ? callejones[Math.floor(r() * callejones.length)] : null;
      // meowlitos en EMBOSCADA (escondidos bajo el suelo): uno cuidando cada callejón (y su corazón)
      // y, desde el piso 1, uno en la cámara del camino que quedó sin gato. Sin r(): no cambia el laberinto de la semilla.
      const libres = medio.filter(c => !fragiles.includes(c) && !enemigos.includes(c));
      const meowlitos = [...callejones, ...(k > 0 ? libres.slice(0, 1) : [])];
      pisos.push({ k, entrada, hoyo, abiertas: [...abiertas], camino, callejones, fragiles, estalactitas, enemigos, meowlitos, corazon });
      entrada = hoyo;                              // la chimenea te deja en la misma cámara del piso de arriba
    }
    if (!ok) continue;
    const ultimo = pisos[pisos.length - 1].hoyo;
    const c = centroCelda(ultimo.i, ultimo.j);
    return { semilla, intento, pisos, salida: { ...ultimo, x: c.x, z: c.z, h: POZO.pisos * POZO.H } };
  }
  throw new Error('No pude armar el laberinto con la semilla ' + semilla);
}
