/* =========================================================
   columba3d.js · Columba vista "de cerca": su playa y su mar
   ---------------------------------------------------------
   Esta escena se usa en dos lugares:
   - el MENÚ: la playa con niebla, cámara en mano suave;
   - la HISTORIA: Columba vista desde el espacio con su luna.

   LA MAREA (física que vuelve en el nivel 4):
   La luna atrae más al lado del mar que la mira que al centro
   del planeta, y más al centro que al lado opuesto. Esa
   DIFERENCIA estira el mar en DOS abultamientos:
       altura(θ) ∝ (3·cos²θ − 1) / 2
   θ = ángulo entre un punto del planeta y la dirección de la luna.
   Truco: una esfera estirada como pelota de rugby hacia la luna
   (escala 1+2ε a lo largo, 1−ε a lo ancho) tiene EXACTAMENTE esa
   forma para ε chico:  r(θ) ≈ R·(1 + ε·(3cos²θ − 1)).
   Sin luna queda la marea del Sol, cerca de la mitad de fuerte.

   El mar refleja el progreso: cada fragmento recuperado sube el
   agua, le devuelve olas y color, y la luna reaparece de a poco.
   ========================================================= */
import { THREE, V3, clamp, rng } from './util.js';
import { gradMap, outline, registrarCamara } from './escena.js';

export const escenaColumba = new THREE.Scene();
export const camColumba = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
registrarCamara(camColumba);

const R = 40;                                // radio del planeta
const CENTRO = new V3(0, -R, 0);             // la playa queda cerca del origen (0,0,0)
const NIEBLA = new THREE.Color(0xa9aeb2);
const NIEBLA_VIVA = new THREE.Color(0x9cc3d6);
const NEGRO = new THREE.Color(0x05060f);

/* ---------- luces ---------- */
const hemi = new THREE.HemisphereLight(0xd8dde2, 0x4a4a52, 0.9);
const sol = new THREE.DirectionalLight(0xfff0d6, 1.2);
const DIR_SOL = new V3(-0.55, 0.42, -0.72).normalize();     // detrás del mar: contraluz
sol.position.copy(DIR_SOL).multiplyScalar(100);
escenaColumba.add(hemi, sol, sol.target);

/* ---------- cielo: esfera grande con degradado (no le afecta la niebla) ---------- */
const cieloMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { arriba: { value: new THREE.Color(0x8d99a6) }, horizonte: { value: new THREE.Color(0xc9cdd0) }, alfa: { value: 1 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 arriba; uniform vec3 horizonte; uniform float alfa; varying vec3 vP;' +
    'void main(){ float k = smoothstep(-0.05, 0.6, vP.y); gl_FragColor = vec4(mix(horizonte, arriba, k), alfa);\n#include <colorspace_fragment>\n}',
});
const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), cieloMat);
cielo.renderOrder = -10;   // se dibuja primero: todo lo demás queda encima
escenaColumba.add(cielo);

/* estrellas para cuando la cámara sale al espacio */
const estrellas = (() => {
  const pts = [], d = new V3();
  for (let i = 0; i < 2000; i++) { d.randomDirection().multiplyScalar(1200 + Math.random() * 300); pts.push(d.x, d.y, d.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true }));
})();
escenaColumba.add(estrellas);

/* ---------- tierra con una playa ---------- */
// el "continente" está centrado en DIR_TIERRA; la playa baja hacia el mar
const DIR_TIERRA = new V3(0, 1, 0.42).normalize();
function alturaTierra(n) {
  const phi = Math.acos(clamp(n.dot(DIR_TIERRA), -1, 1));        // ángulo desde el centro del continente
  const t = clamp((phi - 0.05) / 0.25, 0, 1);
  const s = t * t * (3 - 2 * t);                                 // smoothstep
  let h = 1.6 * (1 - s) - 0.7;
  h += 0.25 * Math.sin(n.x * 31) * Math.sin(n.z * 27) * (1 - s);  // lomitas
  return h;
}
{
  const g = new THREE.IcosahedronGeometry(R, 40);
  const pos = g.attributes.position, n = new V3(), cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const arena = new THREE.Color(0xcfc5aa), pasto = new THREE.Color(0x86a07c), fondo = new THREE.Color(0x6b6a66);
  const r = rng(5);
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    const h = alturaTierra(n);
    pos.setXYZ(i, n.x * (R + h), n.y * (R + h), n.z * (R + h));
    if (h > 0.75) c.copy(pasto); else if (h > -0.15) c.copy(arena); else c.copy(fondo);
    c.multiplyScalar(0.93 + r() * 0.1);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const tierra = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap }));
  tierra.position.copy(CENTRO);
  escenaColumba.add(tierra);
}

