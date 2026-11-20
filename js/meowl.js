/* =========================================================
   meowl.js · MEOWL, el jefe de la superficie de Ícaro
   ---------------------------------------------------------
   Meowl es mitad gato, mitad búho (diseño propio del grupo,
   inspirado en el meme: cabeza de gato atigrado con la cara
   blanca y ojos enormes, cuerpo de búho con alas cafés y el
   pecho blanco; le pusimos las antenas verdes de los aliens
   de Ícaro). Espera en la rama de un árbol seco, en la arena
   de la cima. Sus crías, los MEOWLITOS, viven bajo la arena.

   CÓMO PELEA (3 fases, una por cada golpe que le das):
     · los meowlitos salen de la arena, te persiguen, BRILLAN
       y medio segundo después se LANZAN hacia ti (saltan:
       tiro parabólico). Salta y cáeles encima.
     · Meowl brilla en su rama y se tira en PICADA hacia donde
       estás. Su rapidez crece de forma EXPONENCIAL:
           v(t) = v₀·e^(t/τ)
       (cada τ segundos se multiplica por e ≈ 2,7). Integrando,
       la distancia recorrida es  s(t) = v₀·τ·(e^(t/τ) − 1).
       Si te pega, te quita 2 corazones.
     · se clava en la arena. Fase 1: queda mareado.
       Fase 2: se suelta y se ARRASTRA hacia ti una vez más
       (mismo destello, misma aceleración) y recién ahí se marea.
       Fase 3: se arrastra dos veces.
     · mareado: ¡salta sobre su cabeza! (un salto o un pisotón)
   Con cada fase τ baja: acelera más rápido.
   Al tercer golpe se hace CONFETI. Cada papelito cae con
   gravedad y roce del aire (a = g − k·v): llegan a una
   velocidad límite v = g/k y bajan lento, como el confeti real.
   Después sube el CAÑÓN de los aliens desde la arena.
   ========================================================= */
import { THREE, V3, rng, tangent, clamp } from './util.js';
import { scene, toon, outline, orient } from './escena.js';
import { agregarMuro } from './fisica.js';
import { juego, ajustes, emitir, escuchar } from './estado.js';
import { player, hurtPlayer } from './jugador.js';
import { ETYPES, agregarEnemigo, quitarEnemigos } from './enemigos.js';
import { cam } from './camara.js';
import { piezas } from './mundo.js';
import { CFG } from './config.js';
import { input } from './entrada.js';
import { puntoXZ, dirXZ, localXZ, ejesEn, ARENA_JEFE, puntoDeTramo, guardarParte, registrarMeowlCine } from './superficie.js';

const A = ARENA_JEFE;
const RM = 1.3;                                       // "radio" de Meowl (para chocar)
const ARBOL = { x: 0, z: -158.5 };
export const RAMA = { x: 0, z: -153.6, h: A.h + 8.7 };   // donde se para Meowl (centro de su cuerpo)
// las pozas de arena de donde salen los meowlitos (alrededor del centro)
const POZAS = [[-8, -147], [8, -147], [-6.5, -156], [6.5, -156], [0, -143], [-10, -152], [10, -152]];
const FASES = [
  null,
  { tau: 0.36, destello: 0.5, arrastres: 0, oleada: 3 },
  { tau: 0.3, destello: 0.42, arrastres: 1, oleada: 4 },
  { tau: 0.25, destello: 0.36, arrastres: 2, oleada: 5 },
];
const V0 = 5;                                          // rapidez inicial de la picada (m/s)

export const pm = {
  pelea: 'nada', t: 0, fase: 1, hp: 3,
  m: null, malla: null, canon: null, confeti: null, cola: 0, colaT: 0,
  posRama: puntoXZ(RAMA.x, RAMA.z, RAMA.h),
};

/* =========================================================
   DIBUJO
   ========================================================= */
