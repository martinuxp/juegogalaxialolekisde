/* =========================================================
   audio.js · Sonidos y música del juego
   ---------------------------------------------------------
   Usa la Web Audio API del navegador. La idea:

     archivo .wav ──fetch──► bytes ──decode──► AudioBuffer (en memoria)

   Cada vez que algo suena, creamos una "fuente" barata que toca
   ese buffer y la conectamos a esta cadena de volúmenes:

     fuente ─► (volumen del sonido) ─► efectos ─┐
                                                ├─► general ─► parlantes
     música ─────────────────────────► música ──┘

   Así un solo deslizador controla todos los efectos, otro la
   música, y el botón de silencio solo baja "general" a 0.

   OJO CELULAR: iPhone y Android no dejan sonar nada hasta que la
   persona toca la pantalla. Por eso el contexto de audio parte
   "suspendido" y lo despertamos con el primer toque o tecla.

   Este módulo NO toca la física: solo escucha los avisos que
   los otros módulos ya mandan con emitir('...') (estado.js).
   ========================================================= */
import { juego, ajustes, guardarAjustes, escuchar } from './estado.js';
import { icono } from './iconos.js';

/* ---------- LISTA DE SONIDOS ----------
   nombre del evento: { archivo, vol (0 a 1), tono (cuánto varía al azar) }
   Para cambiar qué suena en cada cosa, basta con cambiar el archivo aquí.
   Los archivos viven en la carpeta /sonidos. */
const SONIDOS = {
  dash:          { archivo: 'dash.wav',              vol: 0.7, tono: 0.08 },
  pisoton:       { archivo: 'pisoton.wav',           vol: 0.9, tono: 0.05 },
  dano:          { archivo: 'perder-vida.wav',       vol: 0.9, tono: 0.04 },
  sinVidas:      { archivo: 'sin-vidas.wav',         vol: 0.9 },
  canonDisparo:  { archivo: 'canon-lanzamiento.wav', vol: 1.0 },
  canonVuelo:    { archivo: 'canon-recorrido.wav',   vol: 0.7 },
  alienMuere:    { archivo: 'enemigo1.wav',          vol: 0.6, tono: 0.08 },
  cartel:        { archivo: 'tutorial-notificacion.wav', vol: 0.6 },
  pagina:        { archivo: 'touchoff01.wav',        vol: 0.5, tono: 0.06 },
  uiEncima:      { archivo: 'hover-boton.wav',       vol: 0.35 },
  uiElegir:      { archivo: 'seleccionar-boton.wav', vol: 0.55 },
  uiJugar:       { archivo: 'boton-jugar.wav',       vol: 0.8 },
  // voces de los gatos-alien del tutorial: se elige una al azar
  voz1: { archivo: 'voz-enemigo1.wav', vol: 0.55, tono: 0.1 },
  voz2: { archivo: 'voz-enemigo2.wav', vol: 0.55, tono: 0.1 },
  voz3: { archivo: 'voz-enemigo3.wav', vol: 0.55, tono: 0.1 },
  voz4: { archivo: 'voz-enemigo4.wav', vol: 0.55, tono: 0.1 },
  voz5: { archivo: 'voz-enemigo5.wav', vol: 0.55, tono: 0.1 },
  voz6: { archivo: 'voz-enemigo6.wav', vol: 0.55, tono: 0.1 },
  // FALTAN (si llegan, se agregan aquí y ya suenan): salto, puno, musicaMenu, musicaColumba, musicaJefe
};
const VOCES = ['voz1', 'voz2', 'voz3', 'voz4', 'voz5', 'voz6'];

/* ---------- volúmenes guardados (estado.js los guarda en localStorage) ---------- */
ajustes.volEfectos ??= 0.8;
ajustes.volMusica ??= 0.6;
ajustes.silencio ??= false;

