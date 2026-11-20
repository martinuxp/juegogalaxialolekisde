/* =========================================================
   Nivel 2 · ÍCARO · PARTE 2: LA SUPERFICIE
   ---------------------------------------------------------
   Sales del laberinto de la cueva por una grieta y llegas al
   desierto de Ícaro (js/superficie.js):
     1. ISLAS de roca sobre la arena hirviendo (saltos de 5–6 m)
     2. PASILLOS de piedra entre ruinas, con un puente roto
     3. FISURAS: la tierra se partió y cada lado quedó 6,5 m
        más alto. El salto normal llega a v²/2g = 14²/40 = 4,9 m:
        solo se suben con las botas (20²/40 = 10 m).
     4. La ARENA de MEOWL en la cima (js/meowl.js). Al ganarle,
        sube el CAÑÓN: hay que pasar la velocidad de escape de
        Ícaro, que es mucho más grande que la de Columba.

   EL PLANETA: radio de la arena R = 400 m, g = 20 m/s².
     G·M = g·R² = 20·400² = 3,2·10⁶ m³/s²
     v_esc = √(2·G·M / r) ≈ √(2·20·400) ≈ 126 m/s en la arena
   (Columba: ≈ 44 m/s). Por eso el cañón de los aliens carga
   hasta 150 m/s, y más rápido.
   ========================================================= */
import { V3 } from '../util.js';
import { dirXZ, puntoXZ, ejesEn, construirSuperficie, actualizarSuperficie, animarSuperficie, quemar, H_FISURA } from '../superficie.js';
import { construirMeowl, prepararMeowl, stepMeowl, animarMeowl } from '../meowl.js';
import { CFG } from '../config.js';

// Kepler (el próximo planeta) se ve en el cielo, arriba a la derecha del sol. Es solo dibujo.
const ejA = ejesEn(0, -150);
const posKepler = puntoXZ(0, -150, 16).addScaledVector(ejA.ez, -600).addScaledVector(ejA.ey, 330).addScaledVector(ejA.ex, 200);
const atras = new V3(0, 0, 1);            // los carteles miran hacia donde vienes

