/* =========================================================
   main.js · Punto de partida y BUCLE PRINCIPAL
   ---------------------------------------------------------
   Modos del juego:
     'menu'     → playa de Columba (columba3d.js)
     'dialogo'  → pantalla negra con el diálogo
     'cine'     → cinemática del despertar
     'juego'    → jugando
     'cartel'   → leyendo un cartel (el juego queda en pausa)
     'completo' → pantalla de nivel completo

   La física avanza a PASO FIJO de 1/120 s: si el celular va
   a 30 FPS, hacemos 4 pasos por cuadro; si va a 60, hacemos 2.
   Así el salto mide lo mismo en cualquier aparato.
   ========================================================= */
import { renderer, scene, camera } from './escena.js';
import { juego, ajustes, guardarAjustes, escuchar } from './estado.js';
import { player, stepPlayer, updatePlayerVisuals } from './jugador.js';
import { stepEnemies, updateEnemyVisuals } from './enemigos.js';
import { stepContacts } from './combate.js';
import { stepFx } from './efectos.js';
import { updateCamera, cam } from './camara.js';
import { animarMundo, piezas } from './mundo.js';
import { cargarNivel, stepNivel } from './nivel.js';
import { stepOvni, animarOvni, ovni } from './ovni.js';
import { stepJefe, pelea } from './jefe.js';
import { actualizarEscape } from './mecanicas/escape.js';
import { actualizarHUD, mostrarHUD, toast, tituloNivel } from './ui.js';
import { mostrarMenu, conectarMenu, abrirPersonaje, jugadorALaPlaya, animarJugadorMenu } from './menu.js';
import { escenaColumba, camColumba, actualizarColumba, camaraPlaya, _depurar } from './columba3d.js';
import { iniciarDialogo, iniciarDespertar, actualizarDespertar, saltarDespertar } from './despertar.js';
import { limpiarEntrada, input } from './entrada.js';
import { pintarIconos } from './iconos.js';
import './dialogo.js';
import { NIVELES, LABORATORIO } from './niveles/index.js';

window.__gameStarted = true;
const $ = id => document.getElementById(id);

/* ---------- cambiar de modo ---------- */
function irAlMenu() {
  juego.modo = 'menu';
  mostrarHUD(false);
  $('saltarCine').classList.add('oculto');
  jugadorALaPlaya(true);
  mostrarMenu(true);
}

function empezarNivel(i, conCine = false) {
  mostrarMenu(false);
  jugadorALaPlaya(false);
  cargarNivel(NIVELES[i]);
  if (conCine) {
    juego.modo = 'cine';
    mostrarHUD(false);
    $('saltarCine').classList.remove('oculto');
    iniciarDespertar(() => {
      $('saltarCine').classList.add('oculto');
      juego.modo = 'juego'; mostrarHUD(true); tituloNivel();
    });
  } else {
    juego.modo = 'juego'; mostrarHUD(true);
  }
}

function historiaYJugar() {
  mostrarMenu(false);
  juego.modo = 'dialogo';
  iniciarDialogo(() => {
    ajustes.historiaVista = true; guardarAjustes();
    empezarNivel(0, true);
  });
}

conectarMenu({
  jugar: () => {
    if (!ajustes.nombre) { abrirPersonaje(() => jugar(), true); return; }   // primero, el nombre
    jugar();
  },
  historia: () => historiaYJugar(),
  laboratorio: () => {
    mostrarMenu(false); jugadorALaPlaya(false);
    cargarNivel(LABORATORIO); juego.modo = 'juego'; mostrarHUD(true);
  },
  nivel: i => empezarNivel(i),
  menu: () => irAlMenu(),
});
function jugar() {
  if (!ajustes.historiaVista) historiaYJugar();
  else empezarNivel(0, true);
}

$('tMenu').onclick = () => irAlMenu();
$('saltarCine').onclick = () => saltarDespertar();
addEventListener('keydown', e => { if (juego.modo === 'cine' && (e.code === 'Escape' || e.code === 'Enter')) saltarDespertar(); });

/* ---------- HORIZONTAL OBLIGATORIO EN CELULAR ----------
   El navegador no deja girar la pantalla solo. Lo que sí podemos:
   1) en vertical, tapar todo con "Gira tu celular" (CSS) y pausar;
   2) en Android, al primer toque pedir pantalla completa y bloquear en horizontal. */
const vertical = matchMedia('(orientation: portrait) and (pointer: coarse)');
addEventListener('pointerdown', async () => {
  if (!matchMedia('(pointer: coarse)').matches || document.fullscreenElement) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation.lock('landscape');
  } catch (e) { /* iPhone y algunos navegadores no lo permiten: queda el aviso de girar */ }
}, { passive: true });

/* ---------- BUCLE PRINCIPAL ---------- */
const DT = 1 / 120;
let last = performance.now(), acc = 0, tiempo = 0;

let tFisica = 0;
function step(dt) {
  tFisica += dt;
  stepPlayer(dt);
  stepEnemies(dt);
  stepContacts();
  stepNivel(dt);
  stepOvni(dt, tFisica);
  stepJefe(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  tiempo += dt;

  if (juego.modo === 'menu') {
    actualizarColumba(dt);
    camaraPlaya(tiempo);
    animarJugadorMenu(tiempo, dt);
    renderer.render(escenaColumba, camColumba);
    return;
  }
  if (juego.modo === 'dialogo') { renderer.clear(); return; }

  const jugando = juego.modo === 'juego' && !vertical.matches;   // en vertical el juego espera
  if (jugando) {
    acc += dt * juego.timeScale;
    let n = 0;
    while (acc >= DT && n < 16) { step(DT); acc -= DT; n++; }
    if (n >= 16) acc = 0;
  } else acc = 0;

  const dtv = jugando ? dt * juego.timeScale : dt;
  updatePlayerVisuals(jugando ? dtv : (juego.modo === 'cine' ? dt : 0), tiempo);
  updateEnemyVisuals(tiempo);
  stepFx(jugando ? dtv : 0);
  animarMundo(dt, tiempo);
  animarOvni(jugando ? dtv : 0, tiempo);
  actualizarEscape(dt);

  if (!actualizarDespertar(vertical.matches ? 0 : dt)) updateCamera(dt);
  renderer.render(scene, camera);
  if (jugando) actualizarHUD(dt);
}

/* ---------- arranque ---------- */
pintarIconos();
irAlMenu();
requestAnimationFrame(frame);

// gancho para pruebas automáticas (Playwright): permite avanzar la física a mano
window.__game = {
  juego, player, step, ajustes, input, cam, piezas, ovni, pelea,
  enemies: () => juego.enemigos,
  jugarNivel: i => { limpiarEntrada(); empezarNivel(i); },
  laboratorio: () => { mostrarMenu(false); jugadorALaPlaya(false); cargarNivel(LABORATORIO); juego.modo = 'juego'; mostrarHUD(true); },
  menu: irAlMenu,
  columba: _depurar,
};
