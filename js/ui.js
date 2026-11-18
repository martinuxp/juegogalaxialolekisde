/* =========================================================
   ui.js · HUD: corazones, objetivo, avisos, barra del
   supersalto, panel de física (DEBUG) y botones de arriba
   ---------------------------------------------------------
   La UI no toca la física: solo LEE el estado del juego y lo
   muestra. Se entera de lo que pasa escuchando eventos
   ('vida', 'objetivo', 'fragmento', 'despegue', ...).
   ========================================================= */
import { juego, ajustes, escuchar } from './estado.js';
import { CFG } from './config.js';
import { mundo, velocidadEscape } from './fisica.js';
import { escape } from './mecanicas/escape.js';
import { spawnEnemies } from './enemigos.js';
import { input, atajos } from './entrada.js';

const $ = id => document.getElementById(id);

/* ---------- corazones y nombre ---------- */
function renderHearts(hit) {
  const p = juego.jugador;
  let s = '';
  for (let i = 0; i < p.maxHP; i++) s += `<span class="${i < p.hp ? '' : 'off'}">❤️</span>`;
  $('hearts').innerHTML = s;
  if (hit) { $('hearts').classList.add('hit'); setTimeout(() => $('hearts').classList.remove('hit'), 150); }
}
escuchar('vida', renderHearts);
export function mostrarNombre() { $('nombreJug').textContent = ajustes.nombre || ''; }

/* ---------- objetivo y avisos ---------- */
escuchar('objetivo', txt => {
  const el = $('objetivo');
  el.textContent = txt || '';
  el.classList.remove('nuevo'); void el.offsetWidth; el.classList.add('nuevo');
});

let toastT = null;
export function toast(html, ms = 2600) {
  const el = $('toast');
  el.innerHTML = html;
  el.classList.add('ver');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('ver'), ms);
}
escuchar('fragmento', () => toast('✦ Fragmento del alma lunar ✦<small>Desbloqueaste el SÚPER SALTO</small>', 3400));
escuchar('reaparecer', motivo => {
  if (motivo === 'vacio') toast('Te perdiste en el espacio…<small>La gravedad era casi cero: nada te atrajo de vuelta</small>', 3200);
  else toast('Sin corazones…<small>Vuelves al inicio del nivel</small>');
});
escuchar('despegue', ({ v, vesc }) => {
  if (v >= vesc) toast(`¡${v.toFixed(1)} m/s ≥ v<sub>esc</sub>!<small>Con esa velocidad no vuelves nunca a este planeta</small>`, 2400);
});
escuchar('nivel', def => {
  document.body.classList.toggle('lab', !!def.laboratorio);
  $('tGrav').textContent = 'g×1.0';
  mostrarNombre();
  // si viene la cinemática, el título se muestra cuando termina (main.js)
  setTimeout(() => { if (!def.laboratorio && juego.modo === 'juego') tituloNivel(); }, 0);
});

export function tituloNivel() {
  const def = juego.nivel;
  toast(`Nivel ${def.numero} · ${def.nombre}<small>${def.ley}</small>`, 3000);
}

/* ---------- botón SÚPER: aparece arriba del cañón (o si ya tienes el supersalto) ---------- */
let etiquetaSuper = '';
function actualizarBotonSuper() {
  const p = juego.jugador;
  const enCanon = !!juego.enCanon;
  $('bSuper').classList.toggle('oculto', !(p.tieneSuper || enCanon));
  $('bSuper').classList.toggle('llamar', enCanon && p.state !== 'carga');   // late para que lo veas
  const txt = enCanon ? 'CAÑÓN' : 'SÚPER';
  if (txt !== etiquetaSuper) { $('bSuper').textContent = txt; etiquetaSuper = txt; }
}

