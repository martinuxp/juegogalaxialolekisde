/* =========================================================
   mision.js · MISIÓN ACTUAL en pantalla
   ---------------------------------------------------------
   Cada parte del juego tiene una misión corta ("Persigue a
   MeiMei") y una línea de ayuda ("esquiva sus bolas...").
   Cuando la misión cambia aparece GRANDE al centro, junto con
   el planeta en que estás. A los 3 s se achica y se queda fija
   arriba a la izquierda, bajo los corazones. Si la tocas, se
   vuelve a ver grande.

   No toca la física: solo LEE el estado de cada nivel (jefe,
   Meowl, MeiMei, posición del jugador) y elige qué mostrar.
   La lista de misiones de cada planeta está abajo, en MISIONES.
   ========================================================= */
import { juego, escuchar } from './estado.js';
import { player } from './jugador.js';
import { mundo } from './fisica.js';
import { pelea } from './jefe.js';
import { pm } from './meowl.js';
import { mei } from './meimei.js';
import { kep } from './kepler.js';
import * as K from './keplerDatos.js';
import { icono } from './iconos.js';

const $ = id => document.getElementById(id);
const M = { nivel: null, id: null, etapa: 0, grandeT: 0, t: 0, cabecera: false };

/* ---------- las misiones de cada planeta ----------
   Cada función devuelve [id, misión, ayuda]. El id solo sirve para saber si cambió. */
const COLUMBA_R = 42;                                   // radio del mar de Columba (nivel1-columba.js)
const MISIONES = {
  // COLUMBA: el camino baja por el meridiano; s = metros desde el polo = ángulo · R
  columba() {
    const P = mundo.planetas[0];
    const up = player.pos.clone().sub(P.c).normalize();
    const s = Math.acos(Math.max(-1, Math.min(1, up.y))) * COLUMBA_R;
    // la etapa solo avanza (si vuelves atrás, la misión no retrocede)
    const etapa = pelea.fase === 'ganada' ? 5 : s > 84 ? 4 : s > 60 ? 3 : s > 45 ? 2 : 1;
    M.etapa = Math.max(M.etapa, etapa);
    switch (M.etapa) {
      case 1: return ['salto', 'Salta de isla en isla', 'Si caes al agua, vuelves a la última isla'];
      case 2: return ['aliens', 'Derrota a los aliens con el puño', 'Acércate y ataca: el puño los empuja'];
      case 3: return ['dash', 'Cruza los huecos grandes', 'Salta y, en el aire, haz dash para llegar más lejos'];
      case 4:
        if (pelea.fase === 'bajaJefe' || pelea.fase === 'pelea')
          return ['jefe', 'Derrota al jefe con el pisotón', 'Salta sobre él y ataca en el aire: solo el pisotón le hace daño'];
        if (pelea.fase === 'oleada' || pelea.fase === 'llegada') return ['oleada', 'Derrota a los aliens del ovni', 'Después baja el jefe'];
        return ['arena', 'Entra a la Isla de la Arena', 'Algo te espera ahí...'];
      default: return ['canon', 'Súbete al cañón y escapa de Columba', 'Mantén SÚPER hasta pasar la marca v<sub>esc</sub> = √(2GM/r)'];
    }
  },
  // ÍCARO, parte 1: la cueva y el pozo
  icaro() {
    if (!player.botas) return ['cueva', 'Explora la cueva', 'Sigue la luz: alguien vive aquí abajo'];
    return ['pozo', 'Sube por el pozo con las botas', 'Mantén SÚPER para agacharte y suelta para el súper salto'];
  },
  // ÍCARO, parte 2: el desierto
  icaroSuperficie() {
    if (pm.pelea === 'intro' || pm.pelea === 'pelea')
      return ['meowl', 'Derrota a Meowl', 'Esquiva su picada. Cuando quede mareado en la arena, salta encima (3 veces)'];
    if (pm.pelea === 'ganada') return ['canonI', 'Súbete al cañón y escapa de Ícaro', 'Carga hasta pasar v<sub>esc</sub> ≈ 124 m/s'];
    return ['desierto', 'Cruza el desierto hasta el árbol de Meowl', 'La arena quema: ve por las rocas. Las fisuras se pasan con el súper salto'];
  },
  // KEPLER
  kepler() {
    if (mei.modo === 'ganada') {
      if (mei.fragmento && mei.fragmento.visible) return ['frag', 'Toma el fragmento de la luna', 'Lo soltó MeiMei: busca la columna de luz'];
      return ['salidaK', 'Súbete al resorte de salida', 'Dispara cuando apunta hacia donde va la luna: v<sub>luna</sub> + 32 m/s > v<sub>esc</sub>'];
    }
    if (mei.modo === 'pelea') {
      if (mei.fase >= 3) return ['mei3', 'Derrota a MeiMei', 'Cuando vuele en órbita, esquívala: al caer queda mareada'];
      if (mei.fase === 2) return ['mei2', 'Derrota a MeiMei', 'Ahora tira bolas y llama gatos. Esquiva su salto y pégale mareada'];
      return ['mei1', 'Derrota a MeiMei', 'Esquiva su salto. Cuando quede mareada (estrellas), salta encima o pégale'];
    }
    if (kep.enLuna || mei.modo === 'luna') return ['luna', 'Encuentra a MeiMei en la luna', 'Aquí la gravedad es g = 6 m/s²'];
    if (mei.modo === 'espera' || mei.modo === 'vuela' || kep.sP > K.S_LAGO[1] - 30 || player.state === 'vuelo')
      return ['resorte', 'Súbete al resorte', 'Te lanza a la Luna 2, adelantado a donde va a estar'];
    return ['carrera', 'Persigue a MeiMei', 'Desliza cuesta abajo. El anillo rojo marca dónde cae cada bola de nieve'];
  },
};
function misionDe(def) {
  if (!def || def.laboratorio || def.editor) return null;
  if (def.id === 'icaro') return def.parte === 'superficie' ? MISIONES.icaroSuperficie() : MISIONES.icaro();
  return MISIONES[def.id] ? MISIONES[def.id]() : null;
}

