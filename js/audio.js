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
  // MÚSICA de la cueva (la mandó muxp). combate = la canción que entra con crossfade al pelear.
  // tarde: true = se carga solo cuando el nivel la pide (son largas y ocupan memoria en el celular)
  dunas:        { archivo: 'dunas.mp3',         vol: 0.8, musica: true, loop: true, tarde: true, combate: 'dunasCombate' },
  dunasCombate: { archivo: 'dunas-combate.mp3', vol: 0.8, musica: true, loop: true, tarde: true },
  misteriosa:   { archivo: 'misteriosa-loop.wav', vol: 0.75, musica: true, loop: true },
  ojosRojos:    { archivo: 'ojos-rojos.wav',    vol: 0.8 },
  vozM1:        { archivo: 'voz-misteriosa1.wav', vol: 0.35, tono: 0.06 },
  vozM2:        { archivo: 'voz-misteriosa2.wav', vol: 0.35, tono: 0.06 },
  vozM3:        { archivo: 'voz-misteriosa3.wav', vol: 0.35, tono: 0.06 },
  botas:        { archivo: 'botas.wav',         vol: 0.8 },
  superCarga:   { archivo: 'super-carga.wav',   vol: 0.5 },
  superListo:   { archivo: 'super-listo.wav',   vol: 0.8 },
  superSalto:   { archivo: 'super-salto.wav',   vol: 0.75, tono: 0.04 },
  // LABERINTO de la cueva (pozo.js): peligros y premios
  estalactitaCruje: { archivo: 'estalactita-cruje.wav', vol: 0.6, tono: 0.08 },
  estalactitaCae:   { archivo: 'estalactita-cae.wav',   vol: 0.5, tono: 0.08 },
  estalactitaRompe: { archivo: 'estalactita-rompe.wav', vol: 0.85, tono: 0.08 },
  fragilCruje:  { archivo: 'fragil-cruje.wav',  vol: 0.7, tono: 0.06 },
  fragilCae:    { archivo: 'fragil-cae.wav',    vol: 0.8, tono: 0.06 },
  corazon:      { archivo: 'corazon.wav',       vol: 0.6 },
  rescate:      { archivo: 'rescate.wav',       vol: 0.6 },
  // SUPERFICIE de Ícaro (superficie.js y meowl.js). desierto = viento de relleno (ya no suena: el camino usa dunasCombate)
  desierto:     { archivo: 'desierto-loop.wav', vol: 0.7, musica: true, loop: true, tarde: true },
  quemadura:    { archivo: 'quemadura.wav',     vol: 0.8, tono: 0.08 },
  salirGrieta:  { archivo: 'salir-grieta.wav',  vol: 0.85 },
  meowlChilla:  { archivo: 'meowl-chilla.wav',  vol: 0.85 },
  meowlCarga:   { archivo: 'meowl-carga.wav',   vol: 0.6 },
  meowlPicada:  { archivo: 'meowl-picada.wav',  vol: 0.8 },
  meowlClava:   { archivo: 'meowl-clava.wav',   vol: 0.9, tono: 0.05 },
  meowlArrastre:{ archivo: 'meowl-arrastre.wav', vol: 0.75 },
  meowlMareado: { archivo: 'meowl-mareado.wav', vol: 0.5 },
  meowlGolpe:   { archivo: 'meowl-golpe.wav',   vol: 0.9 },
  meowlVuela:   { archivo: 'meowl-vuela.wav',   vol: 0.6 },
  meowlitoSale: { archivo: 'meowlito-sale.wav', vol: 0.55, tono: 0.12 },
  meowlitoCarga:{ archivo: 'meowlito-carga.wav', vol: 0.45, tono: 0.1 },
  meowlitoLanza:{ archivo: 'meowlito-lanza.wav', vol: 0.6, tono: 0.12 },
  meowlitoMuere:{ archivo: 'meowlito-muere.wav', vol: 0.65, tono: 0.12 },
  confeti:      { archivo: 'confeti.wav',       vol: 0.9 },
  canonSube:    { archivo: 'canon-sube.wav',    vol: 0.85 },
  canonListo:   { archivo: 'canon-listo.wav',   vol: 0.6 },
  // la pelea con Meowl (la mandó muxp): entra con crossfade desde la música del camino (musicaJefe del nivel)
  meowlPelea:   { archivo: 'meowl-pelea.mp3',   vol: 0.85, musica: true, loop: true, tarde: true },
  // KEPLER (las mandó muxp). cruce = [de, a, seg]: al llegar al segundo «de», la canción
  // vuelve al segundo «a» con un crossfade de «seg» segundos (no se corta: queda en bucle).
  // entrada = desde dónde parte si no la pide una cinemática (salta la mini intro).
  keplerCarrera: { archivo: 'kepler-carrera.mp3', vol: 0.8, musica: true, loop: true, tarde: true, cruce: [179, 2.5, 2], entrada: 2.5 },
  meimeiPelea:   { archivo: 'meimei-pelea.mp3',   vol: 0.85, musica: true, loop: true, tarde: true, cruce: [65, 1, 1.2] },
  // KEPLER: nieve, resortes y MeiMei (generados con herramientas/generar-sonidos.py kepler)
  deslizar:      { archivo: 'deslizar-loop.wav', vol: 0.5, loop: true },
  viento:        { archivo: 'viento-loop.wav',   vol: 0.45, loop: true, tarde: true },
  nieve1:        { archivo: 'nieve1.wav',        vol: 0.4, tono: 0.1 },
  nieve2:        { archivo: 'nieve2.wav',        vol: 0.4, tono: 0.1 },
  nieve3:        { archivo: 'nieve3.wav',        vol: 0.4, tono: 0.1 },
  resortePisa:   { archivo: 'resorte-pisa.wav',  vol: 0.6 },
  resorteCarga:  { archivo: 'resorte-carga.wav', vol: 0.6 },
  resorteSuelta: { archivo: 'resorte-suelta.wav', vol: 0.85 },
  avalancha:     { archivo: 'avalancha.wav',     vol: 0.7 },
  bolaTira:      { archivo: 'bola-tira.wav',     vol: 0.5, tono: 0.1 },
  bolaRompe:     { archivo: 'bola-rompe.wav',    vol: 0.6, tono: 0.1 },
  meimeiRisa:    { archivo: 'meimei-risa.wav',   vol: 0.7, tono: 0.05 },
  meimeiCarga:   { archivo: 'meimei-carga.wav',  vol: 0.5 },
  meimeiSalta:   { archivo: 'meimei-salta.wav',  vol: 0.7, tono: 0.06 },
  meimeiDerrapa: { archivo: 'meimei-derrapa.wav', vol: 0.55 },
  meimeiChoca:   { archivo: 'meimei-choca.wav',  vol: 0.9 },
  meimeiGolpe:   { archivo: 'meimei-golpe.wav',  vol: 0.9 },
  meimeiOrbita:  { archivo: 'meimei-orbita.wav', vol: 0.6 },
  fragmento:     { archivo: 'fragmento.wav',     vol: 0.75 },
  // FALTA (si llega, se agrega aquí y ya suena): musicaMenu
};
const PASOS = ['paso1', 'paso2', 'paso3'];
const PASOS_NIEVE = ['nieve1', 'nieve2', 'nieve3'];
const VOCES = ['voz1', 'voz2', 'voz3', 'voz4', 'voz5', 'voz6'];

