/* =========================================================
   keplerDatos.js · Los DATOS de Kepler, sin dibujo ni DOM
   ---------------------------------------------------------
   Lo usan kepler.js (dibujo y reglas), meimei.js (la carrera
   y la pelea) y pruebas/kepler.test.mjs (node).

   EL PLANETA: R = 300 m, g = 12 m/s² a nivel del suelo (h = 0).
     G·M = g·R² = 12 · 300² = 1 080 000 m³/s²
   Es MUY montañoso: la cima mide 80 m. Como la gravedad baja
   con el cuadrado de la distancia al centro, arriba pesas menos:
     g(cima) = 12·(300/380)² ≈ 7,5 m/s²

   RELIEVE: la altura del suelo en cada dirección (latitud,
   longitud) está guardada en una grilla de 0,9° (≈ 4,7 m).
   Entre puntos de la grilla se interpola (bilineal). Lo dibujado
   y lo que choca salen de la MISMA grilla.

   LAS LUNAS: órbitas circulares de verdad (Kepler):
     v = √(G·M / a)        T = 2π·√(a³ / G·M)
   Cada luna tiene su ESFERA DE HILL: la zona donde manda su
   gravedad sobre la del planeta,  r_H = a·∛(m / 3M).
   ========================================================= */
import { V3 } from './util.js';

export const R = 300;
export const G0 = 12;
export const GM_K = G0 * R * R;
const GRAD = Math.PI / 180;

/* ---------- direcciones: latitud/longitud (grados) ↔ vector unitario ---------- */
export function dirLL(lat, lon, out = new V3()) {
  const a = lat * GRAD, b = lon * GRAD;
  return out.set(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b));
}
export function llDe(u) {
  return { lat: Math.asin(Math.max(-1, Math.min(1, u.y))) / GRAD, lon: Math.atan2(u.x, u.z) / GRAD };
}

/* =========================================================
   EL CAMINO DE LA CARRERA
   Puntos de control (lat, lon) unidos con una curva suave sobre
   la esfera. Después se muestrea cada 2 m: cada muestra tiene
   su posición, su s (metros desde la cima) y su dirección.
   ========================================================= */
const CONTROL = [
  [62, -8], [60, 0], [57, 25], [52, 50], [45, 72], [40, 98], [36, 125], [30, 150],
  [22, 170], [14, 188], [6, 205], [-2, 222], [-6, 245], [-8, 268], [-6, 282], [-5, 290],
];
/* PERFIL: altura del suelo del camino (m) según s (m). Bajadas fuertes ("canaletas") y
   tramos tranquilos para que se sienta como agarrar velocidad, frenar y volver a bajar. */
export const PERFIL = [
  [0, 81], [55, 80], [70, 78],                     // la cima (aquí parte la carrera)
  [150, 62],                                       // canaleta 1 (~12°)
  [215, 58], [285, 44],                            // canaleta 2 (~11°)
  [360, 41], [440, 31], [500, 29], [560, 22],      // lomas y la entrada al desfiladero
  [690, 15], [760, 13], [880, 6],                  // desfiladero
  [1130, 6],                                       // el lago congelado (plano)
  [1185, 9], [1300, 9],                            // la loma del resorte
];
/* LOMAS: [s del centro, alto (m), largo (m)]: un bulto en el camino que funciona de rampa */
export const LOMAS = [[330, 2.6, 26], [470, 3, 28], [610, 2.2, 22], [1000, 1.2, 30]];
/* TRAMOS (para los checkpoints y el tipo de suelo) */
export const TRAMOS = [
  { nombre: 'La Cumbre', s: 30 },
  { nombre: 'La Gran Bajada', s: 220 },
  { nombre: 'El Desfiladero', s: 565 },
  { nombre: 'El Lago Congelado', s: 885 },
  { nombre: 'El Resorte', s: 1170 },
];
export const S_DESFILADERO = [560, 880];
export const S_LAGO = [880, 1140];
export const S_RESORTE = 1250;                     // el resorte (a 1250 m de la cima, arriba de la última loma)
/** Medio ancho del camino según s (m). */
export function anchoEn(s) {
  if (s < 70) return 16;                                  // la cima: una explanada
  if (s >= S_DESFILADERO[0] && s < S_DESFILADERO[1]) return 8;   // el desfiladero: angosto
  if (s >= S_LAGO[0] - 20 && s < S_LAGO[1]) return 26;    // el lago: ancho
  return 15;
}
const suave = t => t * t * (3 - 2 * t);
/** Altura del camino en s: perfil + lomas. */
export function alturaCamino(s) {
  let h = PERFIL[PERFIL.length - 1][1];
  for (let i = 0; i < PERFIL.length - 1; i++) {
    const [s0, h0] = PERFIL[i], [s1, h1] = PERFIL[i + 1];
    if (s >= s0 && s <= s1) { h = h0 + (h1 - h0) * suave((s - s0) / (s1 - s0)); break; }
  }
  if (s < PERFIL[0][0]) h = PERFIL[0][1];
  for (const [c, alto, largo] of LOMAS) {
    const x = (s - c) / largo;
    if (Math.abs(x) < 1) h += alto * Math.cos(x * Math.PI / 2) ** 2;
  }
  return h;
}

