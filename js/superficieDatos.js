/* =========================================================
   superficieDatos.js · Los DATOS y la GEOMETRÍA de la superficie
   de Ícaro, sin dibujo ni DOM (lo usan superficie.js, meowl.js
   y pruebas/superficie.test.mjs)
   ---------------------------------------------------------
   (x, z) = metros medidos SOBRE la arena desde el inicio (el
   polo norte del planeta). x = derecha, z = atrás: el camino
   avanza hacia −z. h = altura sobre la arena.
   El ángulo desde el polo es  arco / radio  (s / R).
   ========================================================= */
import { V3, tangent } from './util.js';

export const R_ARENA = 400;          // radio de la arena (P.mar)
export const G_ARENA = 20;                // gravedad en la arena (m/s²)

/* ---------- de (x, z, h) a un punto del planeta, y de vuelta ---------- */
/** Dirección desde el centro del planeta del punto (x, z): el ángulo es arco / radio. */
export function dirXZ(x, z, out = new V3()) {
  const s = Math.hypot(x, z);
  if (s < 1e-9) return out.set(0, 1, 0);
  const a = s / R_ARENA;
  return out.set(x / s * Math.sin(a), Math.cos(a), z / s * Math.sin(a));
}
/** Punto a h metros sobre la arena en (x, z). El planeta está en el origen. */
export const puntoXZ = (x, z, h = 0, out = new V3()) => dirXZ(x, z, out).multiplyScalar(R_ARENA + h);
/** Al revés: de un punto del mundo a (x, z, h). */
export function localXZ(p) {
  const r = p.length(), y = Math.min(1, Math.max(-1, p.y / r));
  const s = Math.acos(y) * R_ARENA, l = Math.hypot(p.x, p.z) || 1;
  return { x: s * p.x / l, z: s * p.z / l, h: r - R_ARENA };
}
/** Los 3 ejes del suelo en (x, z): ex = derecha, ey = arriba, ez = atrás (girados "giro" radianes). */
export function ejesEn(x, z, giro = 0) {
  const ey = dirXZ(x, z);
  const ex = tangent(new V3(), new V3(1, 0, 0), ey).normalize();
  const ez0 = new V3().crossVectors(ex, ey);
  const exG = ex.clone().multiplyScalar(Math.cos(giro)).addScaledVector(ez0, Math.sin(giro)).normalize();
  return { ex: exG, ey, ez: new V3().crossVectors(exG, ey).normalize() };
}

/* =========================================================
   EL RECORRIDO. Cada pieza es una losa de roca: centro (x, z),
   ancho w (en x), largo d (en z), altura h de su cara de arriba
   y giro. Todas bajan 4 m bajo la arena (fondo).
   ========================================================= */
export const H_FISURA = 6.5;                  // cuánto sube cada fisura (salto normal 4,9 m · botas 10 m)
export const H_ARENA_JEFE = 3 + 2 * H_FISURA;  // 16 m
export const PIEZAS = [
  // TRAMO 1 · la salida y las islas (huecos de 5 a 6 m: un salto normal llega a ~12 m)
  { id: 'salida', x: 0, z: 0, w: 16, d: 16, h: 2.5 },
  { id: 'isla1', x: -2, z: -16, w: 6, d: 6, h: 2.2, giro: 0.3 },
  { id: 'isla2', x: 3, z: -27.5, w: 5.5, d: 5.5, h: 2.8, giro: -0.2 },
  { id: 'isla3', x: -1.5, z: -39, w: 6, d: 5, h: 2.4, giro: 0.15 },
  { id: 'isla4', x: 0, z: -51, w: 8, d: 8, h: 3 },
  // TRAMO 2 · los pasillos de piedra (2,6 m de ancho) con un puente roto
  { id: 'pasillo1', x: 0, z: -60.5, w: 2.6, d: 11, h: 3 },
  { id: 'pasillo2', x: 5.2, z: -64.7, w: 13, d: 2.6, h: 3 },
  { id: 'pasillo3', x: 10.4, z: -69.5, w: 2.6, d: 7, h: 3 },
  { id: 'pasillo4', x: 10.4, z: -80.5, w: 2.6, d: 7, h: 3 },            // hueco de 4 m: el puente roto
  { id: 'mesaB', x: 10, z: -90.5, w: 13, d: 13, h: 3 },
  // TRAMO 3 · las FISURAS: cada una sube 6,5 m (solo con las botas)
  { id: 'mesaC', x: 9, z: -107, w: 14, d: 10, h: 3 + H_FISURA, fisura: true },
  { id: 'mesaD', x: 3, z: -121, w: 11, d: 10, h: H_ARENA_JEFE, fisura: true },
  { id: 'puente', x: 0, z: -131, w: 3.2, d: 10, h: H_ARENA_JEFE },
  // TRAMO 4 · la arena de Meowl: un octágono (2 cuadrados, uno girado 45°)
  { id: 'arena', x: 0, z: -150, w: 28, d: 28, h: H_ARENA_JEFE },
  { id: 'arena45', x: 0, z: -150, w: 28, d: 28, h: H_ARENA_JEFE, giro: Math.PI / 4 },
];
export const ARENA_JEFE = { x: 0, z: -150, radio: 13.5, h: H_ARENA_JEFE };
/** Puntos de control: si caes sin vidas, vuelves al último que pisaste. */
export const TRAMOS = [
  { pieza: 'salida', x: 0, z: -2 },
  { pieza: 'mesaB', x: 10, z: -86 },
  { pieza: 'mesaD', x: 3, z: -119 },
  { pieza: 'puente', x: 0, z: -129 },
];

/**
 * EL SALTO DEL SUSTO (al quemarte): tiro parabólico de vuelta al lugar seguro.
 * h = cuánto más arriba está, d = distancia horizontal, g = gravedad.
 *   cima H = h + 2,2 m (siempre un poco por encima del destino)
 *   subida:  v_y = √(2·g·H)      t₁ = v_y / g
 *   bajada:  de H a h            t₂ = √(2·(H − h) / g)
 *   v_x = d / (t₁ + t₂)
 */
export function tiroDeVuelta(h, d, g = G_ARENA) {
  const H = Math.max(h, 0) + 2.2;
  const vy = Math.sqrt(2 * g * H), t = vy / g + Math.sqrt(2 * (H - h) / g);
  return { vy, vx: d / t, t };
}