const bola = new THREE.SphereGeometry(1, 18, 14);
const negro = new THREE.MeshBasicMaterial({ color: 0x140c0a });
const blanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
function parte(mat, sx, sy, sz, x, y, z, borde = 0.05) {
  const m = new THREE.Mesh(bola, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  return borde ? outline(m, borde) : m;
}

/** MEOWL. u = tamaño (el radio del cuerpo). Mira hacia +z. */
function crearMeowl(u) {
  const g = new THREE.Group();
  const cafe = toon(0x9a6034, { emissive: 0x000000 }), pecho = toon(0xf7efe2, { emissive: 0x000000 });
  const naranjo = toon(0xe0913c, { emissive: 0x000000 }), mancha = toon(0xb2622a), oscuro = toon(0x6a3c1e), pata = toon(0xf0b43c);
  const mats = [cafe, pecho, naranjo];
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  cuerpo.add(parte(cafe, u, u * 1.2, u * 0.92, 0, 0, 0, 0.04));
  cuerpo.add(parte(pecho, u * 0.78, u * 0.98, u * 0.5, 0, -u * 0.12, u * 0.5, 0.04));
  // pintitas en la espalda (las plumas de búho)
  const r = rng(5);
  for (let i = 0; i < 16; i++) {
    const a = (r() - 0.5) * 2.4 + Math.PI, y = (r() - 0.5) * 1.6 * u;
    cuerpo.add(parte(oscuro, u * 0.09, u * 0.12, u * 0.05, Math.sin(a) * u * 0.93, y, Math.cos(a) * u * 0.86, 0));
  }
  // alas: cuelgan de un "hombro" para poder aletear (rotation.z)
  const alas = [];
  for (const sx of [-1, 1]) {
    const hombro = new THREE.Group(); hombro.position.set(sx * u * 0.82, u * 0.45, -u * 0.05);
    hombro.add(parte(cafe, u * 0.3, u * 0.95, u * 0.68, sx * u * 0.12, -u * 0.6, 0, 0.05));
    hombro.add(parte(oscuro, u * 0.2, u * 0.4, u * 0.5, sx * u * 0.14, -u * 1.35, -u * 0.05, 0.04));
    cuerpo.add(hombro); alas.push(hombro);
  }
  // cola en abanico
  for (const a of [-0.45, 0, 0.45]) {
    const p = parte(oscuro, u * 0.2, u * 0.55, u * 0.12, Math.sin(a) * u * 0.35, -u * 1.05, -u * 0.72, 0.04);
    p.rotation.z = a; p.rotation.x = 0.6; cuerpo.add(p);
  }
  // patas amarillas con 3 garras
  for (const sx of [-1, 1]) for (const a of [-0.5, 0, 0.5]) {
    const garra = outline(new THREE.Mesh(new THREE.ConeGeometry(u * 0.07, u * 0.32, 6), pata), 0.06);
    garra.position.set(sx * u * 0.36 + Math.sin(a) * u * 0.1, -u * 1.2, u * 0.32 + Math.cos(a) * u * 0.08);
    garra.rotation.x = Math.PI / 2 + 0.3; garra.rotation.z = a;
    cuerpo.add(garra);
  }
  // CABEZA de gato atigrado (gira como la de un búho)
  const cabeza = new THREE.Group(); cabeza.position.y = u * 1.3; g.add(cabeza);
  cabeza.add(parte(naranjo, u * 1.05, u * 0.88, u * 0.95, 0, 0, 0, 0.04));
  cabeza.add(parte(pecho, u * 0.8, u * 0.62, u * 0.55, 0, -u * 0.16, u * 0.5, 0.03));      // la cara blanca
  for (const sx of [-1, 1]) {
    cabeza.add(parte(mancha, u * 0.36, u * 0.2, u * 0.3, sx * u * 0.4, u * 0.36, u * 0.66, 0));   // manchas sobre los ojos
    const ojo = parte(negro, u * 0.27, u * 0.3, u * 0.18, sx * u * 0.38, u * 0.02, u * 0.86, 0);
    const brillo = new THREE.Mesh(bola, blanco); brillo.scale.setScalar(u * 0.07); brillo.position.set(sx * u * 0.31, u * 0.12, u * 1.0);
    cabeza.add(ojo, brillo);
    const oreja = outline(new THREE.Mesh(new THREE.ConeGeometry(u * 0.3, u * 0.6, 4), naranjo), 0.06);
    oreja.position.set(sx * u * 0.62, u * 0.72, -u * 0.05); oreja.rotation.z = -sx * 0.42;
    const dentro = new THREE.Mesh(new THREE.ConeGeometry(u * 0.15, u * 0.32, 4), toon(0xf2a0a8));
    dentro.position.set(0, -u * 0.05, u * 0.1); oreja.add(dentro);
    cabeza.add(oreja);
    // antenas verdes de los aliens de Ícaro (el toque propio)
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.025, u * 0.035, u * 0.6, 6), oscuro);
    antena.position.set(sx * u * 0.22, u * 1.0, -u * 0.1); antena.rotation.z = -sx * 0.25;
    const punta = new THREE.Mesh(bola, toon(0x9cf27a, { emissive: 0x2f7a14 })); punta.scale.setScalar(u * 0.1);
    punta.position.set(sx * u * 0.3, u * 1.3, -u * 0.1);
    cabeza.add(antena, punta);
  }
  cabeza.add(parte(toon(0xf09aa2), u * 0.08, u * 0.06, u * 0.05, 0, -u * 0.2, u * 1.02, 0));   // nariz
  // estrellitas de mareo
  const estrellas = new THREE.Group(); estrellas.position.y = u * 2.3; estrellas.visible = false;
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(u * 0.16, 0), new THREE.MeshBasicMaterial({ color: 0xfff27a }));
    const a = i / 5 * Math.PI * 2; s.position.set(Math.cos(a) * u * 0.9, 0, Math.sin(a) * u * 0.9);
    estrellas.add(s);
  }
  g.add(estrellas);
  // destello (sprite que crece al cargar el ataque)
  const destello = halo('rgba(255,255,230,1)', u * 5); destello.position.y = u * 0.6; destello.material.opacity = 0;
  g.add(destello);
  return { g, cuerpo, cabeza, alas, estrellas, destello, mats };
}

function halo(rgba, tam) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba); grd.addColorStop(0.35, 'rgba(255,240,170,.6)'); grd.addColorStop(1, 'rgba(255,200,80,0)');
  c.fillStyle = grd; c.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(tam);
  return s;
}

/** MEOWLITO: la cría. Bolita de plumas arena con orejas de gato y ojos enormes. Mira hacia +z. */
function crearMeowlito(r) {
  const g = new THREE.Group();
  const mat = toon(0xe7a957, { emissive: 0x000000 }), pecho = toon(0xfbf1dc), oscuro = toon(0x9a5a2a);
  const body = parte(mat, r * 1.05, r, r, 0, 0, 0, 0.07);
  g.add(body);
  g.add(parte(pecho, r * 0.62, r * 0.6, r * 0.4, 0, -r * 0.25, r * 0.66, 0));
  for (const sx of [-1, 1]) {
    g.add(parte(negro, r * 0.26, r * 0.3, r * 0.16, sx * r * 0.36, r * 0.18, r * 0.86, 0));
    const br = new THREE.Mesh(bola, blanco); br.scale.setScalar(r * 0.08); br.position.set(sx * r * 0.3, r * 0.3, r * 1.0); g.add(br);
    const oreja = outline(new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, r * 0.55, 4), mat), 0.08);
    oreja.position.set(sx * r * 0.55, r * 0.82, 0); oreja.rotation.z = -sx * 0.4; g.add(oreja);
    const ala = parte(oscuro, r * 0.18, r * 0.5, r * 0.42, sx * r * 0.98, -r * 0.1, -r * 0.05, 0.06); g.add(ala);
  }
  return { g, body, mat };
}

