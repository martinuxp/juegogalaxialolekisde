/* =========================================================
   nivel.js · Reglas del nivel: objetivo, cañón, fragmento y meta
   ---------------------------------------------------------
   Pasos de un nivel:
     'jugar'    → recorrer el nivel (tomar el fragmento si hay)
     'completo' → llegaste al planeta de la meta
   El CAÑÓN: si estás parado sobre él, el botón CAÑÓN aparece
   y carga el disparo (mecanicas/escape.js).
   CARTELES: si estás cerca de uno, juego.cartelCerca lo dice
   (el botón de ataque pasa a ser LEER).
   BOTÓN + MUROS: un pisotón sobre el botón baja los muros.
   JEFE: al ganarle (jefe.js) se apaga el campo de fuerza
   del cañón, que usa el mismo código de los muros.
   OVNI: si el nivel tiene def.ovni, aparece en órbita (ovni.js).
   ========================================================= */
import { juego, ajustes, guardarAjustes, emitir, escuchar } from './estado.js';
import { CFG, DIFICULTADES } from './config.js';
import { mundo, GM } from './fisica.js';
import { construirMundo, piezas } from './mundo.js';
import { spawnEnemies } from './enemigos.js';
import { player, respawnPlayer, mostrarLunita } from './jugador.js';
import { camaraAlInicio, cam } from './camara.js';
import { limpiarEscape } from './mecanicas/escape.js';
import { limpiarEntrada } from './entrada.js';
import { crearOvniNivel, limpiarOvni } from './ovni.js';
import { prepararJefe } from './jefe.js';

export const progreso = { paso: 'jugar', tiempo: 0, avisoCanon: false, murosT: -1 };

export function cargarNivel(def) {
  juego.nivel = def;
  mundo.gravMul = 1;
  construirMundo(def);
  spawnEnemies(def.enemigos || []);
  if (def.ovni) crearOvniNivel(def.ovni); else limpiarOvni();
  prepararJefe(def);

  player.maxHP = def.laboratorio ? CFG.maxHP : DIFICULTADES[ajustes.dificultad].corazones;
  player.tieneSuper = !!def.superDesdeInicio;
  player.acostado = 0; player.ojos = 1;
  mostrarLunita(!!def.laboratorio);   // la lunita del casco aparece al tomar un fragmento
  progreso.paso = def.laboratorio ? 'libre' : 'jugar';
  progreso.tiempo = 0;
  progreso.avisoCanon = false;
  progreso.murosT = -1;
  juego.enCanon = null;
  juego.cartelCerca = null;

  limpiarEntrada();
  limpiarEscape();
  respawnPlayer();
  camaraAlInicio();
  emitir('nivel', def);
  emitir('objetivo', def.objetivos ? def.objetivos.inicio : '');
}