/* ---------- la cadena de volúmenes ---------- */
const AC = window.AudioContext || window.webkitAudioContext;
const ctx = AC ? new AC() : null;                    // navegador muy viejo: el juego sigue mudo
let general, efectos, musica;
if (ctx) {
  general = ctx.createGain(); general.connect(ctx.destination);
  efectos = ctx.createGain(); efectos.connect(general);
  musica = ctx.createGain(); musica.connect(general);
  aplicarVolumen();
}

export function aplicarVolumen() {
  if (!ctx) return;
  const t = ctx.currentTime;
  // setTargetAtTime = cambio suave (en ~50 ms), así no se oye un "clic"
  general.gain.setTargetAtTime(ajustes.silencio ? 0 : 1, t, 0.05);
  efectos.gain.setTargetAtTime(ajustes.volEfectos, t, 0.05);
  musica.gain.setTargetAtTime(ajustes.volMusica * (juego.modo === 'cartel' ? 0.4 : 1), t, 0.2);
}

/* ---------- cargar los archivos ---------- */
const buffers = {};
async function cargar(nombre, def) {
  try {
    const r = await fetch('sonidos/' + def.archivo);
    if (!r.ok) throw new Error(r.status);
    const bytes = await r.arrayBuffer();
    // decodeAudioData con callbacks: así funciona también en Safari viejo
    buffers[nombre] = await new Promise((ok, mal) => ctx.decodeAudioData(bytes, ok, mal));
  } catch (e) { console.warn('[audio] no pude cargar', def.archivo, e); }
}
if (ctx) for (const [n, d] of Object.entries(SONIDOS)) cargar(n, d);

// para las pruebas automáticas (window.__game.audio): qué cargó y qué sonó último
export const _audio = { buffers, ctx, ultimos: [] };

/* ---------- desbloqueo en celular ---------- */
let pedido = false;            // ¿ya hubo un toque? (resume() tarda unos milisegundos en cumplirse)
function despertar() {
  if (!ctx || ctx.state === 'running') return;
  pedido = true;
  ctx.resume();
  // truco de iPhone: tocar un buffer vacío dentro del mismo toque
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050);
  s.connect(ctx.destination); s.start(0);
}
for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) addEventListener(ev, despertar, { capture: true, passive: true });
// al volver a la pestaña, algunos celulares dejan el audio dormido
document.addEventListener('visibilitychange', () => { if (!document.hidden) despertar(); });

/* ---------- tocar un sonido ----------
   opciones: vol (multiplica), tono (velocidad de reproducción: 2 = una octava más agudo) */
export function sonar(nombre, op = {}) {
  const def = SONIDOS[nombre], buf = buffers[nombre];
  if (!ctx || !def || !buf || (ctx.state !== 'running' && !pedido)) return null;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  // tono al azar: el mismo sonido 20 veces seguidas cansa; ±8 % ya lo hace sentir distinto
  const azar = def.tono ? 1 + (Math.random() * 2 - 1) * def.tono : 1;
  s.playbackRate.value = (op.tono || 1) * azar;
  const g = ctx.createGain();
  g.gain.value = def.vol * (op.vol ?? 1);
  s.connect(g).connect(efectos);
  s.start();
  _audio.ultimos.push(nombre); if (_audio.ultimos.length > 20) _audio.ultimos.shift();
  return { s, g };
}

/** Apaga de a poco un sonido que está sonando (lo que devolvió sonar). */
function apagar(h, seg = 0.25) {
  if (!h) return;
  const t = ctx.currentTime;
  h.g.gain.setTargetAtTime(0, t, seg / 3);
  h.s.stop(t + seg);
}

/* =========================================================
   QUÉ SUENA EN CADA EVENTO
   ========================================================= */
escuchar('dash', () => sonar('dash'));
escuchar('pisoton', () => sonar('pisoton'));
escuchar('vida', herido => { if (herido) sonar('dano'); });            // jugador.js: emitir('vida', true) = te pegaron
escuchar('reaparecer', motivo => { if (motivo === 'vida') sonar('sinVidas'); });