/* ---------- el jugador queda parado aquí, mirando al mar ---------- */
export const PLAYA = (() => {
  const haciaMar = new V3(0, 0, -1);
  const dir = DIR_TIERRA.clone().applyAxisAngle(new V3(1, 0, 0), -0.15).normalize();   // un poco hacia el mar
  const h = alturaTierra(dir);
  const pos = CENTRO.clone().addScaledVector(dir, R + h);
  haciaMar.addScaledVector(dir, -haciaMar.dot(dir)).normalize();
  return { pos, arriba: dir, haciaMar };
})();

// rocas en la playa
{
  const r = rng(9), m = new THREE.MeshToonMaterial({ color: 0x8c8a90, gradientMap: gradMap, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const lado = (i % 2 ? 1 : -1) * (0.22 + r() * 0.5);          // a los costados, no delante de la cámara
    const d = DIR_TIERRA.clone().applyAxisAngle(new V3(1, 0, 0), -0.1 - r() * 0.1).applyAxisAngle(new V3(0, 1, 0), lado).normalize();
    const roca = outline(new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + r() * 0.7, 0), m), 0.05);
    roca.position.copy(CENTRO).addScaledVector(d, R + alturaTierra(d) + 0.05);
    roca.rotation.set(r() * 3, r() * 3, r() * 3);
    escenaColumba.add(roca);
  }
}

/* ---------- el mar ---------- */
const marUniforms = { uTiempo: { value: 0 }, uOla: { value: 0.1 } };
const marMat = new THREE.MeshToonMaterial({ color: 0x5f8590, gradientMap: gradMap, transparent: true, opacity: 0.9 });
marMat.onBeforeCompile = sh => {   // olitas: subimos y bajamos cada vértice con ondas seno
  sh.uniforms.uTiempo = marUniforms.uTiempo;
  sh.uniforms.uOla = marUniforms.uOla;
  sh.vertexShader = 'uniform float uTiempo; uniform float uOla;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n' +
    'float ola = sin(position.x*0.55 + uTiempo*1.1) * 0.6 + sin(position.z*0.8 - uTiempo*1.4) * 0.4 + sin((position.x+position.z)*1.7 + uTiempo*2.3) * 0.25;\n' +
    'transformed += normal * ola * uOla;');
};
const marPivote = new THREE.Group();     // gira para que el abultamiento apunte a la luna
marPivote.position.copy(CENTRO);
const mar = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 110), marMat);
mar.rotation.x = Math.PI / 2;            // los "polos" de la esfera quedan en el eje Z del pivote (hacia la luna)
marPivote.add(mar);
escenaColumba.add(marPivote);

/* ---------- la luna (de día se ve pálida y medio transparente) ---------- */
const lunaMat = new THREE.MeshBasicMaterial({ color: 0xf4f6fa, transparent: true, opacity: 0.4, fog: false, depthWrite: false });
const luna = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 20), lunaMat);
{   // manchitas (mares lunares) para que se lea como luna
  const r = rng(12);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.8 + r() * 1.6, 20),
      new THREE.MeshBasicMaterial({ color: 0xa9afbd, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    const d = new V3(r() - 0.5, r() - 0.5, 1).normalize();
    s.position.copy(d).multiplyScalar(7.02); s.lookAt(d.clone().multiplyScalar(20)); luna.add(s);
  }
}
escenaColumba.add(luna);
const DIST_LUNA = 150;

