/* =========================================================
   jefe.js · Mini pelea final del tutorial: la Isla de la Arena
   ---------------------------------------------------------
   El examen final de Columba: para ganar hay que usar todo lo
   aprendido (salto, puño, dash y pisotón).

   FASES DE LA PELEA
     'espera'    nadie en la arena; el ovni sigue en órbita
     'llegada'   pisas la arena → el ovni baja y se queda flotando
     'oleada'    el rayo baja 3 gatos-alien (caen por gravedad)
     'bajaJefe'  cuando no queda ninguno, el rayo baja al JEFE
     'pelea'     el jefe ataca (abajo). Cada vez que lo golpeas,
                 el ovni manda 2 aliens más
     'ganada'    el jefe cae, el ovni huye a Ícaro y se apaga
                 el campo de fuerza del cañón (nivel.js)
   Si pierdes todos los corazones vuelves a la entrada de la
   arena (checkpoint) y la pelea empieza de nuevo.

   CEREBRO DEL JEFE (se repite):
     acecha → EMBESTIDA (tiembla y corre a 14 m/s: salta o haz dash)
     acecha → SALTO sobre ti: tiro parabólico apuntado
              · sube con vy = 16 m/s; tiempo de vuelo t = 2·vy/g
              · rapidez horizontal = distancia / t  → cae donde estabas
              · al caer suelta una ONDA por el suelo: si estás en el
                suelo te pega, si estás en el aire pasa por debajo
              · queda MAREADO 2,6 s con el casco abierto:
                un PISOTÓN le quita 1 de vida (tiene 3)
   ========================================================= */
import { THREE, V3, tangent } from './util.js';
import { scene } from './escena.js';
import { juego, emitir, escuchar } from './estado.js';
import { mundo, superficieEn } from './fisica.js';
import { ETYPES, agregarEnemigo, quitarEnemigos } from './enemigos.js';
import { player, hurtPlayer } from './jugador.js';
import { ovni, ovniIrA, ovniFlotar, ovniRayo } from './ovni.js';
import { cam } from './camara.js';

export const pelea = {
  def: null, fase: 'nada', t: 0,
  P: null, centro: new V3(), arriba: new V3(), radioSuelo: 0,
  hover: new V3(),
  cola: 0,            // aliens que faltan por bajar con el rayo
  colaT: 0,
  jefe: null,
  ondas: [],
};

/** Se llama al cargar un nivel. def.jefe = { planeta, dir, radio, entrada, alturaOvni } */
export function prepararJefe(def) {
  limpiarOndas();
  pelea.def = def.jefe || null;
  pelea.fase = pelea.def ? 'espera' : 'nada';
  pelea.jefe = null; pelea.cola = 0;
  juego.checkpoint = null;
  if (!pelea.def) return;
  const d = pelea.def;
  pelea.P = mundo.planetas[d.planeta];
  pelea.arriba.copy(d.dir);
  pelea.radioSuelo = superficieEn(pelea.P, d.dir);
  pelea.centro.copy(pelea.P.c).addScaledVector(d.dir, pelea.radioSuelo);
  pelea.hover.copy(pelea.centro).addScaledVector(d.dir, d.alturaOvni);
  emitir('jefe', null);
}

/* ---------- utilidades sobre la arena (que es un pedazo de esfera) ---------- */
/** Distancia medida por el suelo desde el centro de la arena hasta pos. */
function distArena(pos) {
  const d = pos.clone().sub(pelea.P.c).normalize();
  return Math.acos(Math.min(1, d.dot(pelea.arriba))) * pelea.radioSuelo;
}
/** Dirección (desde el centro del planeta) de un punto al azar de la arena, a menos de "rmax" metros del centro. */
const _a = new V3(), _b = new V3();
function dirAlAzar(rmax) {
  _a.set(1, 0, 0); if (Math.abs(pelea.arriba.x) > 0.9) _a.set(0, 0, 1);
  tangent(_a, _a, pelea.arriba).normalize(); _b.crossVectors(pelea.arriba, _a);
  const ang = Math.random() * Math.PI * 2, rad = (0.35 + 0.65 * Math.random()) * rmax;
  return pelea.arriba.clone().addScaledVector(_a, Math.cos(ang) * rad / pelea.radioSuelo)
    .addScaledVector(_b, Math.sin(ang) * rad / pelea.radioSuelo).normalize();
}