/* ---------- barra del supersalto ---------- */
let resAnterior = '';
function actualizarBarra() {
  const b = $('barra');
  b.classList.toggle('ver', escape.visible);
  if (!escape.visible) return;
  const max = CFG.superMax;
  $('barraLlena').style.width = (100 * Math.min(escape.v, max) / max) + '%';
  $('barraMarca').style.left = (100 * Math.min(escape.vesc, max) / max) + '%';
  $('barraV').textContent = `v = ${escape.v.toFixed(1)} m/s`;
  $('barraVesc').textContent = escape.vesc.toFixed(1);
  const textos = {
    vuelve: 'vuelves a caer',
    llega: escape.destino ? `llegas a ${escape.destino.name || 'una roca'}` : 'llegas',
    escapa: 'te pierdes en el espacio',
  };
  const res = juego.jugador.state === 'carga' ? escape.resultado : '';
  if (res !== resAnterior) { $('barraRes').className = res; resAnterior = res; }
  $('barraRes').textContent = res ? textos[res] : 'volando…';
}

/* ---------- panel DEBUG con la física en vivo ---------- */
let dbgT = 0, fpsAcc = 0, fpsN = 0, fps = 60;
function hudDebug(dt) {
  fpsAcc += dt; fpsN++; dbgT -= dt;
  if (dbgT > 0) return;
  dbgT = 0.12; fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
  const el = $('dbg');
  if (!juego.debug) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const p = juego.jugador, P = p.planet;
  const r = p.pos.distanceTo(P.c);
  const vy = p.vel.dot(p.up), vh = Math.sqrt(Math.max(0, p.vel.lengthSq() - vy * vy));
  const alive = juego.enemigos.filter(e => !e.dead).length;
  el.innerHTML =
`<b>FPS</b> ${fps}   <b>estado</b> ${p.state}   <b>suelo</b> ${p.grounded ? 'sí' : 'no'}
<b>planeta</b> ${P.name}   <b>r</b> ${r.toFixed(1)}   <b>R</b> ${P.R}   <b>g×</b> ${mundo.gravMul}
<b>g = G·M/r²</b> = ${p.gmag.toFixed(1)} m/s²
<b>v</b> horiz ${vh.toFixed(1)} · vert ${vy.toFixed(1)}
<b>v_esc = √(2·G·M/r)</b> = ${velocidadEscape(P, r).toFixed(1)} m/s
<b>enemigos</b> ${alive}/${juego.enemigos.length}`;
}
export function toggleDebug() {
  juego.debug = !juego.debug;
  $('tDbg').classList.toggle('on', juego.debug);
}
atajos.debug = toggleDebug;

/* ---------- botones de arriba ---------- */
$('tDbg').onclick = toggleDebug;
$('tGrav').onclick = e => {
  const opts = [0.5, 1, 1.5, 2];
  mundo.gravMul = opts[(opts.indexOf(mundo.gravMul) + 1) % opts.length];
  e.target.textContent = 'g×' + mundo.gravMul.toFixed(1);
  toast(`Gravedad ×${mundo.gravMul.toFixed(1)}<small>Cambia G·M de todos los planetas: la marca de v<sub>esc</sub> se mueve</small>`, 2200);
};
$('tTime').onclick = e => {
  const opts = [1, 0.5, 0.25];
  juego.timeScale = opts[(opts.indexOf(juego.timeScale) + 1) % opts.length];
  e.target.textContent = '⏱' + juego.timeScale + 'x';
};
$('tEnem').onclick = () => spawnEnemies();
$('tCam').onclick = () => { input.recenter = true; };

/* ---------- se llama una vez por cuadro ---------- */
let lastAtkLabel = '';
export function actualizarHUD(dt) {
  const p = juego.jugador;
  const lbl = p.grounded ? 'PUÑO' : 'PISOTÓN';
  if (lbl !== lastAtkLabel) { $('bAtk').textContent = lbl; lastAtkLabel = lbl; }
  actualizarBotonSuper();
  actualizarBarra();
  hudDebug(dt);
}

export function mostrarHUD(v) { $('hud').classList.toggle('oculto', !v); }
