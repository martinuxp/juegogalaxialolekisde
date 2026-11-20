/* =========================================================
   version.js · Versión del juego e historial de cambios
   ---------------------------------------------------------
   Se ve en la pantalla de inicio (abajo, junto al pie).
   Tocando la versión se abre la lista de cambios.

   REGLA: cada vez que se mergea algo a main, se agrega una
   entrada ARRIBA de la lista. La primera es la versión actual.
     · número: 0.x mientras sea prototipo; 1.0 = la feria (27 nov)
     · fecha: el día del cambio (hora de Chile)
   ========================================================= */
export const HISTORIAL = [
  { v: '0.9', fecha: '19 nov', cambios: 'Mouse atrapado para la cámara (Esc lo suelta), Ctrl = pisotón y versión en el inicio' },
  { v: '0.8', fecha: '19 nov', cambios: 'Controles de PC: clic o F = puño, doble Espacio = pisotón, E = leer, Tab = centrar' },
  { v: '0.7', fecha: '19 nov', cambios: 'Columba con vegetación, ovni de Ícaro en órbita y mini jefe alien' },
  { v: '0.6', fecha: '19 nov', cambios: 'Editor de planetas: bloques, terreno, bases, probar y exportar nivel.json' },
  { v: '0.5', fecha: '18 nov', cambios: 'Tutorial de Columba por mecánicas, carteles con diálogo e íconos' },
  { v: '0.4', fecha: '18 nov', cambios: 'Botón del cañón, horizontal obligatorio en celular y diálogo por líneas' },
  { v: '0.3', fecha: '18 nov', cambios: 'Módulos, menú en la playa, historia inicial y nivel 1 con cañón' },
  { v: '0.2', fecha: '18 nov', cambios: 'Estilo cartoon y protagonista con casco de vidrio' },
  { v: '0.1', fecha: '17 nov', cambios: 'Prototipo de gravedad: planetas, salto, dash, puño, pisotón y enemigos' },
];
export const VERSION = HISTORIAL[0].v;