/* ---------- el Sol y sus rayos (planos que brillan, no cuestan nada) ---------- */
function texturaRayo() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, 'rgba(255,240,200,.9)'); grd.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
  const lado = g.createLinearGradient(0, 0, 64, 0); lado.addColorStop(0, 'rgba(0,0,0,1)'); lado.addColorStop(.5, 'rgba(0,0,0,0)'); lado.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = lado; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(cv);
}
const rayos = new THREE.Group();
{
  const tex = texturaRayo(), r = rng(4);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16 + r() * 18, 140),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.position.y = -70;   // el plano cuelga desde el sol hacia abajo
    const brazo = new THREE.Group(); brazo.add(m);
    brazo.rotation.z = (r() - 0.5) * 0.7; brazo.rotation.y = r() * Math.PI;
    brazo.userData = { fase: r() * 10, base: 0.07 + r() * 0.08, mat: m.material };
    rayos.add(brazo);
  }
  rayos.position.copy(PLAYA.pos).addScaledVector(DIR_SOL, 75);
  rayos.lookAt(PLAYA.pos); rayos.rotateX(-Math.PI / 2);    // los planos quedan apuntando desde el sol a la playa
  escenaColumba.add(rayos);
}
const solDisco = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,248,225,1)'); grd.addColorStop(.25, 'rgba(255,236,190,.55)'); grd.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(70); s.position.copy(DIR_SOL).multiplyScalar(500); return s;
})();
escenaColumba.add(solDisco);

/* ---------- Aestus (solo en la historia): un punto rojo lejano ---------- */
const aestus = (() => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), new THREE.MeshBasicMaterial({ color: 0xc8463c, fog: false })));
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const grd = c.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,90,70,.8)'); grd.addColorStop(1, 'rgba(255,60,40,0)');
  c.fillStyle = grd; c.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(60); g.add(s);
  g.position.set(-380, 120, -520); g.visible = false;
  return g;
})();
escenaColumba.add(aestus);

/* =========================================================
   ESTADO VISUAL (lo cambian el menú y la historia)
   ========================================================= */
export const columba = {
  modo: 'playa',        // 'playa' (menú) | 'espacio' (historia)
  luna: 1,              // 1 = luna en su órbita, 0 = no está
  lunaPos: null,        // si no es null, la historia mueve la luna a mano
  vida: 0,              // 0 = gris y apagado, 1 = con color (progreso)
  nivelMar: 0,          // cuánto sube o baja el mar (en metros)
  epsLuna: 0.015,       // fuerza de la marea lunar (ε)
  ola: 0.1,             // altura de las olitas
  aestus: false,
  t: 0,
};

/** Ajusta el estado según la historia y los fragmentos recuperados. */
export function estadoSegunProgreso(historiaVista, fragmentos) {
  const k = clamp(fragmentos / 5, 0, 1);
  if (!historiaVista) Object.assign(columba, { luna: 1, vida: 0.55, nivelMar: 0, epsLuna: 0.015, ola: 0.11 });
  else Object.assign(columba, { luna: 0.06 + 0.94 * k, vida: 0.2 + 0.8 * k, nivelMar: -0.55 + 0.55 * k, epsLuna: 0.015 * k, ola: 0.03 + 0.08 * k });
  columba.lunaPos = null;
}

const _dirLuna = new V3(), _z = new V3(0, 0, 1), _q = new THREE.Quaternion(), _c = new THREE.Color();
const nieblaPlaya = new THREE.Fog(NIEBLA.clone(), 4, 90);

/** Dirección de la luna en su órbita lenta (vista desde el centro de Columba). */
function orbitaLuna(t, out) {
  const a = 2.95 + Math.sin(t * 0.02) * 0.12;   // se mece muy lento en el cielo
  return out.set(Math.sin(a), 0.75, Math.cos(a)).normalize();
}