/* ---------- volúmenes guardados (estado.js los guarda en localStorage) ---------- */
ajustes.volEfectos ??= 0.8;
ajustes.volMusica ??= 0.6;
ajustes.silencio ??= false;

/* ---------- la cadena de volúmenes ---------- */
const AC = window.AudioContext || window.webkitAudioContext;
const ctx = AC ? new AC() : null;                    // navegador muy viejo: el juego sigue mudo
let general, efectos, musica, sala, salaVol;
if (ctx) {
  general = ctx.createGain(); general.connect(ctx.destination);
  efectos = ctx.createGain(); efectos.connect(general);
  // ECO de la cueva: los efectos también pasan por una "sala" (ConvolverNode) que se mezcla encima
  sala = ctx.createConvolver(); salaVol = ctx.createGain(); salaVol.gain.value = 0;
  efectos.connect(sala).connect(salaVol).connect(general);
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

/* =========================================================
   REVERB Y ECO (cueva de Ícaro)
   ---------------------------------------------------------
   En una cueva el sonido rebota en las paredes muchas veces.
   Lo que oímos es el sonido original + millones de copias que
   llegan tarde y más bajitas. Eso se describe con la "respuesta
   al impulso" (IR): lo que se oiría si hubiera un aplauso
   infinitamente corto. El ConvolverNode aplica esa IR a cada
   sonido (convolución: cada muestra dispara una copia de la IR).
   Nuestra IR la fabricamos con matemática:
     · cola: ruido que se apaga como e^(−6,9·t/T)  → a los T
       segundos bajó 1000 veces (−60 dB: el "RT60" de la acústica)
     · ecos: rebotes claros en la pared, que llegan a
           t = 2·d / 343   (ida y vuelta, a 343 m/s)
       y cada uno más bajito que el anterior.
   ========================================================= */
let ecoActual = null;
function crearSala({ cola = 2.6, pared = 18 } = {}) {
  const sr = ctx.sampleRate, n = Math.floor(sr * cola), ir = ctx.createBuffer(2, n, sr);
  const tEco = 2 * pared / 343;                                  // ida y vuelta a la pared
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-6.9 * t / cola) * Math.min(1, t / 0.02) * 0.35;
    }
    // 3 ecos claros (cada oído los oye un poquito distinto: más espacio)
    [[1, 1], [2, 0.5], [3, 0.25]].forEach(([k, a]) => {
      const i0 = Math.floor((tEco * k + c * 0.007) * sr);
      for (let j = 0; j < 400 && i0 + j < n; j++) d[i0 + j] += (Math.random() * 2 - 1) * a * Math.exp(-j / 80);
    });
  }
  sala.buffer = ir;                                               // normalize = true: el volumen total queda parejo
}
/** El nivel dice cuánto eco tiene ( eco: { mezcla, cola, pared } ); sin eco = 0. */
function ponerEco(eco) {
  if (!ctx) return;
  const clave = eco ? JSON.stringify(eco) : null;
  if (eco && clave !== ecoActual) crearSala(eco);
  ecoActual = clave;
  salaVol.gain.setTargetAtTime(eco ? eco.mezcla : 0, ctx.currentTime, 0.3);
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
    if (def.loop) bordes[nombre] = def.cruce ? [def.cruce[1], def.cruce[0]] : def.loopDe || bordesDelLoop(buffers[nombre]);
  } catch (e) { console.warn('[audio] no pude cargar', def.archivo, e); }
}
if (ctx) for (const [n, d] of Object.entries(SONIDOS)) if (!d.tarde) cargar(n, d);
/** Las canciones con  tarde: true  se cargan recién cuando alguien las pide (y su pareja de combate). */
const pedidos = {};
function asegurar(nombre) {
  const def = SONIDOS[nombre];
  if (!ctx || !def || pedidos[nombre]) return;
  pedidos[nombre] = true; cargar(nombre, def);
  if (def.combate) asegurar(def.combate);
}

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
  if (def.loop) { s.loop = !def.cruce; [s.loopStart, s.loopEnd] = bordes[nombre]; }
  s.connect(g).connect(def.musica ? musica : efectos);
  const t0 = Math.max(op.cuando || 0, ctx.currentTime);
  const desde = op.desde ?? (def.cruce ? (def.entrada ?? 0) : def.loop ? s.loopStart : 0);
  s.start(t0, desde);
  _audio.ultimos.push(nombre); if (_audio.ultimos.length > 20) _audio.ultimos.shift();
  const h = { s, g, t0, desde, nombre };
  if (def.cruce) { h.tCruce = t0 + Math.max(0, def.cruce[0] - desde) / s.playbackRate.value; cruces.add(h); }
  return h;
}

