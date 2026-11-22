/* =========================================================
   mecanicas/escape.js · SUPERSALTO y velocidad de escape
   ---------------------------------------------------------
   LEY FÍSICA:  v_esc = √(2·G·M / r)

   ¿De dónde sale? De la energía. Al saltar con velocidad v:
     energía de movimiento     ½·m·v²
     energía que "pide" la gravedad para irte al infinito  G·M·m / r
   Si ½·m·v² ≥ G·M·m / r  →  te vas y no vuelves.
   Despejando: v ≥ √(2·G·M / r). La masa m se cancela:
   un elefante y una hormiga necesitan la misma velocidad.

   CÓMO SE JUEGA:
   1. Mantén SÚPER (o L) parado en el suelo: se carga velocidad.
   2. La barra muestra la velocidad cargada y una MARCA en v_esc.
   3. Una línea punteada predice el vuelo con la MISMA física
      que después mueve al jugador (fisica.js → pasoNewton).
   4. Suelta: sales disparado "hacia arriba" (opuesto a la gravedad).

   DATO PARA LA FERIA: para llegar a un planeta VECINO cercano
   basta un poco menos que v_esc, porque antes de "irte al
   infinito" ya te atrapa la gravedad del otro (las misiones a la
   Luna hacen eso). Ícaro está tan lejos que en Columba sí hay
   que pasar v_esc (nivel.js revisa la energía en pleno vuelo).

   SIMPLIFICACIONES: sin aire ni roce; el impulso es instantáneo
   (como un cohete que quema todo su combustible de una vez);
   en cada punto manda solo el planeta que más atrae.
   ========================================================= */
import { THREE, V3, clamp } from '../util.js';
import { scene } from '../escena.js';
import { CFG } from '../config.js';
import { input } from '../entrada.js';
import { juego, emitir } from '../estado.js';
import { pasoNewton, collide, updateUp, velocidadEscape, simularTrayectoria } from '../fisica.js';

/** Lo que la UI necesita para dibujar la barra. */
export const escape = {
  visible: false,
  v: 0,          // velocidad cargada (m/s)
  vesc: 0,       // velocidad de escape del planeta donde estás (m/s)
  resultado: '', // 'vuelve' | 'llega' | 'escapa' (según la predicción)
  destino: null, // planeta donde aterrizarías
};

/* ---------------------------------------------------------
   ESTADOS DEL JUGADOR
   --------------------------------------------------------- */
/** canon: si no es null, el jugador se mete en la boca del cañón y carga desde ahí. */
export function empezarCarga(p, canon) {
  p.state = 'carga';
  p.carga = 0;
  p.vel.set(0, 0, 0);
  p.fijo = canon ? canon.boca.clone() : null;
  emitir('carga', !!canon);
}

const _dir = new V3();
export function pasoCarga(p, dt) {
  updateUp(p, dt);
  if (p.fijo) {
    // dentro del cañón: quieto en la boca
    p.pos.copy(p.fijo); p.vel.set(0, 0, 0);
  } else {
    // quieto en el suelo: solo la gravedad lo mantiene pegado
    p.vel.set(0, 0, 0).addScaledVector(p.gdir, p.gmag * dt);
    p.pos.addScaledVector(p.vel, dt);
    collide(p);
  }

  // la velocidad sube a ritmo constante hasta el tope de la barra
  // (cada nivel puede tener un cañón más potente: juego.superMax / superRitmo, ver nivel.js)
  p.carga = Math.min(juego.superMax || CFG.superMax, p.carga + (juego.superRitmo || CFG.superRitmo) * dt);

  if (!input.superHeld) {
    if (p.carga < CFG.superMin) { p.state = 'normal'; p.carga = 0; p.fijo = null; return; }
    // ¡DESPEGUE! velocidad = carga, en dirección opuesta a la gravedad (radial)
    _dir.copy(p.gdir).negate();
    p.vel.copy(_dir).multiplyScalar(p.carga);
    p.state = 'vuelo';
    p.grounded = false;
    p.airDash = false;
    p.fijo = null;
    emitir('despegue', { v: p.carga, vesc: escape.vesc });
  }
}

