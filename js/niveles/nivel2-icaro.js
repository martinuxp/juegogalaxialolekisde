/* =========================================================
   Nivel 2 · ÍCARO · Ley: velocidad de escape
   ---------------------------------------------------------
   PARTE 1 (esta): LA CUEVA DE LAS DUNAS
   Al llegar, chocas con el cinturón de piedras y caes por una
   grieta gigante (cinemática, js/cineIcaro.js). Despiertas en
   una cueva muy oscura: solo ves lo que alumbra la linterna de
   tu casco. Caminas por un pasillo de dunas hasta una sala
   donde te espera una personaje misteriosa (js/misteriosa.js).
   Te habla (cinemática con los planos del guion del grupo) y
   te deja unas BOTAS DE SALTO: con ellas sale el súper salto.
   La salida está muy arriba (el rayo de luz). Subir hasta allá
   es la siguiente parte.

   La cueva está sobre una esfera invisible de R = 2 000 m
   (ver js/cueva.js): el suelo es casi plano.
   Coordenadas: x = a la derecha, z = hacia atrás (el pasillo
   avanza hacia −z). El inicio está en z = 5 y la sala de la
   personaje tiene su centro en z = −24.
   ========================================================= */
import { V3 } from '../util.js';
import { emitir } from '../estado.js';
import { decorarCueva } from '../cueva.js';
import { animarPolvo } from '../meowl.js';
import { POZO, generarPozo, semillaDeLaUrl, construirPozo, actualizarPozo, reiniciarPozo, checkpointDeRepisa, enemigosDelPozo } from '../pozo.js';

const R = 2000;
const C = new V3(0, -R, 0);              // el centro de la esfera: el suelo de la cueva queda en y ≈ 0
/** Dirección (desde el centro) del punto (x, z) del suelo. */
export const aqui = (x, z) => new V3(x, R, z).normalize();

/* DUNAS (paredes). Esferas de radio 8 con el centro 3 m ARRIBA del suelo:
   a nivel del suelo miden √(8² − 3²) ≈ 7,4 m de radio, y su parte de abajo
   "cuelga", así que no se pueden subir caminando. La cima queda a 11 m:
   más que tu salto (v²/2g = 14²/(2·20) ≈ 4,9 m). */
const RD = 8, HD = 3, A_SUELO = Math.sqrt(RD * RD - HD * HD);
const duna = (x, z, Rd = RD, h = HD) => ({ planeta: 0, dir: aqui(x, z), h, R: Rd, oculta: true });
const dunas = [];
// pasillo: 9 m de ancho (orillas en x = ±4,5)
for (const z of [10, 4, -2, -8, -13]) for (const sx of [-1, 1]) dunas.push(duna(sx * (4.5 + A_SUELO), z));
dunas.push(duna(0, 13 + A_SUELO));                           // atrás del inicio (lejos: ahí va la cámara)
// sala de la personaje: círculo de 10 m de radio con centro en z = −24; la entrada mira hacia +z
const SALA = { x: 0, z: -24, r: 10 };
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2;
  const dx = Math.sin(a), dz = Math.cos(a);                  // a = 0 → hacia +z (la entrada)
  if (dz > 0.75) continue;
  if (dz < -0.75) continue;                                  // atrás: el pasillo hacia el pozo
  dunas.push(duna(SALA.x + dx * (SALA.r + A_SUELO), SALA.z + dz * (SALA.r + A_SUELO)));
}
// pasillo de la sala al LABERINTO (10 m de ancho, de z = −34 a −42, donde está su puerta)
for (const z of [-36, -41]) for (const sx of [-1, 1]) dunas.push(duna(sx * (5 + A_SUELO), z));
// lomitas bajas en el suelo (se pueden pisar): centro 2 m bajo el suelo, asoman 1 m
dunas.push(duna(2.4, -4, 3, -2), duna(-2.2, -9.5, 2.6, -1.7));

/* EL LABERINTO (js/pozo.js): procedural con semilla. ?semilla=123 en la dirección arma otro. */
const pozo = generarPozo(semillaDeLaUrl());

const nivel = {
  id: 'icaro',
  numero: 2,
  nombre: 'Ícaro',
  ley: 'Velocidad de escape',
  musica: 'dunas',                 // audio.js: Dunas Subterráneas (muxp); al pelear, crossfade a la versión de combate
  intro: 'icaro',                  // main.js: al empezar, cinemática de llegada (js/cineIcaro.js)

  // luz de la cueva (escena.js → aplicarAmbiente): casi nada de luz de cielo, sin sol ni estrellas,
  // niebla negra desde los 6 m y la linterna del casco prendida
  ambiente: { cielo: 0x6a5878, suelo: 0x0d0a0c, luzCielo: 0.16, sol: 0, fondo: 0x020103, niebla: [0x020103, 5, 20], estrellas: false, luzJugador: 5 },
  // adentro del pozo (pozo.js lo mezcla de a poco): luz fría que baja de la grieta, y más mientras más subes
  ambientePozo: { cielo: 0xb8a088, suelo: 0x2a1a12, luzCielo: 0.2, luzArriba: 0.25, sol: 0.12, solArriba: 0.5, dirSol: [8, 100, -4],
    fondo: 0x050307, niebla: [0x0a0710, 7, 26], nieblaArriba: 10, estrellas: false, luzJugador: 5.5 },
  // ECO (audio.js): todos los efectos rebotan en las paredes. pared = distancia típica (m) → el eco llega en 2·d/343 s
  eco: { mezcla: 0.45, cola: 2.6, pared: 18 },

  planetas: [
    // g = 20 m/s² en el suelo. G·M = g·R² = 8·10⁷ m³/s². No se dibuja: el suelo lo dibuja cueva.js.
    { name: 'Grieta de Ícaro', c: C, R, g: 20, color: 0x8a6a4c, oculto: true },
  ],
  rocas: dunas,
  decorado: (grupo, planetas) => {
    reiniciarPozo();
    decorarCueva(grupo, planetas, { salida: [POZO.x + pozo.salida.x, POZO.z + pozo.salida.z], bocaAlto: pozo.salida.h + 30, sinRayo: true });
    construirPozo(grupo, pozo);
  },
  pozo,
  checkpointRepisa: k => checkpointDeRepisa(pozo, k),
  alPaso: dt => actualizarPozo(dt, pozo, nivel),
  alCuadro: dt => animarPolvo(dt),          // el polvo de los meowlitos que salen del suelo
  alSalir: () => emitir('irSuperficie'),        // al salir por la grieta de arriba: la superficie (main.js)

  // la escena de la personaje (js/cineIcaro.js)
  sala: SALA,
  charla: { jugador: aqui(0, -15.5), personaje: aqui(0, -20.5), desde: aqui(0, -30), botas: aqui(-3.6, -21.5), activa: 12.5 },

  inicio: { planeta: 0, dir: aqui(0, 3), mirar: new V3(0, 0, -1) },
  enemigos: enemigosDelPozo(pozo),
  carteles: [],
};
export default nivel;