/* =========================================================
   BUCLE CON CROSSFADE (cruce: [de, a, seg] en la tabla)
   ---------------------------------------------------------
   Un loop normal salta de golpe del final al inicio. Aquí, al
   llegar al segundo «de», partimos OTRA copia de la canción en el
   segundo «a» y hacemos un crossfade de igual potencia (cos/sin)
   entre las dos. Se programa con el reloj de audio, un poco antes
   de que toque, para que calce exacto.
   El "handle" h sigue siendo el mismo objeto: solo cambian su
   fuente (h.s) y su volumen (h.g), así el resto del código no se
   entera de que la canción dio la vuelta.
   ========================================================= */
const cruces = new Set();
function dirigirCruces() {
  for (const h of cruces) {
    if (h.muerto) { cruces.delete(h); continue; }
    if (ctx.currentTime < h.tCruce - 0.3) continue;
    const [de, a, seg] = SONIDOS[h.nombre].cruce, T = Math.max(h.tCruce, ctx.currentTime + 0.02);
    const nivel = h.g.gain.value;
    const s = ctx.createBufferSource(); s.buffer = h.s.buffer; s.loopStart = a; s.loopEnd = de;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueCurveAtTime(curva(32, true).map(k => k * nivel), T, seg);
    s.connect(g).connect(musica); s.start(T, a);
    h.g.gain.cancelScheduledValues(T);
    h.g.gain.setValueCurveAtTime(curva(32, false).map(k => k * nivel), T, seg);
    try { h.s.stop(T + seg + 0.05); } catch (e) { /* ya paró */ }
    h.s = s; h.g = g; h.t0 = T; h.desde = a; h.tCruce = T + (de - a);
  }
}
/** Para una canción en el instante t (y deja de darle vueltas si tenía crossfade). */
function parar(h, t) { h.muerto = true; try { h.s.stop(t); } catch (e) { /* ya paró */ } }

