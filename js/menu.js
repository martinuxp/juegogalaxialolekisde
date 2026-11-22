/* =========================================================
   menu.js · Menú inicial, panel de Personaje y fin de nivel
   ---------------------------------------------------------
   Personalización (rúbrica: dos o más aspectos que se notan):
   - color del traje (5)      - accesorio del casco (3)
   - nombre (sale en el HUD y en el diálogo)
   - dificultad: corazones 7 / 5 / 3
   (en el juego también está g×, el multiplicador de gravedad)
   El protagonista se ve en la playa del menú, así los cambios
   se notan al tiro.
   ========================================================= */
import { scene, orient } from './escena.js';
import { V3 } from './util.js';
import { juego, ajustes, guardarAjustes, escuchar } from './estado.js';
import { DIFICULTADES } from './config.js';
import { mallaJugador, applyLook, SUITS, SUIT_NOMBRES, ACCS, ACC_NOMBRES } from './jugador.js';
import { escenaColumba, PLAYA, estadoSegunProgreso } from './columba3d.js';
import { NIVELES } from './niveles/index.js';
import { icono } from './iconos.js';
import { HISTORIAL, VERSION } from './version.js';

const $ = id => document.getElementById(id);
const acciones = { jugar: null, historia: null, laboratorio: null, nivel: null };
/** main.js conecta aquí qué hace cada botón. */
export function conectarMenu(a) { Object.assign(acciones, a); }

/* ---------- protagonista en la playa ---------- */
export function jugadorALaPlaya(si) {
  const g = mallaJugador.group;
  if (si) {
    escenaColumba.add(g);
    g.position.copy(PLAYA.pos).addScaledVector(PLAYA.arriba, 0.6);
    orient(g, PLAYA.arriba, PLAYA.haciaMar);
    g.visible = true;
    mallaJugador.body.rotation.set(0, 0, 0);
    mallaJugador.body.position.set(0, 0, 0);
    mallaJugador.body.scale.set(1, 1, 1);
    mallaJugador.shadow.visible = false;
  } else {
    scene.add(g);
  }
}
/** Respira y parpadea mirando el mar. */
export function animarJugadorMenu(t, dt) {
  const m = mallaJugador;
  m.body.scale.y = 1 + Math.sin(t * 1.6) * 0.015;
  m.eyes.scale.y = (t % 4.1) < 0.13 ? 0.1 : 1;
  m.planet.rotation.y += dt * 0.4;
  m.head.rotation.y = Math.sin(t * 0.23) * 0.25;   // mira de a poco hacia los lados
  const ma = t * 1.8; m.moon.position.set(Math.cos(ma) * 0.35, Math.sin(ma) * 0.12, Math.sin(ma) * 0.35);
}

/* ---------- menú ---------- */
export function mostrarMenu(si) {
  $('menu').classList.toggle('oculto', !si);
  if (!si) { mallaJugador.head.rotation.y = 0; return; }
  estadoSegunProgreso(ajustes.historiaVista, ajustes.nivelesCompletos);
  $('menuSub').textContent = !ajustes.historiaVista
    ? 'El mar de Columba sube y baja con su luna.'
    : ajustes.nivelesCompletos === 0 ? 'Sin su luna, el mar de Columba se quedó quieto.'
    : `El mar vuelve a moverse · ${ajustes.nivelesCompletos} de 5`;
  $('mHistoria').classList.toggle('oculto', !ajustes.historiaVista);
  // PLANETAS: Jugar sigue donde ibas; aquí puedes volver a uno que ya abriste
  const abiertos = NIVELES.slice(0, Math.min(ajustes.nivelesCompletos + 1, NIVELES.length));
  $('mPlanetas').classList.toggle('oculto', abiertos.length < 2);
  $('mPlanetas').innerHTML = '';
  abiertos.forEach((n, i) => {
    const b = document.createElement('button');
    b.className = 'mb chico'; b.textContent = n.nombre;
    b.onclick = () => acciones.nivel(i);
    $('mPlanetas').append(b);
  });
  $('menuPie').textContent = 'Física 2° medio · Unidad IV: El Universo · ';
  // versión (tocarla muestra el historial de cambios, ver version.js)
  const bv = document.createElement('button');
  bv.id = 'menuVersion'; bv.textContent = `v${VERSION} · ${HISTORIAL[0].fecha}`;
  bv.onclick = () => $('menuHistorial').classList.toggle('oculto');
  $('menuPie').append(bv);
  $('menuHistorial').innerHTML = HISTORIAL.map(h => `<li><b>v${h.v}</b> <span>${h.fecha}</span> ${h.cambios}</li>`).join('');
}
$('mJugar').onclick = () => acciones.jugar();
$('mHistoria').onclick = () => acciones.historia();
$('mLab').onclick = () => acciones.laboratorio();
$('mPersonaje').onclick = () => abrirPersonaje();

