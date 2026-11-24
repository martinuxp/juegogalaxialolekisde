/* =========================================================
   main.js · Punto de partida y BUCLE PRINCIPAL
   ---------------------------------------------------------
   Modos del juego:
     'menu'     → playa de Columba (columba3d.js)
     'dialogo'  → pantalla negra con el diálogo
     'cine'     → cinemática del despertar
     'juego'    → jugando
     'cartel'   → leyendo un cartel (el juego queda en pausa)
     'carga'    → pantalla de carga al escapar (cineDespegue.js)
     'completo' → pantalla de nivel completo
     'editor'   → editor de planetas (js/editor/editor.js)

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
import { actualizarCineDespegue, _despegue } from './cineDespegue.js';
import { actualizarEscape } from './mecanicas/escape.js';
import { actualizarHUD, mostrarHUD, toast, tituloNivel } from './ui.js';
import { mostrarMenu, conectarMenu, abrirPersonaje, jugadorALaPlaya, animarJugadorMenu } from './menu.js';
import { escenaColumba, camColumba, actualizarColumba, camaraPlaya, _depurar } from './columba3d.js';
import { iniciarDialogo, iniciarDespertar, actualizarDespertar, saltarDespertar } from './despertar.js';
import { limpiarEntrada, input } from './entrada.js';
import { pintarIconos } from './iconos.js';
import './dialogo.js';
import { actualizarAudio, _audio } from './audio.js';
import { actualizarMision, _mision } from './mision.js';
import { actualizarCineOvni } from './cineOvni.js';
import { iniciarLlegada, actualizarCineIcaro, saltarCineIcaro, reanudarIcaro, _icaro } from './cineIcaro.js';
import { NIVELES, LABORATORIO, SUPERFICIE_ICARO } from './niveles/index.js';
import { iniciarSalidaSuperficie, actualizarCineSuperficie, saltarCineSuperficie, reanudarSuperficie, guardarParte } from './superficie.js';
import { pm as _meowl } from './meowl.js';
import { mei as _mei } from './meimei.js';
import { iniciarLlegadaKepler, actualizarCineKepler, saltarCineKepler, reanudarKepler, kep as _kepler } from './kepler.js';
import { abrirEditor, frameEditor, conectarEditor, volverAlEditor, ed } from './editor/editor.js';

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

/** Ícaro, parte 2: la superficie. conCine = recién saliste del laberinto (cinemática de llegada). */
function irSuperficie(conCine) {
  mostrarMenu(false);
  jugadorALaPlaya(false);
  cargarNivel(SUPERFICIE_ICARO);
  if (conCine) {
    guardarParte({ tramo: 0 });
    $('saltarCine').classList.remove('oculto');
    iniciarSalidaSuperficie(() => {
      $('saltarCine').classList.add('oculto');
      juego.modo = 'juego'; mostrarHUD(true); tituloNivel();
    });
  } else {
    reanudarSuperficie();
    juego.modo = 'juego'; mostrarHUD(true); tituloNivel();
  }
}
escuchar('irSuperficie', () => irSuperficie(true));     // el laberinto de la cueva termina aquí (nivel2-icaro.js)

