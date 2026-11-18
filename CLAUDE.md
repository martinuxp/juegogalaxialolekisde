# CLAUDE.md · Alma Lunar

Contexto del proyecto para cualquier sesión de Claude que trabaje en este repo.

## Qué es
Proyecto escolar de Física (2° medio, Liceo Camilo Henríquez, Temuco; profesor Nermo Soto Méndez). Un videojuego jugable sobre el Universo, basado en una ley física. Se presenta el viernes 27 nov 2026 en una feria de juegos (5 min de presentación y los compañeros juegan). Grupos de hasta 3.
- **Hito 2** (prototipo jugable con la mecánica física central): semana del 16 al 20 nov. Fecha por confirmar con el profe.
- La pauta prohíbe copiar un juego existente. Todos los integrantes deben poder **explicar el código**.
- Entregables: bitácora de prompts (Anexo B), ficha de física (Anexo A, la escriben los estudiantes) y autoevaluación (Anexo C).
- Duda abierta para el profe: la rúbrica suma 80 o 68.

## Idea del juego
«Alma Lunar» (nombre tentativo; también «Marea Perdida»). Plataformas 3D tipo Mario Galaxy en planetas pequeños, cada uno con su gravedad. El protagonista busca de planeta en planeta el «alma lunar» (la luna) de su planeta, robada por una tribu de un planeta vecino. Sin luna casi no hay mareas y su planeta se muere.
- **Cada ley física es una mecánica nueva** para llegar al planeta de los ladrones. Todas se combinan en el nivel final.
- Se juega en solitario. El multijugador cooperativo de 2 a 3 es **SHOULD** y se hace al final (opciones: Playroom Kit o Firebase). En 3 jugadores habría más switches y enemigos.

## Planetas (canon)
- **Columba:** planeta de origen (gravedad de Newton).
- **Ícaro:** velocidad de escape.
- **Planetas de Kepler:** lunas en órbita.
- **Aestus:** mareas y planeta de los ladrones.

## Mecánicas por implementar
1. **Supersalto por velocidad de escape** (primero, para el Hito 2): `v = √(2·g·r)`.
2. **Órbitas de Kepler:** `v = √(GM/a)`, `T² ∝ a³`.
3. **Mareas:** `h(θ) ∝ (3cos²θ − 1)/2`. El Sol también causa mareas, más débiles.
4. Nivel final que combina todo.
5. Multijugador (SHOULD).

## Estado técnico
Un solo `index.html` con Three.js 0.170.0 (módulos ES por importmap desde jsDelivr, ruta `three/addons/`). Mobile first, con joystick táctil, botones y teclado.
- **Física:** `g = g0·(R/r)²`, manda el planeta con más `g` en cada punto, colisiones esféricas, el «arriba» del jugador se alinea con la gravedad, velocidades proyectadas al plano tangente, paso fijo 1/120 s, coyote time, buffer de salto, salto de altura variable, dash que sigue la curvatura, puño en suelo y pisotón en el aire, anillos de lanzamiento (curva de Bézier entre planetas), enemigos chico/mediano/grande (el grande solo recibe daño del pisotón y embiste).
- **Estilo:** cartoon liviano al estilo Content Warning. `MeshToonMaterial` con 3 tonos, contorno negro por back-face, planetas de icosfera con color por vértice, grano CSS.
- **Protagonista:** chibi más ancho que alto de lado, casco redondo transparente con un planeta pequeño con ojitos cartoon adentro. 🎨 cambia el color del traje (5 colores) y 🎩 cambia el accesorio (sombrero de copa, lazo, nada). Se guarda en `localStorage`.
- **Gancho de pruebas:** `window.__game` expone player, enemies, input, PLANETS, step, cam y pause.
- **Pendiente:**
  - La luna dentro del casco es de muestra. Debe aparecer al recuperar un fragmento del alma lunar.
  - Los enemigos se parecen al protagonista. La tribu de Aestus necesita otra silueta.
  - Falta probar el salto y la cámara en un celular real.
  - Plan de modularización: `js/fisica.js`, `jugador.js`, `enemigos.js`, `mecanicas/{escape,kepler,mareas}.js`, `niveles/*.js`, `ui.js`, `red.js`.

El plan completo está en el doc «Alma Lunar · Plan del proyecto» (Claude Docs).

## Cómo trabajar con Martín
- Tono cálido, de tú a tú, como compañero. Nada corporativo. Se vale el humor y no hace falta forzar modismos.
- **Honestidad:** no darle la razón automáticamente. Si algo falla, decirlo y explicar por qué.
- Como todos deben defender el código, **explicar la física detrás de cada cambio**. Nada de magia.
- Priorizar MUST sobre SHOULD. Avanzar sin preguntar de más y hacer preguntas solo si cambian el rumbo.
- Después de cambiar física, correr las pruebas deterministas de física. Si se toca el estilo, mirar capturas en vertical y en horizontal.
- Commits en español. Los avances importantes van a `main`.
