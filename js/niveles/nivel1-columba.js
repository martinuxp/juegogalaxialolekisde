/* =========================================================
   Nivel 1 · COLUMBA (tutorial) · Ley: gravitación de Newton
   ---------------------------------------------------------
   Despiertas en la Isla de las Flores (polo norte) y caminas
   "hacia abajo" del planeta por un camino de islas. Cada
   tramo solo se pasa usando UNA mecánica:
     1. SALTO    islitas separadas por 6 m de agua
     2. DASH     huecos de 14,5 m: un salto llega a ~12,9 m
                 (medido); salto + dash cayendo llega a ~16–18 m
     3. PISOTÓN  el cañón está rodeado de muros más altos que
                 tu salto; un pisotón sobre el botón los baja
     4. CAÑÓN    cargas (barra con v_esc) y te disparas a Ícaro
   Si caes al mar, vuelves al último lugar seguro.

   Las instrucciones están en CARTELES: te acercas, tocas LEER
   y se abre la caja de diálogo (js/dialogo.js).

   Para afinar: todo se mide en METROS sobre el mar, contando
   desde el polo (s = 0) por el meridiano 180°.
   ========================================================= */
import { V3, dirLL } from '../util.js';

const R_MAR = 42;                       // radio de la superficie del mar de Columba
const GRADOS = 180 / Math.PI;

/** Dirección del punto que está a s metros del polo por el camino (lado = metros a la derecha). */
function camino(s, lado = 0) {
  const lat = 90 - (s / R_MAR) * GRADOS;
  const d = dirLL(lat, 180);
  if (lado) d.addScaledVector(new V3(1, 0, 0), lado / R_MAR).normalize();   // x es perpendicular al meridiano 180°
  return d;
}

// dónde está cada cosa (s en metros desde el polo)
const S = {
  flores: 0,        // Isla de las Flores: orilla a 9 m → borde en s = 9
  salto1: 19,       // hueco de 6 m (un salto corto ya llega; uno largo no se pasa de largo)
  salto2: 33,       // hueco de 6 m (un poco más alta)
  enemigos: 50,     // hueco de 6 m → isla de los enemigos (orilla a 7 m, borde en 57)
  dash1: 75,        // hueco de 14,5 m
  canon: 102,       // hueco de 14,5 m → isla del cañón (orilla a 9 m, borde en 93)
  boton: 96.5,      // entre el borde (93) y los muros (99)
};
const DIR_CANON = camino(S.canon);
const DIST_ICARO = 112;                 // Ícaro está "encima" del cañón, a esta distancia del centro

export default {
  id: 'columba',
  numero: 1,
  nombre: 'Columba',
  ley: 'Gravitación de Newton',
  superDesdeInicio: false,

  planetas: [
    // R = radio del fondo del mar, mar = radio de la superficie del agua.
    // g = gravedad en R (m/s²). Con eso: G·M = g·R²
    { name: 'Columba', c: new V3(0, 0, 0), R: 40, mar: R_MAR, g: 27.5, color: 0x4d5f66, colorMar: 0x5d8a99, seed: 31 },
    { name: 'Ícaro', c: DIR_CANON.clone().multiplyScalar(DIST_ICARO), R: 6, g: 40, color: 0xe08a3f, seed: 77 },
  ],

  // islas: ancho = radio de lo que se ve sobre el agua; alto = cuánto asoma
  islas: [
    { planeta: 0, dir: camino(S.flores), alto: 1.2, ancho: 9 },
    { planeta: 0, dir: camino(S.salto1), alto: 1.3, ancho: 4 },
    { planeta: 0, dir: camino(S.salto2), alto: 1.9, ancho: 4 },
    { planeta: 0, dir: camino(S.enemigos), alto: 1.4, ancho: 7 },
    { planeta: 0, dir: camino(S.dash1), alto: 1.4, ancho: 3.5 },
    { planeta: 0, dir: DIR_CANON, alto: 1.6, ancho: 9, canon: true },
  ],

  flores: { planeta: 0, dir: camino(S.flores) },
  canon: { planeta: 0, dir: DIR_CANON },

  // muros alrededor del cañón: más altos que el salto máximo (v²/2g ≈ 14²/(2·25) ≈ 3,9 m)
  muros: { planeta: 0, dir: DIR_CANON, lado: 3, alto: 5.5, grosor: 0.6 },
  boton: { planeta: 0, dir: camino(S.boton) },

  // [tipo, planeta, dirección]
  enemigos: [
    ['small', 0, camino(S.enemigos - 2, 2.5)],
    ['small', 0, camino(S.enemigos + 2.5, -2)],
    ['small', 0, camino(S.enemigos + 4, 2)],
  ],

  inicio: { planeta: 0, dir: camino(S.flores), mirar: new V3(0, 0, -1) },

  // CARTELES: icono = lo que se dibuja en la tabla; paginas = lo que dice al leerlo
  carteles: [
    {
      planeta: 0, dir: camino(5.5, -2.2), icono: 'mover',
      paginas: [
        'Isla de las Flores.\nEl cañón está al otro lado de Columba: sigue el camino de islas.',
        'Muévete con el joystick (o WASD).\nArrastra a la derecha para girar la cámara.',
        'Aquí la gravedad apunta al centro del planeta. Por eso puedes caminar alrededor de él sin caerte.',
      ],
    },
    {
      planeta: 0, dir: camino(7.5, 2), icono: 'salto',
      paginas: [
        'Entre las islas hay agua. El agua no te sostiene: si caes, vuelves a tierra firme.',
        'Toca SALTO (Espacio) para saltar.\nSi lo mantienes apretado, subes más alto.',
        'Subes, la gravedad te frena hasta quedar quieto y luego te hace caer. Es la misma g = G·M/r² en todo el planeta.',
      ],
    },
    {
      planeta: 0, dir: camino(S.enemigos - 4.5, -2.5), icono: 'puno',
      paginas: [
        'Cuidado: en esta isla hay criaturas.',
        'En el suelo, PUÑO (J) las golpea.\nTambién puedes caerles encima.',
      ],
    },
    {
      planeta: 0, dir: camino(S.enemigos + 5, -2.2), icono: 'dash',
      paginas: [
        'La siguiente isla está demasiado lejos para un salto.',
        'Salta y, cuando ya vayas cayendo, toca DASH (K o Shift): sales disparad@ hacia adelante.',
        'El dash deja tu velocidad vertical en cero. Si lo usas cayendo, frenas la caída y llegas mucho más lejos.',
        'Solo tienes un dash en el aire. Se recarga al tocar el suelo.',
      ],
    },
    {
      planeta: 0, dir: camino(95, 3), icono: 'pisoton',
      paginas: [
        'Unos muros protegen el cañón. Son más altos de lo que puedes saltar.',
        'Párate en el botón, salta y, en el aire, toca PISOTÓN (J). Caes en picada con fuerza.',
      ],
    },
    {
      planeta: 0, dir: camino(S.canon - 1.6, 1.9), icono: 'canon',
      paginas: [
        'Súbete al cañón y mantén CAÑÓN (L). Suelta para disparar.',
        'La marca blanca de la barra es la velocidad de escape: v_esc = √(2·G·M/r). Con ella no vuelves nunca a Columba.',
        'No la necesitas para llegar a Ícaro: la línea punteada te muestra dónde vas a caer.',
      ],
    },
  ],

  // se gana al aterrizar en este planeta
  meta: { aterrizarEn: 1 },
};
