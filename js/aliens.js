/* =========================================================
   aliens.js · Cómo se VEN los gatos-alien de Ícaro y su ovni
   ---------------------------------------------------------
   Solo dibujo (Three.js), nada de física ni de IA.
   Diseño propio del grupo: cabeza de gato redonda y verde,
   orejas, dos antenas con bolitas, ojos grandes y caídos
   (con párpado) y bigotes. El jefe es más grande, más oscuro
   y lleva un casco de metal que se abre cuando queda mareado.
   Todo se arma con figuras simples (esferas, conos, cilindros)
   para que cualquiera del grupo pueda explicarlo.
   ========================================================= */
import { THREE } from './util.js';
import { toon, outline } from './escena.js';

const ojoGeo = new THREE.SphereGeometry(1, 16, 12);
const bolaGeo = new THREE.SphereGeometry(1, 12, 10);
const negro = new THREE.MeshBasicMaterial({ color: 0x10261a });
const blanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
const rosado = toon(0xf2a0a8);
const bigote = new THREE.MeshBasicMaterial({ color: 0xe9ffd8 });

/**
 * Gato-alien de radio r (el radio de su cuerpo para la física).
 * El cuerpo ES la cabeza: una bola peluda con patitas.
 * Devuelve { g, body, mat, casco?, estrellas? } — mat es el material que
 * enemigos.js hace brillar cuando recibe un golpe.
 */
export function crearGatoAlien(r, { jefe = false } = {}) {
  const g = new THREE.Group();
  const piel = jefe ? 0x7cc052 : 0xb4ec8c;
  const mat = toon(piel, { emissive: 0x000000 });
  const clara = toon(jefe ? 0xa6de78 : 0xd6f7b8);

  // cuerpo-cabeza: un poco más ancho que alto, como la foto de referencia
  const body = outline(new THREE.Mesh(bolaGeo, mat), 0.06);
  body.scale.set(r * 1.08, r * 0.92, r);
  g.add(body);
  // mejillas peludas a los lados
  for (const sx of [-1, 1]) {
    const m = outline(new THREE.Mesh(bolaGeo, mat), 0.08);
    m.scale.set(r * 0.42, r * 0.36, r * 0.4);
    m.position.set(sx * r * 0.78, -r * 0.18, r * 0.22);
    g.add(m);
  }
  // patitas
  for (const sx of [-1, 1]) {
    const pata = outline(new THREE.Mesh(bolaGeo, clara), 0.1);
    pata.scale.set(r * 0.26, r * 0.18, r * 0.32);
    pata.position.set(sx * r * 0.42, -r * 0.86, r * 0.25);
    g.add(pata);
  }
  // orejas de gato (conos) con el interior rosado
  for (const sx of [-1, 1]) {
    const oreja = outline(new THREE.Mesh(new THREE.ConeGeometry(r * 0.34, r * 0.6, 4), mat), 0.08);
    oreja.position.set(sx * r * 0.6, r * 0.74, -r * 0.05);
    oreja.rotation.z = -sx * 0.45;
    const dentro = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * 0.3, 4), rosado);
    dentro.position.set(0, -r * 0.05, r * 0.1);
    oreja.add(dentro);
    g.add(oreja);
  }
  // antenas: tallo fino + bolita en la punta
  const antenas = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(sx * r * 0.3, r * 0.82, 0);
    a.rotation.z = -sx * 0.18;
    const tallo = outline(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.045, r * 0.07, r * 0.85, 6), clara), 0.15);
    tallo.position.y = r * 0.42;
    const punta = outline(new THREE.Mesh(bolaGeo, clara), 0.12);
    punta.scale.setScalar(r * 0.14);
    punta.position.y = r * 0.88;
    a.add(tallo, punta);
    g.add(a); antenas.push(a);
  }
  // ojos grandes, oscuros y "con sueño": esfera aplastada + brillo + párpado
  for (const sx of [-1, 1]) {
    const ojo = new THREE.Mesh(ojoGeo, negro);
    ojo.scale.set(r * 0.2, r * 0.13, r * 0.08);
    ojo.position.set(sx * r * 0.36, r * 0.08, r * 0.9);
    ojo.rotation.z = sx * 0.12;
    const brillo = new THREE.Mesh(ojoGeo, blanco);
    brillo.scale.set(0.22, 0.32, 0.5);
    brillo.position.set(sx * 0.25, 0.25, 0.75);
    ojo.add(brillo);
    const parpado = new THREE.Mesh(ojoGeo, mat);
    parpado.scale.set(1.15, 0.75, 1.3);
    parpado.position.set(0, 0.85, 0.1);
    ojo.add(parpado);
    g.add(ojo);
  }
  // naricita rosada y bigotes
  const nariz = new THREE.Mesh(bolaGeo, rosado);
  nariz.scale.set(r * 0.08, r * 0.06, r * 0.05);
  nariz.position.set(0, -r * 0.14, r * 0.98);
  g.add(nariz);
  for (const sx of [-1, 1]) for (const k of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 0.42, r * 0.02, r * 0.02), bigote);
    b.position.set(sx * r * 0.42, -r * 0.2 + k * r * 0.05, r * 0.92);
    b.rotation.z = sx * k * 0.15;
    g.add(b);
  }

  const out = { g, body, mat, antenas };

  if (jefe) {
    // casco duro de metal (media esfera) con una franja verde brillante
    const casco = new THREE.Group();
    const metal = toon(0x6e6a8c, { emissive: 0x000000 });
    const domo = outline(new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), metal), 0.04);
    domo.position.y = r * 0.12;
    const franja = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.06, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0x8cff6b }));
    franja.rotation.x = Math.PI / 2; franja.position.y = r * 0.47;
    casco.add(domo, franja);
    g.add(casco);
    out.casco = casco; out.metalCasco = metal;
    // estrellitas de mareo que giran sobre la cabeza (ocultas al principio)
    const estrellas = new THREE.Group();
    estrellas.position.y = r * 1.5;
    const amarillo = new THREE.MeshBasicMaterial({ color: 0xffe27a });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.13, 0), amarillo);
      const a = i / 4 * Math.PI * 2;
      s.position.set(Math.cos(a) * r * 0.7, 0, Math.sin(a) * r * 0.7);
      estrellas.add(s);
    }
    estrellas.visible = false;
    g.add(estrellas);
    out.estrellas = estrellas;
  }
  return out;
}

