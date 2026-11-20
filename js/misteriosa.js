/* =========================================================
   misteriosa.js · La personaje misteriosa de la cueva de Ícaro
   ---------------------------------------------------------
   Diseño PROPIO (la pauta prohíbe copiar juegos): cabeza-casco
   lisa con dos ojos rojos que brillan en la oscuridad, dos
   mechones largos que cuelgan, kimono claro con faja roja y
   mangas anchas. Alta (2,15 m) al lado del protagonista (1,4 m).

   Todo es geometría simple de Three.js (cilindros, esferas y
   cápsulas). Se anima por código, sin archivos de animación:
   cada gesto es un número de 0 a 1 que se acerca suave a su
   meta (suavizado exponencial, ver más abajo):
     hombros  encogerse de hombros ("no sé")
     apunta   el brazo derecho apunta a su derecha
     suspiro  sube y baja los hombros despacio
     niega    mueve la cabeza de lado a lado
     inclina  ladea la cabeza (curiosidad)
     ojos     brillo de los ojos (0 = apagados)
     anda     rapidez al caminar (m/s): balanceo lento y elegante
   ========================================================= */
import { THREE, V3, damp } from './util.js';
import { toon, outline, orient } from './escena.js';

const KIMONO = 0xe9e4da, FAJA = 0x9c2f3f, CASCO = 0x8d8f99, OSCURO = 0x26252e;

/** Brillo rojo de un ojo: un círculo difuminado que se suma a lo que hay detrás (no le afecta la niebla). */
function brilloRojo() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,90,80,1)'); grd.addColorStop(0.35, 'rgba(255,40,40,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
}

export function crearMisteriosa() {
  const m = {
    grupo: new THREE.Group(), cuerpo: new THREE.Group(),
    pos: new V3(), up: new V3(0, 1, 0), facing: new V3(0, 0, 1),
    meta: { hombros: 0, apunta: 0, suspiro: 0, niega: 0, inclina: 0, ojos: 0, anda: 0 },
    ahora: { hombros: 0, apunta: 0, suspiro: 0, niega: 0, inclina: 0, ojos: 0, anda: 0 },
    t: 0, paso: 0,
  };
  m.grupo.add(m.cuerpo);
  const kimono = toon(KIMONO, { map: null }), faja = toon(FAJA, { map: null }), casco = toon(CASCO, { map: null }), oscuro = toon(OSCURO, { map: null });
  const add = (padre, geo, mat, x, y, z, k = 0.04) => { const o = outline(new THREE.Mesh(geo, mat), k); o.position.set(x, y, z); padre.add(o); return o; };

  // falda larga (tapa las piernas: así no hay que animar piernas, solo un balanceo)
  add(m.cuerpo, new THREE.CylinderGeometry(0.25, 0.44, 0.98, 20), kimono, 0, 0.49, 0);
  add(m.cuerpo, new THREE.CylinderGeometry(0.2, 0.25, 0.56, 20), kimono, 0, 1.24, 0);        // torso
  add(m.cuerpo, new THREE.CylinderGeometry(0.265, 0.265, 0.17, 20), faja, 0, 1.0, 0, 0.05);   // faja
  for (const sx of [-1, 1]) {                                                                 // moño de la faja (atrás)
    const l = add(m.cuerpo, new THREE.SphereGeometry(1, 12, 8), faja, sx * 0.12, 1.02, -0.3, 0.12);
    l.scale.set(0.13, 0.08, 0.05); l.rotation.z = sx * 0.4;
  }
  // cuello del kimono: una V oscura
  for (const sx of [-1, 1]) {
    const v = add(m.cuerpo, new THREE.BoxGeometry(0.05, 0.3, 0.03), oscuro, sx * 0.06, 1.37, 0.19, 0.1);
    v.rotation.z = sx * 0.45;
  }
  add(m.cuerpo, new THREE.CylinderGeometry(0.05, 0.065, 0.16, 10), oscuro, 0, 1.56, 0);       // cuello

  // brazos: un "hombro" que gira y cuelga una manga ancha con la mano al final
  m.hombros = [];
  for (const sx of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(sx * 0.25, 1.46, 0); m.cuerpo.add(h);
    const manga = add(h, new THREE.CylinderGeometry(0.075, 0.17, 0.56, 14), kimono, 0, -0.28, 0);
    manga.rotation.z = sx * 0.06;
    add(h, new THREE.SphereGeometry(0.06, 10, 8), casco, 0, -0.6, 0.02, 0.1);                // mano
    h.userData.lado = sx;
    m.hombros.push(h);
  }
  // m.hombros[0] = lado -x = su brazo DERECHO (ella mira hacia +z)

  // cabeza: casco liso y gris, con una "capucha" oscura arriba y atrás
  m.cabeza = new THREE.Group(); m.cabeza.position.y = 1.62; m.cuerpo.add(m.cabeza);
  const craneo = add(m.cabeza, new THREE.SphereGeometry(0.27, 24, 18), casco, 0, 0.26, 0.02, 0.04);
  craneo.scale.set(1, 1.07, 1.04);
  const capucha = add(m.cabeza, new THREE.SphereGeometry(0.29, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), oscuro, 0, 0.27, -0.03, 0.03);
  capucha.rotation.x = -0.18;            // cubre la coronilla y llega hasta la frente
  // mechones largos que cuelgan a los lados (se mecen al caminar)
  m.mechones = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.25, 0.36, -0.02); m.cabeza.add(piv);
    const me = add(piv, new THREE.CapsuleGeometry(0.075, 0.42, 4, 10), oscuro, sx * 0.04, -0.27, 0.02, 0.06);
    me.rotation.z = sx * 0.12;
    m.mechones.push(piv);
  }
  // ojos rojos: no los afecta la luz ni la niebla, así brillan desde la oscuridad
  m.ojoMat = new THREE.MeshBasicMaterial({ color: 0xff3a35, transparent: true, fog: false });
  m.brillos = [];
  for (const [x, y, r] of [[-0.1, 0.3, 0.075], [0.105, 0.27, 0.058]]) {   // un ojo más grande que el otro
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m.ojoMat);
    o.position.set(x, y, 0.255); o.scale.z = 0.55; m.cabeza.add(o);
    const b = new THREE.Sprite(brilloRojo()); b.position.set(x, y, 0.3); b.scale.setScalar(r * 3.6); m.cabeza.add(b);
    m.brillos.push(b);
  }
  return m;
}

