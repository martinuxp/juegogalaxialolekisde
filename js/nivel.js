/* =========================================================
   nivel.js · Reglas del nivel: objetivo, cañón, fragmento y meta
   ---------------------------------------------------------
   Pasos de un nivel:
     'jugar'    → recorrer el nivel (tomar el fragmento si hay)
     'completo' → llegaste al planeta de la meta
   El CAÑÓN: si estás parado sobre él, el botón SÚPER aparece
   y carga el disparo (mecanicas/escape.js).
   ========================================================= */
import { juego, ajustes, guardarAjustes, emitir, escuchar } from './estado.js';
import { CFG, DIFICULTADES } from './config.js';
import { mundo } from './fisica.js';
import { construirMundo, piezas } from './mundo.js';
import { spawnEnemies } from './enemigos.js';
import { player, respawnPlayer, mostrarLunita } from './jugador.js';
import { camaraAlInicio } from './camara.js';
import { limpiarEscape } from './mecanicas/escape.js';
import { limpiarEntrada } from './entrada.js';

export const progreso = { paso: 'jugar', tiempo: 0, avisoCanon: false };

export function cargarNivel(def) {
  juego.nivel = def;
  mundo.gravMul = 1;
  construirMundo(def);
  spawnEnemies(def.enemigos || []);

  player.maxHP = def.laboratorio ? CFG.maxHP : DIFICULTADES[ajustes.dificultad].corazones;
  player.tieneSuper = !!def.superDesdeInicio;
  player.acostado = 0; player.ojos = 1;
  mostrarLunita(!!def.laboratorio);   // la lunita del casco aparece al tomar un fragmento
  progreso.paso = def.laboratorio ? 'libre' : 'jugar';
  progreso.tiempo = 0;
  progreso.avisoCanon = false;
  juego.enCanon = null;

  limpiarEntrada();
  limpiarEscape();
  respawnPlayer();
  camaraAlInicio();
  emitir('nivel', def);
  emitir('objetivo', def.objetivos.inicio);
}

/** Se llama en cada paso de física. */
export function stepNivel(dt) {
  progreso.tiempo += dt;
  const def = juego.nivel;

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
    emitir('objetivo', def.objetivos.canon);
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

// ¿aterrizó en el planeta de la meta?
escuchar('aterrizaje', solido => {
  const def = juego.nivel;
  if (!def || progreso.paso !== 'jugar' || !def.meta) return;
  if (solido === mundo.planetas[def.meta.aterrizarEn]) {
    progreso.paso = 'completo';
    ajustes.nivelesCompletos = Math.max(ajustes.nivelesCompletos, def.numero);
    guardarAjustes();
    emitir('completo', { def, tiempo: progreso.tiempo });
  }
});
