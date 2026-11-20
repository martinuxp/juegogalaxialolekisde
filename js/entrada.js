/* =========================================================
   entrada.js · Controles: pantalla táctil, teclado y mouse
   ---------------------------------------------------------
   Celular: mitad izquierda = joystick; arrastrar en la derecha
   = girar la cámara; botones SALTO, PUÑO, DASH y SÚPER.
   PC:
     WASD / flechas   moverse
     mouse            girar la cámara (el primer clic "atrapa" el mouse
                      y lo esconde, como en cualquier juego; Esc lo suelta)
     clic o F         puño
     Espacio          salto
     Espacio en el aire o Ctrl       pisotón
     E                leer un cartel
     Shift / K        dash
     L / C            súper (mantener)
     Tab              centrar la cámara

   Los botones no hacen la acción directo: dejan un "pedido"
   (jumpQ, atkQ, dashQ) que dura unos milisegundos. Así, si
   apretaste saltar justo antes de tocar el suelo, igual salta
   (eso se llama "buffer de entrada").
   ========================================================= */
import { CFG } from './config.js';
import { juego } from './estado.js';

export const input = {
  jx: 0, jy: 0,                 // joystick (-1 a 1)
  jumpHeld: false, jumpQ: 0,
  atkQ: 0, dashQ: 0,            // botón de ataque del celular: LEER / PUÑO / PISOTÓN según el caso
  punoQ: 0, poundQ: 0, leerQ: 0, // PC: cada acción tiene su propia tecla
  pisoQ: 0,                     // PC: Ctrl = pisotón directo (sin la regla del metro, ver jugador.js)
  superHeld: false,             // botón SÚPER apretado
  camDX: 0, camDY: 0, recenter: false,
};
export const keys = new Set();
export const atajos = { debug: null, avanzarCartel: null };   // main.js pone la tecla G; dialogo.js, el clic que pasa página

/* ¿Estás jugando con teclado y mouse (PC) o con el dedo?
   Cambia con lo último que usaste. Sirve para que los carteles
   digan "Espacio" o "SALTO" según corresponda. */
export const control = { pc: matchMedia('(pointer: fine)').matches };
function usarPC(v) {
  if (control.pc === v) return;
  control.pc = v;
  document.body.classList.toggle('pc', v);
}
document.body.classList.toggle('pc', control.pc);
addEventListener('pointerdown', e => usarPC(e.pointerType === 'mouse'), true);

/* Textos con controles: en los carteles se escribe {salto}, {puno}...
   y aquí se cambia por el nombre del botón o de la tecla. */
const NOMBRES = {
  //            celular            PC
  mover:   ['el joystick',       'WASD'],
  camara:  ['arrastra a la derecha', 'mueve el mouse (Esc lo suelta)'],
  salto:   ['SALTO',             'Espacio'],
  puno:    ['PUÑO',              'el clic o F'],
  dash:    ['DASH',              'Shift'],
  pisoton: ['PISOTÓN',           'Espacio otra vez (o Ctrl)'],
  leer:    ['LEER',              'E'],
  super:   ['SÚPER',             'L'],
};
export function conControles(txt) {
  return txt.replace(/\{(\w+)\}/g, (m, k) => NOMBRES[k] ? NOMBRES[k][control.pc ? 1 : 0] : m);
}

const joyEl = document.getElementById('joy');
const knob = document.getElementById('knob');
const joyHint = document.getElementById('joyHint');
const touch = document.getElementById('touch');
let joyId = null, joyO = { x: 0, y: 0 }, camId = null, camLast = { x: 0, y: 0 };

touch.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') { atraparMouse(); return; }   // el mouse va por su cuenta (más abajo)
  const leftSide = e.clientX < innerWidth * 0.45 && e.pointerType !== 'mouse';
  if (leftSide && joyId === null) {
    joyId = e.pointerId; joyO = { x: e.clientX, y: e.clientY };
    joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
    joyEl.style.display = 'block'; joyHint.style.display = 'none';
    knob.style.transform = 'translate(0,0)';
  } else if (camId === null) {
    camId = e.pointerId; camLast = { x: e.clientX, y: e.clientY };
  }
  touch.setPointerCapture(e.pointerId);
});
touch.addEventListener('pointermove', e => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyO.x, dy = e.clientY - joyO.y;
    const L = Math.hypot(dx, dy), M = 52;
    if (L > M) { dx *= M / L; dy *= M / L; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const dz = 0.12;                 // zona muerta: movimientos chiquitos no cuentan
    let x = dx / M, y = -dy / M;
    const m = Math.hypot(x, y);
    if (m < dz) { x = 0; y = 0; } else { const k = (m - dz) / (1 - dz) / m; x *= k; y *= k; }
    input.jx = x; input.jy = y;
  } else if (e.pointerId === camId) {
    input.camDX += e.clientX - camLast.x; input.camDY += e.clientY - camLast.y;
    camLast = { x: e.clientX, y: e.clientY };
  }
});
function endPointer(e) {
  if (e.pointerId === joyId) { joyId = null; input.jx = input.jy = 0; joyEl.style.display = 'none'; }
  if (e.pointerId === camId) camId = null;
}
touch.addEventListener('pointerup', endPointer);
touch.addEventListener('pointercancel', endPointer);

