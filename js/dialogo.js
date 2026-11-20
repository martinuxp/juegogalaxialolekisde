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

atajos.avanzarCartel = avanzar;                  // clic con el mouse atrapado (entrada.js)
escuchar('leer', cartel => { abrir(cartel); d.cerrandoT = performance.now() + 180; });
$('cartelVelo').addEventListener('pointerdown', e => { e.preventDefault(); avanzar(); });
addEventListener('keydown', e => {
  if (juego.modo !== 'cartel' || e.repeat) return;
  if (['KeyE', 'KeyF', 'Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); e.code === 'Escape' ? cerrar() : avanzar(); }
});