/**
 * Anima a la personaje. SUAVIZADO EXPONENCIAL: cada gesto se acerca a su meta
 *   x ← x + (meta − x)·(1 − e^(−k·dt))
 * Avanza siempre la misma FRACCIÓN de lo que le falta: rápido al principio y
 * frenando al final, igual en un celular lento o rápido (no depende de los FPS).
 */
export function animarMisteriosa(m, dt) {
  m.t += dt;
  const a = m.ahora, k = damp(5, dt);
  for (const n in a) a[n] += (m.meta[n] - a[n]) * (n === 'ojos' ? damp(2.2, dt) : k);
  orient(m.grupo, m.up, m.facing);
  m.grupo.position.copy(m.pos);

  // caminar: sube y baja dos veces por zancada y se mece un poco (lento: es elegante)
  m.paso += a.anda * dt * 3.2;
  const bob = Math.abs(Math.sin(m.paso)) * 0.035 * Math.min(1, a.anda);
  m.cuerpo.position.y = bob;
  m.cuerpo.rotation.z = Math.sin(m.paso) * 0.035 * Math.min(1, a.anda);
  const respira = Math.sin(m.t * 1.6) * 0.012;                       // quieta, igual respira

  // suspiro: los hombros suben y bajan una vez (seno de medio ciclo)
  const sus = a.suspiro * Math.sin(Math.min(1, a.suspiro) * Math.PI) ;
  const subeHombros = 0.07 * a.hombros + 0.05 * sus + respira;
  for (const h of m.hombros) {
    const lado = h.userData.lado;
    h.position.y = 1.46 + subeHombros;
    // brazos: colgando, se abren al encogerse de hombros (palmas hacia arriba = codos afuera)
    h.rotation.set(0, 0, lado * (0.08 + 0.55 * a.hombros));
    h.rotation.x = -0.35 * a.hombros + Math.sin(m.paso + (lado > 0 ? Math.PI : 0)) * 0.12 * Math.min(1, a.anda);
  }
  // apuntar: el brazo derecho (lado −x) sube casi horizontal y un poco hacia adelante
  const der = m.hombros[0];
  der.rotation.z = der.rotation.z * (1 - a.apunta) + (-1.35) * a.apunta;
  der.rotation.y = 0.5 * a.apunta;

  // cabeza: ladeo + "no" (gira de lado a lado) + mirar un poco hacia donde apunta
  m.cabeza.rotation.set(0.04 * sus, Math.sin(m.t * 9) * 0.32 * a.niega + 0.35 * a.apunta, 0.18 * a.inclina);
  for (const [i, piv] of m.mechones.entries()) piv.rotation.z = Math.sin(m.paso + i) * 0.08 * Math.min(1, a.anda) + Math.sin(m.t * 1.3 + i) * 0.03;

  // ojos: se encienden (o apagan) de a poco
  m.ojoMat.opacity = a.ojos;
  for (const b of m.brillos) b.material.opacity = a.ojos * (0.85 + 0.15 * Math.sin(m.t * 3));
}

/** Punto de la mano derecha en el mundo (para que la cámara la siga cuando apunta). */
export function manoDerecha(m, out) {
  return m.hombros[0].children[1].getWorldPosition(out);
}

/** Punto entre los ojos, en el mundo (para los primeros planos). */
export function caraDe(m, out) {
  return m.cabeza.localToWorld(out.set(0, 0.28, 0.2));
}