/* ---------- el árbol seco con la rama ---------- */
function crearArbol(grupo) {
  const g = new THREE.Group(), madera = toon(0x6e4a30), clara = toon(0x8a6040);
  // un "palo" = cilindro con punta más delgada que va de a hasta b
  const palo = (a, b, r0, r1, mat = madera) => {
    const d = new V3().subVectors(b, a), L = d.length();
    const m = outline(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 9), mat), 0.04);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    g.add(m);
    const j = new THREE.Mesh(bola, mat); j.scale.setScalar(r1 * 1.02); j.position.copy(b); g.add(j);
  };
  const v = (x, y, z) => new V3(x, y, z);
  const tronco = [v(0, -0.5, 0), v(0.5, 3, -0.3), v(-0.4, 6, 0.2), v(0.2, 8.6, 0), v(0, 11.5, -0.6)];
  const radios = [0.95, 0.75, 0.6, 0.5, 0.3];
  for (let i = 0; i < tronco.length - 1; i++) palo(tronco[i], tronco[i + 1], radios[i], radios[i + 1]);
  // la rama de Meowl: sale del tronco hacia el centro de la arena (+z)
  palo(v(-0.3, 6.2, 0.15), v(0.1, 6.9, 2.6), 0.42, 0.32, clara);
  palo(v(0.1, 6.9, 2.6), v(0, 6.8, 5.6), 0.32, 0.18, clara);
  palo(v(0.05, 6.85, 4), v(0.9, 7.6, 4.6), 0.1, 0.05);
  // otras ramas secas
  palo(v(-0.4, 6, 0.2), v(-2.6, 8.1, -1), 0.4, 0.25); palo(v(-2.6, 8.1, -1), v(-4.2, 10.6, -1.6), 0.25, 0.1);
  palo(v(0, 11.5, -0.6), v(2.4, 12.8, -1.1), 0.25, 0.12); palo(v(2.4, 12.8, -1.1), v(3.1, 14.2, -0.6), 0.12, 0.05);
  palo(v(0.5, 3, -0.3), v(2.2, 4.6, -1.4), 0.3, 0.12);
  // raíces
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; palo(v(0, 0.6, 0), v(Math.cos(a) * 2.2, -0.3, Math.sin(a) * 2.2), 0.45, 0.12); }
  const { ex, ey, ez } = ejesEn(ARBOL.x, ARBOL.z);
  g.position.copy(puntoXZ(ARBOL.x, ARBOL.z, A.h));
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  grupo.add(g);
  // el tronco choca (una caja), para no atravesarlo
  agregarMuro(puntoXZ(ARBOL.x, ARBOL.z, A.h + 5), ex, ey, ez, new V3(0.7, 5.5, 0.7));
}

/** Pozas de arena oscura en la arena de la cima: de ahí salen los meowlitos. */
function crearPozas(grupo) {
  const mat = toon(0x9c5a24, { map: null }), borde = toon(0xd28a3a, { map: null });
  for (const [x, z] of POZAS) {
    const { ex, ey, ez } = ejesEn(x, z);
    const g = new THREE.Group();
    const d = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), mat); d.rotation.x = -Math.PI / 2; d.position.y = 0.05;
    const anillo = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.55, 20), borde); anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.04;
    g.add(d, anillo);
    g.position.copy(puntoXZ(x, z, A.h));
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
    grupo.add(g);
  }
}

/* =========================================================
   PREPARAR (al construir el nivel)
   ========================================================= */
export function construirMeowl(grupo) {
  crearArbol(grupo);
  crearPozas(grupo);
  pm.malla = crearMeowl(RM);
  grupo.add(pm.malla.g);
  pm.m = { lx: RAMA.x, lz: RAMA.z, lh: RAMA.h, fase: 'rama', t: 0, mareado: 0, facing: new V3(0, 0, 1), mirarA: null, aleteo: 0, flash: 0 };
  Object.defineProperty(pm.m, 'posRama', { get: () => pm.posRama });
  registrarMeowlCine(pm.m);
  pm.pelea = 'espera'; pm.fase = 1; pm.hp = 3; pm.cola = 0;
  limpiarConfeti();
}
/** Después de construir el mundo: esconde el cañón (sale al ganar) o lo deja listo si ya ganaste. */
export function prepararMeowl() {
  pm.canon = piezas.canon;
  const ganada = ajustes.guardado && ajustes.guardado.meowl;
  if (ganada) {
    pm.pelea = 'ganada'; pm.malla.g.visible = false;
    return;
  }
  if (pm.canon) { pm.canon.visible = false; piezas.canon = null; pm.canonBase = pm.canon.position.clone(); }
}

/* =========================================================
   CADA PASO DE FÍSICA
   ========================================================= */
const _p = new V3(), _q = new V3(), _w = new V3();
const vivos = () => juego.enemigos.filter(e => e.deMeowl && !e.dead).length;
const distArena = (x, z) => Math.hypot(x - A.x, z - A.z);
/** Mantiene un punto (x, z) dentro de la arena. */
function adentro(o, max = A.radio - 1.5) {
  const d = distArena(o.x, o.z);
  if (d > max) { o.x = A.x + (o.x - A.x) * max / d; o.z = A.z + (o.z - A.z) * max / d; }
  return o;
}