/** Curva Catmull-Rom entre vectores (después se normaliza: queda sobre la esfera). */
function catmull(p0, p1, p2, p3, t, out) {
  const t2 = t * t, t3 = t2 * t;
  for (const k of ['x', 'y', 'z'])
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return out.normalize();
}
function muestrearCamino(paso = 2) {
  const ctrl = CONTROL.map(([la, lo]) => dirLL(la, lo));
  const fino = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 60; k++) fino.push(catmull(p0, p1, p2, p3, k / 60, new V3()));
  }
  fino.push(ctrl[ctrl.length - 1].clone());
  // arrancamos en el 2° punto de control (el 1° solo da la dirección de salida)
  // remuestreo EXACTO cada "paso" metros (interpolando entre los puntos finos)
  const ini = 60;
  const muestras = [{ u: fino[ini].clone(), s: 0 }];
  let acum = 0, proximo = paso;
  for (let i = ini + 1; i < fino.length; i++) {
    const l = fino[i].distanceTo(fino[i - 1]) * R;
    while (acum + l >= proximo) {
      const k = (proximo - acum) / l;
      muestras.push({ u: fino[i - 1].clone().lerp(fino[i], k).normalize(), s: proximo });
      proximo += paso;
    }
    acum += l;
  }
  // dirección de avance (tangente) en cada muestra
  for (let i = 0; i < muestras.length; i++) {
    const a = muestras[Math.max(0, i - 1)].u, b = muestras[Math.min(muestras.length - 1, i + 1)].u;
    const t = b.clone().sub(a); t.addScaledVector(muestras[i].u, -t.dot(muestras[i].u));
    muestras[i].t = t.normalize();
    muestras[i].lado = new V3().crossVectors(muestras[i].t, muestras[i].u).normalize();   // a la derecha
    muestras[i].h = alturaCamino(muestras[i].s);
    muestras[i].ancho = anchoEn(muestras[i].s);
  }
  return muestras;
}
export const CAMINO = muestrearCamino(2);
export const LARGO = CAMINO[CAMINO.length - 1].s;

/** Muestra del camino más cercana a s. */
export function muestraEn(s) {
  const i = Math.max(0, Math.min(CAMINO.length - 1, Math.round(s / 2)));
  return CAMINO[i];
}
/** Punto del camino en s, corrido "lado" metros a la derecha y "alto" metros sobre el suelo del camino. */
export function puntoCamino(s, lado = 0, alto = 0, out = new V3()) {
  const i = Math.max(0, Math.min(CAMINO.length - 2, Math.floor(s / 2)));
  const a = CAMINO[i], b = CAMINO[i + 1], k = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
  out.copy(a.u).lerp(b.u, k).normalize();
  const ld = a.lado.clone().lerp(b.lado, k).normalize();
  out.addScaledVector(ld, lado / R).normalize();
  return out.multiplyScalar(R + alturaCamino(s) + alto);
}
/**
 * ¿Dónde estás respecto al camino? Busca la muestra más cercana (cerca de "pista", la última
 * que encontraste, para no recorrer todo) y devuelve { s, lateral, i }.
 */
