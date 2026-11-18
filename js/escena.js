/* =========================================================
   escena.js · Lo que se dibuja: renderer, cámara, luces y estilo
   ---------------------------------------------------------
   Estilo cartoon liviano:
   - MeshToonMaterial con 3 tonos (sombra / medio / luz)
   - contorno negro: una copia un poco más grande del objeto,
     pintada en negro y mostrando solo sus caras de atrás
   - planetas con manchas de color por vértice
   - grano de película encima de todo (CSS)
   ========================================================= */
import { THREE, V3, rng } from './util.js';

export const renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2 });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
export const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 900);

const camarasExtra = new Set();   // otras cámaras (la de la historia) que también deben ajustarse
export function registrarCamara(c) { camarasExtra.add(c); ajustarPantalla(); }

/** En vertical (celular) usamos un ángulo de visión más abierto. */
function ajustarPantalla() {
  const aspect = innerWidth / innerHeight;
  for (const c of [camera, ...camarasExtra]) {
    c.aspect = aspect;
    c.fov = aspect < 1 ? 78 : 62;
    c.updateProjectionMatrix();
  }
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', ajustarPantalla);
ajustarPantalla();

scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x2a2034, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(40, 70, 30);
scene.add(sun);

/* ---- materiales cartoon ---- */
// "rampa" de 3 tonos para el material toon
export const gradMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// textura de manchas tipo pintura (gris claro que se multiplica por el color)
function paintTex(seed, n = 260, size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(170 + r() * 85);
    g.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`;
    const x = r() * size, y = r() * size, rad = 3 + r() * 16;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const paint = paintTex(7);

/** Material cartoon de 3 tonos. */
export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradMap, map: paint, ...extra });
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x15121c, side: THREE.BackSide });
/** Agrega el contorno negro a una malla (k = qué tan grueso). */
export function outline(mesh, k = 0.06) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.setScalar(1 + k);
  mesh.add(o);
  return mesh;
}

/**
 * Geometría de planeta pintado: icosfera (sin "polos" que estiren la textura)
 * con manchas de color por vértice. relieve > 0 levanta montañas suaves.
 */
export function planetGeo(R, color, seed, relieve = 0) {
  const det = Math.min(18, Math.max(8, Math.round(R * 0.9)));
  const g = new THREE.IcosahedronGeometry(R, det);
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const r = rng(seed), base = new THREE.Color(color), c = new THREE.Color(), n = new V3();
  const blobs = Array.from({ length: 30 }, () => {
    const z = 2 * r() - 1, a = r() * Math.PI * 2, k = Math.sqrt(1 - z * z);
    return { d: new V3(k * Math.cos(a), z, k * Math.sin(a)), cos: Math.cos(0.12 + r() * 0.35), f: 0.78 + r() * 0.34 };
  });
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
    let sh = 1, alto = 0;
    for (const b of blobs) if (n.dot(b.d) > b.cos) { sh *= b.f; alto += 1; }
    sh *= 0.96 + 0.08 * Math.sin(n.x * 23 + seed) * Math.sin(n.y * 19) * Math.sin(n.z * 21);
    c.copy(base).multiplyScalar(sh);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    if (relieve) pos.setXYZ(i, n.x * (R + alto * relieve), n.y * (R + alto * relieve), n.z * (R + alto * relieve));
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (relieve) g.computeVertexNormals();
  return g;
}

/** Orienta un objeto plano (que mira a +Z) para que mire en la dirección n. */
const upZ = new V3(0, 0, 1);
export function faceNormal(obj, n) { obj.quaternion.setFromUnitVectors(upZ, n); }

/** Orienta un objeto para que su +Y sea "up" y su +Z mire hacia "facing". */
const _xA = new V3(), _zA = new V3(), _mB = new THREE.Matrix4();
export function orient(obj, up, facing) {
  _zA.copy(facing).addScaledVector(up, -facing.dot(up));
  if (_zA.lengthSq() < 1e-6) { _zA.set(1, 0, 0); if (Math.abs(up.x) > 0.9) _zA.set(0, 0, 1); _zA.addScaledVector(up, -_zA.dot(up)); }
  _zA.normalize();
  _xA.crossVectors(up, _zA);
  _mB.makeBasis(_xA, up, _zA);
  obj.quaternion.setFromRotationMatrix(_mB);
}

/** Cartel de texto que siempre mira a la cámara (sprite con un canvas). */
export function cartel(texto, { ancho = 6, color = '#ffffff', fondo = 'rgba(10,12,30,.72)' } = {}) {
  const lineas = texto.split('\n');
  const cv = document.createElement('canvas');
  const fs = 44, pad = 26;
  cv.width = 768;
  cv.height = pad * 2 + lineas.length * fs * 1.25;
  const g = cv.getContext('2d');
  g.fillStyle = fondo;
  g.beginPath(); g.roundRect(4, 4, cv.width - 8, cv.height - 8, 30); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.stroke();
  g.fillStyle = color;
  g.font = `700 ${fs}px ui-rounded, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lineas.forEach((l, i) => g.fillText(l, cv.width / 2, pad + fs * 0.62 + i * fs * 1.25));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(ancho, ancho * cv.height / cv.width, 1);
  return s;
}

/* ---- fondo: estrellas y grano ---- */
{
  const pts = [];
  const d = new V3();
  for (let i = 0; i < 1600; i++) { d.randomDirection().multiplyScalar(420 + Math.random() * 120); pts.push(d.x, d.y, d.z); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
}
{
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), r = rng(3), img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  document.getElementById('grain').style.backgroundImage = `url(${cv.toDataURL()})`;
}
