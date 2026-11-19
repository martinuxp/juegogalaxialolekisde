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
| Órbita circular | `v = √(G·M / r)`, `T = 2πr / v` | El ovni de Ícaro da vueltas a Columba (r = 70 m, v ≈ 25 m/s, T ≈ 17,6 s) movido por `pasoNewton` |
| Tiro parabólico | `t = 2·v_y / g` | El jefe alien calcula su salto para caer donde estás |

En el nivel 1 cada tramo se pasa con una mecánica: saltos de 6 m, huecos de 14,5 m que piden salto + dash (un salto llega a ~12,9 m, medido) y la Isla de la Arena (mini jefe: aliens que baja el ovni y un jefe al que solo le hace daño el pisotón cuando queda mareado) y un campo de fuerza de 5,5 m alrededor del cañón (el salto sube ~3,9 m = v²/2g) que se apaga al ganarle al jefe.

Simplificaciones: en cada punto manda solo el planeta que más atrae; sin aire ni roce; el impulso del cañón es instantáneo.

## Editor de planetas

En el menú, **Editor de planetas** (o `index.html?editor`). Está pensado para PC, con mouse y teclado.

- **Paleta (abajo):** seleccionar/mover, borrar, terreno, roca, enemigo, cartel, botón, muros, cañón, inicio, flores, fragmento y **Nota**.
- **Terreno:** clic levanta una colina (o isla, si el planeta es de agua). Mantener apretado la sigue subiendo, Shift+clic la baja y arrastrar pinta una cordillera. Las colinas son esferas, las mismas que usa `fisica.js` para chocar.
- **Planetas (derecha):** base (tierra, agua, roca, arena, hielo o lava), color, radio R, gravedad g, posición y si es la meta. El panel muestra `G·M = g·R²`, `v_esc = √(2·G·M/r)` y el salto máximo `h = v²/2g`. Al poner una colina o un muro dice si se alcanza saltando.
- **Nota:** un bloque rosado que todavía no existe. Escribes qué quieres ("un trampolín que te lance el doble de alto") y Claude lo convierte en un bloque real.
- **Abajo** se ve la altura y la gravedad bajo el mouse, y la distancia hasta lo seleccionado, para medir los huecos.
- **Probar** (P) usa la física real; Shift+P parte desde donde está el mouse. Esc vuelve al editor.
- **Exportar** descarga `nombre-del-nivel.json`; **Copiar** lo deja en el portapapeles para pegarlo en el chat. También se puede abrir un `.json` (o arrastrarlo a la ventana), y abrir una copia de Columba o del Laboratorio.
- Teclas: 1…0 herramientas, N nota, Supr borrar, Ctrl+Z / Ctrl+Y, F mirar lo seleccionado; clic derecho y arrastrar gira la cámara, la rueda hace zoom.

El formato del archivo está explicado en `js/niveles/formato.js`. Un nivel exportado se deja en el juego con
`export default nivelDesdeEditor({ ...el json... })`, porque un JSON también es JavaScript válido.

## Pruebas de física

```
node pruebas/fisica.test.mjs
node pruebas/formato.test.mjs
```

Revisa que `g` baje con `1/r²`, que `v_esc` sea correcta, que con 95 % de `v_esc` vuelvas a caer y con 105 % no,
que la altura máxima coincida con la conservación de la energía, que el cañón del nivel 1 llegue a Ícaro y que la órbita del ovni
mantenga su radio y tenga el período `T = 2πr/v`.
`formato.test.mjs` revisa que Columba pase por el editor (ida y vuelta por JSON) sin moverse más de un centímetro.

## Controles

| Acción | Celular | Teclado |
|---|---|---|
| Mover | joystick (mitad izquierda) | WASD / flechas |
| Cámara | arrastrar a la derecha | Q / E, mouse, R para centrar |
| Saltar | SALTO | Espacio |
| Puño / pisotón (en el aire) / leer cartel | botón del guante (cambia de ícono) | J |
| Dash | DASH | K / Shift |
| Cargar cañón / supersalto | botón del cañón (mantener y soltar) | L |
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
| `js/aliens.js`, `js/ovni.js`, `js/jefe.js` | Gatos-alien y ovni (dibujo), órbita del ovni y pelea del jefe |
| `js/vegetacion.js` | Pasto, flores, matas, árboles y nenúfares (InstancedMesh, no chocan) |
| `js/mundo.js`, `js/nivel.js` | Construir el nivel (islas, mar, cañón) y sus reglas |
| `js/niveles/*.js` | Un archivo por nivel (datos que se pueden afinar) |
| `js/columba3d.js`, `js/menu.js` | Playa del menú (con la marea) y personalización |
| `js/despertar.js` | Diálogo inicial y cinemática del despertar |
| `js/camara.js`, `js/entrada.js`, `js/ui.js` | Cámara, controles y HUD |
| `js/dialogo.js` | Caja de diálogo de los carteles (pausa el juego) |
| `js/editor/editor.js`, `js/editor/editor.css` | Editor de planetas (modo debug) |
| `js/niveles/formato.js` | Formato `nivel.json` del editor y bases de planeta (tierra, agua, roca, arena, hielo, lava) |
| `js/iconos.js` | Íconos SVG (Iconoir, MIT, y algunos propios); el juego no usa emojis |
