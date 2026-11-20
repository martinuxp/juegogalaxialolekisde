/* =========================================================
   cineOvni.js · Cinemática: el ovni llega a la arena
   ---------------------------------------------------------
   Estilo caricatura. NO es física (igual que los viajes del
   ovni): es animación, con tres trucos clásicos del dibujo animado:

   1) ZIGZAG: baja del cielo por una curva de Bézier y además se
      mece de lado a lado (un seno que se va achicando).
   2) SE PASA DE LARGO y vuelve como un RESORTE:
         x(t) = x0 · e^(−β·t) · cos(ω·t)
      Es un oscilador amortiguado: oscila (cos) y cada vez
      menos (la exponencial). β = 4 (cuánto frena), ω = 13 rad/s.
   3) ESTIRAR Y APLASTAR: mientras va rápido se ve más plano y
      largo; al frenar se aplasta y rebota. Para que parezca el
      mismo objeto, el volumen no cambia:  ancho² · alto = 1
      → ancho = 1/√alto.

   Mientras dura, el juego está en pausa (modo 'cine') y la
   cámara mira desde atrás del jugador hacia el cielo.
   ========================================================= */
import { V3, tangent, damp } from './util.js';
import { camera } from './escena.js';
import { juego, emitir } from './estado.js';
import { ovni, ovniFlotar } from './ovni.js';
import { cam } from './camara.js';
import { mostrarHUD } from './ui.js';
import { limpiarEntrada } from './entrada.js';

const VUELO = 1.9, RESORTE = 1.3, QUIETO = 0.6;
const DUR = VUELO + RESORTE + QUIETO;                // 3,8 s en total

const c = {
  activo: false, t: 0, fin: null, boing: false,
  hover: new V3(), arriba: new V3(), lado: new V3(), suelo: new V3(),
  desde: new V3(), ctrl: new V3(), pasa: new V3(),
  camPos: new V3(), mira: new V3(),
};
const _prev = new V3(), _d = new V3(), _hacia = new V3(), _pos = new V3();

/** hover = punto donde quedará flotando; arriba = "arriba" de la arena; suelo = centro de la arena; fin = qué hacer al terminar. */
export function iniciarLlegadaOvni(hover, arriba, suelo, fin) {
  const p = juego.jugador;
  c.activo = true; c.t = 0; c.fin = fin; c.boing = false;
  c.hover.copy(hover); c.arriba.copy(arriba); c.suelo.copy(suelo);
  // dirección (por el suelo) desde el jugador hacia la arena
  tangent(_hacia, _d.copy(hover).sub(p.pos), arriba);
  if (_hacia.lengthSq() < 1e-4) tangent(_hacia, cam.fwd, arriba);
  _hacia.normalize();
  c.lado.crossVectors(arriba, _hacia).normalize();
  // entra desde el cielo, lejos y de costado; se pasa 3 m de largo y un poco más abajo
  c.desde.copy(hover).addScaledVector(arriba, 40).addScaledVector(_hacia, 30).addScaledVector(c.lado, -35);
  c.ctrl.copy(hover).addScaledVector(arriba, 10).addScaledVector(c.lado, 22);
  c.pasa.copy(hover).addScaledVector(_hacia, -3).addScaledVector(arriba, -1.5);
  // cámara: detrás del jugador y un poco arriba; se ven el jugador, la arena y el cielo
  c.camPos.copy(p.pos).addScaledVector(_hacia, -8).addScaledVector(p.up, 3.5).addScaledVector(c.lado, 2.5);
  c.mira.copy(c.desde).multiplyScalar(0.55).addScaledVector(suelo, 0.45);
  ovni.estado = 'cine'; ovni.viaje = null; ovni.flota = null;
  ovni.pos.copy(c.desde);
  juego.modo = 'cine';
  mostrarHUD(false);
  emitir('ovniLlega');
}

function bezier(out, a, b, d, s) {
  const u = 1 - s;
  return out.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(b, 2 * u * s).addScaledVector(d, s * s);
}

/** Devuelve true mientras la cinemática está corriendo (main.js no mueve la cámara del juego). */
export function actualizarCineOvni(dt) {
  if (!c.activo) return false;
  c.t += dt;
  const t = c.t;
  _prev.copy(ovni.pos);
  let alto = 1;

  if (t < VUELO) {
    const k = t / VUELO, s = 1 - (1 - k) ** 3;       // llega rápido y frena (easeOutCubic)
    bezier(ovni.pos, c.desde, c.ctrl, c.pasa, s);
    ovni.pos.addScaledVector(c.lado, Math.sin(k * Math.PI * 4) * 4 * (1 - k));   // zigzag que se achica
  } else {
    const tt = t - VUELO;
    if (!c.boing) { c.boing = true; emitir('ovniBoing'); }
    const x = Math.exp(-4 * tt) * Math.cos(13 * tt); // resorte amortiguado
    ovni.pos.copy(c.hover).addScaledVector(_d.copy(c.pasa).sub(c.hover), x);
    alto = 1 - 0.35 * Math.exp(-5 * tt) * Math.cos(18 * tt);   // aplastón y rebote
  }
  ovni.vel.copy(ovni.pos).sub(_prev).divideScalar(Math.max(dt, 1e-4));
  if (t < VUELO) alto = 1 - Math.min(0.3, ovni.vel.length() * 0.006);   // rápido = estirado
  const ancho = 1 / Math.sqrt(alto);                 // mismo volumen
  if (ovni.giro) ovni.giro.scale.set(ancho, alto, ancho);

  // cámara: mira entre el ovni y la arena (55 % / 45 %), con un poquito de retraso,
  // así parte mirando al cielo y baja junto con él; tiembla en el aplastón
  _d.copy(ovni.pos).multiplyScalar(0.55).addScaledVector(c.suelo, 0.45);
  c.mira.lerp(_d, damp(5, dt));
  _pos.copy(c.camPos);
  if (c.boing && t - VUELO < 0.35) _pos.addScaledVector(c.lado, Math.sin(t * 90) * 0.08);
  camera.position.copy(_pos);
  camera.up.copy(juego.jugador.up);
  camera.lookAt(c.mira);

  if (t >= DUR) terminar();
  return true;
}

function terminar() {
  c.activo = false;
  if (ovni.giro) ovni.giro.scale.set(1, 1, 1);
  ovniFlotar(c.hover, c.arriba);
  juego.modo = 'juego';
  mostrarHUD(true);
  limpiarEntrada();
  // la cámara del juego parte desde donde quedó la cinemática (corte suave, como en despertar.js)
  const p = juego.jugador;
  cam.pos.copy(camera.position); cam.look.copy(c.mira); cam.up.copy(p.up);
  tangent(cam.fwd, _d.copy(c.hover).sub(p.pos), p.up);
  if (cam.fwd.lengthSq() < 1e-4) cam.fwd.copy(p.facing);
  cam.fwd.normalize();
  const fn = c.fin; c.fin = null;
  if (fn) fn();
}

/** Si cambias de nivel o vuelves al menú a la mitad, se corta sin llamar a fin. */
export function cortarCineOvni() {
  if (!c.activo) return;
  c.activo = false; c.fin = null;
  if (ovni.giro) ovni.giro.scale.set(1, 1, 1);
}
