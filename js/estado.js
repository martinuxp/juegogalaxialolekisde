/* =========================================================
   estado.js · Lo que varios módulos necesitan compartir
   ---------------------------------------------------------
   En vez de que los archivos se importen entre ellos en círculo,
   todos leen y escriben este objeto.
   ========================================================= */
export const juego = {
  modo: 'menu',        // 'menu' | 'historia' | 'juego' | 'completo'
  pausado: true,
  jugador: null,       // lo crea jugador.js
  enemigos: [],        // lo llena enemigos.js
  nivel: null,         // definición del nivel actual (js/niveles/...)
  debug: false,        // panel de depuración (tecla G o botón DEBUG)
  timeScale: 1,        // cámara lenta del laboratorio
};

/* ---- preferencias guardadas en el dispositivo (localStorage) ---- */
const CLAVE = 'almaLunarAjustes';
export const ajustes = {
  traje: 0, accesorio: 0,
  nombre: '',
  dificultad: 'normal',
  historiaVista: false,
  nivelesCompletos: 0, // niveles terminados (0 a 5): el menú lo muestra en el mar de Columba
};
try {
  const viejo = JSON.parse(localStorage.getItem('almaLunarLook') || 'null');   // versión anterior
  if (viejo) { ajustes.traje = viejo.suitIdx || 0; ajustes.accesorio = viejo.accIdx || 0; }
  Object.assign(ajustes, JSON.parse(localStorage.getItem(CLAVE) || '{}'));
} catch (e) { /* sin localStorage: usamos los valores por defecto */ }

export function guardarAjustes() {
  try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch (e) { /* nada */ }
}

/* ---- eventos: un módulo avisa ("emitir") y otros reaccionan ("escuchar") ----
   Ej: el jugador recibe daño → emitir('daño') → la UI actualiza los corazones. */
const oyentes = {};
export function escuchar(nombre, fn) { (oyentes[nombre] ||= []).push(fn); }
export function emitir(nombre, datos) { for (const fn of oyentes[nombre] || []) fn(datos); }