export function proyectar(pos, pista = -1) {
  const u = pos.clone().normalize();
  let mejor = Infinity, iM = 0;
  const desde = pista < 0 ? 0 : Math.max(0, pista - 40), hasta = pista < 0 ? CAMINO.length : Math.min(CAMINO.length, pista + 40);
  for (let i = desde; i < hasta; i++) {
    const d = 1 - CAMINO[i].u.dot(u);
    if (d < mejor) { mejor = d; iM = i; }
  }
  const m = CAMINO[iM];
  const rel = u.clone().sub(m.u);
  return { s: m.s + rel.dot(m.t) * R, lateral: rel.dot(m.lado) * R, i: iM, dist: Math.sqrt(2 * Math.max(0, mejor)) * R };
}

/* =========================================================
   LAS LUNAS
   plano: dos vectores unitarios perpendiculares (e1, e2); la luna
   está en  c(t) = a·(cos(ωt + φ)·e1 + sin(ωt + φ)·e2),  ω = 2π/T
   ========================================================= */
function plano(normal) {
  const n = normal.clone().normalize();
  const e1 = new V3(0, 1, 0).cross(n);
  if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
  e1.normalize();
  return { n, e1, e2: new V3().crossVectors(n, e1) };
}
function luna(nombre, a, Rl, g, normal, fase, color) {
  const T = 2 * Math.PI * Math.sqrt(a ** 3 / GM_K);
  const gm = g * Rl * Rl;
  return {
    nombre, a, R: Rl, g, gm, color, fase,
    v: Math.sqrt(GM_K / a), T, w: 2 * Math.PI / T,
    hill: a * Math.cbrt(gm / (3 * GM_K)),          // radio de Hill: ahí manda la luna
    ...plano(normal),
  };
}
// Luna 2 (la de la pelea) pasa justo sobre el resorte del final del lago (más abajo se calcula).
// Luna 1 es más chica y más baja: da la vuelta más rápido (la 3ª ley se ve comparándolas).
const dirResorte = muestraEn(S_RESORTE).u;
const ejeL2 = dirResorte.clone().cross(new V3(0.25, 1, 0).normalize()).normalize();   // plano que contiene al resorte
export const LUNAS = [
  luna('Luna 1', 380, 18, 5, new V3(0.35, 1, -0.2), 1.3, 0xcfe3ff),
  luna('Luna 2', 440, 35, 6, ejeL2, 0, 0xe6f0ff),
];
/** Centro de la luna L en el tiempo t (el planeta está en el origen). */
export function posLuna(L, t, out = new V3()) {
  const ang = L.w * t + L.fase;
  return out.copy(L.e1).multiplyScalar(L.a * Math.cos(ang)).addScaledVector(L.e2, L.a * Math.sin(ang));
}
/** Velocidad de la luna: perpendicular al radio, de módulo v = √(GM/a). */
export function velLuna(L, t, out = new V3()) {
  const ang = L.w * t + L.fase;
  return out.copy(L.e1).multiplyScalar(-Math.sin(ang)).addScaledVector(L.e2, Math.cos(ang)).multiplyScalar(L.v);
}

/* =========================================================
   EL RELIEVE (grilla de alturas)
   ========================================================= */
export const PASO_GRILLA = 0.9;                    // grados
export const NLAT = Math.round(180 / PASO_GRILLA) + 1, NLON = Math.round(360 / PASO_GRILLA);
// la CIMA: el monte Kepler (donde parte la carrera)
const CIMA = dirLL(60.5, 0);

