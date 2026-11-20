/* =========================================================
   Nivel 1 · COLUMBA (tutorial) · Ley: gravitación de Newton
   ---------------------------------------------------------
   Despiertas en la Isla de las Flores (polo norte) y caminas
   "hacia abajo" del planeta por un camino de islas. Cada
   tramo solo se pasa usando UNA mecánica:
     1. SALTO    islitas separadas por 6 m de agua
     2. DASH     huecos de 14,5 m: un salto llega a ~12,9 m
                 (medido); salto + dash cayendo llega a ~16–18 m
     3. ARENA    isla grande: el ovni de Ícaro baja aliens y al
                 JEFE (js/jefe.js). Aquí se aprende el PISOTÓN,
                 lo único que le hace daño al jefe. Es el examen
                 final: salto, puño, dash y pisotón.
     4. CAÑÓN    un campo de fuerza (más alto que tu salto) lo
                 tapa hasta que le ganas al jefe. Después cargas
                 (barra con v_esc) y te disparas a Ícaro.
   Un OVNI de Ícaro da vueltas al planeta en órbita circular
   de verdad: v = √(G·M/r) (js/ovni.js).
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
  dash1: 75,        // hueco de 14,5 m (isla chica: orilla a 3,5 m, borde en 78,5)
  arena: 98.5,      // hueco de 6 m → Isla de la Arena (orilla a 14 m: de 84,5 a 112,5)
  canon: 125.5,     // hueco de 6 m → isla del cañón (orilla a 7 m, borde en 118,5)
};
const DIR_CANON = camino(S.canon);
const DIR_ARENA = camino(S.arena);
const DIST_ICARO = 112;                 // Ícaro está "encima" del cañón, a esta distancia del centro

export default {
  id: 'columba',
  numero: 1,
  nombre: 'Columba',
  ley: 'Gravitación de Newton',
  musica: 'columba',              // audio.js: música de fondo (se apaga en la arena)
  superDesdeInicio: false,

  planetas: [
    // R = radio del fondo del mar, mar = radio de la superficie del agua.
    // g = gravedad en R (m/s²). Con eso: G·M = g·R²
    { name: 'Columba', c: new V3(0, 0, 0), R: 40, mar: R_MAR, g: 27.5, color: 0x4d5f66, colorMar: 0x5d8a99, seed: 31 },
    { name: 'Ícaro', c: DIR_CANON.clone().multiplyScalar(DIST_ICARO), R: 6, g: 40, color: 0xe08a3f, seed: 77 },
  ],

  // islas: ancho = radio de lo que se ve sobre el agua; alto = cuánto asoma
  // veg = cuánta vegetación lleva (js/vegetacion.js); si falta un número se calcula con el tamaño
  islas: [
    { planeta: 0, dir: camino(S.flores), alto: 1.2, ancho: 9, veg: { flores: 150, matas: 9, arboles: 5, claro: 4.5 } },
    { planeta: 0, dir: camino(S.salto1), alto: 1.3, ancho: 4, veg: { arboles: 1 } },
    { planeta: 0, dir: camino(S.salto2), alto: 1.9, ancho: 4, veg: { arboles: 1 } },
    { planeta: 0, dir: camino(S.enemigos), alto: 1.4, ancho: 7, veg: { arboles: 3 } },
    { planeta: 0, dir: camino(S.dash1), alto: 1.4, ancho: 3.5, veg: { matas: 1 } },
    { planeta: 0, dir: DIR_ARENA, alto: 1.6, ancho: 14, veg: { arboles: 9, matas: 14, flores: 70, claro: 10.5 } },
    { planeta: 0, dir: DIR_CANON, alto: 1.6, ancho: 7, canon: true, veg: { matas: 3 } },
  ],
  // las islas están en el meridiano 180° (el plano x = 0): ahí no van árboles ni matas, para no tapar el camino
  vegetacion: { planeta: 0, camino: new V3(1, 0, 0), seed: 7 },

  flores: { planeta: 0, dir: camino(S.flores) },
  canon: { planeta: 0, dir: DIR_CANON },

  // campo de fuerza alrededor del cañón: más alto que el salto máximo (v²/2g ≈ 14²/(2·25) ≈ 3,9 m).
  // Se apaga al ganarle al jefe (nivel.js escucha 'jefeVencido').
  muros: { planeta: 0, dir: DIR_CANON, lado: 3, alto: 5.5, grosor: 0.6, estilo: 'campo' },

  // ovni de Ícaro en órbita circular a 70 m del centro (pasa por encima del inicio)
  ovni: { planeta: 0, radio: 70, normal: new V3(0.35, 0.3, 1).normalize(), empieza: new V3(0, 1, 0) },

  // pelea del jefe (js/jefe.js): radio = metros de arena donde se pelea; entrada = checkpoint
  jefe: { planeta: 0, dir: DIR_ARENA, radio: 12, entrada: camino(S.arena - 12.5), alturaOvni: 11 },

  // [tipo, planeta, dirección]
  enemigos: [
    ['alien', 0, camino(S.enemigos - 2, 2.5)],
    ['alien', 0, camino(S.enemigos + 2.5, -2)],
    ['alien', 0, camino(S.enemigos + 4, 2)],
  ],

  inicio: { planeta: 0, dir: camino(S.flores), mirar: new V3(0, 0, -1) },

  // CARTELES: icono = lo que se dibuja en la tabla; paginas = lo que dice al leerlo
  carteles: [
    {
      planeta: 0, dir: camino(5.5, -2.2), icono: 'mover',
      paginas: [
        'Isla de las Flores.\nEl cañón está al otro lado de Columba: sigue el camino de islas.',
        'Muévete con {mover}.\nPara girar la cámara, {camara}.',
        'Aquí la gravedad apunta al centro del planeta. Por eso puedes caminar alrededor de él sin caerte.',
      ],
    },
    {
      planeta: 0, dir: camino(7.5, 2), icono: 'salto',
      paginas: [
        'Entre las islas hay agua. El agua no te sostiene: si caes, vuelves a tierra firme.',
        'Aprieta {salto} para saltar.\nSi lo mantienes apretado, subes más alto.',
        'Subes, la gravedad te frena hasta quedar quieto y luego te hace caer. Es la misma g = G·M/r² en todo el planeta.',
      ],
    },
    {
      planeta: 0, dir: camino(S.enemigos - 4.5, -2.5), icono: 'puno',
      paginas: [
        'Cuidado: esos gatos verdes son aliens de Ícaro. Bajaron del ovni que da vueltas al planeta.',
        'En el suelo, {puno} las golpea.\nTambién puedes caerles encima.',
      ],
    },
    {
      planeta: 0, dir: camino(S.enemigos + 5, -2.2), icono: 'dash',
      paginas: [
        'La siguiente isla está demasiado lejos para un salto.',
        'Salta y, cuando ya vayas cayendo, aprieta {dash}: sales disparad@ hacia adelante.',
        'El dash deja tu velocidad vertical en cero. Si lo usas cayendo, frenas la caída y llegas mucho más lejos.',
        'Solo tienes un dash en el aire. Se recarga al tocar el suelo.',
      ],
    },
    {
      planeta: 0, dir: camino(S.arena - 12.5, 3), icono: 'pisoton',
      paginas: [
        'Isla de la Arena.\nEl ovni de Ícaro no te va a dejar pasar tan fácil.',
        'En el aire, aprieta {pisoton}: dejas de avanzar y caes en picada a 40 m/s.',
        'El jefe tiene un casco duro. Saltarle encima, el puño o el dash no le hacen nada.',
        'Cuando salte y caiga, queda mareado y abre el casco. Ahí, ¡pisotón!',
        'Al caer suelta una onda que corre por el suelo. Si estás en el aire, pasa por debajo de ti.',
      ],
    },
    {
      planeta: 0, dir: camino(S.canon - 6, -2.5), icono: 'alien',
      paginas: [
        'Los aliens encerraron el cañón con un campo de fuerza. Es más alto de lo que puedes saltar.',
        'Si le ganas al jefe de la arena, el campo se apaga.',
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