/** Apaga de a poco un sonido que está sonando (lo que devolvió sonar). */
function apagar(h, seg = 0.25) {
  if (!h) return;
  h.muerto = true;
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
  if (fondo.jefe) return;                              // este nivel tiene su propia canción de jefe (crossfade, abajo)
  if (!d || tema.entrada || tema.loop || !buffers.jefeEntrada) return;
  tema.entrada = sonar('jefeEntrada');
  tema.finEntrada = ctx.currentTime + buffers.jefeEntrada.duration;
});
// toca el suelo: parte el loop. Si la entrada aún no termina, espera a que termine
// (son centésimas: el jefe cae ~0,8 s y la entrada dura 0,86 s) para que calce con la música.
escuchar('jefeAterriza', () => {
  if (tema.loop || fondo.jefe) return;
  tema.loop = sonar('jefeLoop', { cuando: tema.finEntrada });
});
escuchar('jefeVencido', () => { if (fondo.jefe) return; callarTema(0.15); sonar('jefeSalida'); });

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
const fondo = { nombre: null, h: null, zona: 'calma', calmaDesde: 0, tension: null, espacio: null, jefe: null };
function callarTension(seg) { apagar(fondo.tension, seg); fondo.tension = null; }
function calma(desde = 0) { fondo.zona = 'calma'; fondo.calmaDesde = desde; callarTension(0.8); }

escuchar('nivel', def => {
  ponerEco(def.eco);
  callarTema(0.3); calma(); salirDelEspacio(0.5);
  if (fondo.nombre !== (def.musica || null)) { apagar(fondo.h, 0.3); fondo.h = null; olvidarPelea(0.3); }
  fondo.nombre = def.musica || null;
  asegurar(fondo.nombre);
  olvidarJefe(0.3);
  fondo.jefe = def.musicaJefe || null;               // canción propia del jefe de este nivel (Meowl)
  asegurar(fondo.jefe);
  for (const n of def.precargar || []) asegurar(n);   // canciones que pedirá una cinemática (que estén listas a tiempo)
});
// una cinemática puede cambiar la música de fondo: emitir('musica', 'misteriosa') o null (silencio)
// también se puede pedir desde qué segundo parte: emitir('musica', { nombre: 'keplerCarrera', desde: 0 })
escuchar('musica', pedido => {
  const nombre = pedido && typeof pedido === 'object' ? pedido.nombre : pedido;
  fondo.desde = pedido && typeof pedido === 'object' ? pedido.desde : null;
  if (fondo.nombre === nombre) return;
  apagar(fondo.h, 1.5); fondo.h = null; olvidarPelea(1.5);
  fondo.nombre = nombre;
  asegurar(nombre);
});
escuchar('arena', () => {                              // jefe.js: pisaste la arena
  if (fondo.jefe) { entraJefe(); return; }             // Meowl: crossfade directo a su música, sin tensión
  fondo.zona = 'combate';
  sonar('tensionGolpe');
  if (!fondo.tension) fondo.tension = sonar('tension', { subir: 1.5 });
});
escuchar('jefe', d => { if (d) callarTension(0.8); });                 // aparece el jefe: manda su música
escuchar('reaparecer', () => { callarTema(0.6); if (fondo.zona === 'combate') calma(); saleJefe(); });   // la pelea parte de nuevo
escuchar('jefeVencido', () => {
  if (fondo.jefe) { saleJefe(); return; }
  calma(ctx ? ctx.currentTime + (buffers.jefeSalida ? buffers.jefeSalida.duration : 0) : 0);
});