/* ---------- dibujo ---------- */
function pintar(m, conCabecera) {
  const def = juego.nivel, el = $('mision');
  el.innerHTML =
    `<div class="mPlaneta">${icono('gravedad', 2)}<span>${def.nombre.toUpperCase()}</span>` +
    `${conCabecera ? `<em>Nivel ${def.numero} · ${def.ley}</em>` : ''}</div>` +
    `<div class="mTexto">${m[1]}</div><div class="mAyuda">${m[2]}</div>`;
}
function agrandar(seg = 3.2) {
  const el = $('mision');
  M.grandeT = seg;
  el.classList.remove('esquina'); el.classList.add('grande');
  el.classList.remove('nueva'); void el.offsetWidth; el.classList.add('nueva');
}

/** Al empezar un nivel (o seguirlo): planeta + misión, grande. ui.js tituloNivel() manda emitir('anunciarNivel'). */
export function anunciarNivel() {
  M.nivel = juego.nivel; M.etapa = 0; M.id = null; M.cabecera = true;
  revisar(true);
}
escuchar('anunciarNivel', anunciarNivel);
function revisar(forzar = false) {
  const el = $('mision');
  const m = misionDe(juego.nivel);
  if (!m) { el.classList.add('oculto'); M.id = null; return; }
  el.classList.remove('oculto');
  if (m[0] !== M.id || forzar) {
    const primera = M.cabecera; M.cabecera = false;
    M.id = m[0];
    pintar(m, primera);
    agrandar(primera ? 3.6 : 3);
  }
}

/** Cada cuadro (main.js). Revisa la misión 4 veces por segundo. */
export function actualizarMision(dt) {
  const el = $('mision');
  if (!el) return;
  if (juego.nivel !== M.nivel) { M.nivel = juego.nivel; M.etapa = 0; M.id = null; }
  // se esconde en cinemáticas, diálogos y menús
  el.classList.toggle('pausa', juego.modo !== 'juego');
  if (juego.modo !== 'juego') return;
  M.t -= dt;
  if (M.t <= 0) { M.t = 0.25; revisar(); }
  if (M.grandeT > 0) {
    M.grandeT -= dt;
    if (M.grandeT <= 0) { el.classList.remove('grande'); el.classList.add('esquina'); }
  }
}

// tocar la misión chica la vuelve a mostrar grande
const el0 = $('mision');
if (el0) el0.addEventListener('pointerdown', e => { e.stopPropagation(); if (el0.classList.contains('esquina')) agrandar(3); });

export const _mision = M;