/* ruido de valores 3D (el mismo de roca.js, copiado para no depender del dibujo) */
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function ruido(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = suave(x - xi), v = suave(y - yi), w = suave(z - zi);
  const l = (a, b, t) => a + (b - a) * t, c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
/** Montañas "de fondo": crestas (1 − |ruido·2 − 1|) en 3 tamaños. Entre 0 y ~1. */
function montanas(u) {
  let h = 0, amp = 0.62, f = 2.2;
  for (let o = 0; o < 3; o++) {
    const n = ruido(u.x * f + 11, u.y * f + 3, u.z * f + 7);
    const cresta = 1 - Math.abs(n * 2 - 1);
    h += cresta * cresta * amp; amp *= 0.45; f *= 2.3;
  }
  return h;
}

/** Arma la grilla. Tarda ~0,1 s. Devuelve el objeto "relieve" que usa fisica.js. */
export function crearRelieve() {
  const N = NLAT * NLON;
  const alt = new Float32Array(N), tipo = new Uint8Array(N);       // tipo: 0 nieve · 1 hielo · 2 roca · 3 camino
  const dist = new Float32Array(N).fill(1e9), sMas = new Float32Array(N);
  const u = new V3();
  const idx = (i, j) => i * NLON + ((j % NLON) + NLON) % NLON;
  const latDe = i => -90 + i * PASO_GRILLA, lonDe = j => -180 + j * PASO_GRILLA;
  // 1) distancia de cada punto de la grilla al camino ("estampamos" cada muestra en su vecindad)
  const ALC = 70;                                   // m: más allá, el camino ya no influye
  for (const m of CAMINO) {
    const { lat, lon } = llDe(m.u);
    const dLat = ALC / R / GRAD, dLon = dLat / Math.max(0.15, Math.cos(lat * GRAD));
    const i0 = Math.max(0, Math.floor((lat - dLat + 90) / PASO_GRILLA)), i1 = Math.min(NLAT - 1, Math.ceil((lat + dLat + 90) / PASO_GRILLA));
    const j0 = Math.floor((lon - dLon + 180) / PASO_GRILLA), j1 = Math.ceil((lon + dLon + 180) / PASO_GRILLA);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      dirLL(latDe(i), lonDe(j), u);
      const d = u.distanceTo(m.u) * R, k = idx(i, j);
      if (d < dist[k]) { dist[k] = d; sMas[k] = m.s; }
    }
  }
  // 2) la altura: valle del camino + montañas alrededor
  for (let i = 0; i < NLAT; i++) for (let j = 0; j < NLON; j++) {
    const k = idx(i, j);
    dirLL(latDe(i), lonDe(j), u);
    let mont = 6 + 64 * montanas(u);
    const aCima = Math.acos(Math.min(1, u.dot(CIMA))) * R;           // m desde la cima
    mont = Math.max(mont, 84 * Math.exp(-((aCima / 95) ** 2)));       // el monte Kepler
    let h = mont, t = 0;
    const d = dist[k];
    if (d < ALC) {
      const s = sMas[k], hp = alturaCamino(s), w = anchoEn(s);
      const desf = s >= S_DESFILADERO[0] && s < S_DESFILADERO[1], lago = s >= S_LAGO[0] - 10 && s < S_LAGO[1] + 10;
      // el valle: piso del camino + paredes que suben (en el desfiladero, casi verticales)
      const piso = hp + 0.5 * (d / w) ** 2;
      const borde = desf ? 3 : lago ? 22 : 12;
      const pared = desf ? hp + 24 + 0.3 * Math.max(0, d - w - borde) : Math.max(mont, hp + 3 + 0.3 * Math.max(0, d - w - borde));
      if (d <= w) h = piso;
      else if (d < w + borde) h = piso + (pared - piso) * suave((d - w) / borde);
      else h = Math.max(pared, desf ? pared : h * suave(Math.min(1, (d - w - borde) / 40)) + pared * (1 - suave(Math.min(1, (d - w - borde) / 40))));
      if (d < w + borde) h = Math.max(h, piso);
      if (lago && d < w + 4) t = 1;
      else if (d < w * 0.85) t = 3;                     // el piso del camino (nieve pisada)
    }
    if (t === 0 && h > 40 && ruido(u.x * 40, u.y * 40, u.z * 40) > 0.62) t = 2;   // manchas de roca en lo alto
    alt[k] = h; tipo[k] = t;
  }
  // 3) bajo la órbita de la Luna 1 no puede haber montañas altas (pasa a 62 m del suelo)
  const L1 = LUNAS[0], techo = L1.a - L1.R - R - 14;
  for (let i = 0; i < NLAT; i++) for (let j = 0; j < NLON; j++) {
    dirLL(latDe(i), lonDe(j), u);
    const dPlano = Math.abs(u.dot(L1.n)) * R;
    if (dPlano < 40) { const k = idx(i, j); alt[k] = Math.min(alt[k], techo + (dPlano / 40) * 30); }
  }
  return relieveDesdeGrilla(alt, tipo);
}