const _n = new V3();
export function pasoVuelo(p, dt) {
  // Newton puro: la misma función que usa la predicción
  pasoNewton(p.pos, p.vel, dt);
  updateUp(p, dt);
  const toco = collide(p);
  if (toco) {
    // aterrizaje: el "arriba" pasa a ser la normal del lugar donde caíste
    _n.copy(p.pos).sub(toco.c).normalize();
    p.up.copy(_n);
    p.grounded = true;
    p.state = 'normal';
    p.vel.multiplyScalar(0.25);
    p.land = 0.35;
    p.carga = 0;
    emitir('aterrizaje', toco);
  }
}

/* ---------------------------------------------------------
   LÍNEA PUNTEADA QUE PREDICE LA TRAYECTORIA
   --------------------------------------------------------- */
const MAXP = 800;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
const mat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.95, depthTest: false });
const linea = new THREE.Line(geo, mat);
linea.frustumCulled = false;
linea.renderOrder = 5;
linea.visible = false;
scene.add(linea);
// anillo donde aterrizarías
const marca = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthTest: false }));
marca.renderOrder = 6;
marca.visible = false;
scene.add(marca);

const COLORES = { vuelve: 0xff8a5c, llega: 0x7dffa8, escapa: 0xb9c3ff };
const _v0 = new V3(), _z = new V3(0, 0, 1);
let opacidad = 0;

/** Se llama una vez por cuadro: recalcula la predicción y la barra. */
export function actualizarEscape(dt) {
  const p = juego.jugador;
  const cargando = p.state === 'carga';
  // en Kepler el vuelo es por un resorte (no por el cañón): la barra de v_esc no corresponde
  const volando = p.state === 'vuelo' && !(juego.nivel && juego.nivel.deslizar);
  escape.visible = cargando || volando;

  if (p.planet) escape.vesc = velocidadEscape(p.planet, p.pos.distanceTo(p.planet.c));
  if (cargando) escape.v = p.carga;

  if (cargando && p.carga > 0.5) {
    _v0.copy(p.gdir).negate().multiplyScalar(p.carga);
    const sim = simularTrayectoria(p.pos, _v0, { radio: p.r, tMax: 14 });
    const pts = sim.puntos;
    const n = Math.min(pts.length, MAXP);
    const arr = geo.attributes.position.array;
    for (let i = 0; i < n; i++) { arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z; }
    geo.attributes.position.needsUpdate = true;
    geo.setDrawRange(0, n);
    geo.computeBoundingSphere();
    linea.computeLineDistances();

    // las islas y rocas pertenecen a un planeta: caer en ellas cuenta como caer en ese planeta
    const destino = sim.choca ? (sim.choca.planeta || sim.choca) : null;
    // ¿escapas? Se decide con la ENERGÍA, no con la simulación: la simulación dura 14 s y,
    // con 90 % de v_esc, subes ~240 m y tardas más que eso en volver (parecería que escapas).
    if (p.carga >= escape.vesc) escape.resultado = 'escapa';
    else if (!destino || destino === p.planet) escape.resultado = 'vuelve';
    else escape.resultado = 'llega';
    escape.destino = destino;
    mat.color.setHex(COLORES[escape.resultado]);
    marca.material.color.setHex(COLORES[escape.resultado]);

    if (sim.choca) {
      const fin = pts[pts.length - 1];
      const nrm = fin.clone().sub(sim.choca.c).normalize();
      marca.position.copy(sim.choca.c).addScaledVector(nrm, sim.choca.R + 0.05);
      marca.quaternion.setFromUnitVectors(_z, nrm);
      marca.visible = true;
    } else marca.visible = false;
    opacidad = 1;
  } else if (!volando) {
    opacidad -= dt * 2;          // al aterrizar, la línea se desvanece
  }
  opacidad = clamp(opacidad, 0, 1);
  mat.opacity = 0.95 * opacidad;
  marca.material.opacity = opacidad;
  linea.visible = opacidad > 0.01;
  if (opacidad <= 0.01) marca.visible = false;
}

/** Esconde la línea de inmediato (al cambiar de nivel). */
export function limpiarEscape() {
  opacidad = 0; linea.visible = false; marca.visible = false; escape.visible = false;
}
