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
  { v: '0.23', fecha: '24 nov', cambios: 'Misión actual en pantalla en cada parte del juego, como franja de peligro: aparece grande con el planeta y después queda chica bajo los corazones. MeiMei tira más bolas de nieve y más grandes en la carrera. Pelea más clara: después de cada ataque queda mareada (estrellas y flecha) y le pegas saltando encima o con el puño. El fragmento cae de verdad al suelo de la luna con una columna de luz' },
  { v: '0.22', fecha: '24 nov', cambios: 'Kepler más ágil: ya no esperas a la Luna 2 en el resorte (el reloj de las órbitas se ajusta para que llegue justo contigo), el salto en la luna tiene tope y ya no te saca hacia el planeta, y MeiMei derrapa unos 10 m y frena su salto orbital en vez de dar vueltas a la luna' },
  { v: '0.21', fecha: '22 nov', cambios: 'Kepler (nivel 3): carrera patinando por un planeta de montañas nevadas detrás de MeiMei, la leopardo de las nieves que robó un fragmento de la luna. Deslizar con pendiente, roce y aire, carámbanos y avalanchas, lunas en órbita de verdad (3ª ley de Kepler), resorte que apunta adelantado a la Luna 2, pelea en la luna con salto orbital y resorte de salida a Aestus. Música de muxp con bucle por crossfade' },
  { v: '0.20', fecha: '20 nov', cambios: 'Ícaro: meowlitos escondidos que salen del suelo en el laberinto y de la arena en el camino, más gatos-alien en el laberinto, ruinas del desierto sólidas (columnas, arco, obeliscos, estatua) y música: la pelea de la cueva suena en el camino y la de Meowl entra con crossfade' },
  { v: '0.19', fecha: '20 nov', cambios: 'Ícaro desde arriba: desierto de arena hirviendo que quema, islas y pasillos de roca, fisuras que piden las botas, cinemática al salir de la grieta, jefe Meowl con sus meowlitos, confeti y cañón a Kepler. Sonidos nuevos del desierto y de la pelea' },
  { v: '0.18', fecha: '20 nov', cambios: 'Ícaro: pozo vertical procedural con capas de colores, repisas con gatos-alien, eco en la cueva y salida a la luz. Jugar sigue en el planeta donde ibas y Ícaro guarda las botas y la última repisa' },
  { v: '0.17', fecha: '20 nov', cambios: 'Botas de salto: mantener para agacharte, destello y sonido al estar listo, salto alto con control total. Cámara que no se mete en las rocas. Charlas más rápidas con fondo rojo difuminado. Música de las Dunas Subterráneas con crossfade a la versión de pelea' },
  { v: '0.16', fecha: '20 nov', cambios: 'Ícaro: cinemática de llegada (choque con el cinturón y caída a la grieta), cueva oscura de dunas con linterna, personaje misteriosa con su charla, botas de salto, música y sonidos nuevos' },
  { v: '0.15', fecha: '20 nov', cambios: 'Sonidos: música ambiente del espacio en el despegue y la carga, rugido del cohete, salto, pasos, puño, caídas, chapuzón y fanfarria al completar' },
  { v: '0.14', fecha: '20 nov', cambios: 'Ícaro lejano: escapar con v_esc, cinemática del despegue y pantalla de carga con fórmulas y datos curiosos' },
  { v: '0.13', fecha: '20 nov', cambios: 'Música de Columba, tensión al entrar a la arena y cinemática cartoon del ovni con sonidos de nave' },
  { v: '0.12', fecha: '20 nov', cambios: 'Música del primer jefe: entrada al aparecer, loop al tocar el suelo y salida al ganarle' },
  { v: '0.11', fecha: '20 nov', cambios: 'Sonidos: dash, pisotón, daño, cañón, voces de los aliens, carteles y botones; silencio (M) y volúmenes' },
  { v: '0.10', fecha: '19 nov', cambios: 'Campo de fuerza del cañón: los muros laterales ya no se ven torcidos' },
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