export function stepMeowl(dt) {
  const m = pm.m;
  if (!m) return;
  pm.t += dt;
  const p = player, l = localXZ(p.pos);
  if (pm.pelea === 'espera') {
    // la pelea parte cuando pisas la arena de la cima
    if (p.grounded && l.h > A.h - 0.5 && distArena(l.x, l.z) < A.radio - 1) empezar();
    return;
  }
  if (pm.pelea === 'ganada') { pasoCanon(dt); return; }
  if (pm.pelea !== 'pelea' && pm.pelea !== 'intro') return;

  // meowlitos que faltan por salir (uno cada 0,6 s, de una poza lejos de ti)
  if (pm.cola > 0) {
    pm.colaT -= dt;
    if (pm.colaT <= 0) { sacarMeowlito(l); pm.cola--; pm.colaT = 0.6; }
  }
  const F = FASES[pm.fase];
  m.t += dt;
  switch (m.fase) {
    case 'despierta':                                 // abre las alas y chilla
      if (m.t > 1.6) { pm.pelea = 'pelea'; enRama(2.2); emitir('jefe', { hp: pm.hp, max: 3, icono: 'meowl' }); emitir('jefeAterriza'); }
      break;
    case 'rama':
      // espera a que queden pocas crías (o se aburre a los 7 s) y se prepara
      if (m.t > m.espera && (vivos() <= 1 || m.t > 7)) { m.fase = 'destello'; m.t = 0; emitir('meowlCarga'); }
      if (m.t > 3 && vivos() < pm.fase - 1 && pm.cola === 0 && !m.refuerzo) { m.refuerzo = true; pm.cola = 1; }
      break;
    case 'destello':                                  // brilla... y a los F.destello s se lanza
      if (m.t >= F.destello) {
        // apunta a donde ESTÁS en ese instante (al suelo de la arena)
        const o = adentro({ x: l.x, z: l.z }, A.radio - 0.5);
        picada(m, o.x, o.z, A.h + RM, 40);
        emitir('meowlPicada');
      }
      break;
    case 'picada': case 'arrastre': {
      // rapidez exponencial: s(t) = v₀·τ·(e^(t/τ) − 1)
      const s = Math.min(m.L, V0 * F.tau * (Math.exp(m.t / F.tau) - 1));
      const k = s / m.L;
      m.lx = m.de.x + (m.a.x - m.de.x) * k; m.lz = m.de.z + (m.a.z - m.de.z) * k; m.lh = m.de.h + (m.a.h - m.de.h) * k;
      m.v = V0 * Math.exp(m.t / F.tau);
      tocarJugador(m, true);
      if (k >= 1) {
        cam.shake = m.fase === 'picada' ? 0.8 : 0.4;
        emitir(m.fase === 'picada' ? 'meowlClava' : 'meowlFrena');
        polvo(posDe(m), 18);
        if (m.fase === 'picada') { m.fase = 'clavado'; m.t = 0; m.quedan = F.arrastres; }
        else { m.quedan--; m.fase = m.quedan > 0 ? 'clavado' : 'mareado'; m.t = 0; m.mareado = m.fase === 'mareado' ? 3.2 : 0; if (m.fase === 'mareado') emitir('meowlMareado'); }
      }
      break;
    }
    case 'clavado':                                   // pico en la arena: forcejea
      tocarJugador(m, false);
      if (m.t > (m.quedan > 0 ? 0.8 : 0.9)) {
        if (m.quedan > 0) { m.fase = 'destelloSuelo'; m.t = 0; emitir('meowlCarga'); }
        else { m.fase = 'mareado'; m.t = 0; m.mareado = 3.2; emitir('meowlMareado'); }
      }
      break;
    case 'destelloSuelo':                             // otra vez el destello, ahora en el suelo
      tocarJugador(m, false);
      if (m.t >= F.destello) {
        // se arrastra hacia ti: hasta 15 m y sin salirse de la arena
        const dx = l.x - m.lx, dz = l.z - m.lz, d = Math.hypot(dx, dz) || 1;
        const largo = Math.min(15, d + 2.5);
        const o = adentro({ x: m.lx + dx / d * largo, z: m.lz + dz / d * largo });
        picada(m, o.x, o.z, A.h + RM, 0);
        m.fase = 'arrastre';
        emitir('meowlArrastre');
      }
      break;
    case 'mareado':
      m.mareado -= dt;
      tocarJugador(m, false);
      if (m.fase === 'mareado' && m.mareado <= 0) volar(m);   // (si le pegaste, ya pasó a 'golpe')                   // no le pegaste a tiempo: vuelve a su rama
      break;
    case 'golpe':                                     // le pegaste: se sacude
      if (m.t > 0.7) {
        if (pm.hp <= 0) return ganar();
        pm.fase = Math.min(3, pm.fase + 1);
        pm.cola += FASES[pm.fase].oleada;
        volar(m);
      }
      break;
    case 'vuela': {                                   // vuelve a la rama (curva de Bézier, es animación)
      const k = Math.min(1, m.t / 1.4), e = k * k * (3 - 2 * k), u = 1 - e;
      m.lx = u * u * m.de.x + 2 * u * e * m.c.x + e * e * RAMA.x;
      m.lz = u * u * m.de.z + 2 * u * e * m.c.z + e * e * RAMA.z;
      m.lh = u * u * m.de.h + 2 * u * e * m.c.h + e * e * RAMA.h;
      if (k >= 1) enRama(1.6);
      break;
    }
  }
}

