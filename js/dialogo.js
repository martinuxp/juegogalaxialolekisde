/* =========================================================
   dialogo.js · Caja de diálogo de los CARTELES
   ---------------------------------------------------------
   Cuando lees un cartel (botón LEER), el juego se pausa y
   aparece una caja arriba con el texto, página por página:
     · el texto se escribe solo, letra por letra
     · al terminar, una flechita late: "toca para seguir"
     · tocar (o clic / E / F / Espacio / Enter) completa el texto o pasa
       a la siguiente página; después de la última se cierra
   ========================================================= */
import { juego, escuchar, emitir } from './estado.js';
import { limpiarEntrada, conControles, atajos } from './entrada.js';
import { icono } from './iconos.js';

const $ = id => document.getElementById(id);
const caja = $('cartelDlg'), texto = $('cdTexto');

const d = { paginas: [], i: 0, escribiendo: null, letras: 0, cerrandoT: 0 };

function abrir(cartel) {
  if (juego.modo !== 'juego') return;
  juego.modo = 'cartel';
  d.paginas = cartel.paginas.map(conControles); d.i = 0;   // {salto} → 'SALTO' o 'Espacio'
  $('cdIcono').innerHTML = icono(cartel.icono || 'leer', 2);
  caja.classList.remove('oculto');
  void caja.offsetWidth;            // reinicia la animación de entrada
  caja.classList.add('ver');
  mostrarPagina();
}

function mostrarPagina() {
  const txt = d.paginas[d.i];
  caja.classList.remove('listo');
  texto.textContent = '';
  $('cdPagina').textContent = `${d.i + 1}/${d.paginas.length}`;
  d.letras = 0;
  clearInterval(d.escribiendo);
  d.escribiendo = setInterval(() => {            // efecto máquina de escribir
    d.letras += 1;
    texto.textContent = txt.slice(0, d.letras);
    if (d.letras >= txt.length) terminarPagina();
  }, 26);
}

function terminarPagina() {
  clearInterval(d.escribiendo); d.escribiendo = null;
  texto.textContent = d.paginas[d.i];
  caja.classList.add('listo');                   // aparece la flechita
}

function avanzar() {
  if (juego.modo !== 'cartel' || performance.now() < d.cerrandoT) return;
  if (d.escribiendo) { terminarPagina(); return; }
  d.i++;
  emitir('paginaCartel');
  if (d.i < d.paginas.length) mostrarPagina();
  else cerrar();
}

function cerrar() {
  caja.classList.remove('ver', 'listo');
  setTimeout(() => { if (!caja.classList.contains('ver')) caja.classList.add('oculto'); }, 250);
  limpiarEntrada();                              // que el último toque no te haga saltar
  juego.modo = 'juego';
  emitir('cartelLeido');
}

/* ---------- CHARLA (cinemáticas) ----------
   Mismo estilo que la voz misteriosa del inicio (despertar.js): sin caja,
   letra cursiva centrada, quién habla arriba en letra chica. Para que se
   note QUIÉN habla, cada personaje tiene su color: un degradé difuminado
   que sube desde abajo (rojo para la personaje de la cueva).
   Igual que en el inicio, cada línea se escribe sola, espera un ratito
   (más si es larga) y pasa sola; tocar la completa o la adelanta.
   decir('Hola', { quien: '? ? ?' }) devuelve una promesa que se cumple
   cuando la línea termina. cerrarCharla() la esconde. */
const ch = { activa: false, txt: '', letras: 0, escribiendo: null, espera: null, fin: null, voz: null, desde: 0 };
const chEl = $('charla'), chTexto = $('chTexto');

export function decir(txt, { quien = '? ? ?', color = 'rojo', ritmo = 24, voz = 'misteriosa' } = {}) {
  return new Promise(fin => {
    clearInterval(ch.escribiendo); clearTimeout(ch.espera);
    Object.assign(ch, { activa: true, txt, letras: 0, fin, voz, desde: performance.now() });
    $('chQuien').textContent = quien;
    chEl.dataset.color = color;
    chEl.classList.remove('oculto');
    void chEl.offsetWidth;
    chEl.classList.add('ver');
    chTexto.classList.remove('ver'); chTexto.textContent = '';
    void chTexto.offsetWidth;
    chTexto.classList.add('ver');
    ch.escribiendo = setInterval(() => {                 // máquina de escribir
      ch.letras++;
      chTexto.textContent = txt.slice(0, ch.letras);
      // cada 3 letras (que no sean espacios) suena una sílaba de su voz (audio.js)
      if (ch.letras % 3 === 0 && /\S/.test(txt[ch.letras - 1])) emitir('vozLetra', voz);
      if (ch.letras >= txt.length) lineaCompleta();
    }, ritmo);
  });
}
function lineaCompleta() {
  clearInterval(ch.escribiendo); ch.escribiendo = null;
  chTexto.textContent = ch.txt;
  clearTimeout(ch.espera);
  ch.espera = setTimeout(pasarLinea, 700 + ch.txt.length * 18);   // tiempo para leer: más si es larga
}
function pasarLinea() {
  clearTimeout(ch.espera);
  if (!ch.activa) return;
  const f = ch.fin; ch.fin = null;
  if (f) f();
}
function avanzarCharla() {
  if (!ch.activa || performance.now() - ch.desde < 200) return;   // que el toque anterior no se salte esta línea
  if (ch.escribiendo) lineaCompleta(); else pasarLinea();
}
export function cerrarCharla() {
  clearInterval(ch.escribiendo); clearTimeout(ch.espera);
  ch.escribiendo = null; ch.activa = false; ch.fin = null;
  chEl.classList.remove('ver');
  setTimeout(() => { if (!chEl.classList.contains('ver')) chEl.classList.add('oculto'); }, 400);
}
$('chVelo').addEventListener('pointerdown', e => { e.preventDefault(); avanzarCharla(); });
addEventListener('keydown', e => {
  if (!ch.activa || e.repeat) return;
  if (['KeyE', 'KeyF', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); avanzarCharla(); }
});

atajos.avanzarCartel = avanzar;                  // clic con el mouse atrapado (entrada.js)
escuchar('leer', cartel => { abrir(cartel); d.cerrandoT = performance.now() + 180; });
$('cartelVelo').addEventListener('pointerdown', e => { e.preventDefault(); avanzar(); });
addEventListener('keydown', e => {
  if (juego.modo !== 'cartel' || e.repeat) return;
  if (['KeyE', 'KeyF', 'Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); e.code === 'Escape' ? cerrar() : avanzar(); }
});