/* ---------- personaje ---------- */
let despuesDePersonaje = null;
export function abrirPersonaje(luego = null, pedirNombre = false) {
  despuesDePersonaje = luego;
  $('personaje').classList.remove('oculto');
  $('pNombre').value = ajustes.nombre;
  $('pNombre').placeholder = pedirNombre ? '¿Cómo te llamas?' : 'Tu nombre';
  pintarPersonaje();
  if (pedirNombre) setTimeout(() => $('pNombre').focus(), 50);
}
function pintarPersonaje() {
  $('pTrajes').innerHTML = '';
  SUITS.forEach((c, i) => {
    const b = document.createElement('button');
    b.style.background = '#' + c.toString(16).padStart(6, '0');
    b.title = SUIT_NOMBRES[i];
    b.className = i === ajustes.traje ? 'on' : '';
    b.onclick = () => { ajustes.traje = i; applyLook(); guardarAjustes(); pintarPersonaje(); };
    $('pTrajes').appendChild(b);
  });
  $('pAcc').innerHTML = `<span>${ACC_NOMBRES[ajustes.accesorio]}</span>${icono('flecha', 2)}`;
  $('pDif').innerHTML = '';
  for (const [k, d] of Object.entries(DIFICULTADES)) {
    const b = document.createElement('button');
    b.innerHTML = `${d.nombre} <span class="dCor">${icono('corazon')}${d.corazones}</span>`;
    b.className = k === ajustes.dificultad ? 'on' : '';
    b.onclick = () => { ajustes.dificultad = k; guardarAjustes(); pintarPersonaje(); };
    $('pDif').appendChild(b);
  }
}
$('pAcc').onclick = () => { ajustes.accesorio = (ajustes.accesorio + 1) % ACCS.length; applyLook(); guardarAjustes(); pintarPersonaje(); };
$('pNombre').addEventListener('input', () => { ajustes.nombre = $('pNombre').value.trim(); guardarAjustes(); });
$('pNombre').addEventListener('keydown', e => { if (e.key === 'Enter') $('pListo').click(); });
$('pListo').onclick = () => {
  ajustes.nombre = $('pNombre').value.trim();
  guardarAjustes();
  $('personaje').classList.add('oculto');
  const fn = despuesDePersonaje; despuesDePersonaje = null;
  if (fn) fn();
};

/* ---------- nivel completo ---------- */
escuchar('completo', ({ def, tiempo }) => {
  if (def.editor) return;                  // probando un nivel del editor: lo maneja js/editor/editor.js
  setTimeout(() => {
    const sig = NIVELES[def.numero];        // el siguiente (los números parten en 1)
    const m = Math.floor(tiempo / 60), s = Math.floor(tiempo % 60).toString().padStart(2, '0');
    $('cTitulo').textContent = def.meta && def.meta.escapar ? `¡Escapaste de ${def.planetas[0].name}!` : '¡Nivel completo!';
    $('cTexto').innerHTML = `Nivel ${def.numero} · ${def.nombre} · ${m}:${s}` +
      (sig ? '' : '<br><br>El siguiente planeta está en construcción.');
    $('cSeguir').classList.toggle('oculto', !sig);
    $('completo').classList.remove('oculto');
    juego.modo = 'completo';
  }, 1300);
});
$('cSeguir').onclick = () => {
  $('completo').classList.add('oculto');
  if (juego.nivel.numero < NIVELES.length) acciones.nivel(juego.nivel.numero); else acciones.menu();   // el último planeta hecho: vuelve al menú
};
$('cRepetir').onclick = () => { $('completo').classList.add('oculto'); acciones.nivel(juego.nivel.numero - 1); };
$('cMenu').onclick = () => { $('completo').classList.add('oculto'); acciones.menu(); };
