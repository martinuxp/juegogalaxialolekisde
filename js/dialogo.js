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

const d = { paginas: [], i: 0, escribiendo: null, letras: 0, cerrandoT: 0, charla: null, ritmo: 26 };

function abrir(cartel) {
  if (juego.modo !== 'juego') return;
  juego.modo = 'cartel';
  d.ritmo = 26; $('cartelDlg').classList.remove('charla');
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
  $('cdPagina').textContent = d.charla ? d.charla.quien : `${d.i + 1}/${d.paginas.length}`;
  d.letras = 0;
  clearInterval(d.escribiendo);
  d.escribiendo = setInterval(() => {            // efecto máquina de escribir
    d.letras += 1;
    texto.textContent = txt.slice(0, d.letras);
    // en una charla, cada 3 letras (que no sean espacios) suena una sílaba de su voz (audio.js)
    if (d.charla && d.letras % 3 === 0 && /\S/.test(txt[d.letras - 1])) emitir('vozLetra', d.charla.voz);
    if (d.letras >= txt.length) terminarPagina();
  }, d.ritmo);
}

function terminarPagina() {
  clearInterval(d.escribiendo); d.escribiendo = null;
  texto.textContent = d.paginas[d.i];
  caja.classList.add('listo');                   // aparece la flechita
}

function avanzar() {
  if ((juego.modo !== 'cartel' && !d.charla) || performance.now() < d.cerrandoT) return;
  if (d.escribiendo) { terminarPagina(); return; }
  d.i++;
  emitir('paginaCartel');
  if (d.i < d.paginas.length) mostrarPagina();
  else cerrar();
}

function cerrar() {
  if (d.charla) {                                // charla de una cinemática: la caja se queda para la próxima línea
    caja.classList.remove('listo');
    const fin = d.charla.fin; d.charla = null;
    if (fin) fin();
    return;
  }
  caja.classList.remove('ver', 'listo');
  setTimeout(() => { if (!caja.classList.contains('ver')) caja.classList.add('oculto'); }, 250);
  limpiarEntrada();                              // que el último toque no te haga saltar
  juego.modo = 'juego';
  emitir('cartelLeido');
}

/* ---------- CHARLA (cinemáticas) ----------
   Igual que un cartel, pero es un personaje el que habla y el juego no
   está en modo 'cartel' (la cinemática sigue animándose detrás).
   decir('Hola', { quien: '? ? ?' }) devuelve una promesa que se cumple
   cuando el jugador pasa esa línea. cerrarCharla() esconde la caja. */
export function decir(txt, { quien = '? ? ?', icono: ic = 'misteriosa', ritmo = 46, voz = 'misteriosa' } = {}) {
  return new Promise(fin => {
    d.charla = { quien, voz, fin };
    d.paginas = [txt]; d.i = 0; d.ritmo = ritmo;
    $('cdIcono').innerHTML = icono(ic, 2);
    $('cartelDlg').classList.add('charla');
    caja.classList.remove('oculto');
    void caja.offsetWidth;
    caja.classList.add('ver');
    d.cerrandoT = performance.now() + 250;       // que el toque anterior no se salte esta línea
    mostrarPagina();
  });
}
export function cerrarCharla() {
  clearInterval(d.escribiendo); d.escribiendo = null;
  d.charla = null; d.ritmo = 26;
  caja.classList.remove('ver', 'listo');
  setTimeout(() => { if (!caja.classList.contains('ver')) { caja.classList.add('oculto'); caja.classList.remove('charla'); } }, 250);
}

atajos.avanzarCartel = avanzar;                  // clic con el mouse atrapado (entrada.js)
escuchar('leer', cartel => { abrir(cartel); d.cerrandoT = performance.now() + 180; });
$('cartelVelo').addEventListener('pointerdown', e => { e.preventDefault(); avanzar(); });
addEventListener('keydown', e => {
  if ((juego.modo !== 'cartel' && !d.charla) || e.repeat) return;
  if (d.charla && e.code === 'Escape') return;    // en la charla, Esc es "saltar la cinemática" (main.js)
  if (['KeyE', 'KeyF', 'Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); e.code === 'Escape' ? cerrar() : avanzar(); }
});