/* ---------- el rayo baja enemigos: aparecen arriba y CAEN por gravedad ---------- */
function bajarAlien() {
  const e = agregarEnemigo('alien', pelea.def.planeta, dirAlAzar(pelea.def.radio - 3), pelea.def.alturaOvni - 3);
  e.dePelea = true;
  e.T = { ...e.T, aggro: 40 };   // en la arena todos te ven
}

function empezar() {
  juego.checkpoint = { planeta: pelea.def.planeta, dir: pelea.def.entrada, mirar: pelea.arriba };
  cam.shake = 0.3;
  if (ovni.estado === 'flota') { pelea.fase = 'oleada'; pelea.cola = 3; pelea.colaT = 0.6; return; }
  pelea.fase = 'llegada';
  ovniIrA(pelea.hover, 3.2, () => {
    ovniFlotar(pelea.hover, pelea.arriba);
    if (pelea.fase === 'llegada') { pelea.fase = 'oleada'; pelea.cola = 3; pelea.colaT = 0.4; }
  });
}

function vivos(cond) { return juego.enemigos.filter(e => !e.dead && cond(e)).length; }

/** Paso de la pelea (1/120 s). */
export function stepJefe(dt) {
  if (!pelea.def) return;
  pasoOndas(dt);
  pelea.t += dt;
  switch (pelea.fase) {
    case 'espera':
      if (player.grounded && player.planet === pelea.P && distArena(player.pos) < pelea.def.radio - 1.5) empezar();
      break;
    case 'oleada': case 'pelea': {
      // bajar los aliens que falten, uno cada 0,7 s, con el rayo prendido
      if (pelea.cola > 0) {
        ovniRayo(pelea.def.alturaOvni);
        pelea.colaT -= dt;
        if (pelea.colaT <= 0) { bajarAlien(); pelea.cola--; pelea.colaT = 0.7; }
      } else ovniRayo(0);
      if (pelea.fase === 'oleada' && pelea.cola === 0 && vivos(e => e.dePelea) === 0) {
        pelea.fase = 'bajaJefe'; pelea.t = 0;
        ovniRayo(pelea.def.alturaOvni);
        const j = agregarEnemigo('jefe', pelea.def.planeta, pelea.arriba, pelea.def.alturaOvni - 3);
        j.dePelea = true; j.fase = 'cae'; j.t = 0; j.ataques = 0; j.mareado = 0;
        pelea.jefe = j;
        emitir('jefe', { hp: j.hp, max: j.T.hp });
      }
      if (pelea.fase === 'pelea' && pelea.jefe.dead) ganar();
      break;
    }
    case 'ganada':
      if (!pelea.huyo && pelea.t > 0.9) {
        pelea.huyo = true;
        ovniIrA(pelea.destinoHuida, 5, () => ovniFlotar(pelea.destinoHuida, pelea.arribaHuida));
      }
      break;
    case 'bajaJefe':
      if (pelea.jefe.grounded) { pelea.fase = 'pelea'; ovniRayo(0); cam.shake = 0.5; pelea.jefe.fase = 'acecha'; pelea.jefe.t = 1; }
      break;
  }
}

function ganar() {
  pelea.fase = 'ganada'; pelea.t = 0; pelea.huyo = false;
  ovniRayo(0);
  emitir('jefe', null);
  // los aliens que quedan se rinden (se desvanecen)
  for (const e of juego.enemigos) if (e.dePelea && !e.dead) { e.dead = true; e.dieT = 0.3; }
  // el ovni escapa a Ícaro: te muestra a dónde tienes que ir
  const I = mundo.planetas.find(P => P !== pelea.P) || pelea.P;
  // flota a un costado de Ícaro (no detrás), para que lo veas desde el cañón
  const haciaI = I.c.clone().sub(pelea.P.c).normalize();
  const lado = new V3().crossVectors(haciaI, new V3(0, 1, 0));
  if (lado.lengthSq() < 1e-4) lado.set(1, 0, 0);
  const arribaI = haciaI.multiplyScalar(0.3).addScaledVector(lado.normalize(), 0.95).normalize();
  pelea.destinoHuida = I.c.clone().addScaledVector(arribaI, I.R + 7);
  pelea.arribaHuida = arribaI;
  cam.shake = 0.8;
  emitir('jefeVencido');
}

