/* =========================================================
   config.js · Números para afinar cómo se siente el juego
   ---------------------------------------------------------
   Las unidades son "metros" y "segundos" del juego.
   Cambiar algo aquí no cambia la física de Newton (eso está
   en fisica.js); cambia qué tan rápido corre, salta, etc.
   ========================================================= */
export const CFG = {
  // movimiento
  run: 9, groundAccel: 70, airAccel: 22,
  // salto normal: velocidad inicial, corte al soltar, coyote time y buffer
  jump: 14, jumpCut: 0.45, coyote: 0.1, buffer: 0.13,
  // dash
  dashSpeed: 24, dashTime: 0.17, dashCD: 0.5, dashKeep: 0.5,
  // pisotón
  poundWind: 0.2, poundSpeed: 40, poundLand: 0.22, shockR: 4.5,
  poundAltMin: 1.0,   // PC: si vas cayendo a menos de 1 m del suelo, Espacio es un salto guardado, no pisotón
  // puño
  punchTime: 0.28, punchFrom: 0.05, punchTo: 0.18, punchReach: 1.15, punchR: 1.0,
  // rebote al pisar enemigos
  stomp: 11, stompHeld: 15,
  // vida
  maxHP: 5, invul: 1.2,
  // radio del jugador (para chocar con planetas)
  r: 0.6,

  // SUPERSALTO (velocidad de escape)
  superRitmo: 22,   // cuánta velocidad se carga por segundo (m/s cada s)
  superMax: 60,     // tope de la barra (m/s)
  superMin: 4,      // si sueltas antes de esto, no sale nada

  // BOTAS DE SALTO (Ícaro): mantienes SÚPER, te agachas y, cuando brillas, sueltas.
  // Es un salto normal (te mueves, haces dash) pero con más velocidad hacia arriba:
  //   altura máxima h = v² / (2·g)   →  en la cueva (g = 20): 20² / 40 = 10 m (el normal: 4,9 m)
  botasV: 20,       // velocidad del súper salto (m/s)
  botasCarga: 0.45, // segundos agachad@ hasta que está listo
};

/** Corazones según la dificultad elegida en el menú. */
export const DIFICULTADES = {
  facil:   { nombre: 'Fácil',   corazones: 7 },
  normal:  { nombre: 'Normal',  corazones: 5 },
  dificil: { nombre: 'Difícil', corazones: 3 },
};
