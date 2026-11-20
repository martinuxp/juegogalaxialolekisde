/* =========================================================
   fisica.js · La física del juego (Newton) en un solo lugar
   ---------------------------------------------------------
   1) GRAVITACIÓN UNIVERSAL DE NEWTON
        g(r) = G·M / r²
      Para cada planeta damos su gravedad en la superficie (g0)
      y su radio (R). Como en la superficie g0 = G·M / R²,
      entonces G·M = g0·R² y queda:
        g(r) = g0 · (R / r)²
      Si te alejas al doble de distancia, la gravedad baja a 1/4.

   2) SIMPLIFICACIÓN: en cada punto manda SOLO el planeta que
      más atrae (el de mayor g). No sumamos las fuerzas de todos.
      Es parecido a la "esfera de influencia" que usan las
      misiones espaciales para planificar viajes.

   3) VELOCIDAD DE ESCAPE
        v_esc = √(2·G·M / r) = √(2·g·r)
      Sale de la conservación de la energía:
        ½·m·v² = G·M·m / r   →   la masa m del jugador se cancela.

   Este archivo NO dibuja nada: solo hace cuentas. Por eso se
   puede probar con node (ver pruebas/fisica.test.mjs).
   ========================================================= */
import { V3 } from './util.js';

/**
 * El "mundo físico" del nivel actual.
 * planetas: tienen gravedad. rocas: son sólidas pero sin gravedad.
 * gravMul: multiplicador de gravedad (botón g× del juego).
 */
export const mundo = {
  planetas: [],
  rocas: [],
  solidos: [],
  muros: [],      // cajas (muros que se pueden bajar): chocan, pero no atraen
  gravMul: 1,
};

/** Cambia los planetas y rocas del mundo (lo usa el cargador de niveles). */
export function definirMundo(planetas, rocas) {
  mundo.planetas.length = 0;
  mundo.rocas.length = 0;
  mundo.planetas.push(...planetas);
  mundo.rocas.push(...rocas);
  mundo.solidos.length = 0;
  mundo.solidos.push(...planetas, ...rocas);
  mundo.muros.length = 0;
}

/**
 * Muro = caja orientada. c: centro; x, y, z: sus 3 ejes (vectores
 * unitarios, y = "arriba" del muro); medio: la mitad de cada medida.
 */
export function agregarMuro(c, x, y, z, medio) {
  const m = { c: c.clone(), x: x.clone(), y: y.clone(), z: z.clone(), medio: medio.clone(), muro: true };
  mundo.muros.push(m);
  return m;
}

/** G·M del planeta (con el multiplicador g× aplicado). */
export function GM(P) {
  return P.g * mundo.gravMul * P.R * P.R;
}

/** Gravedad de UN planeta a distancia d de su centro: g = G·M / r². */
export function gravedadDePlaneta(P, d) {
  const r = Math.max(d, P.R);          // adentro del planeta no calculamos
  return GM(P) / (r * r);
}

/**
 * Gravedad en un punto: busca el planeta que más atrae.
 * Devuelve { planeta, g, dir } donde dir apunta hacia el centro del planeta.
 */
export function gravedadEn(pos, out = { planeta: null, g: 0, dir: new V3() }) {
  let mejor = mundo.planetas[0];
  let mejorG = -1;
  for (const P of mundo.planetas) {
    const g = gravedadDePlaneta(P, pos.distanceTo(P.c));
    if (g > mejorG) { mejorG = g; mejor = P; }
  }
  out.planeta = mejor;
  out.g = mejorG;
  out.dir.copy(mejor.c).sub(pos).normalize();
  return out;
}

/** Velocidad de escape a distancia r del centro del planeta P: √(2·G·M/r). */
export function velocidadEscape(P, r) {
  return Math.sqrt(2 * GM(P) / r);
}

/* ---------------------------------------------------------
   CUERPOS: el jugador y los enemigos usan la misma física
   --------------------------------------------------------- */
export function makeBody(r) {
  return {
    pos: new V3(), vel: new V3(), r,
    up: new V3(0, 1, 0),          // "arriba" del cuerpo (se alinea con la gravedad)
    facing: new V3(0, 0, -1),     // hacia dónde mira
    grounded: false,
    planet: null, gmag: 0, gdir: new V3(0, -1, 0),
  };
}

