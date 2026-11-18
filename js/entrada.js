/* =========================================================
   entrada.js · Controles: pantalla táctil, teclado y mouse
   ---------------------------------------------------------
   Celular: mitad izquierda = joystick; arrastrar en la derecha
   = girar la cámara; botones SALTO, PUÑO, DASH y SÚPER.
   Teclado: WASD/flechas, Espacio, J, K/Shift, L (súper), Q/E, R.

   Los botones no hacen la acción directo: dejan un "pedido"
   (jumpQ, atkQ, dashQ) que dura unos milisegundos. Así, si
   apretaste saltar justo antes de tocar el suelo, igual salta
   (eso se llama "buffer de entrada").
   ========================================================= */
import { CFG } from './config.js';

export const input = {
  jx: 0, jy: 0,                 // joystick (-1 a 1)
  jumpHeld: false, jumpQ: 0,
  atkQ: 0, dashQ: 0,
  superHeld: false,             // botón SÚPER apretado
  camDX: 0, camDY: 0, recenter: false,
};
export const keys = new Set();
export const atajos = { debug: null };   // main.js pone aquí qué hacer con la tecla G

const joyEl = document.getElementById('joy');
const knob = document.getElementById('knob');
const joyHint = document.getElementById('joyHint');
const touch = document.getElementById('touch');
let joyId = null, joyO = { x: 0, y: 0 }, camId = null, camLast = { x: 0, y: 0 };

touch.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
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
  if (e.repeat) return;
  if (e.code === 'Space') { input.jumpQ = CFG.buffer; input.jumpHeld = true; e.preventDefault(); }
  if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'KeyF') input.atkQ = CFG.buffer;
  if (e.code === 'KeyK' || e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashQ = CFG.buffer;
  if (e.code === 'KeyL' || e.code === 'KeyC') input.superHeld = true;
  if (e.code === 'KeyR') input.recenter = true;
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
  input.jumpHeld = input.superHeld = false;
  input.camDX = input.camDY = 0;
}