function empezar() {
  pm.pelea = 'intro';
  juego.checkpoint = puntoDeTramo(3);               // si pierdes, vuelves al puente
  emitir('arena');                                  // audio.js: tensión
  cam.shake = 0.4;
  const m = pm.m; m.fase = 'despierta'; m.t = 0;
  pm.fase = 1; pm.hp = 3;
  pm.cola = FASES[1].oleada; pm.colaT = 1.2;
  emitir('meowlChilla');
}
function enRama(espera) {
  const m = pm.m;
  m.fase = 'rama'; m.t = 0; m.espera = espera; m.refuerzo = false;
  m.lx = RAMA.x; m.lz = RAMA.z; m.lh = RAMA.h;
}
/** Prepara un movimiento en línea recta (picada o arrastre) desde donde está hasta (x, z, h). */
function picada(m, x, z, h) {
  m.de = { x: m.lx, z: m.lz, h: m.lh };
  m.a = { x, z, h };
  m.L = Math.max(0.1, Math.hypot(x - m.lx, z - m.lz, h - m.lh));
  m.fase = 'picada'; m.t = 0; m.pego = false;
  _w.set(x - m.lx, 0, z - m.lz);
  if (_w.lengthSq() > 1e-4) m.facing.copy(_w.normalize());
}
function volar(m) {
  m.fase = 'vuela'; m.t = 0; m.mareado = 0;
  m.de = { x: m.lx, z: m.lz, h: m.lh };
  m.c = { x: (m.lx + RAMA.x) / 2, z: (m.lz + RAMA.z) / 2, h: RAMA.h + 5 };
  emitir('meowlVuela');
}
const posDe = (m, out = new V3()) => puntoXZ(m.lx, m.lz, m.lh, out);

/** ¿Choca con el jugador? peligroso = en picada o arrastrándose (2 corazones). */
function tocarJugador(m, peligroso) {
  const p = player;
  posDe(m, _p);
  _q.copy(p.pos).sub(_p);
  const d = _q.length(), min = RM + p.r + 0.2;
  if (d > min) return;
  const up = _p.clone().normalize(), encima = _q.dot(up) / (d || 1), baja = p.vel.dot(up);
  // ¿le caíste encima de la cabeza estando mareado? → ¡golpe!
  if (m.fase === 'mareado' && encima > 0.45 && baja < 1) {
    pm.hp--; m.fase = 'golpe'; m.t = 0; m.mareado = 0; m.flash = 0.25;
    cam.shake = 0.7;
    emitir('meowlGolpe', pm.hp);
    emitir('jefe', pm.hp > 0 ? { hp: pm.hp, max: 3, icono: 'meowl' } : null);
    rebotar(p, _q, up, input.jumpHeld ? CFG.stompHeld : CFG.stomp);
    return;
  }
  if (encima > 0.45 && baja < 1 && !peligroso) { rebotar(p, _q, up, CFG.stomp); return; }   // rebota en su cabeza
  // empujar al jugador fuera
  p.pos.copy(_p).addScaledVector(_q.normalize(), min);
  if (peligroso && !m.pego) { m.pego = true; hurtPlayer(2, _q); emitir('meowlPega'); }
}
function rebotar(p, n, up, v) {
  tangent(p.vel, p.vel, p.up); p.vel.addScaledVector(p.up, v);
  tangent(_w, n, up); if (_w.lengthSq() > 1e-4) p.vel.addScaledVector(_w.normalize(), 4);
  p.state = 'normal'; p.jumping = true; p.jumpCut = false; p.airDash = true; p.grounded = false;
}

/* ---------- meowlitos ---------- */
function sacarMeowlito(l) {
  // la poza más lejos de ti (entre 3 al azar), para que no salgan encima tuyo
  const opciones = POZAS.map(([x, z]) => ({ x, z, d: Math.hypot(x - l.x, z - l.z) })).filter(o => o.d > 4);
  const lista = opciones.length ? opciones : POZAS.map(([x, z]) => ({ x, z }));
  const o = lista[Math.floor(Math.random() * lista.length)];
  const e = agregarEnemigo('meowlito', 0, dirXZ(o.x, o.z), 0.02);
  e.deMeowl = true; e.fase = 'sale'; e.t = 0; e.mareado = 1;
  emitir('meowlitoSale', e.pos);
  polvo(e.pos, 8);
}

ETYPES.meowlito = { r: 0.5, hp: 1, speed: 4.2, aggro: 40, stomp: 1, punch: 1, dash: 1, mass: 1, modelo: crearMeowlito };

/* EMBOSCADA: los meowlitos que pone el nivel (no los que llama Meowl) parten ESCONDIDOS.
   - En el laberinto, bajo el suelo de su cámara: salen cuando te acercas y te persiguen
     sin alejarse de su casa.
   - En el desierto (planeta que quema), bajo la ARENA: a ellos no los quema, viven ahí.
     Salen, brillan y te saltan encima desde la arena. Si fallan y caen a la arena, se
     vuelven a hundir y esperan de nuevo. */
const EMB = { cerca: 9, alto: 3, altoArena: 6, espera: 2.5, lejos: 12 };
function prepararEmboscada(e) {
  e.fase = 'oculto'; e.t = 0; e.cdEmb = 0;
  const P = e.planet;
  if (P && P.quema && e.pos.distanceTo(P.c) < P.mar + 1) {   // vive bajo la arena: su "casa" es el punto de la arena donde se esconde
    e.arenero = true;
    e.casa = e.pos.clone().sub(P.c).normalize().multiplyScalar(P.mar + e.r).add(P.c);
  } else if (!e.casa) e.casa = e.pos.clone();
}
/** Lo deja quieto en su casa, justo en la superficie de la arena (la arena no es sólida: hay que sostenerlo). */
function enLaArena(e) { e.pos.copy(e.casa); e.vel.set(0, 0, 0); }
function hundir(e) {
  polvo(e.pos, 6, e.up);
  emitir('meowlitoSale', e.pos);
  e.fase = 'oculto'; e.t = 0; e.cdEmb = EMB.espera; e.balistico = false; e.saltoPendiente = null;
  enLaArena(e);
}
const bajoLaArena = e => e.arenero && e.pos.distanceTo(e.planet.c) < e.planet.mar + e.r * 0.3;

