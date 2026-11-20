/* =========================================================
   vegetacion.js · Pasto, flores, matas, árboles y nenúfares
   ---------------------------------------------------------
   Solo decoración: NADA de esto choca ni cambia la física, así
   que los saltos medidos del tutorial siguen siendo iguales.

   Para que el celular no sufra usamos InstancedMesh: una sola
   malla (por ejemplo, una hojita de pasto) que la tarjeta de
   video dibuja cientos de veces en UNA llamada, cada copia con
   su propia posición, giro, tamaño y color.

   Cada cosa se para en el suelo real: superficieEn() dice a qué
   distancia del centro del planeta está el suelo en esa
   dirección, y la planta crece "hacia afuera" de la isla.

   En el nivel, cada isla puede pedir cuánto quiere:
     veg: { pasto, flores, matas, arboles, claro }
   claro = radio (m) del centro de la isla sin matas ni árboles
   (para que la arena del jefe quede despejada).
   ========================================================= */
import { THREE, V3, rng } from './util.js';
import { toon } from './escena.js';
import { superficieEn } from './fisica.js';

const Y = new V3(0, 1, 0);
const negroAtras = new THREE.MeshBasicMaterial({ color: 0x15121c, side: THREE.BackSide });

/** Junta "muchas copias" de una geometría en un InstancedMesh. lista = [{ pos, up, giro, esc (V3), color }] */
function instanciar(geo, mat, lista, contorno = 0) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, lista.length));
  m.count = lista.length;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), qg = new THREE.Quaternion(), c = new THREE.Color();
  lista.forEach((it, i) => {
    q.setFromUnitVectors(Y, it.up);
    qg.setFromAxisAngle(Y, it.giro || 0);
    q.multiply(qg);                                   // primero gira sobre su eje, después se para sobre el suelo
    M.compose(it.pos, q, it.esc);
    m.setMatrixAt(i, M);
    m.setColorAt(i, c.setHex(it.color ?? 0xffffff));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;                            // las copias están repartidas por todo el planeta
  if (!contorno) return m;
  // contorno negro de dibujo animado: la misma geometría un poco más grande, por dentro (BackSide)
  const g = new THREE.Group();
  const o = new THREE.InstancedMesh(geo.clone().scale(1 + contorno, 1 + contorno, 1 + contorno), negroAtras, Math.max(1, lista.length));
  o.count = lista.length; o.instanceMatrix = m.instanceMatrix; o.frustumCulled = false;
  g.add(m, o);
  return g;
}

/* geometrías base (todas "paradas" sobre y = 0) */
const hoja = new THREE.ConeGeometry(0.07, 1, 3).translate(0, 0.5, 0);
const tallo = new THREE.CylinderGeometry(0.018, 0.022, 1, 4).translate(0, 0.5, 0);
const flor = new THREE.IcosahedronGeometry(1, 0);
const bola = new THREE.IcosahedronGeometry(1, 1);
const tronco = new THREE.CylinderGeometry(0.11, 0.17, 1, 6).translate(0, 0.5, 0);
const nenufar = new THREE.CylinderGeometry(1, 1, 0.05, 12);

const VERDES = [0x7fae6e, 0x6fa35f, 0x8cbc72, 0x5f9a58, 0x9cc77a];
const PETALOS = [0xff8fb8, 0xffe07a, 0xffffff, 0xc9a2ff, 0xff9f6b, 0x8fd8ff];
const COPAS = [0x5f9a58, 0x6fae5c, 0x4f8a4a, 0x82b863];

/**
 * islas: [{ def, solido }] — def = lo del nivel (dir, ancho, veg), solido = esfera que va a la física.
 * evitar: puntos donde NO poner matas ni árboles (carteles, cañón, botón...).
 * camino: normal del plano del camino (las islas están en ese gran círculo); deja libre una franja.
 */
export function crearVegetacion(P, islas, { evitar = [], camino = null, seed = 5 } = {}) {
  const r = rng(seed);
  const L = { pasto: [], tallos: [], flores: [], matas: [], troncos: [], copas: [], nenufares: [], florAgua: [] };
  const Rm = P.mar || P.R;
  const dir = new V3(), a = new V3(), b = new V3();

  for (const { def: is, solido } of islas) {
    const v = is.veg || {};
    const ancho = is.ancho;
    a.set(1, 0, 0); if (Math.abs(is.dir.x) > 0.9) a.set(0, 0, 1);
    a.addScaledVector(is.dir, -a.dot(is.dir)).normalize();
    b.crossVectors(is.dir, a);

    /** Busca un punto al azar del pasto de la isla. Devuelve { pos, up, dist } o null. */
    const punto = (margen = 0.6, minDist = 0) => {
      for (let k = 0; k < 8; k++) {
        const ang = r() * Math.PI * 2;
        const rad = minDist + Math.sqrt(r()) * (ancho - margen - minDist);
        dir.copy(is.dir).addScaledVector(a, Math.cos(ang) * rad / Rm).addScaledVector(b, Math.sin(ang) * rad / Rm).normalize();
        const h = superficieEn(P, dir);
        if (h - Rm < 0.42) continue;                          // ahí ya es arena o agua
        const pos = P.c.clone().addScaledVector(dir, h);
        const up = pos.clone().sub(solido.c).normalize();      // normal de la isla en ese punto
        return { pos, up, dist: rad, dir: dir.clone() };
      }
      return null;
    };
    const libre = q => {
      if (camino && Math.abs(q.dir.dot(camino)) * Rm < 2.6) return false;
      for (const e of evitar) if (q.pos.distanceTo(e) < 2.4) return false;
      return true;
    };

    // PASTO: matitas de 3 hojitas
    const nPasto = v.pasto ?? Math.round(ancho * ancho * 2.2);
    for (let i = 0; i < nPasto; i++) {
      const q = punto(0.5); if (!q) continue;
      const verde = VERDES[Math.floor(r() * VERDES.length)];
      for (let k = 0; k < 3; k++) {
        const alto = 0.25 + r() * 0.3;
        const up = q.up.clone().add(new V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.7)).normalize();
        L.pasto.push({ pos: q.pos.clone().addScaledVector(up, -0.03), up, giro: r() * 6, esc: new V3(1, alto, 1), color: verde });
      }
    }
    // FLORES: tallo + cabecita de color
    const nFlores = v.flores ?? Math.round(ancho * ancho * 0.6);
    for (let i = 0; i < nFlores; i++) {
      const q = punto(0.7); if (!q) continue;
      const alto = 0.22 + r() * 0.35;
      L.tallos.push({ pos: q.pos, up: q.up, esc: new V3(1, alto, 1), color: 0x4f8a4a });
      const t = 0.07 + r() * 0.06;
      L.flores.push({ pos: q.pos.clone().addScaledVector(q.up, alto), up: q.up, giro: r() * 6, esc: new V3(t, t * 0.7, t), color: PETALOS[Math.floor(r() * PETALOS.length)] });
    }
    // MATAS: 2 o 3 bolitas verdes juntas (algunas con flores)
    const nMatas = v.matas ?? Math.round(ancho * 0.9);
    for (let i = 0; i < nMatas; i++) {
      const q = punto(1.1, v.claro || 0); if (!q || !libre(q)) continue;
      const verde = COPAS[Math.floor(r() * COPAS.length)];
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const s = 0.35 + r() * 0.3;
        const off = new V3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.8);
        off.addScaledVector(q.up, -off.dot(q.up));
        L.matas.push({ pos: q.pos.clone().add(off).addScaledVector(q.up, s * 0.55), up: q.up, giro: r() * 6, esc: new V3(s, s * 0.85, s), color: verde });
      }
      if (r() < 0.5) for (let k = 0; k < 4; k++) {
        const off = new V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9);
        off.addScaledVector(q.up, -off.dot(q.up));
        L.flores.push({ pos: q.pos.clone().add(off).addScaledVector(q.up, 0.75), up: q.up, esc: new V3(0.08, 0.06, 0.08), color: PETALOS[i % PETALOS.length] });
      }
    }
    // ÁRBOLES: tronco + copa de 2 bolas (solo lejos del camino)
    const nArboles = v.arboles ?? 0;
    let puestos = 0;
    for (let i = 0; i < nArboles * 6 && puestos < nArboles; i++) {
      const q = punto(1.6, v.claro || 0); if (!q || !libre(q)) continue;
      puestos++;
      const alto = 1.7 + r() * 1.1;
      L.troncos.push({ pos: q.pos.clone().addScaledVector(q.up, -0.1), up: q.up, giro: r() * 6, esc: new V3(1, alto, 1), color: 0x8a5a3c });
      const verde = COPAS[Math.floor(r() * COPAS.length)];
      const s = 0.9 + r() * 0.45;
      L.copas.push({ pos: q.pos.clone().addScaledVector(q.up, alto + s * 0.35), up: q.up, giro: r() * 6, esc: new V3(s, s * 0.9, s), color: verde });
      const lado = new V3(r() - 0.5, 0, r() - 0.5); lado.addScaledVector(q.up, -lado.dot(q.up)).normalize();
      L.copas.push({ pos: q.pos.clone().addScaledVector(q.up, alto - 0.1).addScaledVector(lado, s * 0.6), up: q.up, esc: new V3(s * 0.7, s * 0.65, s * 0.7), color: verde });
    }
    // NENÚFARES flotando cerca de la orilla
    const nNen = v.nenufares ?? Math.round(ancho * 0.8);
    for (let i = 0; i < nNen; i++) {
      const ang = r() * Math.PI * 2, rad = ancho + 0.8 + r() * 3.5;
      dir.copy(is.dir).addScaledVector(a, Math.cos(ang) * rad / Rm).addScaledVector(b, Math.sin(ang) * rad / Rm).normalize();
      if (superficieEn(P, dir) > Rm - 0.05) continue;         // ahí hay tierra
      const pos = P.c.clone().addScaledVector(dir, Rm + 0.04);
      const s = 0.35 + r() * 0.35;
      L.nenufares.push({ pos, up: dir.clone(), giro: r() * 6, esc: new V3(s, 1, s), color: VERDES[i % VERDES.length] });
      if (r() < 0.35) L.flores.push({ pos: pos.clone().addScaledVector(dir, 0.1), up: dir.clone(), esc: new V3(0.11, 0.08, 0.11), color: r() < 0.5 ? 0xff8fb8 : 0xffffff });
    }
  }

  const g = new THREE.Group();
  const blanco = () => toon(0xffffff);
  g.add(instanciar(hoja, blanco(), L.pasto));
  g.add(instanciar(tallo, blanco(), L.tallos));
  g.add(instanciar(flor, toon(0xffffff, { flatShading: true }), L.flores));
  g.add(instanciar(bola, toon(0xffffff, { flatShading: true }), L.matas, 0.08));
  g.add(instanciar(tronco, blanco(), L.troncos, 0.12));
  g.add(instanciar(bola, toon(0xffffff, { flatShading: true }), L.copas, 0.06));
  g.add(instanciar(nenufar, blanco(), L.nenufares));
  g.userData.cuenta = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.length]));
  return g;
}