/** El objeto que usa fisica.js: radio del suelo y normal en cualquier dirección. */
export function relieveDesdeGrilla(alt, tipo) {
  let max = 0;
  for (let k = 0; k < alt.length; k++) if (alt[k] > max) max = alt[k];
  // altura interpolada (bilineal) en (lat, lon) en grados
  function hLL(lat, lon) {
    const fi = Math.max(0, Math.min(NLAT - 1.0001, (lat + 90) / PASO_GRILLA));
    let fj = (lon + 180) / PASO_GRILLA; fj = ((fj % NLON) + NLON) % NLON;
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, j2 = (j + 1) % NLON;
    const h00 = alt[i * NLON + j], h01 = alt[i * NLON + j2], h10 = alt[(i + 1) * NLON + j], h11 = alt[(i + 1) * NLON + j2];
    return (h00 * (1 - b) + h01 * b) * (1 - a) + (h10 * (1 - b) + h11 * b) * a;
  }
  const _e = new V3(), _n = new V3();
  return {
    max: R + max, alt, tipo,
    /** altura (m) sobre R en la dirección unitaria u */
    h(u) { const { lat, lon } = llDe(u); return hLL(lat, lon); },
    /** distancia del centro al suelo en la dirección u */
    radio(u) { return R + this.h(u); },
    /** tipo de suelo (0 nieve · 1 hielo · 2 roca · 3 camino) del punto de grilla más cercano */
    tipoEn(u) {
      const { lat, lon } = llDe(u);
      const i = Math.round((lat + 90) / PASO_GRILLA), j = ((Math.round((lon + 180) / PASO_GRILLA) % NLON) + NLON) % NLON;
      return tipo[Math.max(0, Math.min(NLAT - 1, i)) * NLON + j];
    },
    /**
     * NORMAL del suelo en u (vector unitario hacia afuera). Sale de la PENDIENTE:
     * medimos cuánto sube el suelo 1 m al este y 1 m al norte (diferencias centradas)
     * y la normal es  arriba − (pendiente este)·este − (pendiente norte)·norte.
     */
    normal(u, out = new V3()) {
      const { lat, lon } = llDe(u);
      const rr = R + hLL(lat, lon), cl = Math.max(0.05, Math.cos(lat * GRAD));
      const dLat = 1 / rr / GRAD, dLon = dLat / cl;
      const pe = (hLL(lat, lon + dLon) - hLL(lat, lon - dLon)) / 2;     // subida por metro hacia el este
      const pn = (hLL(lat + dLat, lon) - hLL(lat - dLat, lon)) / 2;     // subida por metro hacia el norte
      const b = lon * GRAD, a = lat * GRAD;
      _e.set(Math.cos(b), 0, -Math.sin(b));                                    // este
      _n.set(-Math.sin(a) * Math.sin(b), Math.cos(a), -Math.sin(a) * Math.cos(b));   // norte
      return out.copy(u).addScaledVector(_e, -pe).addScaledVector(_n, -pn).normalize();
    },
  };
}

/* =========================================================
   DESLIZAR (lo usa jugador.js y la prueba): ROCE de la nieve o el
   hielo y AIRE.
     roce:  a = μ·g·cos θ   (en contra del movimiento; cos θ = normal·arriba)
     aire:  a = c·v²        (crece con el cuadrado de la rapidez)
   En una bajada la gravedad empuja g·sen θ: ese empuje lo hace sola
   la física de choques (la gravedad apunta al centro, el suelo quita
   la parte que empuja contra él y queda la parte cuesta abajo).
   Velocidad límite en una bajada:  g·(sen θ − μ·cos θ) = c·v²
   ========================================================= */