// la nave (cineOvni.js y jefe.js)
escuchar('ovniLlega', () => sonar('ovniLlega'));
escuchar('ovniBoing', () => sonar('ovniBoing'));
escuchar('rayo', () => sonar('ovniRayo'));
escuchar('ovniHuye', () => sonar('ovniHuye'));

/* =========================================================
   CROSSFADE A LA MÚSICA DE PELEA (dunas → dunas-combate)
   ---------------------------------------------------------
   Si la canción del nivel tiene pareja de combate (combate: '...')
   y un enemigo te está persiguiendo, una canción baja mientras la
   otra sube, al mismo tiempo, en CRUCE seg.
   Crossfade de "igual potencia": los volúmenes siguen
       sale = cos(x·π/2)     entra = sin(x·π/2)     (x de 0 a 1)
   y como cos² + sin² = 1, la potencia total (lo que oímos como
   "fuerte") se mantiene constante: no hay un bache al medio.
   Las canciones duran distinto (2:42 y 1:52), así que no se
   pueden tocar "sincronizadas": la de pelea parte desde el inicio
   y, al terminar la pelea, la de calma SIGUE DONDE IBA.
   ========================================================= */
const CRUCE = 1.6;             // segundos del crossfade
const CALMA_TRAS = 4;          // segundos sin enemigos encima antes de volver a la calma
const pelea = { h: null, activa: false, sinEnemigos: 99, retomar: null };
const curva = (n, entra) => Float32Array.from({ length: n }, (_, i) => { const x = i / (n - 1); return entra ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2); });
/** Cambia el volumen de h siguiendo la curva (multiplicada por su volumen normal). */
function rampa(h, entra, seg) {
  const v = SONIDOS[h.nombre].vol, t = ctx.currentTime, c = curva(32, entra).map(k => k * v);
  h.g.gain.cancelScheduledValues(t);
  h.g.gain.setValueCurveAtTime(c, t, seg);
}
/** ¿En qué segundo de la canción va? (para retomarla donde iba) */
function posicion(h) {
  const [a, b] = [h.s.loopStart, h.s.loopEnd], largo = b - a, ya = Math.max(0, ctx.currentTime - h.t0);
  const x = h.desde + ya;                             // si aún no llega al final, va justo ahí (puede estar en la intro)
  return x < b ? x : a + (x - a) % largo;
}
function olvidarPelea(seg) { apagar(pelea.h, seg); pelea.h = null; pelea.activa = false; pelea.retomar = null; pelea.sinEnemigos = 99; }
/** ¿Algún enemigo te está persiguiendo? (lo decide enemigos.js: e.persigue) */
function hayPelea() {
  const p = juego.jugador;
  if (!p || juego.modo !== 'juego') return false;
  return juego.enemigos.some(e => !e.dead && !e.T.jefe && e.persigue);
}
function dirigirPelea(dt) {
  const def = SONIDOS[fondo.nombre];
  if (!def || !def.combate) return;
  if (juego.modo === 'juego') { if (hayPelea()) pelea.sinEnemigos = 0; else pelea.sinEnemigos += dt; }   // leyendo un cartel, el reloj se congela
  const quiere = pelea.sinEnemigos < CALMA_TRAS && fondo.h && ctx.currentTime >= fondo.calmaDesde;
  if (quiere && !pelea.activa && buffers[def.combate]) {          // ENTRA la pelea
    pelea.activa = true;
    pelea.retomar = posicion(fondo.h);
    pelea.h = sonar(def.combate, { vol: 0 });
    if (pelea.h) rampa(pelea.h, true, CRUCE);
    rampa(fondo.h, false, CRUCE);
    const viejo = fondo.h; parar(viejo, ctx.currentTime + CRUCE + 0.05);
    fondo.h = { ...viejo, enPausa: true };                       // marcador: la calma "está", pero callada
  } else if (!quiere && pelea.activa && pelea.sinEnemigos >= CALMA_TRAS) {   // SALE la pelea
    pelea.activa = false;
    if (pelea.h) { rampa(pelea.h, false, CRUCE); parar(pelea.h, ctx.currentTime + CRUCE + 0.05); pelea.h = null; }
    fondo.h = sonar(fondo.nombre, { vol: 0, desde: pelea.retomar ?? undefined });
    if (fondo.h) rampa(fondo.h, true, CRUCE);
    pelea.retomar = null;
  }
}

