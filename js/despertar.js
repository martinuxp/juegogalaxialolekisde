/* =========================================================
   despertar.js · Historia inicial
   ---------------------------------------------------------
   1. DIÁLOGO: pantalla negra; habla alguien que no conocemos.
   2. CINEMÁTICA: plano detalle de los ojos que parpadean al
      despertar → la cámara se aleja rápido pero suave a un
      plano general: el protagonista acostado en una cama de
      flores, en una isla de Columba. Se levanta y empieza.
   Cámara "en mano": le sumamos movimientos seno chiquitos.
   ========================================================= */
import { THREE, V3, clamp } from './util.js';
import { camera } from './escena.js';
import { juego, ajustes } from './estado.js';
import { player, mallaJugador } from './jugador.js';
import { cam } from './camara.js';

const $ = id => document.getElementById(id);

/* ---------------------------------------------------------
   1) DIÁLOGO (texto escrito por el grupo; %NAME% = nombre del jugador)
   --------------------------------------------------------- */
const DIALOGO = [
  '%NAME%… despierta, tienes una misión. Nuestra luna fue robada. Así como escuchas.',
  'Súbete al cañón y recupérala, si no, las mareas de nuestro mundo que mantienen nuestra vida no serán suficientes con el sol para que nuestro aire esté limpio.',
  '¡Ve, %NAME%, tú puedes!',
];

let linea = 0, escribiendo = null, alTerminar = null;

function mostrarLinea() {
  const nombre = ajustes.nombre || 'pequeñ@';
  const txt = DIALOGO[linea].replaceAll('%NAME%', nombre);
  const el = $('hTexto');
  el.textContent = '';
  el.classList.add('ver');
  let i = 0;
  clearInterval(escribiendo);
  escribiendo = setInterval(() => {      // efecto máquina de escribir
    i++;
    el.textContent = txt.slice(0, i);
    if (i >= txt.length) { clearInterval(escribiendo); escribiendo = null; }
  }, 32);
  el.dataset.completo = txt;
}

function avanzar() {
  if (escribiendo) {                       // si todavía escribe, mostrar la línea entera
    clearInterval(escribiendo); escribiendo = null;
    $('hTexto').textContent = $('hTexto').dataset.completo;
    return;
  }
  linea++;
  if (linea >= DIALOGO.length) terminarDialogo();
  else mostrarLinea();
}

function terminarDialogo() {
  clearInterval(escribiendo); escribiendo = null;
  $('historia').classList.add('oculto');
  const fn = alTerminar; alTerminar = null;
  if (fn) fn();
}

export function iniciarDialogo(fin) {
  alTerminar = fin;
  linea = 0;
  $('historia').classList.remove('oculto');
  $('hTexto').classList.remove('ver');
  setTimeout(mostrarLinea, 700);
}
$('historia').addEventListener('pointerdown', e => { if (e.target.id !== 'hSaltar') avanzar(); });
$('hSaltar').addEventListener('pointerdown', e => { e.stopPropagation(); terminarDialogo(); });
addEventListener('keydown', e => {
  if ($('historia').classList.contains('oculto')) return;
  if (e.code === 'Escape') terminarDialogo(); else if (e.code === 'Space' || e.code === 'Enter') avanzar();
});

/* ---------------------------------------------------------
   2) CINEMÁTICA DEL DESPERTAR
   --------------------------------------------------------- */
const cine = { activo: false, t: 0, fin: null };
const DUR = 6.4;

// apertura de los ojos en el tiempo: [segundo, apertura]  (0 = cerrados, 1 = abiertos)
const OJOS = [[0, 0.06], [1.2, 0.06], [1.4, 0.35], [1.65, 0.06], [2.0, 0.06], [2.55, 0.55], [2.65, 0.06], [2.85, 0.6], [3.2, 1.18], [3.6, 1]];
function curva(tabla, t) {
  if (t <= tabla[0][0]) return tabla[0][1];
  for (let i = 1; i < tabla.length; i++) {
    const [t1, v1] = tabla[i];
    if (t <= t1) { const [t0, v0] = tabla[i - 1]; const k = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * k; }
  }
  return tabla[tabla.length - 1][1];
}
const suave = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // easeInOutCubic

const _ojos = new V3(), _cerca = new V3(), _lejos = new V3(), _pos = new V3(), _mira = new V3(), _arriba = new V3();
const _miraLejos = new V3(), _lado = new V3(), _arribaCerca = new V3();

export function iniciarDespertar(fin) {
  cine.activo = true; cine.t = 0; cine.fin = fin;
  player.state = 'dormido'; player.acostado = 1; player.ojos = 0.06; player.invul = 0;
  $('negro').classList.add('ver');
  setTimeout(() => $('negro').classList.remove('ver'), 60);   // aparece desde negro
}

export function saltarDespertar() { if (cine.activo) cine.t = DUR; }

/** Devuelve true mientras la cinemática está corriendo. */
export function actualizarDespertar(dt) {
  if (!cine.activo) return false;
  cine.t += dt;
  const t = cine.t, p = player;

  p.ojos = curva(OJOS, t);
  // se levanta al final
  p.acostado = t < 5.2 ? 1 : 1 - suave(clamp((t - 5.2) / 0.55, 0, 1));

  // plano detalle: frente a los ojos (con el personaje acostado, su cara mira al cielo = p.up)
  mallaJugador.eyes.getWorldPosition(_ojos);
  _cerca.copy(_ojos).addScaledVector(p.up, 0.62);
  _arribaCerca.copy(p.facing).negate();                // la "coronilla" apunta hacia atrás
  // plano general: arriba y al costado, mirando hacia el mar y las islas
  _lado.crossVectors(p.up, p.facing).normalize();
  _lejos.copy(p.pos).addScaledVector(p.up, 6.5).addScaledVector(_lado, 4.5).addScaledVector(p.facing, -4.5);
  _miraLejos.copy(p.pos).addScaledVector(p.facing, 4).addScaledVector(p.up, 0.3);

  const k = suave(clamp((t - 3.55) / 1.6, 0, 1));      // 0 = detalle, 1 = general
  _pos.lerpVectors(_cerca, _lejos, k);
  _mira.lerpVectors(_ojos, _miraLejos, k);
  _arriba.lerpVectors(_arribaCerca, p.up, k).normalize();

  // cámara en mano (más notoria de cerca)
  const a = 0.012 + 0.05 * k;
  _pos.x += Math.sin(t * 1.3) * a + Math.sin(t * 3.1) * a * 0.3;
  _pos.y += Math.sin(t * 1.7 + 1) * a;
  _pos.z += Math.sin(t * 1.1 + 2) * a;
  camera.position.copy(_pos);
  camera.up.copy(_arriba);
  camera.lookAt(_mira);

  if (t >= DUR) {
    cine.activo = false;
    p.state = 'normal'; p.acostado = 0; p.ojos = 1; p.invul = 1;
    // la cámara del juego parte desde donde quedó la cinemática (así el corte es suave)
    cam.pos.copy(camera.position); cam.look.copy(_mira); cam.up.copy(p.up); cam.fwd.copy(p.facing);
    const fn = cine.fin; cine.fin = null;
    if (fn) fn();
  }
  return true;
}
