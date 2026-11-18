/* =========================================================
   Nivel 1 · COLUMBA (tutorial) · Ley: gravitación de Newton
   ---------------------------------------------------------
   Despiertas en una cama de flores, en una isla de Columba.
   1. Aprende a moverte y saltar de isla en isla (si caes al
      mar, vuelves al último lugar seguro).
   2. Llega al CAÑÓN de la última isla.
   3. Cárgalo (barra con la marca de v_esc) y dispárate a Ícaro.

   Para afinar el nivel, cambia los números de aquí abajo.
   dirLL(latitud, longitud) da una dirección sobre el planeta:
   latitud 90 = polo norte (donde despiertas).
   ========================================================= */
import { V3, dirLL } from '../util.js';

const DIR_CANON = dirLL(-4, 180);     // la isla del cañón
const DIST_ICARO = 62;               // Ícaro está justo "encima" del cañón, a esta distancia del centro

export default {
  id: 'columba',
  numero: 1,
  nombre: 'Columba',
  ley: 'Gravitación de Newton',
  superDesdeInicio: false,

  planetas: [
    // R = radio del fondo del mar, mar = radio de la superficie del agua.
    // g = gravedad en R (m/s²). Con eso: G·M = g·R²
    { name: 'Columba', c: new V3(0, 0, 0), R: 14, mar: 15, g: 27.5, color: 0x4d5f66, colorMar: 0x5d8a99, seed: 31 },
    { name: 'Ícaro', c: DIR_CANON.clone().multiplyScalar(DIST_ICARO), R: 6, g: 40, color: 0xe08a3f, seed: 77 },
  ],

  // islas: alto = cuánto asoma sobre el agua; radio = tamaño de la esfera hundida
  islas: [
    { planeta: 0, dir: dirLL(90, 0), alto: 1.2, radio: 9 },     // A: la de las flores
    { planeta: 0, dir: dirLL(38, 180), alto: 1.0, radio: 5 },   // B: la de los enemigos
    { planeta: 0, dir: DIR_CANON, alto: 1.6, radio: 4.5 },      // C: la del cañón
  ],

  // piedras para cruzar el agua (h = altura del centro sobre el mar)
  rocas: [
    { planeta: 0, dir: dirLL(61, 183), h: 0.2, R: 0.9 },
    { planeta: 0, dir: dirLL(54, 176), h: 0.4, R: 0.9 },
    { planeta: 0, dir: dirLL(20, 178), h: 0.3, R: 0.9 },
    { planeta: 0, dir: dirLL(14, 184), h: 2.0, R: 1.0 },
  ],

  flores: { planeta: 0, dir: dirLL(90, 0) },
  canon: { planeta: 0, dir: DIR_CANON },

  // [tipo, planeta, dirección]
  enemigos: [
    ['small', 0, dirLL(42, 165)],
    ['small', 0, dirLL(33, 194)],
    ['small', 0, dirLL(-10, 168)],
  ],

  inicio: { planeta: 0, dir: dirLL(90, 0), mirar: new V3(0, 0, -1) },

  carteles: [
    { planeta: 0, dir: dirLL(80, 110), h: 1.8, ancho: 4.2, texto: 'Muévete: joystick o WASD\nCámara: arrastra a la derecha' },
    { planeta: 0, dir: dirLL(70, 205), h: 1.8, ancho: 4.2, texto: 'SALTO / Espacio\nMantén apretado = más alto' },
    { planeta: 0, dir: dirLL(46, 150), h: 2.0, ancho: 4.2, texto: 'PUÑO / J en el suelo\nEn el aire = PISOTÓN' },
    { planeta: 0, dir: dirLL(3, 160), h: 2.4, ancho: 4.2, texto: 'CAÑÓN: súbete\nMantén CAÑÓN (L) y suelta' },
  ],

  objetivos: {
    inicio: 'Llega al cañón de la última isla (mira hacia el planeta naranjo)',
    canon: 'Mantén el botón CAÑÓN (o L) y suelta: la línea punteada muestra dónde caerás',
  },

  // se gana al aterrizar en este planeta
  meta: { aterrizarEn: 1 },
};