export const DESLIZ = {
  mu: [0.03, 0.012, 0.09, 0.03],      // nieve, hielo, roca, camino (nieve pisada)
  c: 0.0028,                    // aire (1/m)
  patin: 12,                    // empujándote con el joystick llegas hasta 12 m/s en lo plano
  aPatin: 5,                    // ... con esta aceleración (m/s²)
  freno: 8,                     // tirar hacia atrás frena (m/s²)
  giro: 16,                     // aceleración de lado para doblar (m/s²): radio de giro = v²/16
  max: 36,                      // tope por seguridad (m/s)
};
/** Velocidad límite (m/s) en una bajada de "grados" con roce mu y gravedad g. */
export function velLimite(grados, mu, g = G0) {
  const a = grados * GRAD, empuje = g * (Math.sin(a) - mu * Math.cos(a));
  return empuje > 0 ? Math.sqrt(empuje / DESLIZ.c) : 0;
}
const _vt = new V3(), _dir = new V3(), _lado = new V3();
/**
 * Un paso de deslizar SOBRE EL SUELO. vel = velocidad completa (se cambia aquí);
 * n = normal del suelo; up = arriba (opuesto a la gravedad); mv = joystick (sobre el suelo, largo 0 a 1).
 */
export function pasoDeslizar(vel, n, up, g, mu, mv, dt) {
  // la parte de la velocidad que va A LO LARGO del suelo
  _vt.copy(vel).addScaledVector(n, -vel.dot(n));
  let v = _vt.length();
  const cos = Math.max(0, n.dot(up));
  if (v > 0.05) {
    _dir.copy(_vt).divideScalar(v);
    // roce y aire: le quitan rapidez (sin cambiarle la dirección, y sin hacerla negativa)
    v = Math.max(0, v - (mu * g * cos + DESLIZ.c * v * v) * dt);
    // joystick: hacia adelante empuja (patinar), hacia atrás frena, de lado dobla
    const adelante = mv.dot(_dir);
    if (adelante > 0.2 && v < DESLIZ.patin) v = Math.min(DESLIZ.patin, v + DESLIZ.aPatin * adelante * dt);
    if (adelante < -0.3) v = Math.max(0, v + DESLIZ.freno * adelante * dt);
    _lado.copy(mv).addScaledVector(_dir, -adelante).addScaledVector(n, -mv.dot(n));
    if (_lado.lengthSq() > 1e-4 && v > 0.5) {
      // doblar: girar la dirección con aceleración de lado "giro" → ángulo = (a/v)·dt
      const ang = Math.min(1, DESLIZ.giro * Math.min(1, _lado.length()) / v * dt);
      _dir.lerp(_lado.normalize(), ang).normalize();
    }
    v = Math.min(v, DESLIZ.max);
    vel.copy(_dir).multiplyScalar(v).addScaledVector(n, vel.dot(n));
  } else if (mv.lengthSq() > 0.01) {
    // casi quieto: arrancar empujando
    vel.addScaledVector(mv, DESLIZ.aPatin * dt);
  }
  return v;
}

/* =========================================================
   EL RESORTE: Hooke y el tiro a la Luna 2
     energía del resorte = ½·k·x²  →  ½·m·v²   →   v = x·√(k/m)
   x = 1,5 m de compresión, m = 60 kg (tú con traje).
   Para apuntar: el resorte prueba ángulos y velocidades, simula el
   vuelo con la gravedad del planeta (la misma de pasoNewton) y busca
   uno que te deje dentro de la esfera de Hill de la luna CUANDO ella
   llegue ahí (apunta adelantado: la luna avanza ω·t mientras vuelas).
   ========================================================= */