const nivel = {
  id: 'icaro',
  parte: 'superficie',
  numero: 2,
  nombre: 'Ícaro',
  ley: 'Velocidad de escape',
  musica: 'dunasCombate',        // audio.js: la música de pelea de la cueva es el fondo del camino (la pidió muxp)
  musicaJefe: 'meowlPelea',      // y al despertar Meowl entra su música con un crossfade
  botas: true,                   // llegas con las botas de salto puestas

  // luz de desierto al atardecer: cielo naranjo, luz cálida y una neblina amarilla que se come lo lejano
  ambiente: { cielo: 0xffd9a0, suelo: 0xb0602a, luzCielo: 1.05, sol: 1.3, dirSol: [30, 90, -60], fondo: 0xffdb85,
    niebla: [0xffdb85, 70, 320], estrellas: false, luzJugador: 0 },

  planetas: [
    // R = 398 (la roca bajo la arena) · mar = 400 (la arena, que NO es sólida y quema).
    // g = 20,2 en R → en la arena g = 20,2·(398/400)² ≈ 20 m/s²
    { name: 'Ícaro', c: new V3(0, 0, 0), R: 398, mar: 400, g: 20.2, oculto: true, quema: true, color: 0xe08a3f },
  ],
  lejano: { nombre: 'Kepler', dir: posKepler.clone().normalize(), dist: posKepler.length(), R: 70, color: 0x6c8fe0, seed: 9, brillo: 'rgba(150,190,255,.4)', emisivo: 0.45 },

  decorado: (grupo, planetas) => { construirSuperficie(grupo, planetas); construirMeowl(grupo); },
  alListo: () => prepararMeowl(),
  alPaso: dt => { actualizarSuperficie(dt); stepMeowl(dt); },
  alCuadro: (dt, t) => { animarSuperficie(dt, t); animarMeowl(dt, t); },
  quemar,

  // el cañón de los aliens: enterrado en la arena de Meowl, sube al ganar (meowl.js)
  canon: { planeta: 0, dir: dirXZ(0, -149), max: 150, ritmo: 55 },

  inicio: { planeta: 0, dir: dirXZ(0, -0.5), mirar: new V3(0, 0, -1) },
  // [tipo, planeta, dirección, altura, casa]: gatos-alien cuidando las mesas de roca
  enemigos: [
    ['alien', 0, dirXZ(13, -93), 0.05, 4],
    ['alien', 0, dirXZ(7, -88), 0.05, 4],
    ['alien', 0, dirXZ(13, -109), 0.05, 4],
    // meowlitos (meowl.js) escondidos BAJO LA ARENA, al lado de las rocas: cuando pasas cerca salen,
    // brillan medio segundo y te saltan encima. Si fallan, caen a la arena y se vuelven a hundir.
    ['meowlito', 0, dirXZ(4, -19), 0.02],         // entre la isla 1 y la 2
    ['meowlito', 0, dirXZ(-5, -31.5), 0.02],      // entre la isla 2 y la 3
    ['meowlito', 0, dirXZ(5.5, -44), 0.02],       // entre la isla 3 y la 4
    ['meowlito', 0, dirXZ(4, -58.5), 0.02],       // en la esquina de los pasillos
    ['meowlito', 0, dirXZ(12.8, -75), 0.02],      // en el puente roto
    ['meowlito', 0, dirXZ(1.5, -88), 0.02],       // al pie de la mesa B
    // y dos escondidos en las grietas de las mesas altas (salen de la roca y te persiguen sin bajarse)
    ['meowlito', 0, dirXZ(5, -105), 0.05, 4],
    ['meowlito', 0, dirXZ(6, -118.5), 0.05, 3.5],
  ],

  carteles: [
    {
      planeta: 0, dir: dirXZ(-4.5, -4.5), icono: 'salto', mira: atras,
      paginas: [
        'La superficie de Ícaro.\nLa arena está hirviendo: si la tocas, te quemas.',
        'Avanza saltando por las rocas y los pasillos de piedra.',
        'Si caes, saltas del susto de vuelta a la última roca que pisaste... pero pierdes un corazón.',
        'Allá al fondo, en la cima, hay un árbol seco. Algo te está mirando desde ahí.',
      ],
    },
    {
      planeta: 0, dir: dirXZ(5.5, -95), icono: 'botas', mira: atras,
      paginas: [
        `Una fisura: la tierra se partió y el otro lado quedó ${String(H_FISURA).replace('.', ',')} m más arriba.`,
        `Tu salto normal llega a h = v²/2g = ${CFG.jump}²/(2·20) ≈ 4,9 m. No alcanza.`,
        `Con las botas sales a ${CFG.botasV} m/s: ${CFG.botasV}²/(2·20) = 10 m.\nMantén {super}, espera el brillo y suelta.`,
        'Mientras subes, muévete hacia la pared: la gravedad te frena, pero de lado sigues avanzando.',
      ],
    },
    {
      planeta: 0, dir: dirXZ(-1.4, -124.5), icono: 'meowl', mira: atras,
      paginas: [
        'El árbol de Meowl. Sus crías, los meowlitos, viven bajo la arena de la cima.',
        'Antes de lanzarse, brillan. Medio segundo después se lanzan hacia ti: salta y cáeles encima.',
        'Meowl hace lo mismo desde su rama, pero acelera de forma exponencial: v = v₀·e^(t/τ). Te quita 2 corazones.',
        'Cuando se clava en la arena queda aturdido. Ahí, ¡salta sobre su cabeza!',
        'Dicen que bajo esa arena los aliens enterraron un cañón.',
      ],
    },
  ],

  // pantalla de carga al escapar (cineDespegue.js): las fórmulas de ESTE nivel
  tarjetas: ({ vesc, vDespegue, f1 }) => {
    const vCol = Math.sqrt(2 * 27.5 * 40 * 40 / 45.3);
    return [
      { tipo: 'formula', titulo: 'Las botas y las fisuras', formula: 'h = v² / 2g',
        texto: `Salto normal: ${CFG.jump}²/(2·20) ≈ 4,9 m. Botas: ${CFG.botasV}²/(2·20) = 10 m. Cada fisura subía ${f1(H_FISURA)} m: solo con botas.` },
      { tipo: 'formula', titulo: 'Velocidad de escape de Ícaro', formula: 'v<sub>esc</sub> = √(2·G·M / r)',
        texto: `Desde la boca del cañón, v<sub>esc</sub> = ${f1(vesc)} m/s: ${f1(vesc / vCol)} veces la de Columba (≈ ${f1(vCol)} m/s). Ícaro es 10 veces más grande.` + (vDespegue ? ` Saliste a ${f1(vDespegue)} m/s.` : '') },
      { tipo: 'formula', titulo: 'Energía: ¿escapaste?', formula: '½·v² − G·M / r ≥ 0',
        texto: 'Igual que en Columba: tu energía de movimiento le ganó a la de la gravedad. La masa se cancela.' },
      { tipo: 'formula', titulo: 'La picada de Meowl', formula: 'v = v₀·e<sup>t/τ</sup>',
        texto: 'Cada τ segundos su rapidez se multiplicaba por e ≈ 2,7. En la fase 1, τ = 0,36 s; en la 3, τ = 0,25 s: por eso cada vez llegaba antes.' },
      { tipo: 'formula', titulo: 'El salto del susto', formula: 'v<sub>y</sub> = √(2·g·H) · v<sub>x</sub> = d / t',
        texto: 'Al quemarte, el juego calculaba un tiro parabólico de vuelta a la última roca: cuánto subir y qué tan rápido moverte de lado para caer justo ahí.' },
      { tipo: 'formula', titulo: 'El confeti', formula: 'a = g − k·v → v<sub>límite</sub> = g / k',
        texto: `Cada papelito tenía roce con el aire. Por eso no caía cada vez más rápido: llegaba a ${f1(20 / 2.4)} m/s y bajaba flotando.` },
    ];
  },

  // se gana al ESCAPAR de Ícaro con el cañón (nivel.js revisa la energía en pleno vuelo)
  meta: { escapar: true },
};
export default nivel;