/** Se llama en cada paso de física. */
export function stepNivel(dt) {
  progreso.tiempo += dt;
  const def = juego.nivel;

  // META "escapar": ¿ya tienes energía para no volver nunca?
  //   energía por kilo = ½·v² − G·M/r   (movimiento − lo que pide la gravedad)
  //   si es ≥ 0, la gravedad ya no te puede traer de vuelta: es la MISMA condición que v ≥ v_esc,
  //   pero sirve en cualquier punto del vuelo (no solo al despegar).
  // Esperamos a que estés 10 m arriba del mar, para que se alcance a ver el despegue.
  if (def.meta && def.meta.escapar && progreso.paso === 'jugar' && player.state === 'vuelo') {
    const P = mundo.planetas[0];
    const r = player.pos.distanceTo(P.c);
    const energia = 0.5 * player.vel.lengthSq() - GM(P) / r;
    if (energia >= 0 && r > (P.mar || P.R) + 10) {
      progreso.paso = 'escapando';
      emitir('escapo', { v: player.vel.length(), r });
    }
  }

  // ¿está parado sobre el cañón?
  const c = piezas.canon;
  const antes = juego.enCanon;
  juego.enCanon = null;
  if (c && progreso.paso === 'jugar') {
    const cerca = player.pos.distanceTo(c.userData.suelo) < 2.4;
    if ((cerca && player.grounded) || (player.state === 'carga' && player.fijo)) juego.enCanon = c.userData;
  }
  if (juego.enCanon && !antes && !progreso.avisoCanon) {
    progreso.avisoCanon = true;
    if (def.objetivos && def.objetivos.canon) emitir('objetivo', def.objetivos.canon);
  }

  // ¿hay un cartel cerca? (a menos de 2,3 m y parado en el suelo)
  juego.cartelCerca = null;
  if (player.grounded && player.state === 'normal') {
    let mejor = 2.3;
    for (const k of piezas.carteles) {
      const d = player.pos.distanceTo(k.pos);
      if (d < mejor) { mejor = d; juego.cartelCerca = k; }
    }
  }

  // muros bajando: en 1,4 s se hunden en el suelo (con una curva suave)
  if (progreso.murosT >= 0 && progreso.murosT < 1) {
    progreso.murosT = Math.min(1, progreso.murosT + dt / 1.4);
    const k = progreso.murosT * progreso.murosT * (3 - 2 * progreso.murosT);
    for (const m of piezas.muros) {
      m.solido.c.copy(m.base).addScaledVector(m.arriba, -m.bajada * k);
      m.mesh.position.copy(m.solido.c);
    }
    if (progreso.murosT >= 1) {
      // ya bajaron: los sacamos de la física
      mundo.muros.length = 0;
      for (const m of piezas.muros) m.mesh.visible = false;
    }
  }

  // ¿tomó el fragmento?
  const f = piezas.fragmento;
  if (f && f.visible && player.pos.distanceTo(f.position) < 1.6) {
    f.visible = false;
    player.tieneSuper = true;
    mostrarLunita(true);
    for (const k of piezas.carteles) if (k.userData.despues) k.visible = true;
    emitir('fragmento');
    if (def.objetivos.fragmento) emitir('objetivo', def.objetivos.fragmento);
  }
}

// PISOTÓN: si cae sobre el botón (a menos de 1,4 m de su centro), lo aprieta
escuchar('pisoton', pos => {
  const b = piezas.boton;
  if (!b || b.apretado || pos.distanceTo(b.pos) > 1.4) return;
  b.apretado = true;
  b.tapa.position.y = 0.06;                       // la tapa se hunde
  b.tapa.material.emissive.setHex(0x0a3d1f); b.tapa.material.color.setHex(0x7dffa8);
  progreso.murosT = 0;                            // empiezan a bajar los muros
  cam.shake = 0.6;
  emitir('boton');
});

// le ganaste al jefe: el campo de fuerza del cañón se apaga (baja igual que los muros)
escuchar('jefeVencido', () => {
  if (progreso.murosT < 0) progreso.murosT = 0;
});

/** Lo llama la pantalla de carga al terminar (cineDespegue.js): el nivel queda completo. */
export function completarNivel() {
  const def = juego.nivel;
  progreso.paso = 'completo';
  ajustes.nivelesCompletos = Math.max(ajustes.nivelesCompletos, def.numero);
  guardarAjustes();
  emitir('completo', { def, tiempo: progreso.tiempo });
}

// ¿aterrizó en el planeta de la meta?
escuchar('aterrizaje', solido => {
  const def = juego.nivel;
  if (!def || progreso.paso !== 'jugar' || !def.meta || def.meta.aterrizarEn == null) return;
  if (solido === mundo.planetas[def.meta.aterrizarEn]) {
    progreso.paso = 'completo';
    ajustes.nivelesCompletos = Math.max(ajustes.nivelesCompletos, def.numero);
    guardarAjustes();
    emitir('completo', { def, tiempo: progreso.tiempo });
  }
});