// si te quedas sin corazones en plena pelea: todo vuelve a empezar desde la entrada
escuchar('reaparecer', () => {
  if (!pelea.def || pelea.fase === 'espera' || pelea.fase === 'ganada' || pelea.fase === 'nada') return;
  quitarEnemigos(e => e.dePelea);
  limpiarOndas();
  ovniRayo(0);
  pelea.jefe = null; pelea.cola = 0;
  pelea.fase = 'espera';
  emitir('jefe', null);
});

/* =========================================================
   CEREBRO DEL JEFE. enemigos.js lo llama en cada paso:
   escribe en w hacia dónde camina y devuelve su rapidez.
   La gravedad y los choques los pone enemigos.js (igual que a todos).
   ========================================================= */
const _toP = new V3(), _d = new V3();
ETYPES.jefe.ia = (e, dt, w) => {
  const p = player;
  const enojo = e.T.hp - e.hp;                       // con menos vida, más rápido
  if (e.golpeado) { e.golpeado = false; e.fase = 'acecha'; e.t = 1.2; e.state = 'walk'; e.balistico = false;
    if (e.hp > 0) emitir('jefe', { hp: e.hp, max: e.T.hp });
    if (pelea.fase === 'pelea' && e.hp > 0) pelea.cola += 2; }
  _toP.copy(p.pos).sub(e.pos);
  switch (e.fase) {
    case 'cae': return 0;
    case 'acecha':
      e.state = 'walk';
      e.t -= dt;
      tangent(w, _toP, e.up); if (w.lengthSq() > 1e-6) w.normalize();
      if (e.t <= 0 && e.grounded) {
        e.ataques++;
        if (e.ataques % 2 === 1) { e.fase = 'wind'; e.state = 'wind'; e.t = 0.75 - enojo * 0.12; e.chargeDir.copy(w); }
        else { e.fase = 'agacha'; e.t = 0.45; }
      }
      return e.T.speed + enojo * 0.8;
    case 'wind':                                     // tiembla en rojo: ¡va a embestir!
      e.t -= dt; w.set(0, 0, 0);
      if (e.t <= 0) { e.fase = 'charge'; e.state = 'charge'; e.t = 0.8; }
      return 0;
    case 'charge':
      e.t -= dt;
      tangent(w, e.chargeDir, e.up).normalize();
      if (e.t <= 0) { e.fase = 'acecha'; e.t = 1.3 - enojo * 0.2; }
      return 14;
    case 'agacha': {                                 // se agacha y calcula el salto
      e.t -= dt; w.set(0, 0, 0);
      if (e.t > 0) return 0;
      // a dónde apunta: donde estás tú, pero sin salirse de la arena
      _d.copy(p.pos);
      if (distArena(_d) > pelea.def.radio - 3) _d.copy(pelea.centro).lerp(p.pos, 0.5);
      tangent(_d, _d.sub(e.pos), e.up);              // desplazamiento horizontal
      const vy = 16;
      const tVuelo = 2 * vy / e.gmag;                // tiro vertical: sube y baja en t = 2·vy/g
      e.saltoPendiente = { vy, vh: _d.clone().divideScalar(tVuelo) };   // v_horizontal = distancia / t
      e.balistico = true;
      e.fase = 'aire'; e.t = 0;
      return 0;
    }
    case 'aire':
      e.t += dt; w.set(0, 0, 0);
      if (e.grounded && e.t > 0.15) {
        e.balistico = false;
        onda(e.pos.clone().addScaledVector(e.up, -e.r), e.up);
        cam.shake = 0.7;
        e.fase = 'mareado'; e.mareado = 2.6;
      }
      return 0;
    case 'mareado':
      e.mareado -= dt; w.set(0, 0, 0);
      if (e.mareado <= 0) { e.mareado = 0; e.fase = 'acecha'; e.t = 0.8; }
      return 0;
  }
  return 0;
};

