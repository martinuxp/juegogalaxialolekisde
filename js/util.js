/* =========================================================
   util.js · Herramientas matemáticas chicas que usan todos los módulos
   ---------------------------------------------------------
   Todo el juego trabaja con vectores 3D (THREE.Vector3).
   Como caminamos sobre esferas, lo que más se repite es:
   "quitarle a un vector la parte que apunta hacia arriba"
   (proyectarlo sobre el plano tangente al planeta).
   ========================================================= */
import * as THREE from './vendor/three/three.module.min.js';

export { THREE };
export const V3 = THREE.Vector3;

/** Limita x al rango [a, b]. */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Factor de suavizado que no depende de los FPS (sirve para lerp). */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/**
 * out = v sin su componente a lo largo de n.
 * Si n es el "arriba" del jugador, el resultado es la parte "horizontal" de v,
 * o sea, la que está sobre el plano tangente al planeta.
 */
export function tangent(out, v, n) {
  const d = v.dot(n);
  return out.copy(v).addScaledVector(n, -d);
}

/** Dirección (vector unitario) a partir de latitud y longitud en grados. */
export function dirLL(lat, lon) {
  const a = lat * Math.PI / 180;
  const b = lon * Math.PI / 180;
  return new V3(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b));
}

/** Un vector cualquiera perpendicular a n (sirve cuando no hay otra referencia). */
export function anyPerp(out, n) {
  out.set(1, 0, 0);
  if (Math.abs(n.x) > 0.9) out.set(0, 0, 1);
  return tangent(out, out, n).normalize();
}

/** Mueve el vector v hacia target, como máximo maxDelta (aceleración limitada). */
const _mt = new V3();
export function moveTowards(v, target, maxDelta) {
  _mt.copy(target).sub(v);
  const d = _mt.length();
  if (d <= maxDelta || d < 1e-9) v.copy(target);
  else v.addScaledVector(_mt, maxDelta / d);
}

/** Generador pseudoaleatorio con semilla: el mismo número da siempre lo mismo. */
export function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
