# Prototipo de gravedad · mapa debug

Prototipo web (mobile first) de un juego de plataformas en planetas con gravedad propia.
Proyecto para la Unidad IV · El Universo (Física, 2° medio).

Abrir `index.html` en el navegador. Usa Three.js desde CDN, así que no hay que instalar nada.

## Física
- **Gravitación de Newton:** cada planeta atrae hacia su centro con `g = G·M / r²`.
  Se define la gravedad en la superficie `g0` y el radio `R`, así que `G·M = g0·R²`.
- **Planeta dominante:** en cada punto manda el planeta que más tira (simplificación: no se suman las fuerzas).
- **Velocidad de escape:** `v = √(2·g·r)` se muestra en el panel debug.

## Controles
| Acción | Celular | Teclado |
|---|---|---|
| Mover | joystick (mitad izquierda) | WASD / flechas |
| Cámara | arrastrar a la derecha | Q / E, mouse, R para centrar |
| Saltar | SALTO | Espacio |
| Puño / pisotón (en el aire) | PUÑO | J |
| Dash | DASH | K / Shift |

## Estilo y personalización
- Estilo cartoon liviano: sombras de tres tonos, contorno negro y planetas pintados.
- Protagonista chibi: un planeta pequeño con ojitos dentro de un casco de vidrio.
- 🎨 cambia el color del traje (5 colores) y 🎩 cambia el accesorio (sombrero de copa, lazo o ninguno). Se guarda en el dispositivo.

## Enemigos
- **Chico:** 1 de vida, muere con cualquier ataque.
- **Mediano:** 3 de vida.
- **Grande:** 6 de vida. Solo le hace daño el pisotón y embiste.