ETYPES.meowlito.ia = (e, dt, w) => {
  const p = player;
  if (!e.fase) prepararEmboscada(e);
  e.t += dt;
  _q.copy(p.pos).sub(e.pos);
  const dh = _q.dot(e.up);                           // cuánto más arriba estás tú
  tangent(w, _q, e.up);
  const dist = w.length();
  if (dist > 1e-4) w.divideScalar(dist);
  const libre = p.planet === e.planet && p.state !== 'launch' && p.state !== 'vuelo' && p.state !== 'guiado';
  e.oculto = e.fase === 'oculto';
  e.iaPersigue = false;
  switch (e.fase) {
    case 'oculto': {                                 // escondido: no se ve, no choca, no hace daño
      e.mareado = 1; w.set(0, 0, 0);
      if (e.arenero) enLaArena(e);
      const alto = e.arenero ? EMB.altoArena : EMB.alto;
      if (e.t > e.cdEmb && libre && dist < EMB.cerca && dh > -2 && dh < alto) {
        e.fase = 'sale'; e.t = 0; e.oculto = false;
        emitir('meowlitoSale', e.pos); polvo(e.pos, 8, e.up);
      }
      return 0;
    }
    case 'sale':                                     // sale del suelo (0,7 s, no hace daño)
      e.mareado = 1; w.set(0, 0, 0);
      if (e.arenero) enLaArena(e);
      if (e.t > 0.7) {
        e.mareado = 0; e.t = 0;
        // el de la arena no camina: brilla y salta de una. Los demás te acechan primero.
        if (e.arenero) { e.fase = 'destello'; e.dir = w.clone(); emitir('meowlitoCarga', e.pos); }
        else { e.fase = 'acecha'; e.espera = 0.9 + Math.random() * 1.2; }
      }
      return 0;
    case 'acecha': {
      if (bajoLaArena(e)) { hundir(e); return 0; }   // se cayó de la roca a la arena: se hunde
      // el de casa (laberinto, roca del desierto) solo te persigue si estás cerca y a su altura
      if (!e.deMeowl && (!libre || dist > EMB.lejos || Math.abs(dh) > EMB.alto)) {
        _q.copy(e.casa).sub(e.pos); tangent(w, _q, e.up);
        const dc = w.length();
        if (dc < 0.8) { w.set(0, 0, 0); return 0; }
        w.divideScalar(dc);
        return e.T.speed * 0.45;
      }
      e.iaPersigue = true;
      if (e.t > e.espera && e.grounded && dist < 13) { e.fase = 'destello'; e.t = 0; e.dir = w.clone(); emitir('meowlitoCarga', e.pos); }
      return e.T.speed;
    }
    case 'destello':                                 // brilla medio segundo, quieto, mirándote
      e.iaPersigue = true;
      if (e.arenero && e.pos.distanceTo(e.casa) < 0.3) enLaArena(e);
      e.flash = Math.floor(e.t * 16) % 2 ? 0.03 : 0;
      e.dir.copy(w.lengthSq() > 0 ? w : e.dir);
      w.set(0, 0, 0);
      if (e.t >= 0.5) {
        // se LANZA con un tiro parabólico apuntado a donde estás (el mismo cálculo del "salto del susto"):
        //   cima H = (lo que estás más arriba) + 1 m   →  v_y = √(2·g·H)
        //   tiempo de vuelo t = v_y/g + √(2·(H − dh)/g)   →  de lado v_h = distancia / t
        const g = e.gmag, H = Math.max(dh, 0) + 1;
        const vy = Math.sqrt(2 * g * H), tVuelo = vy / g + Math.sqrt(2 * Math.max(H - dh, 0) / g);
        const vh = clamp(dist / tVuelo + 1, 4, 17);
        e.saltoPendiente = { vy, vh: e.dir.clone().multiplyScalar(vh) };
        e.balistico = true; e.fase = 'lanza'; e.t = 0;
        emitir('meowlitoLanza', e.pos);
      }
      return 0;
    case 'lanza':
      e.iaPersigue = true;
      w.set(0, 0, 0);
      if (e.t > 0.15 && bajoLaArena(e)) { hundir(e); return 0; }   // falló: cayó a la arena y se hunde
      if (e.grounded && e.t > 0.15) { e.balistico = false; e.fase = 'mareo'; e.t = 0; e.mareado = 0.8; }
      return 0;
    case 'mareo':                                    // aterrizó: un ratito inofensivo
      w.set(0, 0, 0);
      if (bajoLaArena(e)) { hundir(e); return 0; }
      if (e.t > 0.8) { e.fase = 'acecha'; e.t = 0; e.mareado = 0; e.espera = 1 + Math.random(); }
      return 0;
  }
  return 0;
};
ETYPES.meowlito.visual = (e, t) => {
  const M = e.mesh;
  if (e.fase === 'oculto') { M.g.visible = false; return; }
  if (e.fase === 'sale') {                             // va saliendo del suelo
    const k = Math.min(1, e.t / 0.7);
    M.g.position.addScaledVector(e.up, -(1 - k) * 1.1);
    M.g.rotation.y += Math.sin(t * 30) * 0.2;
  }
  if (e.fase === 'destello') M.g.scale.setScalar(1 + e.t * 0.5);
  if (e.fase === 'lanza') M.body.rotation.x = -0.6;
};

