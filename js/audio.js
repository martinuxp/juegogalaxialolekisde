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
  // MÚSICA del primer jefe, en 3 trozos (musica: true = va por el volumen de Música)
  jefeEntrada: { archivo: 'boss1-fadein.mp3',  vol: 1, musica: true },              // aparece el jefe
  jefeLoop:    { archivo: 'boss1-loop.mp3',    vol: 1, musica: true, loop: true },  // toca el suelo: se repite
  jefeSalida:  { archivo: 'boss1-fadeout.mp3', vol: 1, musica: true },              // lo derrotas
  // MÚSICA de fondo de cada planeta (el nivel dice cuál con  musica: 'columba').
  // loopDe = [inicio, fin] en segundos: la canción termina en silencio, así que el loop
  // da la vuelta antes de ese silencio para no dejar un hueco.
  columba:     { archivo: 'columba.mp3', vol: 0.8, musica: true, loop: true, loopDe: [0.35, 54.8] },
  // TENSIÓN al entrar a la arena y SONIDOS DE NAVE: los generamos nosotros con
  // herramientas/generar-sonidos.py (sumas de ondas, nada grabado)
  tension:      { archivo: 'tension-loop.wav',  vol: 0.9, musica: true, loop: true },
  tensionGolpe: { archivo: 'tension-golpe.wav', vol: 0.9 },
  ovniLlega:    { archivo: 'ovni-llegada.wav',  vol: 0.8 },
  ovniBoing:    { archivo: 'ovni-boing.wav',    vol: 0.7 },
  ovniRayo:     { archivo: 'ovni-rayo.wav',     vol: 0.45, tono: 0.06 },
  ovniHuye:     { archivo: 'ovni-huida.wav',    vol: 0.7 },
  // JUGADOR (también generados con herramientas/generar-sonidos.py)
  salto:        { archivo: 'salto.wav',         vol: 0.45, tono: 0.06 },
  paso1:        { archivo: 'paso1.wav',         vol: 0.35, tono: 0.1 },
  paso2:        { archivo: 'paso2.wav',         vol: 0.35, tono: 0.1 },
  paso3:        { archivo: 'paso3.wav',         vol: 0.35, tono: 0.1 },
  puno:         { archivo: 'puno.wav',          vol: 0.6,  tono: 0.1 },
  tocaSuelo:    { archivo: 'tocar-suelo.wav',   vol: 0.6,  tono: 0.08 },
  chapuzon:     { archivo: 'chapuzon.wav',      vol: 0.7,  tono: 0.05 },
  // ESPACIO: despegue a otro planeta y pantalla de carga
  despegueRugido: { archivo: 'despegue-rugido.wav', vol: 0.9 },
  espacio:      { archivo: 'espacio-loop.wav',  vol: 0.9, musica: true, loop: true },
  cargaTarjeta: { archivo: 'carga-tarjeta.wav', vol: 0.35, tono: 0.03 },
  cargaLista:   { archivo: 'carga-lista.wav',   vol: 0.55 },
  nivelCompleto:{ archivo: 'nivel-completo.wav', vol: 0.7 },
  // ÍCARO: llegada (cineIcaro.js) y cueva. Todos generados con herramientas/generar-sonidos.py
  llegadaIcaro: { archivo: 'llegada-icaro.wav', vol: 0.9, musica: true },
  choque:       { archivo: 'choque.wav',        vol: 1.0 },
  caidaGrieta:  { archivo: 'caida-grieta.wav',  vol: 0.8 },
  golpeCueva:   { archivo: 'golpe-cueva.wav',   vol: 0.9 },
  cueva:        { archivo: 'cueva-loop.wav',    vol: 0.8, musica: true, loop: true },
  misteriosa:   { archivo: 'misteriosa-loop.wav', vol: 0.75, musica: true, loop: true },
  ojosRojos:    { archivo: 'ojos-rojos.wav',    vol: 0.8 },
  vozM1:        { archivo: 'voz-misteriosa1.wav', vol: 0.35, tono: 0.06 },
  vozM2:        { archivo: 'voz-misteriosa2.wav', vol: 0.35, tono: 0.06 },
  vozM3:        { archivo: 'voz-misteriosa3.wav', vol: 0.35, tono: 0.06 },
  botas:        { archivo: 'botas.wav',         vol: 0.8 },
  // FALTA (si llega, se agrega aquí y ya suena): musicaMenu
};
const PASOS = ['paso1', 'paso2', 'paso3'];
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
const bordes = {};             // [inicio, fin] en segundos del trozo que se repite

