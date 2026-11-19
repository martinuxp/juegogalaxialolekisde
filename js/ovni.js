/* =========================================================
   ovni.js · El ovni de Ícaro que ronda Columba
   ---------------------------------------------------------
   ÓRBITA (física de verdad): el ovni no tiene motor. Lo mueve
   la misma función pasoNewton (leapfrog) que mueve al jugador
   en vuelo. Si lo lanzamos de lado con la rapidez justa, cae
   "alrededor" del planeta para siempre: una órbita circular.

     La gravedad hace de fuerza centrípeta:
        G·M/r² = v²/r   →   v = √(G·M/r)
     Y el período (una vuelta completa):
        T = 2πr / v

   En Columba: G·M = g·R² = 27,5 · 40² = 44 000 m³/s².
   A r = 70 m:  v = √(44 000/70) ≈ 25 m/s  y  T ≈ 17,6 s.
   (Esto adelanta la mecánica de Kepler del planeta siguiente.)

   Si cambias g× (botón de arriba), G·M cambia y la órbita ya
   no sería circular: el ovni "prende sus motores" y corrige su
   rapidez a la nueva √(G·M/r) para no estrellarse.

   VIAJES (NO es física, es animación): para bajar a la arena
   del jefe o escapar a Ícaro, el ovni prende los motores y
   sigue una curva de Bézier (como los anillos del Laboratorio).
   ========================================================= */
import { THREE, V3, tangent } from './util.js';
import { scene, orient } from './escena.js';
import { mundo, pasoNewton, GM } from './fisica.js';
import { crearOvni } from './aliens.js';

export const ovni = {
  obj: null, partes: null, giro: null,
  estado: 'nada',            // 'orbita' | 'viaje' | 'flota' | 'nada'
  pos: new V3(), vel: new V3(),
  planeta: null, gmUsado: 0,
  viaje: null,               // { p0, ctrl, p1, t, dur, alLlegar }
  flota: null,               // { centro, arriba } mientras flota quieto
  rayo: 0,                   // largo del rayo (0 = apagado)
};

export function limpiarOvni() {
  if (ovni.obj) scene.remove(ovni.obj);
  ovni.obj = null; ovni.estado = 'nada'; ovni.viaje = null; ovni.flota = null; ovni.rayo = 0;
}

/** Crea el ovni en una órbita circular de radio "radio" alrededor del planeta, en el plano con esa normal. */
export function crearOvniNivel(d) {
  limpiarOvni();
  const P = mundo.planetas[d.planeta];
  ovni.planeta = P;
  const g = new THREE.Group();
  ovni.partes = crearOvni();
  ovni.giro = new THREE.Group();
  ovni.giro.add(ovni.partes.g);
  g.add(ovni.giro);
  scene.add(g);
  ovni.obj = g;
  ponerEnOrbita(d.radio, d.normal, d.empieza);
}

/** Posición en el radio pedido + velocidad perpendicular de rapidez √(GM/r). */
function ponerEnOrbita(radio, normal, empieza) {
  const P = ovni.planeta;
  const u = tangent(new V3(), empieza, normal).normalize();     // punto de partida (dentro del plano de la órbita)
  const w = new V3().crossVectors(normal, u).normalize();       // dirección del movimiento (perpendicular a u)
  ovni.pos.copy(P.c).addScaledVector(u, radio);
  ovni.gmUsado = GM(P);
  ovni.vel.copy(w).multiplyScalar(Math.sqrt(ovni.gmUsado / radio));
  ovni.estado = 'orbita';
}

/** Rapidez de órbita circular a la distancia actual (sirve para mostrarla en el panel). */
export function rapidezOrbital() {
  const r = ovni.pos.distanceTo(ovni.planeta.c);
  return { v: ovni.vel.length(), vCirc: Math.sqrt(GM(ovni.planeta) / r), r };
}