/* ---------------------------------------------------------
   MOUSE "ATRAPADO" (Pointer Lock)
   Como en los juegos de PC: el primer clic sobre el juego
   esconde el cursor y lo deja atrapado. Desde ahí, mover el
   mouse gira la cámara sin apretar nada y cada clic es un
   puño. Esc lo suelta (eso lo hace el navegador solo).
   Con el mouse atrapado el navegador ya no nos da la posición
   del cursor, sino cuánto se movió: movementX / movementY.
   --------------------------------------------------------- */
const SENS_MOUSE = 0.4;            // el mouse se mueve mucho más que un dedo: lo achicamos
export const mouseAtrapado = () => document.pointerLockElement === touch;
function atraparMouse() {
  if (juego.modo !== 'juego' || mouseAtrapado()) return;
  try { const pr = touch.requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}); } catch (_) {}
}
/** Suelta el mouse (al volver al menú, a la historia, etc.). */
export function soltarMouse() { if (mouseAtrapado()) document.exitPointerLock(); }
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('atrapado', mouseAtrapado()));
document.addEventListener('mousemove', e => {
  if (!mouseAtrapado()) return;
  // tope por evento: algunos navegadores a veces mandan un salto gigante falso que voltearía la cámara
  const mx = Math.max(-150, Math.min(150, e.movementX)), my = Math.max(-150, Math.min(150, e.movementY));
  input.camDX += mx * SENS_MOUSE; input.camDY += my * SENS_MOUSE;
});
document.addEventListener('mousedown', e => {
  if (!mouseAtrapado() || e.button !== 0) return;
  if (juego.modo === 'juego') input.punoQ = CFG.buffer;
  else if (juego.modo === 'cartel') atajos.avanzarCartel && atajos.avanzarCartel();   // clic = pasar página
});

function bindBtn(id, onDown, onUp) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); el.setPointerCapture(e.pointerId); onDown(); });
  const up = () => { el.classList.remove('down'); onUp && onUp(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  return el;
}
bindBtn('bJump', () => { input.jumpQ = CFG.buffer; input.jumpHeld = true; }, () => { input.jumpHeld = false; });
bindBtn('bAtk', () => { input.atkQ = CFG.buffer; });
bindBtn('bDash', () => { input.dashQ = CFG.buffer; });
bindBtn('bSuper', () => { input.superHeld = true; }, () => { input.superHeld = false; });

addEventListener('keydown', e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // escribiendo (nombre, editor)
  keys.add(e.code);
  usarPC(true);
  if (e.code === 'Tab') e.preventDefault();          // si no, el navegador mueve el foco entre botones
  if (e.repeat) return;
  if (e.code === 'Space') {
    // el mismo Espacio pide las dos cosas; jugador.js decide: en el suelo salta, en el aire pisotea
    input.jumpQ = CFG.buffer; input.poundQ = CFG.buffer; input.jumpHeld = true; e.preventDefault();
  }
  if (e.code === 'KeyF') input.punoQ = CFG.buffer;
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') input.pisoQ = CFG.buffer;
  // con Ctrl apretado, Ctrl+S / Ctrl+D / Ctrl+A serían "guardar página", "marcador"... los bloqueamos.
  // (Ctrl+W, cerrar pestaña, el navegador NO deja bloquearlo)
  if (e.ctrlKey && /^Key[WASD]$/.test(e.code)) e.preventDefault();
  if (e.code === 'KeyE') input.leerQ = CFG.buffer;
  if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashQ = CFG.buffer;
  if (e.code === 'KeyL' || e.code === 'KeyC') input.superHeld = true;
  if (e.code === 'Tab') input.recenter = true;
  if ((e.code === 'KeyG' || e.code === 'Backquote') && atajos.debug) atajos.debug();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'Space') input.jumpHeld = false;
  if (e.code === 'KeyL' || e.code === 'KeyC') input.superHeld = false;
});
addEventListener('blur', () => { keys.clear(); input.jumpHeld = false; input.superHeld = false; });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

/** Borra todo lo pendiente (al cambiar de nivel o volver al menú). */
export function limpiarEntrada() {
  input.jx = input.jy = 0;
  input.jumpQ = input.atkQ = input.dashQ = 0;
  input.punoQ = input.poundQ = input.leerQ = input.pisoQ = 0;
  input.jumpHeld = input.superHeld = false;
  input.camDX = input.camDY = 0;
}