/* =========================================================
   CROSSFADE A LA MÚSICA DEL JEFE (camino → Meowl)
   ---------------------------------------------------------
   Igual de "igual potencia" (cos/sin) que la de arriba, pero más
   largo (CRUCE_JEFE): mientras Meowl despierta, la música del
   camino baja y la suya sube. Al ganar (o si pierdes y la pelea
   vuelve a empezar), cruza de vuelta y el camino SIGUE DONDE IBA.
   ========================================================= */
const CRUCE_JEFE = 2.4;
const jefeM = { h: null, retomar: null };
function entraJefe() {
  if (fondo.zona === 'jefe' || !ctx) return;
  fondo.zona = 'jefe';
  const t = ctx.currentTime;
  if (fondo.h && !fondo.h.enPausa) {
    jefeM.retomar = posicion(fondo.h);
    rampa(fondo.h, false, CRUCE_JEFE); parar(fondo.h, t + CRUCE_JEFE + 0.05);
  }
  fondo.h = null;
  apagar(pelea.h, CRUCE_JEFE); pelea.h = null; pelea.activa = false;
  jefeM.h = sonar(fondo.jefe, { vol: 0 });
  if (jefeM.h) rampa(jefeM.h, true, CRUCE_JEFE);
}
function saleJefe() {
  if (fondo.zona !== 'jefe' || !ctx) return;
  fondo.zona = 'calma'; fondo.calmaDesde = 0;
  if (jefeM.h) { rampa(jefeM.h, false, CRUCE_JEFE); parar(jefeM.h, ctx.currentTime + CRUCE_JEFE + 0.05); jefeM.h = null; }
  fondo.h = sonar(fondo.nombre, { vol: 0, desde: jefeM.retomar ?? undefined });
  if (fondo.h) rampa(fondo.h, true, CRUCE_JEFE);
  jefeM.retomar = null;
}
function olvidarJefe(seg) {
  if (jefeM.h) apagar(jefeM.h, seg);
  jefeM.h = null; jefeM.retomar = null;
  if (fondo.zona === 'jefe') fondo.zona = 'calma';
}

