/* =========================================================
   LABORATORIO · el mapa de pruebas
   ---------------------------------------------------------
   Para jugar con la física en la demostración:
   g× (multiplicador de gravedad), cámara lenta, reaparecer
   enemigos y panel de depuración. Supersalto disponible.
   Los anillos celestes NO son física (curva de Bézier): son un atajo.
   ========================================================= */
import { V3, dirLL } from '../util.js';

export default {
  id: 'laboratorio',
  numero: 0,
  nombre: 'Laboratorio',
  ley: 'Todas (modo libre)',
  laboratorio: true,
  superDesdeInicio: true,

  planetas: [
    { name: 'Hogar', c: new V3(0, 0, 0), R: 14, g: 30, color: 0x3f7be0 },
    { name: 'Mini', c: new V3(38, 22, -24), R: 5, g: 40, color: 0xe0a03f },
    { name: 'Arena', c: new V3(-24, 14, -72), R: 20, g: 34, color: 0x9a4fe0 },
  ],
  rocas: [
    { planeta: 0, dir: dirLL(62, 0), h: 2.6, R: 1.3 },
    { planeta: 0, dir: dirLL(53, 14), h: 6.2, R: 1.4 },
    { planeta: 0, dir: dirLL(44, 28), h: 10.4, R: 1.9 },
  ],
  pads: [
    { planet: 0, dir: dirLL(-15, 0), to: 2 },
    { planet: 0, dir: dirLL(15, 110), to: 1 },
    { planet: 1, dir: dirLL(60, 0), to: 0 },
    { planet: 2, dir: dirLL(70, 0), to: 0 },
  ],
  enemigos: [
    ['small', 0, dirLL(35, 40)], ['small', 0, dirLL(30, -60)], ['small', 0, dirLL(30, 90)], ['small', 0, dirLL(20, -120)],
    ['medium', 0, dirLL(40, 180)], ['medium', 0, dirLL(0, 60)],
    ['small', 1, dirLL(10, 60)], ['small', 1, dirLL(-30, 200)],
    ['large', 2, dirLL(40, 30)], ['medium', 2, dirLL(30, -50)], ['small', 2, dirLL(70, 120)], ['small', 2, dirLL(10, 150)],
  ],
  inicio: { planeta: 0, dir: dirLL(90, 0), mirar: new V3(0, 0, -1) },
  objetivos: { inicio: 'Modo libre: prueba la física (g×, ⏱, SÚPER)' },
};