/** Dibujo del jefe: casco que se abre y estrellitas cuando está mareado. */
ETYPES.jefe.visual = (e, t) => {
  const M = e.mesh;
  const abierto = e.mareado > 0;
  M.casco.position.y += ((abierto ? e.r * 0.75 : 0) - M.casco.position.y) * 0.2;
  M.casco.rotation.x += ((abierto ? -0.6 : 0) - M.casco.rotation.x) * 0.2;
  M.estrellas.visible = abierto;
  M.estrellas.rotation.y = t * 5;
  if (e.fase === 'agacha') M.g.scale.set(1.12, 0.8, 1.12);        // se aplasta antes de saltar
  if (abierto) M.body.rotation.z = Math.sin(t * 7) * 0.12;          // se tambalea
};

/* =========================================================
   ONDA DE CHOQUE DEL JEFE
   Un anillo que corre por el SUELO de la arena a 10 m/s.
   Como la arena es un pedazo de esfera, el anillo se dibuja
   curvado: cada punto está a la altura real del suelo.
   Te pega si estás en el suelo justo donde pasa el anillo.
   ========================================================= */
const SEG = 72;
function onda(punto, arriba) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
  const idx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb8ff7a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  m.frustumCulled = false;
  scene.add(m);
  const dir = punto.clone().sub(pelea.P.c);
  pelea.ondas.push({ m, dir: dir.clone().normalize(), Rs: dir.length(), r: 0.5, pego: false });
}

const _u = new V3(), _v = new V3(), _q = new V3();
function pasoOndas(dt) {
  for (let k = pelea.ondas.length - 1; k >= 0; k--) {
    const o = pelea.ondas[k];
    o.r += 10 * dt;
    // ¿te pegó? (solo si estás en el suelo y el anillo pasa por donde estás)
    if (!o.pego && player.grounded && player.planet === pelea.P) {
      const dp = _q.copy(player.pos).sub(pelea.P.c).normalize();
      const dist = Math.acos(Math.min(1, dp.dot(o.dir))) * o.Rs;
      if (Math.abs(dist - o.r) < 0.8) { o.pego = true; hurtPlayer(1, player.pos.clone().sub(pelea.P.c.clone().addScaledVector(o.dir, o.Rs))); }
    }
    // redibujar el anillo curvado sobre la esfera
    _u.set(1, 0, 0); if (Math.abs(o.dir.x) > 0.9) _u.set(0, 0, 1);
    tangent(_u, _u, o.dir).normalize(); _v.crossVectors(o.dir, _u);
    const pos = o.m.geometry.attributes.position;
    for (let i = 0; i <= SEG; i++) {
      const a = i / SEG * Math.PI * 2;
      for (let j = 0; j < 2; j++) {
        const phi = (o.r + (j ? 0.45 : -0.45)) / o.Rs;            // ángulo = arco / radio
        _q.copy(o.dir).multiplyScalar(Math.cos(phi))
          .addScaledVector(_u, Math.sin(phi) * Math.cos(a)).addScaledVector(_v, Math.sin(phi) * Math.sin(a));
        const s = superficieEn(pelea.P, _q) + 0.12;              // altura real del suelo ahí
        pos.setXYZ(i * 2 + j, pelea.P.c.x + _q.x * s, pelea.P.c.y + _q.y * s, pelea.P.c.z + _q.z * s);
      }
    }
    pos.needsUpdate = true;
    o.m.material.opacity = 0.85 * Math.max(0, 1 - o.r / 12);
    if (o.r > 12) { scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); pelea.ondas.splice(k, 1); }
  }
}
function limpiarOndas() {
  for (const o of pelea.ondas) { scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); }
  pelea.ondas.length = 0;
}
