/* =========================================================
   cueva.js · Lo que se VE en la cueva de Ícaro (decorado)
   ---------------------------------------------------------
   La cueva es un "set" aparte, como en el cine: no está dentro
   del planeta. Está sobre una esfera invisible ENORME
   (R = 2 000 m). A esa escala el suelo es casi plano y la
   gravedad casi no cambia con la altura:
       g(h) = g₀·R² / (R + h)²   →  subir 10 m la baja solo 1 %
   así que se siente como la Tierra bajo tus pies, y el motor
   de siempre (esferas que chocan, gravedad de Newton) sirve
   sin cambiar nada.

   Las paredes son DUNAS: esferas grandes con el centro ARRIBA
   del suelo. Así la parte de abajo queda "colgando" y no se
   puede subir caminando (el suelo solo cuenta como suelo si
   su normal apunta hacia arriba; ver collide en fisica.js).
   ========================================================= */
import { THREE, V3, rng } from './util.js';
import { toon, outline, faceNormal } from './escena.js';
import { mundo } from './fisica.js';

const ARENA = 0x8a6a4c, DUNA = 0x9a7552, ROCA = 0x4a3a35;

/** Pinta franjas (las "ondas" que deja el viento en la arena) con colores por vértice. */
function ondas(geo, base, seed, escala = 1) {
  const pos = geo.attributes.position, c = new THREE.Color(), b = new THREE.Color(base), r = rng(seed);
  const fase = r() * 10, giro = r() * 3;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const u = (x * Math.cos(giro) + z * Math.sin(giro)) * 1.3 * escala + y * 0.8 * escala;
    const k = 0.86 + 0.1 * Math.sin(u + fase) + 0.05 * Math.sin(u * 3.7 + y);
    c.copy(b).multiplyScalar(k);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

/** Brillo suave (sprite) de un color. */
function halo(rgba, tam) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(tam);
  return s;
}

/**
 * def.decorado del nivel de la cueva: dibuja el suelo, las dunas (las rocas
 * "ocultas" del nivel, que son las que chocan), cristales, estalagmitas y el
 * rayo de luz que entra por la grieta allá arriba (la salida).
 */