export const RESORTE = { x: 1.5, m: 60, tMax: 18, vs: [38, 42, 46, 50, 54, 58, 62, 66, 70], angs: [22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88], lados: [-0.35, 0, 0.35] };
export const kResorte = v => RESORTE.m * (v / RESORTE.x) ** 2;
/** Base del resorte (en el mundo) y sus ejes: arriba, hacia donde va la luna. */
export function baseResorte(relieve, t = 0) {
  const u = muestraEn(S_RESORTE).u.clone();
  const pos = u.clone().multiplyScalar(relieve ? relieve.radio(u) : R + alturaCamino(S_RESORTE));
  const L = LUNAS[1];
  const haciaLuna = L.n.clone().cross(u).normalize();       // dirección en que avanza la órbita sobre el resorte
  return { pos, arriba: u, adelante: haciaLuna };
}
/**
 * ¿Hay un tiro que llegue a la Luna 2 si disparas en el tiempo t0? Devuelve el mejor
 * { v, ang, vel, tVuelo } o null. paso = dt de la simulación.
 */
export function tiroALaLuna(base, t0, paso = 1 / 60) {
  const L = LUNAS[1], pos = new V3(), vel = new V3(), cL = new V3(), g = new V3();
  let mejor = null;
  const lado = new V3().crossVectors(base.adelante, base.arriba), hor = new V3();
  for (const v of RESORTE.vs) for (const angG of RESORTE.angs) for (const ld of RESORTE.lados) {
    const a = angG * GRAD;
    pos.copy(base.pos).addScaledVector(base.arriba, 1.2);
    hor.copy(base.adelante).addScaledVector(lado, ld).normalize();
    vel.copy(base.arriba).multiplyScalar(v * Math.sin(a)).addScaledVector(hor, v * Math.cos(a));
    const vel0 = vel.clone();
    for (let t = 0; t < RESORTE.tMax; t += paso) {
      // salto de rana con la gravedad del planeta (afuera de la esfera de Hill de la luna)
      const r = pos.length(); g.copy(pos).multiplyScalar(-GM_K / (r * r * r));
      vel.addScaledVector(g, paso / 2); pos.addScaledVector(vel, paso);
      const r2 = pos.length(); g.copy(pos).multiplyScalar(-GM_K / (r2 * r2 * r2)); vel.addScaledVector(g, paso / 2);
      if (r2 < R) break;
      posLuna(L, t0 + t + paso, cL);
      const d = pos.distanceTo(cL);
      if (d < L.hill * 0.8) {
        // nos quedamos con el que llega más suave (poca velocidad respecto a la luna) y sin volar tanto rato:
        // puntaje = v_rel + 2·t_vuelo (mientras más bajo, mejor)
        const rel = vel.clone().sub(velLuna(L, t0 + t + paso)).length();
        if (!mejor || rel + 2 * t < mejor.rel + 2 * mejor.tVuelo) mejor = { v, ang: angG, vel: vel0, tVuelo: t, rel };
        break;
      }
    }
  }
  return mejor;
}

/* =========================================================
   LA PELEA EN LA LUNA 2 (meimei.js)
   ========================================================= */
export const PELEA = {
  // salto orbital: en una luna tan chica, a 1,5 m del suelo basta  v = √(G·m / r)  para quedar en órbita
  alturaOrbita: 1.5,
  vOrbita: () => Math.sqrt(LUNAS[1].gm / (LUNAS[1].R + 1.5)),
  tOrbita: () => 2 * Math.PI * (LUNAS[1].R + 1.5) / Math.sqrt(LUNAS[1].gm / (LUNAS[1].R + 1.5)),
  // escapar de Kepler desde la Luna 2: v_esc = √(2·G·M / a) = √2 · v_luna
  vEscape: () => Math.sqrt(2 * GM_K / LUNAS[1].a),
  vSalida: 32,                                  // el resorte final (m/s, respecto a la luna)
  // el derrape de MeiMei: cae entre 6 y 10 m/s y frena con a = μ·g (μ = 0,8 con las garras)
  vDerrape: [6, 10], muFrena: 0.8,
  frenoOrbita: 0.7,                             // en el salto orbital se frena a 0,7·v: la órbita se vuelve elipse y cae
  // TOPE DEL SALTO (ayuda del juego): lo más alto de un salto queda en r_tope = r_Hill − 8 m
  margenTope: 8,
  vTope: r => Math.sqrt(Math.max(0, 2 * LUNAS[1].gm * (1 / r - 1 / (LUNAS[1].hill - 8)))),
};