export function actualizarColumba(dt) {
  const s = columba;
  s.t += dt;
  marUniforms.uTiempo.value = s.t;
  marUniforms.uOla.value = s.ola;

  // dónde está la luna
  if (s.lunaPos) luna.position.copy(s.lunaPos);
  else luna.position.copy(CENTRO).addScaledVector(orbitaLuna(s.t, _dirLuna), DIST_LUNA);
  _dirLuna.copy(luna.position).sub(CENTRO).normalize();
  luna.visible = s.luna > 0.01;
  lunaMat.opacity = (s.modo === 'espacio' ? 1 : 0.62) * s.luna;
  luna.children.forEach(m => m.material.opacity = 0.55 * s.luna);

  // MAREA: ε de la luna, y si no hay luna, la del Sol (≈ 0.46 de la lunar)
  const epsSol = 0.007;
  let eps, haciaDonde;
  if (s.luna > 0.3) { eps = Math.max(s.epsLuna, 0.004); haciaDonde = _dirLuna; }
  else { eps = epsSol; haciaDonde = DIR_SOL; }
  _q.setFromUnitVectors(_z, haciaDonde);
  marPivote.quaternion.copy(_q);
  const Rm = R + s.nivelMar;
  // la esfera del mar tiene sus polos en Y local; con la rotación de 90° ese eje apunta a la luna
  mar.scale.set(Rm / R * (1 - eps), Rm / R * (1 + 2 * eps), Rm / R * (1 - eps));

  // color: gris apagado → vivo
  _c.copy(NIEBLA).lerp(NIEBLA_VIVA, s.vida * 0.6);
  nieblaPlaya.color.copy(_c);
  nieblaPlaya.far = 45 + s.vida * 120;
  marMat.color.setHex(0x5f8590).lerp(new THREE.Color(0x2f86a8), s.vida * 0.8);
  sol.intensity = 0.7 + s.vida * 0.9 + Math.sin(s.t * 0.37) * 0.25;            // nubes que pasan
  hemi.intensity = 0.75 + s.vida * 0.3;
  cieloMat.uniforms.arriba.value.setHex(0x8d99a6).lerp(new THREE.Color(0x6f9fc4), s.vida);
  cieloMat.uniforms.horizonte.value.copy(_c);
  for (const b of rayos.children) b.userData.mat.opacity = b.userData.base * (0.6 + 0.4 * Math.sin(s.t * 0.4 + b.userData.fase)) * (0.6 + s.vida * 0.6);

  // en el espacio: sin niebla ni cielo, con estrellas
  const espacio = s.modo === 'espacio';
  escenaColumba.fog = espacio ? null : nieblaPlaya;
  escenaColumba.background = espacio ? NEGRO : _c;
  cielo.visible = !espacio; rayos.visible = !espacio;
  estrellas.visible = espacio;
  aestus.visible = s.aestus;
}

/** Cámara "en mano": pequeños movimientos suaves que se suman (como respirar). */
const _p = new V3(), _mira = new V3(), _der = new V3();
export function camaraPlaya(t) {
  _der.crossVectors(PLAYA.haciaMar, PLAYA.arriba).normalize();
  _p.copy(PLAYA.pos)
    .addScaledVector(PLAYA.haciaMar, -6.5)
    .addScaledVector(PLAYA.arriba, 1.9)
    .addScaledVector(_der, -1.4);
  _p.x += Math.sin(t * 0.7) * 0.05 + Math.sin(t * 1.9) * 0.015;
  _p.y += Math.sin(t * 0.9 + 1) * 0.04 + Math.sin(t * 2.3) * 0.01;
  _p.z += Math.sin(t * 0.5 + 2) * 0.05;
  camColumba.position.copy(_p);
  _mira.copy(PLAYA.pos).addScaledVector(PLAYA.haciaMar, 30).addScaledVector(PLAYA.arriba, 2.8).addScaledVector(_der, -2.5);
  _mira.x += Math.sin(t * 0.6) * 0.12;
  _mira.y += Math.sin(t * 0.8 + 0.5) * 0.08;
  camColumba.up.copy(PLAYA.arriba);
  camColumba.lookAt(_mira);
  camColumba.rotateZ(Math.sin(t * 0.45) * 0.008);    // un leve balanceo
}

export const PUNTOS = { CENTRO, R, DIST_LUNA, aestus: aestus.position, orbitaLuna };
export const _depurar = { luna, mar, camColumba };