/**
 * Ovni de Ícaro: platillo de metal, cúpula de vidrio con un gatito
 * piloto adentro, luces que parpadean y un rayo (cono) para bajar aliens.
 */
export function crearOvni() {
  const g = new THREE.Group();
  const metal = toon(0xa9a6c4), oscuro = toon(0x55506e);
  const plato = outline(new THREE.Mesh(bolaGeo, metal), 0.04);
  plato.scale.set(3, 0.55, 3);
  const panza = outline(new THREE.Mesh(bolaGeo, oscuro), 0.05);
  panza.scale.set(1.6, 0.5, 1.6); panza.position.y = -0.35;
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshToonMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.45, depthWrite: false }));
  cupula.position.y = 0.3;
  const piloto = crearGatoAlien(0.55);
  piloto.g.position.y = 0.75;
  g.add(plato, panza, piloto.g, cupula);

  // anillo de luces
  const luces = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const m = new THREE.MeshBasicMaterial({ color: 0x8cff6b });
    const l = new THREE.Mesh(bolaGeo, m);
    l.scale.setScalar(0.17);
    l.position.set(Math.cos(a) * 2.55, 0.05, Math.sin(a) * 2.55);
    g.add(l); luces.push(m);
  }
  // rayo: cono abierto que cuelga hacia abajo (−Y). Se estira con scale.y.
  const rayoGeo = new THREE.CylinderGeometry(0.8, 1.9, 1, 24, 1, true);
  rayoGeo.translate(0, -0.5, 0);            // que cuelgue desde el ovni
  const rayo = new THREE.Mesh(rayoGeo, new THREE.MeshBasicMaterial({
    color: 0x9dff7a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  rayo.position.y = -0.5;
  rayo.visible = false;
  g.add(rayo);
  return { g, luces, rayo, piloto };
}