/* ---------- ganar: confeti y el cañón ---------- */
function ganar() {
  const m = pm.m;
  pm.pelea = 'ganada'; pm.t = 0; pm.canonT = -1.4;
  emitir('jefe', null);
  for (const e of juego.enemigos) if (e.deMeowl && !e.dead) { e.dead = true; e.dieT = 0.3; }
  posDe(m, _p);
  confeti(_p, _p.clone().normalize());
  pm.malla.g.visible = false;
  cam.shake = 1;
  emitir('meowlConfeti');
  emitir('jefeVencido');
  guardarParte({ meowl: true, tramo: 3 });
}
function pasoCanon(dt) {
  if (!pm.canon || piezas.canon) return;
  pm.canonT += dt;
  if (pm.canonT < 0) return;
  if (!pm.canon.visible) { pm.canon.visible = true; emitir('canonSube'); }
  // sube 3,2 m en 2,4 s, temblando
  const k = Math.min(1, pm.canonT / 2.4), e = k * k * (3 - 2 * k);
  const arriba = pm.canonBase.clone().normalize();
  pm.canon.position.copy(pm.canonBase).addScaledVector(arriba, -3.2 * (1 - e));
  cam.shake = Math.max(cam.shake, 0.25 * (1 - k));
  if (Math.random() < dt * 14 && k < 1) polvo(pm.canonBase, 2);
  if (k >= 1) { pm.canon.position.copy(pm.canonBase); piezas.canon = pm.canon; emitir('canonListo'); }
}

/* CONFETI: cada papelito tiene posición, velocidad y giro. Por paso:
     a = −g·arriba − k·v     (gravedad + roce del aire, proporcional a la velocidad)
   Con roce, la velocidad tiende a v_límite = g / k = 20 / 2,4 ≈ 8 m/s:
   por eso el confeti baja lento y "flota". Al tocar el suelo se queda. */
const NCONF = 240, KROCE = 2.4;
function confeti(pos, up) {
  limpiarConfeti();
  const geo = new THREE.PlaneGeometry(0.26, 0.16);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
  const mesh = new THREE.InstancedMesh(geo, mat, NCONF);
  const colores = [0xff5c8a, 0xffd23f, 0x5ce1ff, 0x9cf27a, 0xb98cff, 0xffffff, 0xff8a3d];
  const c = new THREE.Color(), lado = new V3(), lado2 = new V3();
  tangent(lado, new V3(1, 0, 0), up).normalize(); lado2.crossVectors(up, lado);
  const piezasC = [];
  for (let i = 0; i < NCONF; i++) {
    mesh.setColorAt(i, c.setHex(colores[i % colores.length]));
    const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 11;
    const vel = up.clone().multiplyScalar(6 + Math.random() * 12)
      .addScaledVector(lado, Math.cos(a) * v).addScaledVector(lado2, Math.sin(a) * v);
    piezasC.push({ p: pos.clone(), v: vel, giro: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: 4 + Math.random() * 10, quieto: false });
  }
  mesh.frustumCulled = false;
  scene.add(mesh);
  pm.confeti = { mesh, piezas: piezasC, t: 0 };
}
const _mat = new THREE.Matrix4(), _quat = new THREE.Quaternion(), _uno = new V3(1, 1, 1), _arr = new V3();
function animarConfeti(dt) {
  const C = pm.confeti;
  if (!C) return;
  C.t += dt;
  for (let i = 0; i < C.piezas.length; i++) {
    const k = C.piezas[i];
    if (!k.quieto) {
      _arr.copy(k.p).normalize();
      k.v.addScaledVector(_arr, -20 * dt).addScaledVector(k.v, -KROCE * dt);        // a = −g·arriba − k·v
      k.v.addScaledVector(_w.set(Math.sin(C.t * 3 + i), 0, Math.cos(C.t * 2.6 + i)), 1.5 * dt);   // aleteo de papel
      k.p.addScaledVector(k.v, dt);
      k.giro.x += k.w * dt; k.giro.y += k.w * 0.7 * dt;
      const l = localXZ(k.p);
      const suelo = distArena(l.x, l.z) < A.radio + 0.5 ? A.h : 0;
      if (l.h < suelo + 0.03) { k.p.copy(puntoXZ(l.x, l.z, suelo + 0.03)); k.quieto = true; k.giro.x = Math.PI / 2; }
    }
    _quat.setFromEuler(k.giro);
    C.mesh.setMatrixAt(i, _mat.compose(k.p, _quat, _uno));
  }
  C.mesh.instanceMatrix.needsUpdate = true;
  C.mesh.material.opacity = clamp(1 - (C.t - 7) / 2, 0, 1);
  if (C.t > 9) limpiarConfeti();
}
function limpiarConfeti() {
  if (!pm.confeti) return;
  scene.remove(pm.confeti.mesh); pm.confeti.mesh.geometry.dispose(); pm.confeti.mesh.material.dispose();
  pm.confeti = null;
}

/* ---------- polvo de arena (al clavarse, al salir un meowlito, al subir el cañón) ---------- */
const polvos = [];
let texPolvo = null;
function polvo(pos, n, up = pos.clone().normalize()) {
  if (!texPolvo) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(240,190,110,.9)'); grd.addColorStop(1, 'rgba(240,190,110,0)');
    c.fillStyle = grd; c.fillRect(0, 0, 64, 64);
    texPolvo = new THREE.CanvasTexture(cv);
  }
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPolvo, transparent: true, depthWrite: false }));
    s.position.copy(pos);
    const v = new V3(Math.random() - 0.5, 0, Math.random() - 0.5);
    tangent(v, v, up).normalize().multiplyScalar(2 + Math.random() * 4).addScaledVector(up, 1 + Math.random() * 3);
    scene.add(s);
    polvos.push({ s, v, t: 0 });
  }
}
/** El polvo también se anima en el laberinto (nivel2-icaro.js lo llama desde alCuadro). */
export function animarPolvo(dt) {
  for (let i = polvos.length - 1; i >= 0; i--) {
    const q = polvos[i];
    q.t += dt;
    q.s.position.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - 2 * dt);
    q.s.scale.setScalar(0.8 + q.t * 3);
    q.s.material.opacity = Math.max(0, 0.8 - q.t);
    if (q.t > 0.8) { scene.remove(q.s); q.s.material.dispose(); polvos.splice(i, 1); }
  }
}