/** Calcula la gravedad que siente el cuerpo y la guarda en él. */
const _g = { planeta: null, g: 0, dir: new V3() };
export function computeGravity(b) {
  gravedadEn(b.pos, _g);
  b.planet = _g.planeta;
  b.gmag = _g.g;
  b.gdir.copy(_g.dir);
}

/** El "arriba" del cuerpo gira suavemente hasta quedar opuesto a la gravedad. */
const _up = new V3();
export function updateUp(b, dt) {
  _up.copy(b.gdir).negate();
  const rate = b.grounded ? 25 : 8;
  b.up.lerp(_up, 1 - Math.exp(-rate * dt)).normalize();
}

/**
 * Choques con esferas (planetas y rocas).
 * Si el cuerpo quedó adentro de una esfera, lo empujamos hacia afuera
 * y le quitamos la velocidad que iba hacia adentro.
 * Devuelve el sólido con el que chocó (o null).
 */
const _cn = new V3();
export function collide(b) {
  b.grounded = false;
  let toco = null;
  for (const s of mundo.solidos) {
    _cn.copy(b.pos).sub(s.c);
    const d = _cn.length();
    const min = s.R + b.r;
    if (d < min && d > 1e-6) {
      _cn.divideScalar(d);
      b.pos.copy(s.c).addScaledVector(_cn, min);
      const vn = b.vel.dot(_cn);
      if (vn < 0) b.vel.addScaledVector(_cn, -vn);
      if (_cn.dot(b.up) > 0.45) b.grounded = true;
      toco = s;
    }
  }
  for (const m of mundo.muros) if (chocarMuro(b, m)) toco = m;
  return toco;
}

/**
 * Choque esfera–caja: buscamos el punto de la caja más cercano al
 * centro del cuerpo (se "aprieta" el punto dentro de la caja, eje
 * por eje). Si está a menos de r, empujamos hacia afuera.
 */
const _n = new V3();
function chocarMuro(b, m) {
  _n.copy(b.pos).sub(m.c);
  const l = [_n.dot(m.x), _n.dot(m.y), _n.dot(m.z)];             // posición en los ejes del muro
  const h = [m.medio.x, m.medio.y, m.medio.z];
  const q = l.map((v, i) => Math.max(-h[i], Math.min(h[i], v)));  // punto de la caja más cercano
  let n = l.map((v, i) => v - q[i]);
  let d = Math.hypot(n[0], n[1], n[2]);
  if (d >= b.r) return false;
  if (d < 1e-6) {
    // el centro quedó ADENTRO de la caja: sale por la cara más cercana
    const falta = h.map((v, i) => v - Math.abs(l[i]));
    const i = falta.indexOf(Math.min(...falta));
    n = [0, 0, 0]; n[i] = Math.sign(l[i]) || 1;
    q[i] = n[i] * h[i];
  } else n = n.map(v => v / d);
  _n.set(0, 0, 0).addScaledVector(m.x, n[0]).addScaledVector(m.y, n[1]).addScaledVector(m.z, n[2]);
  b.pos.copy(m.c).addScaledVector(m.x, q[0]).addScaledVector(m.y, q[1]).addScaledVector(m.z, q[2])
    .addScaledVector(_n, b.r);                                     // queda justo tocando la caja
  const vn = b.vel.dot(_n);
  if (vn < 0) b.vel.addScaledVector(_n, -vn);                      // se quita la velocidad hacia adentro
  if (_n.dot(b.up) > 0.45) b.grounded = true;
  return true;
}

/* ---------------------------------------------------------
   VUELO LIBRE (Newton puro)
   Se usa en el supersalto/cañón y para dibujar la línea que
   predice la trayectoria. Como las dos cosas usan ESTA MISMA
   función, la predicción coincide con lo que de verdad pasa.

   Método "salto de rana" (leapfrog), con paso dt = 1/120 s:
     1. v ← v + g·(dt/2)    medio empujón con la gravedad de aquí
     2. x ← x + v·dt        avanzar
     3. v ← v + g'·(dt/2)   otro medio empujón con la gravedad de allá
   Es casi igual de simple que sumar g·dt de una vez, pero
   conserva mucho mejor la energía (lo revisan las pruebas).
   --------------------------------------------------------- */
