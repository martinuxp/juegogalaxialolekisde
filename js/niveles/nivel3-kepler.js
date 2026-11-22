/* =========================================================
   Nivel 3 · KEPLER: la carrera de MeiMei
   ---------------------------------------------------------
   Un planeta de nieve MUY montañoso con dos lunas en órbita.
   MeiMei (meimei.js) te robó un fragmento de la luna y la
   persigues patinando cerro abajo (kepler.js):
     Cumbre → Gran Bajada → Desfiladero (carámbanos) →
     Lago Congelado (hielo, casi sin roce) → RESORTE a la Luna 2
   La pelea es en la Luna 2. Al ganar, otro resorte te saca de
   Kepler (v_luna + v_resorte ≥ v_esc) rumbo a Aestus.

   EL PLANETA: R = 300 m, g = 12 m/s² al nivel del "mar".
     G·M = g·R² = 1,08·10⁶ m³/s²
   LAS LUNAS (3ª ley de Kepler: T² / a³ es igual para las dos):
     Luna 1: a = 380 m, T = 44,8 s · Luna 2: a = 440 m, T = 55,8 s
   ========================================================= */
import { V3 } from '../util.js';
import * as K from '../keplerDatos.js';
import { relieveKepler, construirKepler, antesDelPaso, alPaso, alCuadro, kep } from '../kepler.js';
import { mei } from '../meimei.js';

const f1 = x => x.toFixed(1).replace('.', ',');
const ini = K.muestraEn(2);
const [L1, L2] = K.LUNAS;
// Aestus (el planeta de los ladrones) se ve lejos, sobre la cumbre. Es solo dibujo.
const dirAestus = new V3(0.2, 0.75, -0.62).normalize();

const nivel = {
  id: 'kepler',
  numero: 3,
  nombre: 'Kepler',
  ley: 'Órbitas de Kepler',
  intro: 'kepler',                 // main.js: llegada en el cañón de Ícaro (kepler.js)
  deslizar: true,                  // jugador.js: en la nieve RESBALAS (pendiente, roce y aire)
  botas: true,
  musica: null,                    // la carrera la pide la cinemática, para que el "drop" calce con la partida de MeiMei
  precargar: ['keplerCarrera'],
  musicaJefe: 'meimeiPelea',       // audio.js: crossfade al empezar la pelea en la Luna 2

  // luz fría de montaña: cielo celeste, sol blanco, niebla azulada que esconde lo lejano
  ambiente: { cielo: 0xdbeaff, suelo: 0x6a7fa8, luzCielo: 1.15, sol: 1.45, dirSol: [55, 65, -52], fondo: 0xcfe0ff,
    niebla: [0xdbe8ff, 90, 520], estrellas: false, luzJugador: 0 },

  planetas: [
    // el relieve (montañas) está en keplerDatos.js: la grilla que choca es la misma que se dibuja
    { name: 'Kepler', c: new V3(0, 0, 0), R: K.R, g: K.G0, oculto: true, color: 0xf4f8ff, get relieve() { return relieveKepler(); } },
    // las lunas: hill = radio de la esfera de Hill (adentro, manda su gravedad)
    { name: 'Luna 1', c: K.posLuna(L1, 0), R: L1.R, g: L1.g, hill: L1.hill, oculto: true, color: L1.color },
    { name: 'Luna 2', c: K.posLuna(L2, 0), R: L2.R, g: L2.g, hill: L2.hill, oculto: true, color: L2.color },
  ],
  lejano: { nombre: 'Aestus', dir: dirAestus, dist: 760, R: 60, color: 0x3f7fd0, seed: 41, brillo: 'rgba(120,180,255,.35)', emisivo: 0.4 },

  decorado: (grupo, planetas) => construirKepler(grupo, planetas),
  antesDelPaso,
  alPaso,
  alCuadro,
  // el despegue final sale desde la Luna 2 (cineDespegue.js)
  camDespegue: () => {
    const S = mei.salida, c = kep.lunas[1].P.c;
    return { base: S.local.clone().add(c), arriba: S.arriba.clone() };
  },

  inicio: { planeta: 0, dir: ini.u.clone(), mirar: ini.t.clone() },
  enemigos: [],
  carteles: [],
  meta: { escapar: true },

  // la pantalla de carga (con los números de verdad)
  tarjetas: ({ vesc, vDespegue }) => [
    { tipo: 'formula', titulo: 'Tercera ley de Kepler', formula: 'T² / a³ = 4π² / (G·M)',
      texto: `Luna 1: a = ${L1.a} m, T = ${f1(L1.T)} s. Luna 2: a = ${L2.a} m, T = ${f1(L2.T)} s. Las dos dan T²/a³ = ${(L1.T ** 2 / L1.a ** 3 * 1e5).toFixed(2).replace('.', ',')}·10⁻⁵ s²/m³: la más lejana tarda más.` },
    { tipo: 'formula', titulo: 'Velocidad de una órbita', formula: 'v = √(G·M / a)',
      texto: `La Luna 2 avanza a ${f1(L2.v)} m/s. Por eso el resorte apuntaba ADELANTADO: mientras volabas, la luna se movía.` },
    { tipo: 'formula', titulo: 'Deslizar en la nieve', formula: 'a = g·(senθ − μ·cosθ) − c·v²',
      texto: `En la nieve μ = ${K.DESLIZ.mu[0]}, en el hielo μ = ${K.DESLIZ.mu[1]}. El aire frena más mientras más rápido vas: en una bajada de 20° llegas a unos ${f1(K.velLimite(20, K.DESLIZ.mu[0]))} m/s y ya no aceleras más.` },
    { tipo: 'formula', titulo: 'El resorte', formula: '½·k·x² = ½·m·v²',
      texto: `Comprimido x = ${f1(K.RESORTE.x)} m, para lanzarte a 44 m/s necesita k = ${Math.round(K.kResorte(44) / 1000)} 000 N/m (con m = ${K.RESORTE.m} kg).` },
    { tipo: 'formula', titulo: 'El salto orbital de MeiMei', formula: 'v = √(G·m / r)',
      texto: `En la Luna 2 (g = ${L2.g} m/s²) bastan ${f1(K.PELEA.vOrbita())} m/s para quedar en órbita a 1,5 m del suelo. Una vuelta: ${f1(K.PELEA.tOrbita())} s.` },
    { tipo: 'formula', titulo: 'Salir de Kepler', formula: 'v<sub>esc</sub> = √2 · v<sub>órbita</sub>',
      texto: `Desde la órbita de la Luna 2, v_esc = ${f1(K.PELEA.vEscape())} m/s. La luna ya te daba ${f1(L2.v)} m/s y el resorte sumó ${K.PELEA.vSalida}.` + (vDespegue ? ` Saliste a ${f1(vDespegue)} m/s.` : '') },
  ],
};
export default nivel;