/* =========================================================
   CADA CUADRO: dónde se dibuja Meowl y cómo se mueve
   ========================================================= */
const _f = new V3(), _up = new V3(), _loc = new V3();
export function animarMeowl(dt, t) {
  animarConfeti(dt);
  animarPolvo(dt);
  const m = pm.m, M = pm.malla;
  cam.foco = null;
  if (!m || !M || !M.g.visible) return;
  posDe(m, M.g.position);
  // durante la pelea, la cámara inclina la mirada hacia Meowl (si está adelante): así ves su destello
  if ((pm.pelea === 'pelea' || pm.pelea === 'intro') && m.lh > A.h + 3) cam.foco = M.g.position;
  _up.copy(M.g.position).normalize();
  // hacia dónde mira el cuerpo: en la rama, hacia el centro de la arena; si no, hacia donde va o hacia ti
  if (m.fase === 'rama' || m.fase === 'despierta' || m.fase === 'destello') _f.copy(puntoXZ(A.x, A.z, A.h)).sub(M.g.position);
  else if (m.fase === 'mareado' || m.fase === 'clavado' || m.fase === 'destelloSuelo') _f.copy(player.pos).sub(M.g.position);
  else _f.copy(m.facing);
  tangent(_f, _f, _up);
  if (_f.lengthSq() > 1e-4) m.facing.copy(_f.normalize());
  orient(M.g, _up, m.facing);
  // la cabeza gira como la de un búho (hasta 150° a cada lado) para mirarte
  const mira = m.mirarA || player.pos;
  _loc.copy(mira); M.g.worldToLocal(_loc);
  const ang = clamp(Math.atan2(_loc.x, _loc.z), -2.6, 2.6);
  M.cabeza.rotation.y += (ang - M.cabeza.rotation.y) * Math.min(1, dt * 8);
  M.cabeza.rotation.z = m.fase === 'rama' ? Math.sin(t * 1.3) * 0.12 : 0;      // ladea la cabeza (curiosidad)
  // alas: quietas en la rama, abiertas al despertar y aleteando al volar
  const aleteo = m.fase === 'vuela' ? Math.sin(t * 22) * 0.9 + 0.6 : m.fase === 'despierta' ? 1.2 + Math.sin(t * 14) * 0.3
    : m.fase === 'picada' ? 0.15 : m.fase === 'arrastre' ? 1.0 : 0.08;
  M.alas.forEach((a, i) => { a.rotation.z += ((i ? -1 : 1) * -aleteo - a.rotation.z) * Math.min(1, dt * 14); });
  // pose: en picada se inclina hacia adelante; clavado = cabeza en la arena
  const incl = m.fase === 'picada' ? 1.1 : m.fase === 'clavado' ? 1.4 : m.fase === 'arrastre' ? 1.2 : 0;
  M.cuerpo.rotation.x += (incl - M.cuerpo.rotation.x) * Math.min(1, dt * 10);
  M.cabeza.position.z = Math.sin(M.cuerpo.rotation.x) * RM * 1.3;
  M.cabeza.position.y = Math.cos(M.cuerpo.rotation.x) * RM * 1.3 - (m.fase === 'clavado' ? 0.6 : 0);
  if (m.fase === 'clavado') M.g.rotation.z = Math.sin(t * 18) * 0.12;       // forcejea
  if (m.fase === 'golpe') M.g.scale.set(1.25, 0.7, 1.25); else M.g.scale.lerp(_uno, Math.min(1, dt * 10));
  // destello: brilla en blanco y el halo crece (¡ojo, se va a lanzar!)
  const cargando = m.fase === 'destello' || m.fase === 'destelloSuelo';
  const k = cargando ? Math.min(1, m.t / FASES[pm.fase].destello) : 0;
  M.destello.material.opacity = cargando ? 0.5 + 0.5 * Math.abs(Math.sin(t * 20)) : Math.max(0, M.destello.material.opacity - dt * 4);
  M.destello.scale.setScalar(RM * (3 + k * 5));
  m.flash -= dt;
  const blanco = cargando ? (Math.floor(t * 14) % 2 ? 0.55 : 0.15) : m.flash > 0 ? 0.6 : 0;
  for (const mt of M.mats) mt.emissive.setScalar(blanco);
  // estrellitas cuando está mareado
  M.estrellas.visible = m.fase === 'mareado';
  M.estrellas.rotation.y = t * 5;
}

/* si pierdes todas las vidas, la pelea parte de nuevo desde el puente */
escuchar('reaparecer', () => {
  if (!pm.m || (pm.pelea !== 'pelea' && pm.pelea !== 'intro')) return;
  quitarEnemigos(e => e.deMeowl);
  pm.pelea = 'espera'; pm.cola = 0; pm.fase = 1; pm.hp = 3;
  enRama(2);
  pm.malla.g.visible = true;
  emitir('jefe', null);
});
escuchar('nivel', () => { limpiarConfeti(); for (const q of polvos) scene.remove(q.s); polvos.length = 0; });
