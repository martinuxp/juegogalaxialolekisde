# Alma Lunar

Juego de plataformas 3D en planetas con gravedad propia, para la Unidad IV · El Universo (Física, 2° medio).
A Columba le robaron su luna y sin ella su mar se queda quieto. Cada ley física es una mecánica para ir a recuperarla.

## Cómo abrirlo

El juego usa módulos de JavaScript, así que **no se abre con doble clic** (el navegador bloquea los archivos locales).
Hay dos formas:

1. **Con internet:** el link de GitHub Pages (Settings → Pages → rama `main`, carpeta `/`).
2. **Sin internet (feria, PC del liceo):** en la carpeta del juego, abre una terminal y escribe

   ```
   python -m http.server 8000
   ```

   y entra a `http://localhost:8000`. Three.js ya está copiado en `js/vendor/`, así que no necesita internet.

## Leyes físicas implementadas

| Ley | Fórmula | Dónde se ve |
|---|---|---|
| Gravitación de Newton | `g = G·M / r² = g0·(R/r)²` | Todo: caminar, saltar, caer en cada planeta |
| Velocidad de escape | `v_esc = √(2·G·M / r)` | Cañón de Columba (y SÚPER en el Laboratorio): barra con la marca de `v_esc` y línea que predice el vuelo |

Simplificaciones: en cada punto manda solo el planeta que más atrae; sin aire ni roce; el impulso del cañón es instantáneo.

## Pruebas de física

```
node pruebas/fisica.test.mjs
```

Revisa que `g` baje con `1/r²`, que `v_esc` sea correcta, que con 95 % de `v_esc` vuelvas a caer y con 105 % no,
que la altura máxima coincida con la conservación de la energía y que el cañón del nivel 1 llegue a Ícaro.

## Controles

| Acción | Celular | Teclado |
|---|---|---|
| Mover | joystick (mitad izquierda) | WASD / flechas |
| Cámara | arrastrar a la derecha | Q / E, mouse, R para centrar |
| Saltar | SALTO | Espacio |
| Puño / pisotón (en el aire) | PUÑO | J |
| Dash | DASH | K / Shift |
| Cargar cañón / supersalto | SÚPER (mantener y soltar) | L |
| Panel de física | DEBUG | G |

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html`, `estilos.css` | Página, botones, HUD y menús |
| `js/main.js` | Arranque y bucle principal (física a paso fijo de 1/120 s) |
| `js/fisica.js` | Newton, velocidad de escape, choques y vuelo libre (se prueba con node) |
| `js/jugador.js` | Estados y malla del protagonista |
| `js/enemigos.js`, `js/combate.js`, `js/efectos.js` | Enemigos, contacto y onda del pisotón |
| `js/mecanicas/escape.js` | Carga del cañón/supersalto, barra y línea de trayectoria |
| `js/mundo.js`, `js/nivel.js` | Construir el nivel (islas, mar, cañón) y sus reglas |
| `js/niveles/*.js` | Un archivo por nivel (datos que se pueden afinar) |
| `js/columba3d.js`, `js/menu.js` | Playa del menú (con la marea) y personalización |
| `js/despertar.js` | Diálogo inicial y cinemática del despertar |
| `js/camara.js`, `js/entrada.js`, `js/ui.js` | Cámara, controles y HUD |