/** Cada cuadro: ¿debería sonar la música del planeta? Si sí y no suena, entra suave; si no, sale suave. */
function dirigirFondo(dt) {
  const jugando = ['juego', 'cartel', 'cine'].includes(juego.modo);
  const quiere = jugando && !fondo.espacio && fondo.nombre && fondo.zona === 'calma' && ctx.currentTime >= fondo.calmaDesde;
  if (quiere && !fondo.h) {
    const desde = fondo.desde ?? undefined;
    fondo.h = sonar(fondo.nombre, desde === undefined ? { subir: 2.5 } : { desde });
    if (fondo.h) fondo.desde = null;
  }
  if (!quiere && fondo.h) { if (!fondo.h.enPausa) apagar(fondo.h, 1.5); fondo.h = null; olvidarPelea(1.5); }
  if (quiere) dirigirPelea(dt);
  if (!jugando && fondo.tension) callarTension(0.5);
  if (jefeM.h && ['menu', 'completo'].includes(juego.modo)) olvidarJefe(1.5);
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
escuchar('repisa', () => sonar('cargaTarjeta'));          // llegaste a una repisa nueva (checkpoint)
escuchar('salidaLuz', () => sonar('nivelCompleto'));
// súper salto con las botas: carga (al agacharte), "ting" cuando está listo y el salto
let carga = null;
escuchar('agacha', () => { apagar(carga, 0.05); carga = sonar('superCarga'); });
escuchar('superListo', () => sonar('superListo'));
escuchar('superSalto', () => { apagar(carga, 0.05); carga = null; sonar('superSalto'); });
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
  if (e.kind === 'meowlito') { if (e.dead) sonar('meowlitoMuere'); return; }
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
  dirigirFondo(dt);
  dirigirCruces();
  if (ecoActual && !['juego', 'cartel', 'cine'].includes(juego.modo)) ponerEco(null);   // en el menú no hay cueva
  if (fondo.espacio && !['cine', 'carga'].includes(juego.modo)) salirDelEspacio(1);     // por si saliste a medias
  sonidosKepler();
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
  if (!p.grounded || p.deslizando || (p.state !== 'normal' && p.state !== 'punch')) { zancada = ZANCADA * 0.6; return; }
  const v = p.vel.length();                             // casi toda es horizontal en el suelo
  if (v < 1) return;
  zancada += v * dt;
  if (zancada < ZANCADA) return;
  zancada -= ZANCADA;
  const lista = juego.nivel && juego.nivel.deslizar ? PASOS_NIEVE : PASOS;     // en Kepler, crujidos de nieve
  sonar(lista[Math.floor(Math.random() * lista.length)], { vol: Math.min(1, 0.4 + v / 12) });
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

/* ---------- laberinto de la cueva (pozo.js) y superficie de Ícaro (superficie.js, meowl.js) ----------
   Cada evento suena con el archivo del mismo nombre (ver la tabla SONIDOS). */
for (const n of ['estalactitaCruje', 'estalactitaCae', 'estalactitaRompe', 'fragilCruje', 'fragilCae', 'corazon', 'rescate',
  'quemadura', 'salirGrieta', 'meowlChilla', 'meowlCarga', 'meowlPicada', 'meowlClava', 'meowlArrastre', 'meowlMareado',
  'meowlGolpe', 'meowlVuela', 'meowlitoSale', 'meowlitoCarga', 'meowlitoLanza', 'canonSube', 'canonListo'])
  escuchar(n, () => sonar(n));
escuchar('meowlConfeti', () => sonar('confeti'));

/* =========================================================
   KEPLER
   ---------------------------------------------------------
   Al patinar suena un "shhh" que depende de tu rapidez v:
     volumen = v / 25 (hasta 1)    tono = 0,7 + v / 40
   Más rápido = más fuerte y más agudo (como el viento en la cara).
   El viento de la montaña suena de fondo todo el nivel.
   ========================================================= */
const kep = { patin: null, viento: null };
function sonidosKepler() {
  const enKepler = juego.nivel && juego.nivel.id === 'kepler' && ['juego', 'cartel', 'cine'].includes(juego.modo);
  if (enKepler && !kep.viento) { asegurar('viento'); kep.viento = sonar('viento', { subir: 3 }); }
  if (!enKepler && kep.viento) { apagar(kep.viento, 1.5); kep.viento = null; }
  const p = juego.jugador;
  const patina = enKepler && juego.modo === 'juego' && p && p.deslizando && p.grounded;
  const v = patina ? p.vel.length() : 0;
  if (patina && v > 2) {
    if (!kep.patin) kep.patin = sonar('deslizar', { vol: 0 });
    if (kep.patin) {
      kep.patin.g.gain.setTargetAtTime(SONIDOS.deslizar.vol * Math.min(1, v / 25), ctx.currentTime, 0.08);
      kep.patin.s.playbackRate.setTargetAtTime(0.7 + v / 40, ctx.currentTime, 0.1);
    }
  } else if (kep.patin) { kep.patin.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); if (!patina || v <= 2) { apagar(kep.patin, 0.3); kep.patin = null; } }
}
for (const n of ['resortePisa', 'resorteCarga', 'resorteSuelta', 'bolaTira', 'meimeiRisa', 'meimeiCarga', 'meimeiSalta',
  'meimeiDerrapa', 'meimeiChoca', 'meimeiGolpe', 'meimeiOrbita', 'fragmento'])
  escuchar(n, () => sonar(n));
escuchar('meimeiSeVa', () => sonar('meimeiRisa', { tono: 1.1 }));
escuchar('meimeiLlama', () => sonar('meimeiRisa', { tono: 0.9 }));
escuchar('meimeiHuye', () => sonar('meimeiSalta', { tono: 1.15 }));
escuchar('meimeiFrena', () => sonar('meimeiDerrapa', { tono: 1.2 }));
escuchar('meimeiMareada', () => sonar('meowlMareado'));
escuchar('meimeiCansada', () => sonar('meowlMareado', { tono: 0.85 }));
escuchar('meimeiAterriza', () => sonar('tocaSuelo'));
escuchar('seEscapo', () => sonar('rescate'));
escuchar('marcoLuna', () => sonar('cargaTarjeta', { tono: 0.8 }));
// a la distancia d (m): más lejos, más bajito
escuchar('bolaRompe', d => sonar('bolaRompe', { vol: Math.max(0.15, 1 - (d || 0) / 40) }));
escuchar('avalancha', d => sonar('avalancha', { vol: Math.max(0.2, 1 - (d || 0) / 260) }));