// cañón: disparo + el "recorrido" mientras vuelas; al aterrizar se apaga suave
let vuelo = null;
escuchar('despegue', () => { sonar('canonDisparo'); apagar(vuelo); vuelo = sonar('canonVuelo'); });
escuchar('aterrizaje', () => { apagar(vuelo, 0.4); vuelo = null; });

// carteles
escuchar('leer', () => sonar('cartel'));
escuchar('paginaCartel', () => sonar('pagina'));

// enemigos (enemigos.js avisa en cada golpe)
escuchar('golpeEnemigo', e => {
  if (!e.T.gato) return;
  if (e.dead && !e.T.jefe) sonar('alienMuere');
  else voz(e, 1);
});

/** Una voz al azar de los gatos-alien. El jefe usa las mismas, más graves (tono 0.7). */
function voz(e, vol) {
  const n = VOCES[Math.floor(Math.random() * VOCES.length)];
  sonar(n, { vol, tono: e.T.jefe ? 0.7 : 1 });
}

/* ---------- cada cuadro (main.js) ----------
   Los aliens cercanos "conversan" de vez en cuando. El volumen baja con
   la distancia: más lejos, más bajito (como en la vida real, aunque aquí
   lo hacemos lineal y no con la ley del inverso del cuadrado). */
const OIDO = 16;                // a más de 16 m no se escuchan
let charla = 2;
export function actualizarAudio(dt) {
  if (!ctx) return;
  musica.gain.setTargetAtTime(ajustes.volMusica * (juego.modo === 'cartel' ? 0.4 : 1), ctx.currentTime, 0.2);
  if (juego.modo !== 'juego' || !juego.jugador) return;
  charla -= dt;
  if (charla > 0) return;
  charla = 2 + Math.random() * 3;                           // la próxima, en 2 a 5 s
  let cerca = null, dmin = OIDO;
  for (const e of juego.enemigos) {
    if (e.dead || !e.T.gato) continue;
    const d = e.pos.distanceTo(juego.jugador.pos);
    if (d < dmin) { dmin = d; cerca = e; }
  }
  if (cerca) voz(cerca, 1 - dmin / OIDO);
}

/* ---------- botones del menú: encima (PC) y elegir ---------- */
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;                    // en celular no hay "encima"
  const b = e.target.closest('.mb, .tb');
  if (b && !b.contains(e.relatedTarget)) sonar('uiEncima');
});
document.addEventListener('click', e => {
  const b = e.target.closest('.mb, .tb, .swatches button, .seg button');
  if (!b) return;
  sonar(b.id === 'mJugar' ? 'uiJugar' : 'uiElegir');
});

/* ---------- botón de silencio (HUD y menú), tecla M y deslizadores de Personaje ---------- */
const $ = id => document.getElementById(id);
function pintarBotones() {
  for (const id of ['tSonido', 'mSonido']) {
    const b = $(id); if (!b) continue;
    b.innerHTML = icono(ajustes.silencio ? 'silencio' : 'sonido', 2);
    b.classList.toggle('on', !ajustes.silencio);
  }
}
export function alternarSilencio() {
  ajustes.silencio = !ajustes.silencio;
  guardarAjustes(); aplicarVolumen(); pintarBotones();
}
for (const id of ['tSonido', 'mSonido']) if ($(id)) $(id).addEventListener('click', alternarSilencio);
addEventListener('keydown', e => {
  if (e.code === 'KeyM' && !e.repeat && !(e.target instanceof HTMLInputElement)) alternarSilencio();
});
for (const [id, clave] of [['pMusica', 'volMusica'], ['pEfectos', 'volEfectos']]) {
  const r = $(id); if (!r) continue;
  r.value = ajustes[clave];
  r.addEventListener('input', () => { ajustes[clave] = +r.value; aplicarVolumen(); });
  r.addEventListener('change', () => { guardarAjustes(); if (clave === 'volEfectos') sonar('uiElegir'); });   // al soltar: guarda y te deja oír cómo quedó
}
pintarBotones();
