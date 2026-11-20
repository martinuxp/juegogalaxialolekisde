/* =========================================================
   roca.js · Convierte CAJAS en ROCA (solo el dibujo)
   ---------------------------------------------------------
   El motor choca con cajas (rápido y fácil de explicar), pero
   las cajas se ven muy "cuadradas". Aquí dibujamos cada caja
   como roca: la geometría se subdivide y cada vértice se mete
   hacia ADENTRO según un "ruido" 3D (un número suave que cambia
   de a poco en el espacio). Como solo se hunde (nunca sobresale)
   el jugador nunca atraviesa una roca que se ve; a lo más queda
   un poquito de aire entre él y la pared.
   Los vértices que comparten esquina se SUELDAN (mismo índice),
   así la roca no se raja en los bordes y las esquinas quedan
   redondeadas (la normal de una esquina es el promedio de las
   caras que se juntan ahí).
   El color depende de la ALTURA (capas, como las rocas de
   sedimento) y de cuánto se hundió (las grietas, más oscuras).
   Todo termina en UNA sola malla: una sola llamada de dibujo.
   ========================================================= */
import { THREE, V3 } from './util.js';
import { toon } from './escena.js';

/* ---------- ruido de valores 3D ----------
   En cada punto de una grilla de 1 m hay un número al azar (pero
   fijo: sale de un "hash" de las coordenadas). Entre puntos se
   interpola suave (curva 3t² − 2t³), así el ruido no tiene saltos. */
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const suave = t => t * t * (3 - 2 * t);
export function ruido(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = suave(x - xi), v = suave(y - yi), w = suave(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
           l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
/** Ruido con 2 "octavas": formas grandes + detalle chico. Entre 0 y 1. */
export const ruido2 = (x, y, z) => ruido(x * 0.35, y * 0.35, z * 0.35) * 0.7 + ruido(x * 1.1 + 7, y * 1.1, z * 1.1) * 0.3;

/** Suelda vértices repetidos (misma posición) para que la caja sea una sola piel. */
function soldar(geo) {
  const pos = geo.attributes.position, mapa = new Map(), nuevos = [], idx = [];
  const viejoANuevo = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!mapa.has(k)) { mapa.set(k, nuevos.length / 3); nuevos.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
    viejoANuevo[i] = mapa.get(k);
  }
  const ind = geo.index.array;
  for (let i = 0; i < ind.length; i++) idx.push(viejoANuevo[ind[i]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(nuevos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const _p = new V3(), _n = new V3(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3();
/**
 * cajas: [{ c, ex, ey, ez, medio }]   (las mismas que chocan)
 * op.colorEn(alturaLocal, hundido01, ruido) → THREE.Color
 * op.altura(p) → altura "local" de un punto del mundo (para las capas)
 * op.hundir: cuánto se mete la roca en los lados (m); op.plano: en las caras de arriba
 */
export function crearRoca(cajas, op = {}) {
  const hundir = op.hundir ?? 0.55, plano = op.plano ?? 0.06, paso = op.paso ?? 1.3;
  const arriba = op.arriba || new V3(0, 1, 0);
  const pos = [], nor = [], col = [], idx = [];
  const color = new THREE.Color();
  for (const k of cajas) {
    const w = k.medio.x * 2, h = k.medio.y * 2, d = k.medio.z * 2;
    const seg = v => Math.max(1, Math.min(14, Math.round(v / paso)));
    const g = soldar(new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)));
    _m.makeBasis(k.ex, k.ey, k.ez).setPosition(k.c);
    _nm.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal, base = pos.length / 3;
    for (let i = 0; i < P.count; i++) {
      _p.fromBufferAttribute(P, i).applyMatrix4(_m);
      _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
      const n = ruido2(_p.x, _p.y, _p.z);
      // arriba (donde se pisa) casi plano; a los lados, la roca se come hacia adentro
      const tope = Math.max(0, _n.dot(arriba));
      const prof = (tope > 0.7 ? plano : hundir) * (0.25 + 0.75 * n);
      _p.addScaledVector(_n, -prof);
      pos.push(_p.x, _p.y, _p.z);
      color.copy(op.colorEn ? op.colorEn(op.altura ? op.altura(_p) : _p.y, prof / Math.max(hundir, 1e-3), n) : new THREE.Color(0x9a7552));
      col.push(color.r, color.g, color.b);
    }
    for (const i of g.index.array) idx.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return new THREE.Mesh(geo, toon(0xffffff, { map: null, vertexColors: true }));
}