export function decorarCueva(grupo, planetas, { salida: [sx, sz] = [6.5, -31], bocaAlto = 118, sinRayo = false } = {}) {
  const P = planetas[0], r = rng(91);
  // SUELO: un casquete de la esfera (110 m de radio, llega hasta el fondo del laberinto). Es la MISMA esfera que choca.
  const ang = 110 / P.R;
  const suelo = new THREE.Mesh(ondas(new THREE.SphereGeometry(P.R, 160, 48, 0, Math.PI * 2, 0, ang), ARENA, 3, 0.6),
    toon(0xffffff, { map: null, vertexColors: true }));
  suelo.position.copy(P.c);
  grupo.add(suelo);

  // DUNAS: una por cada roca oculta del nivel (esas son las que chocan)
  for (const s of mundo.rocas) {
    if (!s.oculta) continue;
    const g = ondas(new THREE.SphereGeometry(s.R, 30, 20), DUNA, Math.round(s.c.x * 7 + s.c.z), 0.9 / Math.max(1, s.R / 4));
    const m = outline(new THREE.Mesh(g, toon(0xffffff, { map: null, vertexColors: true })), 0.012);
    m.position.copy(s.c);
    grupo.add(m);
  }

  // punto del suelo en (x, z) del set (la cueva está en el polo norte de la esfera: "arriba" ≈ +y)
  const enSuelo = (x, z, alto = 0) => {
    const d = new V3(x, P.R, z).normalize();
    return { p: P.c.clone().addScaledVector(d, P.R + alto), d };
  };

  // ESTALAGMITAS de roca oscura (decoración, no chocan: están pegadas a las paredes)
  const rocaMat = toon(ROCA, { flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, R0 = 9 + r() * 20;
    const x = Math.cos(a) * R0, z = -12 + Math.sin(a) * R0 * 1.3;
    if (Math.abs(x) < 5 && z > -16) continue;                            // nada en el pasillo
    if (Math.hypot(x, z + 22) < 10) continue;                            // ni en la sala
    if (Math.abs(x) < 7 && z < -30) continue;                            // ni en el pasillo al laberinto
    if (Math.abs(x) < 24 && z < -40) continue;                           // ni dentro del laberinto
    const alto = 1.5 + r() * 4;
    const { p, d } = enSuelo(x, z, alto / 2 - 0.2);
    const e = outline(new THREE.Mesh(new THREE.ConeGeometry(0.4 + r() * 0.7, alto, 6), rocaMat), 0.05);
    e.position.copy(p); e.quaternion.setFromUnitVectors(new V3(0, 1, 0), d);
    grupo.add(e);
  }

  // CRISTALES ámbar: las "grietas doradas" de Ícaro. Dan un poco de color en la oscuridad.
  const crisMat = toon(0xffb35c, { emissive: 0x8a4a10, flatShading: true });
  const racimos = [[-4.2, -3], [4.4, -9], [-4.6, -13], [7, -20], [-8, -28], [5.5, -31], [-3.5, 6]];
  for (const [x, z] of racimos) {
    for (let j = 0; j < 3; j++) {
      const { p, d } = enSuelo(x + (r() - 0.5) * 0.9, z + (r() - 0.5) * 0.9, 0.25);
      const c = outline(new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + r() * 0.25, 0), crisMat), 0.08);
      c.scale.y = 1.8 + r(); c.position.copy(p);
      c.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().add(new V3((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7)).normalize());
      grupo.add(c);
    }
    const h = halo('rgba(255,170,80,.5)', 2.6); h.position.copy(enSuelo(x, z, 0.4).p); grupo.add(h);
  }

  cueva.polvo = null; cueva.salida = null;
  if (sinRayo) return;                 // el laberinto (pozo.js) dibuja su propia luz por las chimeneas
  // RAYO DE LUZ que entra por la grieta, muy arriba: muestra que la salida está hacia ARRIBA
  const salida = enSuelo(sx, sz);
  // degradé: transparente abajo, más claro arriba (la luz se va perdiendo en el polvo al bajar)
  const cvR = document.createElement('canvas'); cvR.width = 4; cvR.height = 128;
  const gR = cvR.getContext('2d'), grR = gR.createLinearGradient(0, 128, 0, 0);
  grR.addColorStop(0, 'rgba(255,255,255,0)'); grR.addColorStop(0.35, 'rgba(255,255,255,.35)'); grR.addColorStop(1, 'rgba(255,255,255,1)');
  gR.fillStyle = grR; gR.fillRect(0, 0, 4, 128);
  const rayo = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.8, 120, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xcfe6ff, map: new THREE.CanvasTexture(cvR), transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false }));
  rayo.position.copy(salida.p).addScaledVector(salida.d, 60);
  rayo.quaternion.setFromUnitVectors(new V3(0, 1, 0), salida.d);
  const charco = new THREE.Mesh(new THREE.CircleGeometry(3.8, 40),
    new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  charco.position.copy(salida.p).addScaledVector(salida.d, 0.03); faceNormal(charco, salida.d);
  const boca = halo('rgba(220,235,255,.9)', 26); boca.position.copy(salida.p).addScaledVector(salida.d, bocaAlto);
  grupo.add(rayo, charco, boca);
  // polvo que flota en el rayo
  const n = 70, pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rad = r() * 2.8, y = r() * 30;
    const q = salida.p.clone().addScaledVector(salida.d, y).add(new V3(Math.cos(a) * rad * (1 + y / 60), 0, Math.sin(a) * rad * (1 + y / 60)));
    pts.set([q.x, q.y, q.z], i * 3);
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const polvo = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xe8f0ff, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
  polvo.userData.giro = true;
  grupo.add(polvo);
  cueva.polvo = polvo; cueva.salida = salida;
}
export const cueva = { polvo: null, salida: null };

/** Las botas de salto en el suelo: metal oscuro, suela celeste brillante y un halo. */
export function crearBotasSuelo() {
  const g = new THREE.Group();
  const metal = toon(0x2b2d3a), suela = new THREE.MeshBasicMaterial({ color: 0x7ff0ff, fog: false });
  for (const sx of [-1, 1]) {
    const b = new THREE.Group(); b.position.set(sx * 0.22, 0, sx * 0.08); b.rotation.y = sx * 0.25; g.add(b);
    const cana = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.36, 14), metal), 0.06); cana.position.y = 0.3; b.add(cana);
    const pie = outline(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.42), metal), 0.06); pie.position.set(0, 0.1, 0.08); b.add(pie);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.43), suela); s.position.set(0, 0.015, 0.08); b.add(s);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 6, 18), suela); aro.position.y = 0.45; aro.rotation.x = Math.PI / 2; b.add(aro);
  }
  const h = halo('rgba(120,240,255,.55)', 2.4); h.position.y = 0.3; g.add(h);
  return g;
}
