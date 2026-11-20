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

## Mecánicas
1. **Velocidad de escape** ✓ (18 nov): cañón de Columba (nivel 1) y SÚPER en el Laboratorio. Barra con marca de `v_esc = √(2GM/r)`, línea punteada que predice el vuelo con la misma función `pasoNewton` (leapfrog) que mueve al jugador. Desde el 20 nov Ícaro está lejos (`lejano` en el nivel: solo dibujo, sin gravedad) y la meta del nivel 1 es `meta: { escapar: true }`: nivel.js revisa en pleno vuelo la energía `½v² − GM/r ≥ 0` (= pasar `v_esc`). Entonces `js/cineDespegue.js`: cinemática (animación, no física) hacia Ícaro, fundido y pantalla de carga con las fórmulas del nivel (números calculados) y datos curiosos; al seguir, `completarNivel()`.
2. **Órbitas de Kepler:** `v = √(GM/a)`, `T² ∝ a³`.
3. **Mareas:** `h(θ) ∝ (3cos²θ − 1)/2`. El Sol también causa mareas, más débiles. Ya se ven en el mar del menú (esfera estirada 1+2ε / 1−ε hacia la luna).
4. Nivel final que combina todo.
5. Multijugador (SHOULD).

## Estado técnico
Módulos ES sin bundler. Three.js 0.170.0 copiado en `js/vendor/three/` (importmap en `index.html`). **No abre con doble clic**: hay que servirlo (GitHub Pages o `python -m http.server`). Mobile first, con joystick táctil, botones y teclado. PC: el primer clic atrapa el mouse (Pointer Lock) y mover el mouse gira la cámara, Esc lo suelta; clic o F = puño, Espacio = salto y en el aire pisotón (también Ctrl), E = leer, Tab = centrar (ver `README.md`). Ver la tabla de archivos en `README.md`.
- **Física (`js/fisica.js`, sin DOM):** `g = g0·(R/r)²`, manda el planeta con más `g`, colisiones esféricas (planetas, islas y rocas), `superficieEn()` para poner cosas en el suelo, `pasoNewton` + `simularTrayectoria` para vuelos. Pruebas: `node pruebas/fisica.test.mjs`.
- **Jugador:** paso fijo 1/120 s, coyote time, buffer, salto variable, dash que sigue la curvatura, puño/pisotón, estados `carga`/`vuelo` (escape.js), `dormido` (cinemática), mar no sólido (vuelve a `seguro`).
- **Niveles:** datos en `js/niveles/*.js` (planetas con `mar`, `islas` (con `ancho` sobre el mar), `rocas`, `canon`, `muros`, `boton`, `flores`, `carteles` con `paginas`, `enemigos`, `meta`). Nivel 1 Columba (R 40, mar 42) es un tutorial por tramos: salto → aliens (puño) → dash → Isla de la Arena (mini jefe, enseña el pisotón) → cañón tapado por un campo de fuerza que se apaga al ganar; los huecos están medidos con la física real. Islas con `veg` (vegetacion.js, decorativa).
- **Ovni y jefe:** `js/ovni.js` (órbita circular real con `pasoNewton`, `v = √(GM/r)`; viajes con Bézier = animación), `js/jefe.js` (fases de la pelea + cerebro del jefe vía `ETYPES.jefe.ia`; checkpoint `juego.checkpoint` en la entrada de la arena), `js/aliens.js` (gatos-alien verdes con antenas, inspirados en la foto que mandó Martín). El botón de pisotón sigue en el motor pero ya no está en el nivel 1. El resto de niveles falta.
- **Carteles:** postes en el mundo; cerca, el botón de ataque pasa a LEER y se abre la caja de diálogo (`js/dialogo.js`, modo `cartel` pausa el juego). Nada de textos flotantes ni banner de objetivo en el nivel 1.
- **UI:** sin emojis ni texto en botones; íconos SVG de `js/iconos.js` (Iconoir MIT + propios).
- **Física extra:** `mundo.muros` = cajas orientadas (choque esfera–caja); `superficieEn` solo cuenta el planeta y sus propias islas. Laboratorio = mapa debug antiguo con anillos Bézier (no son física).
- **Menú:** playa de Columba con niebla, rayos falsos, luna de día y marea (`js/columba3d.js`). Antes de la historia hay luna; después, sin luna y gris; `nivelesCompletos` le devuelve color, mar y luna.
- **Historia:** diálogo en negro (texto del grupo, `%NAME%`) + cinemática del despertar en la cama de flores (`js/despertar.js`).
- **Personalización:** traje (5), accesorio (3), nombre, dificultad 7/5/3 corazones, g×. Se guarda en `localStorage` (`almaLunarAjustes`).
- **Editor de planetas** (`js/editor/`, menú o `?editor`, desktop first): paleta de bloques, inspector con la física del planeta, terreno = islas-esfera, bases tierra/agua/roca/arena/hielo/lava (la lava quita un corazón), Probar con la física real, exporta `nivel.json` (`js/niveles/formato.js`, prueba `pruebas/formato.test.mjs`). El bloque **Nota** es un placeholder: cuando Martín mande un JSON con notas, hay que convertir cada una en un bloque real.
- **Audio (`js/audio.js`, archivos en `sonidos/`):** tabla `SONIDOS` evento → archivo; escucha los `emitir()` (dash, pisoton, vida, reaparecer, despegue, aterrizaje, leer, paginaCartel, golpeEnemigo). Se desbloquea al primer toque (móvil). Botón parlante en HUD y menú, tecla M, deslizadores Música/Efectos en Personaje (`ajustes.volMusica`, `volEfectos`, `silencio`). Música del jefe 1 en 3 trozos (`boss1-fadein/loop/fadeout.mp3`): entrada con `emitir('jefe')`, loop con `jefeAterriza` (espera a que termine la entrada), salida con `jefeVencido`; el loop recorta el relleno del MP3 (`bordesDelLoop`). Música de fondo por nivel (`musica: 'columba'` en el nivel, `loopDe` en la tabla); zona de combate (`emitir('arena')` en `jefe.empezar`) apaga la música y entra `tension-loop.wav`, que se calla cuando aparece el jefe; al ganar vuelve la música tras el fadeout. Sonidos de nave, tensión, jugador (salto, pasos cada 1,9 m de suelo en `actualizarAudio`, puño, `tocaSuelo` con la rapidez de caída, chapuzón en `agua`) y espacio (`despegueRugido` + loop estéreo `espacio` desde `cineDespegue` hasta `cargaFin`, campanitas `cargaTarjeta`/`cargaLista`, `nivelCompleto`) generados con `herramientas/generar-sonidos.py` (numpy). Falta: música del menú.
- **Cinemática del ovni (`js/cineOvni.js`):** la primera vez que pisas la arena, modo `cine`: Bézier + zigzag, se pasa de largo y vuelve como resorte amortiguado, estirar/aplastar con volumen constante. Al terminar, `ovniFlotar` y empieza la oleada.
- **Gancho de pruebas:** `window.__game` expone juego, player, step, ajustes, enemies(), jugarNivel(i), laboratorio(), menu(), columba, editor, abrirEditor().
- **Pendiente:**
  - La lunita del casco aparece al tomar un fragmento (los fragmentos parten en Ícaro).
  - Los enemigos del Laboratorio se parecen al protagonista; los aliens de Ícaro ya son gatos verdes. Falta decidir si la tribu de Aestus son estos mismos aliens.
  - Falta probar el salto y la cámara en un celular real.

El plan completo está en el doc «Alma Lunar · Plan del proyecto» (Claude Docs).

## Cómo trabajar con Martín
- Tono cálido, de tú a tú, como compañero. Nada corporativo. Se vale el humor y no hace falta forzar modismos.
- **Honestidad:** no darle la razón automáticamente. Si algo falla, decirlo y explicar por qué.
- Como todos deben defender el código, **explicar la física detrás de cada cambio**. Nada de magia.
- Priorizar MUST sobre SHOULD. Avanzar sin preguntar de más y hacer preguntas solo si cambian el rumbo.
- Después de cambiar física, correr las pruebas deterministas de física. Si se toca el estilo, mirar capturas en vertical y en horizontal.
- **Versión:** `js/version.js` tiene el historial que se ve en el inicio. Cada cambio que va a `main` suma una entrada arriba (0.x hasta la feria).
- Commits en español. Los avances importantes van a `main`.