/* El MP3 agrega unos milisegundos de silencio al principio y al final
   (relleno del codificador). Si el loop los incluye, se oye un "tic"
   en cada vuelta. Buscamos dónde empieza y termina el sonido de verdad,
   mirando solo los primeros y últimos ~50 ms. */
function bordesDelLoop(buf) {
  const n = buf.length, max = Math.min(2400, n >> 2), canales = [];
  for (let c = 0; c < buf.numberOfChannels; c++) canales.push(buf.getChannelData(c));
  const suena = i => canales.some(d => Math.abs(d[i]) > 1e-4);
  let a = 0, b = n - 1;
  while (a < max && !suena(a)) a++;
  while (b > n - 1 - max && !suena(b)) b--;
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
}
async function cargar(nombre, def) {
  try {
    const r = await fetch('sonidos/' + def.archivo);
    if (!r.ok) throw new Error(r.status);
    const bytes = await r.arrayBuffer();
    // decodeAudioData con callbacks: así funciona también en Safari viejo
    buffers[nombre] = await new Promise((ok, mal) => ctx.decodeAudioData(bytes, ok, mal));
    if (def.loop) bordes[nombre] = def.loopDe || bordesDelLoop(buffers[nombre]);
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
   opciones: vol (multiplica), tono (velocidad de reproducción: 2 = una octava más agudo),
             cuando (segundo del reloj de audio en que parte; por defecto, ya),
             subir (segundos que tarda en aparecer el volumen: fade in) */
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
  if (op.subir) { const v = g.gain.value; g.gain.value = 0; g.gain.setTargetAtTime(v, ctx.currentTime, op.subir / 3); }
  if (def.loop) { s.loop = true; [s.loopStart, s.loopEnd] = bordes[nombre]; }
  s.connect(g).connect(def.musica ? musica : efectos);
  s.start(Math.max(op.cuando || 0, ctx.currentTime), def.loop ? s.loopStart : 0);
  _audio.ultimos.push(nombre); if (_audio.ultimos.length > 20) _audio.ultimos.shift();
  return { s, g };
}

/** Apaga de a poco un sonido que está sonando (lo que devolvió sonar). */
function apagar(h, seg = 0.25) {
  if (!h) return;
  const t = ctx.currentTime;
  h.g.gain.setTargetAtTime(0, t, seg / 3);
  try { h.s.stop(t + seg); } catch (e) { /* ya había terminado */ }
}

/* =========================================================
   MÚSICA DEL JEFE: entrada → loop → salida
   ---------------------------------------------------------
   Todo se programa con ctx.currentTime, el reloj de la tarjeta
   de sonido (exacto a la muestra), no con setTimeout (que se
   atrasa si el celular está ocupado dibujando).
   ========================================================= */
const tema = { entrada: null, loop: null, finEntrada: 0 };
function callarTema(seg) {
  apagar(tema.entrada, seg); apagar(tema.loop, seg);
  tema.entrada = tema.loop = null;
}
// jefe.js manda emitir('jefe', {hp, max}) al aparecer y en cada golpe: solo la primera vez cuenta
escuchar('jefe', d => {
  if (!d || tema.entrada || tema.loop || !buffers.jefeEntrada) return;
  tema.entrada = sonar('jefeEntrada');
  tema.finEntrada = ctx.currentTime + buffers.jefeEntrada.duration;
});
// toca el suelo: parte el loop. Si la entrada aún no termina, espera a que termine
// (son centésimas: el jefe cae ~0,8 s y la entrada dura 0,86 s) para que calce con la música.
escuchar('jefeAterriza', () => {
  if (tema.loop) return;
  tema.loop = sonar('jefeLoop', { cuando: tema.finEntrada });
});
escuchar('jefeVencido', () => { callarTema(0.15); sonar('jefeSalida'); });

/* =========================================================
   MÚSICA DE FONDO Y ZONA DE COMBATE
   ---------------------------------------------------------
   zona 'calma'   → suena la música del planeta (columba.mp3)
   zona 'combate' → la música se apaga en 1,5 s, golpe grave y
                    entra el loop de TENSIÓN, hasta que aparece
                    el jefe (ahí parte su música, arriba)
   Al ganar, la música del planeta vuelve cuando termina el
   fadeout del jefe. Si pierdes, vuelve de inmediato.
   ========================================================= */
const fondo = { nombre: null, h: null, zona: 'calma', calmaDesde: 0, tension: null, espacio: null };
function callarTension(seg) { apagar(fondo.tension, seg); fondo.tension = null; }
function calma(desde = 0) { fondo.zona = 'calma'; fondo.calmaDesde = desde; callarTension(0.8); }

escuchar('nivel', def => {
  callarTema(0.3); calma(); salirDelEspacio(0.5);
  if (fondo.nombre !== (def.musica || null)) { apagar(fondo.h, 0.3); fondo.h = null; }
  fondo.nombre = def.musica || null;
});
// una cinemática puede cambiar la música de fondo: emitir('musica', 'misteriosa') o null (silencio)
escuchar('musica', nombre => {
  if (fondo.nombre === nombre) return;
  apagar(fondo.h, 1.5); fondo.h = null;
  fondo.nombre = nombre;
});
escuchar('arena', () => {                              // jefe.js: pisaste la arena
  fondo.zona = 'combate';
  sonar('tensionGolpe');
  if (!fondo.tension) fondo.tension = sonar('tension', { subir: 1.5 });
});
escuchar('jefe', d => { if (d) callarTension(0.8); });                 // aparece el jefe: manda su música
escuchar('reaparecer', () => { callarTema(0.6); if (fondo.zona === 'combate') calma(); });   // la pelea parte de nuevo
escuchar('jefeVencido', () => calma(ctx ? ctx.currentTime + (buffers.jefeSalida ? buffers.jefeSalida.duration : 0) : 0));

// la nave (cineOvni.js y jefe.js)
escuchar('ovniLlega', () => sonar('ovniLlega'));
escuchar('ovniBoing', () => sonar('ovniBoing'));
escuchar('rayo', () => sonar('ovniRayo'));
escuchar('ovniHuye', () => sonar('ovniHuye'));

/** Cada cuadro: ¿debería sonar la música del planeta? Si sí y no suena, entra suave; si no, sale suave. */
function dirigirFondo() {
  const jugando = ['juego', 'cartel', 'cine'].includes(juego.modo);
  const quiere = jugando && !fondo.espacio && fondo.nombre && fondo.zona === 'calma' && ctx.currentTime >= fondo.calmaDesde;
  if (quiere && !fondo.h) fondo.h = sonar(fondo.nombre, { subir: 2.5 });
  if (!quiere && fondo.h) { apagar(fondo.h, 1.5); fondo.h = null; }
  if (!jugando && fondo.tension) callarTension(0.5);
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

/* =========================================================
   VIAJE AL ESPACIO (cineDespegue.js)
   ---------------------------------------------------------
   Escapaste: el silbido del cañón se corta, ruge el despegue
   (que se va poniendo grave: efecto Doppler, algo que se aleja
   suena más grave) y entra la música ambiente del espacio, que
   sigue en la pantalla de carga hasta que aprietas Seguir.
   ========================================================= */
function salirDelEspacio(seg) { apagar(fondo.espacio, seg); fondo.espacio = null; }
escuchar('cineDespegue', () => {
  apagar(vuelo, 0.6); vuelo = null;
  apagar(fondo.h, 1.2); fondo.h = null;                 // la música del planeta se despide
  sonar('despegueRugido');
  if (!fondo.espacio) fondo.espacio = sonar('espacio', { subir: 3 });
});
escuchar('cargaTarjeta', () => sonar('cargaTarjeta'));
escuchar('cargaLista', () => sonar('cargaLista'));
escuchar('cargaFin', () => salirDelEspacio(2.5));
escuchar('completo', () => sonar('nivelCompleto'));

/* =========================================================
   ÍCARO: llegada (cineIcaro.js) y cueva
   ========================================================= */
let llegada = null;
escuchar('icaroLlegada', () => { apagar(llegada); llegada = sonar('llegadaIcaro'); });
escuchar('choqueCinturon', () => sonar('choque'));
escuchar('caidaGrieta', () => sonar('caidaGrieta'));
escuchar('caeCueva', () => { apagar(llegada, 0.5); llegada = null; sonar('golpeCueva'); });
escuchar('ojosRojos', () => sonar('ojosRojos'));
escuchar('botas', () => sonar('botas'));
// la voz de la personaje: una sílaba al azar cada 3 letras (dialogo.js)
const VOZ_M = ['vozM1', 'vozM2', 'vozM3'];
escuchar('vozLetra', () => sonar(VOZ_M[Math.floor(Math.random() * VOZ_M.length)]));
escuchar('nivel', () => { apagar(llegada, 0.3); llegada = null; });

// jugador: salto, puño, caer al suelo y al agua (los pasos van en actualizarAudio)
escuchar('salto', () => sonar('salto'));
escuchar('puno', () => sonar('puno'));
// fuerza = rapidez con que caías (m/s). Caer de un salto normal ≈ 14 m/s.
// Bajo 3 m/s es un escaloncito: no suena. Más rápido, más fuerte (hasta 1).
escuchar('tocaSuelo', v => {
  if (v < 3) return;
  sonar('tocaSuelo', { vol: Math.min(1, 0.35 + v / 25) });
  zancada = 0;                                          // el próximo paso, una zancada después de caer
});
escuchar('agua', () => sonar('chapuzon'));

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
  if ((tema.loop || tema.entrada) && !['juego', 'cartel', 'cine'].includes(juego.modo)) callarTema(0.5);   // volviste al menú
  dirigirFondo();
  if (fondo.espacio && !['cine', 'carga'].includes(juego.modo)) salirDelEspacio(1);     // por si saliste a medias
  if (juego.modo !== 'juego' || !juego.jugador) return;
  pasos(dt);
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

/* ---------- PASOS ----------
   Un paso cada vez que recorres una "zancada" (1,9 m) por el suelo:
     pasos por segundo = rapidez / zancada
   Corriendo a 9 m/s → ~4,7 pasos/s; caminando lento, menos. Así el
   ritmo de los pasos sale solo de la física, sin contar cuadros. */
const ZANCADA = 1.9;
let zancada = 0;
function pasos(dt) {
  const p = juego.jugador;
  if (!p.grounded || (p.state !== 'normal' && p.state !== 'punch')) { zancada = ZANCADA * 0.6; return; }
  const v = p.vel.length();                             // casi toda es horizontal en el suelo
  if (v < 1) return;
  zancada += v * dt;
  if (zancada < ZANCADA) return;
  zancada -= ZANCADA;
  sonar(PASOS[Math.floor(Math.random() * PASOS.length)], { vol: Math.min(1, 0.4 + v / 12) });
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