function empezarNivel(i, conCine = false) {
  const g = ajustes.guardado;
  if (NIVELES[i].id === 'icaro' && g && g.nivel === 'icaro' && g.parte === 'superficie') { irSuperficie(false); return; }
  mostrarMenu(false);
  jugadorALaPlaya(false);
  cargarNivel(NIVELES[i]);
  if (NIVELES[i].intro === 'kepler') {
    // Kepler: si ya ibas en la carrera (o en la luna), sigues ahí; si no, llegada en el cañón de Ícaro (kepler.js)
    if (reanudarKepler()) { juego.modo = 'juego'; mostrarHUD(true); tituloNivel(); return; }
    $('saltarCine').classList.remove('oculto');
    iniciarLlegadaKepler(() => {
      $('saltarCine').classList.add('oculto');
      juego.modo = 'juego'; mostrarHUD(true); tituloNivel();
    });
    return;
  }
  if (NIVELES[i].intro === 'icaro' && reanudarIcaro()) {
    juego.modo = 'juego'; mostrarHUD(true); tituloNivel();         // ya tenías las botas: sigues en la cueva (o en tu repisa)
  } else if (NIVELES[i].intro === 'icaro') {
    // llegada a Ícaro: choque con el cinturón, caída a la grieta y despertar en la cueva (cineIcaro.js)
    $('saltarCine').classList.remove('oculto');
    iniciarLlegada(() => {
      $('saltarCine').classList.add('oculto');
      juego.modo = 'juego'; mostrarHUD(true); tituloNivel();
    });
  } else if (conCine) {
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
/** JUGAR sigue donde ibas: el primer planeta que no has terminado (o en el que quedaste a medias). */
function nivelGuardado() {
  const g = ajustes.guardado, i = g ? NIVELES.findIndex(n => n.id === g.nivel) : -1;
  return i >= 0 ? i : Math.min(ajustes.nivelesCompletos, NIVELES.length - 1);
}
function jugar() {
  if (!ajustes.historiaVista) historiaYJugar();
  else { const i = nivelGuardado(); empezarNivel(i, i === 0); }
}
escuchar('irMenu', () => irAlMenu());

$('tMenu').onclick = () => ed.probando ? volverAlEditor() : irAlMenu();   // probando un nivel del editor: vuelve al editor
function editor() { mostrarMenu(false); jugadorALaPlaya(false); abrirEditor(); }
$('mEditor').onclick = editor;
conectarEditor(irAlMenu);
$('saltarCine').onclick = () => saltarCineIcaro() || saltarCineSuperficie() || saltarCineKepler() || saltarDespertar();
addEventListener('keydown', e => { if (juego.modo === 'cine' && (e.code === 'Escape' || e.code === 'Enter') && !(e.code === 'Enter' && _icaro.C.activo)) saltarCineIcaro() || saltarCineSuperficie() || saltarCineKepler() || saltarDespertar(); });

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
  if (juego.nivel && juego.nivel.antesDelPaso) juego.nivel.antesDelPaso(dt);   // Kepler: las lunas se mueven y te llevan
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
  actualizarAudio(dt);

  if (juego.modo === 'menu') {
    actualizarColumba(dt);
    camaraPlaya(tiempo);
    animarJugadorMenu(tiempo, dt);
    renderer.render(escenaColumba, camColumba);
    return;
  }
  if (juego.modo === 'dialogo') { renderer.clear(); return; }
  if (juego.modo === 'editor') { frameEditor(dt, tiempo); renderer.render(scene, camera); return; }

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
  if (juego.nivel && juego.nivel.alCuadro) juego.nivel.alCuadro(jugando || juego.modo === 'cine' ? dt : 0, tiempo);   // sol, Meowl, confeti...
  animarOvni(jugando ? dtv : (juego.modo === 'cine' ? dt : 0), tiempo);
  actualizarEscape(dt);

  const dtCine = vertical.matches ? 0 : dt;           // en vertical, la cinemática también espera
  if (!actualizarDespertar(dtCine) && !actualizarCineOvni(dtCine) && !actualizarCineDespegue(dtCine) && !actualizarCineIcaro(dtCine) && !actualizarCineSuperficie(dtCine) && !actualizarCineKepler(dtCine)) updateCamera(dt);
  renderer.render(scene, camera);
  if (jugando) actualizarHUD(dt);
  actualizarMision(jugando ? dt : 0);
}

/* ---------- arranque ---------- */
pintarIconos();
irAlMenu();
if (new URLSearchParams(location.search).has('editor')) editor();   // index.html?editor abre directo el editor
requestAnimationFrame(frame);

// gancho para pruebas automáticas (Playwright): permite avanzar la física a mano
window.__game = {
  juego, player, step, ajustes, input, cam, piezas, ovni, pelea, audio: _audio, mision: _mision, despegue: _despegue,
  enemies: () => juego.enemigos,
  jugarNivel: i => { limpiarEntrada(); empezarNivel(i); },
  laboratorio: () => { mostrarMenu(false); jugadorALaPlaya(false); cargarNivel(LABORATORIO); juego.modo = 'juego'; mostrarHUD(true); },
  menu: irAlMenu,
  columba: _depurar,
  editor: ed, abrirEditor: editor,
  icaro: _icaro,
  superficie: (conCine = false) => { limpiarEntrada(); irSuperficie(conCine); },
  meowl: _meowl,
  kepler: _kepler,
  meimei: _mei,
};