/** El ovni vuela (con motores) hasta un punto, por una curva suave. */
export function ovniIrA(destino, dur, alLlegar) {
  const p0 = ovni.pos.clone();
  // punto de control: el medio del camino, empujado hacia afuera del planeta (para que no lo atraviese)
  const medio = p0.clone().add(destino).multiplyScalar(0.5);
  const afuera = medio.clone().sub(ovni.planeta.c);
  const ctrl = ovni.planeta.c.clone().addScaledVector(afuera.normalize(), Math.max(p0.distanceTo(ovni.planeta.c), destino.distanceTo(ovni.planeta.c)) * 1.05);
  ovni.viaje = { p0, ctrl, p1: destino.clone(), t: 0, dur, alLlegar };
  ovni.estado = 'viaje';
}

/** Flotar quieto sobre un punto (con un vaivén suave). */
export function ovniFlotar(centro, arriba) {
  ovni.flota = { centro: centro.clone(), arriba: arriba.clone() };
  ovni.estado = 'flota';
  ovni.vel.set(0, 0, 0);
}

/** Paso de física (1/120 s), lo llama main.js. */
const _prev = new V3();
export function stepOvni(dt, t) {
  if (!ovni.obj) return;
  if (ovni.estado === 'orbita') {
    const P = ovni.planeta;
    const gm = GM(P);
    if (Math.abs(gm - ovni.gmUsado) > 1e-6) {
      // cambió g×: corrige la rapidez para seguir en órbita circular (motores)
      const r = ovni.pos.distanceTo(P.c);
      ovni.vel.setLength(Math.sqrt(gm / r));
      ovni.gmUsado = gm;
    }
    pasoNewton(ovni.pos, ovni.vel, dt);                          // ¡la misma física del jugador!
  } else if (ovni.estado === 'viaje') {
    const v = ovni.viaje;
    v.t = Math.min(1, v.t + dt / v.dur);
    const s = v.t * v.t * (3 - 2 * v.t), u = 1 - s;              // arranca y frena suave
    _prev.copy(ovni.pos);
    ovni.pos.set(0, 0, 0).addScaledVector(v.p0, u * u).addScaledVector(v.ctrl, 2 * u * s).addScaledVector(v.p1, s * s);
    ovni.vel.copy(ovni.pos).sub(_prev).divideScalar(dt);
    if (v.t >= 1) { ovni.estado = 'nada'; ovni.vel.set(0, 0, 0); const f = v.alLlegar; ovni.viaje = null; if (f) f(); }
  } else if (ovni.estado === 'flota') {
    const f = ovni.flota;
    ovni.pos.copy(f.centro).addScaledVector(f.arriba, Math.sin(t * 1.6) * 0.35);
  }
}

/** Dibujo: orientarlo, girar el platillo, luces y rayo. */
const _up = new V3(), _fw = new V3();
export function animarOvni(dt, t) {
  if (!ovni.obj) return;
  ovni.obj.position.copy(ovni.pos);
  // "arriba" del ovni = lejos del planeta más cercano (Columba o Ícaro)
  let P = ovni.planeta, mejor = Infinity;
  for (const Q of mundo.planetas) { const d = ovni.pos.distanceTo(Q.c) - Q.R; if (d < mejor) { mejor = d; P = Q; } }
  _up.copy(ovni.pos).sub(P.c).normalize();
  _fw.copy(ovni.vel); if (_fw.lengthSq() < 1e-4) _fw.set(1, 0, 0).applyAxisAngle(_up, 0.3);
  orient(ovni.obj, _up, _fw);
  // se inclina un poco hacia donde va (como un dron)
  ovni.giro.rotation.x = Math.min(0.35, ovni.vel.length() * 0.012);
  ovni.partes.g.rotation.y += dt * 1.2;
  ovni.partes.piloto.g.rotation.y = -ovni.partes.g.rotation.y;  // el piloto siempre mira adelante
  ovni.partes.luces.forEach((m, i) => m.color.setHex(((i + Math.floor(t * 6)) % 3 === 0) ? 0xfff27a : 0x8cff6b));
  const R = ovni.partes.rayo;
  R.visible = ovni.rayo > 0.1;
  if (R.visible) {
    R.scale.y = ovni.rayo;
    R.material.opacity = 0.16 + Math.sin(t * 12) * 0.05;
  }
}

/** Prender/apagar el rayo (largo en metros). */
export function ovniRayo(largo) { ovni.rayo = largo; }