const _gv = { planeta: null, g: 0, dir: new V3() };
export function pasoNewton(pos, vel, dt) {
  gravedadEn(pos, _gv);
  vel.addScaledVector(_gv.dir, _gv.g * dt / 2);
  pos.addScaledVector(vel, dt);
  gravedadEn(pos, _gv);
  vel.addScaledVector(_gv.dir, _gv.g * dt / 2);
  return _gv;
}

/** ¿El punto está tocando algún sólido? Devuelve el sólido o null. */
export function tocaSolido(pos, radio) {
  for (const s of mundo.solidos) {
    if (pos.distanceTo(s.c) < s.R + radio) return s;
  }
  return null;
}

/**
 * Simula un vuelo sin tocar al jugador real.
 * Devuelve { puntos, choca, tiempo }:
 *   puntos: posiciones cada "cadaN" pasos (para dibujar la línea)
 *   choca: el planeta o roca donde aterriza (null si se pierde en el espacio)
 */
export function simularTrayectoria(pos0, vel0, { dt = 1 / 120, tMax = 12, radio = 0.6, cadaN = 4 } = {}) {
  const pos = pos0.clone();
  const vel = vel0.clone();
  const puntos = [pos.clone()];
  const pasos = Math.round(tMax / dt);
  for (let i = 1; i <= pasos; i++) {
    pasoNewton(pos, vel, dt);
    if (i % cadaN === 0) puntos.push(pos.clone());
    const s = tocaSolido(pos, radio);
    if (s) {
      puntos.push(pos.clone());
      return { puntos, choca: s, tiempo: i * dt };
    }
  }
  return { puntos, choca: null, tiempo: tMax };
}

/**
 * Distancia desde el centro del planeta P hasta la superficie más alta
 * en la dirección dir (el planeta mismo, una isla o una roca encima).
 * Sirve para poner cosas "paradas en el suelo".
 */
export function superficieEn(P, dir) {
  let mejor = P.R;
  for (const s of mundo.solidos) {
    if (s !== P && s.planeta !== P) continue;     // solo P y SUS islas y rocas (no otro planeta que esté en esa dirección)
    // rayo desde el centro de P hacia afuera: buscamos dónde sale de la esfera s
    const ox = P.c.x - s.c.x, oy = P.c.y - s.c.y, oz = P.c.z - s.c.z;
    const b = ox * dir.x + oy * dir.y + oz * dir.z;
    const c = ox * ox + oy * oy + oz * oz - s.R * s.R;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b + Math.sqrt(disc);       // punto de salida
    if (t > mejor && t < P.R * 3) mejor = t;
  }
  // cajas que son SUELO de este planeta (las mesas de roca de la superficie de Ícaro)
  for (const m of mundo.muros) {
    if (m.planeta !== P) continue;
    const t = salidaDeCaja(P.c, dir, m);
    if (t > mejor && t < P.R * 3) mejor = t;
  }
  return mejor;
}

/**
 * Rayo que parte en o con dirección d: ¿en qué distancia SALE de la caja m?
 * (−1 si no la toca). Método de las "losas": en cada eje de la caja el rayo
 * está adentro entre dos distancias; adentro de la caja = adentro de las 3 a la vez.
 */
export function salidaDeCaja(o, d, m) { return cruceCaja(o, d, m)[1]; }
/** ¿En qué distancia ENTRA el rayo a la caja? (−1 si no la toca o si el origen ya está adentro). */
export function entradaACaja(o, d, m) { const [a, b] = cruceCaja(o, d, m); return b >= 0 && a >= 0 ? a : -1; }
function cruceCaja(o, d, m) {
  let tMin = -Infinity, tMax = Infinity;
  for (const [eje, h] of [[m.x, m.medio.x], [m.y, m.medio.y], [m.z, m.medio.z]]) {
    const oo = (o.x - m.c.x) * eje.x + (o.y - m.c.y) * eje.y + (o.z - m.c.z) * eje.z;
    const dd = d.x * eje.x + d.y * eje.y + d.z * eje.z;
    if (Math.abs(dd) < 1e-9) { if (Math.abs(oo) > h) return [-1, -1]; continue; }
    const t1 = (-h - oo) / dd, t2 = (h - oo) / dd;
    tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2));
  }
  return tMax >= Math.max(tMin, 0) ? [tMin, tMax] : [-1, -1];
}
