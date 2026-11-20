/* =========================================================
   enemigos.js · Enemigos chico, mediano y grande
   ---------------------------------------------------------
   Usan la MISMA física que el jugador (gravedad de Newton y
   choques con esferas), así que también caminan sobre planetas.

   IA simple:
   - Si estás en su planeta y cerca, te persiguen.
   - Si no, pasean en direcciones al azar.
   - El grande se prepara (tiembla en rojo) y embiste.
   - ALIEN: gato-alien de Ícaro (se ve distinto, js/aliens.js).
   - JEFE: su cerebro está en js/jefe.js (T.ia). Aquí solo se
     le aplica la misma física que a todos.
   ========================================================= */
import { THREE, V3, damp, tangent, anyPerp, clamp } from './util.js';
import { scene, toon, outline, orient } from './escena.js';
import { makeBody, computeGravity, updateUp, collide, mundo, superficieEn } from './fisica.js';
import { juego, emitir } from './estado.js';
import { crearGatoAlien } from './aliens.js';

export const ETYPES = {
  // stomp/punch/dash = daño que reciben de cada ataque (0 = inmune)
  small:  { r: 0.45, hp: 1, speed: 4.6, color: 0xff4d6d, aggro: 12, stomp: 1, punch: 1, dash: 1, mass: 1 },
  medium: { r: 0.9,  hp: 3, speed: 3.4, color: 0xffa53d, aggro: 14, stomp: 1, punch: 1, dash: 1, mass: 2.5 },
  large:  { r: 1.8,  hp: 6, speed: 2.4, color: 0x8b5cff, aggro: 16, stomp: 0, punch: 0, dash: 0, mass: 8, charger: true },
  // gatos-alien de Ícaro: el chico da saltitos como 'small'
  alien:  { r: 0.55, hp: 1, speed: 4.2, aggro: 13, stomp: 1, punch: 1, dash: 1, mass: 1, saltitos: true, gato: true },
  // el jefe: solo el PISOTÓN le hace daño, y solo cuando está mareado (ver combate.js y jefe.js)
  jefe:   { r: 1.5,  hp: 3, speed: 3.2, aggro: 40, stomp: 0, punch: 0, dash: 0, mass: 10, gato: true, jefe: true },
};

const eyeGeo = new THREE.SphereGeometry(1, 10, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pupMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const pipGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const pipOn = new THREE.MeshBasicMaterial({ color: 0x7dff8a });
const pipOff = new THREE.MeshBasicMaterial({ color: 0x333333 });

let spawnsActuales = [];

function makeEnemy(kind, planetIdx, dir, altura = 0.05) {
  const T = ETYPES[kind], P = mundo.planetas[planetIdx];
  const e = Object.assign(makeBody(T.r), {
    kind, T, hp: T.hp, dead: false, dieT: 0, stun: 0, flash: 0, cd: 1, state: 'walk', t: 0,
    chargeDir: new V3(), wanderDir: new V3(), wanderT: 0,
  });
  e.pos.copy(P.c).addScaledVector(dir, superficieEn(P, dir) + T.r + altura);   // parado en el suelo (isla o planeta)
  e.up.copy(dir);
  anyPerp(e.facing, dir);
  e.wanderDir.copy(e.facing);

  if (T.gato || T.modelo) {                             // gato-alien (aliens.js) o un dibujo propio (ej. meowlito, meowl.js)
    const a = T.modelo ? T.modelo(T.r) : crearGatoAlien(T.r, { jefe: !!T.jefe });
    scene.add(a.g);
    const pips = new THREE.Group(); pips.position.y = T.r + (T.jefe ? 1.9 : 0.75); a.g.add(pips);
    for (let i = 0; i < T.hp; i++) { const pp = new THREE.Mesh(pipGeo, pipOn); pp.position.x = (i - (T.hp - 1) / 2) * 0.22; pips.add(pp); }
    e.mesh = { ...a, pips };
    return e;
  }
  const g = new THREE.Group(); scene.add(g);
  const mat = toon(T.color, { flatShading: true, emissive: 0x000000 });
  const body = outline(new THREE.Mesh(new THREE.IcosahedronGeometry(T.r, 1), mat), 0.07);
  g.add(body);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.scale.setScalar(T.r * 0.22); eye.position.set(sx * T.r * 0.35, T.r * 0.25, T.r * 0.82); g.add(eye);
    const pup = new THREE.Mesh(eyeGeo, pupMat); pup.scale.setScalar(T.r * 0.11); pup.position.set(sx * T.r * 0.35, T.r * 0.25, T.r * 1.0); g.add(pup);
  }
  if (kind === 'large') for (let i = 0; i < 5; i++) {   // cresta de púas: "no me pises... salvo con pisotón"
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 6), toon(0xeeeeee, { flatShading: true }));
    const a = (i - 2) * 0.32;
    sp.position.set(0, Math.cos(a) * T.r * 0.95, Math.sin(a) * T.r * 0.95); sp.rotation.x = a; g.add(sp);
  }
  const pips = new THREE.Group(); pips.position.y = T.r + 0.45; g.add(pips);
  for (let i = 0; i < T.hp; i++) { const pp = new THREE.Mesh(pipGeo, pipOn); pp.position.x = (i - (T.hp - 1) / 2) * 0.22; pips.add(pp); }
  e.mesh = { g, body, mat, pips };
  return e;
}

/** Borra los enemigos actuales y crea los de la lista [[tipo, planeta, dirección], ...]. */
export function spawnEnemies(spawns = spawnsActuales) {
  spawnsActuales = spawns;
  for (const e of juego.enemigos) scene.remove(e.mesh.g);
  // [tipo, planeta, dirección, altura, casa]: casa = radio (m) del que no se aleja paseando (ej. su repisa en el pozo)
  juego.enemigos = spawns.map(([k, pi, d, alto, casa]) => {
    const e = makeEnemy(k, pi, d, alto);
    if (casa) { e.casa = e.pos.clone(); e.casaR = casa; }
    return e;
  });
}

/** Agrega UN enemigo sin borrar los demás (el ovni los baja con el rayo). altura = metros sobre el suelo. */
export function agregarEnemigo(kind, planetIdx, dir, altura = 0.05) {
  const e = makeEnemy(kind, planetIdx, dir, altura);
  juego.enemigos.push(e);
  return e;
}

/** Saca de la escena a los enemigos que cumplan la condición (al reiniciar la pelea del jefe). */
export function quitarEnemigos(condicion) {
  for (const e of juego.enemigos) if (condicion(e)) scene.remove(e.mesh.g);
  juego.enemigos = juego.enemigos.filter(e => !condicion(e));
}

export function hurtEnemy(e, dmg, knock, stun) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.15; e.stun = Math.max(e.stun, stun); e.state = 'walk';
  e.vel.copy(knock).divideScalar(Math.sqrt(e.T.mass));   // los pesados salen menos volando
  e.mesh.pips.children.forEach((pp, i) => pp.material = i < e.hp ? pipOn : pipOff);
  if (e.hp <= 0) { e.dead = true; e.dieT = 0.3; }
  emitir('golpeEnemigo', e);                             // audio.js: voz o sonido de derrota
}

const _w = new V3(), _eh = new V3(), _toP = new V3(), _t = new V3(), _prev = new V3();
export function stepEnemies(dt) {
  const p = juego.jugador;
  const enemies = juego.enemigos;
  for (const e of enemies) {
    if (e.dead) { e.dieT -= dt; continue; }
    computeGravity(e); updateUp(e, dt);
    e.stun -= dt; e.flash -= dt; e.cd -= dt;
    let spd = e.T.speed; _w.set(0, 0, 0); let chasing = false;
    let ia = null;
    if (e.T.ia && e.stun <= 0) ia = e.T.ia(e, dt, _w);   // el jefe decide solo (jefe.js): llena _w y devuelve la rapidez
    if (ia !== null) spd = ia;
    else if (e.stun > 0) { /* aturdido: no se mueve por sí mismo */ }
    else if (e.state === 'wind') { e.t -= dt; if (e.t <= 0) { e.state = 'charge'; e.t = 0.75; } }
    else if (e.state === 'charge') {
      e.t -= dt; tangent(_w, e.chargeDir, e.up).normalize(); spd = 14;
      if (e.t <= 0) { e.state = 'walk'; e.cd = 2.2; }
    } else {
      _toP.copy(p.pos).sub(e.pos);
      const dist = _toP.length();
      chasing = p.planet === e.planet && dist < e.T.aggro && p.state !== 'launch' && p.state !== 'vuelo';
      // los que cuidan una repisa solo te persiguen si estás a su misma altura (si no, se caerían)
      if (chasing && e.casa && Math.abs(_toP.dot(e.up)) > 3) chasing = false;
      if (chasing) {
        tangent(_w, _toP, e.up).normalize();
        if (e.T.charger && e.cd <= 0 && dist < 11) { e.state = 'wind'; e.t = 0.7; e.chargeDir.copy(_w); _w.set(0, 0, 0); }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderDir.applyAxisAngle(e.up, (Math.random() - 0.5) * 2.5); e.wanderT = 1.5 + Math.random() * 2; }
        if (e.casa && e.pos.distanceTo(e.casa) > e.casaR) { e.wanderDir.copy(e.casa).sub(e.pos); e.wanderT = 1; }   // vuelve a su repisa
        tangent(_w, e.wanderDir, e.up).normalize(); e.wanderDir.copy(_w); spd *= 0.45;
      }
    }
    e.persigue = chasing || !!e.iaPersigue;   // audio.js lo mira para la música de pelea (iaPersigue: lo decide su propia ia)
    let vy = e.vel.dot(e.up);
    tangent(_eh, e.vel, e.up);
    _t.copy(_w).multiplyScalar(spd);
    // en el aire, un salto "balístico" (el del jefe) no se corrige: es un tiro parabólico puro
    if (!(e.balistico && !e.grounded)) _eh.lerp(_t, damp(e.grounded ? (e.stun > 0 ? 3 : 8) : 1.2, dt));
    if (chasing && (e.kind === 'small' || e.T.saltitos) && e.grounded && Math.random() < dt * 0.7) vy = 7;   // los chicos dan saltitos
    if (e.saltoPendiente) { vy = e.saltoPendiente.vy; _eh.copy(e.saltoPendiente.vh); e.saltoPendiente = null; e.grounded = false; }
    vy -= e.gmag * dt;                                                                 // gravedad
    e.vel.copy(_eh).addScaledVector(e.up, vy);
    _prev.copy(e.pos);
    e.pos.addScaledVector(e.vel, dt);
    collide(e);
    // no se tiran al mar: si el paso los deja en el agua, se devuelven y cambian de rumbo
    const P = e.planet;
    if (P && P.mar && !e.arenero && e.stun <= 0 && !e.balistico && e.pos.distanceTo(P.c) < P.mar + e.r * 0.8) {
      e.pos.copy(_prev); tangent(e.vel, e.vel, e.up).multiplyScalar(-0.3);
      e.wanderDir.negate(); e.wanderT = 1.5;
    }
    if (P && P.mar && !e.arenero && e.pos.distanceTo(P.c) < P.mar - e.r) { e.dead = true; e.dieT = 0.3; }   // se hundió
    if (_w.lengthSq() > 0.01) e.facing.lerp(_w, damp(8, dt));
    tangent(e.facing, e.facing, e.up);
    if (e.facing.lengthSq() < 1e-6) anyPerp(e.facing, e.up);
    e.facing.normalize();
    if (e.pos.length() > 600) { e.dead = true; e.dieT = 0; }
  }
  // separación simple entre enemigos (para que no se encimen)
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (a.dead || b.dead) continue;
    _t.copy(a.pos).sub(b.pos); const d = _t.length(), min = a.r + b.r;
    if (d < min && d > 1e-6) {
      _t.multiplyScalar((min - d) / d); const wa = b.T.mass / (a.T.mass + b.T.mass);
      a.pos.addScaledVector(_t, wa); b.pos.addScaledVector(_t, -(1 - wa));
    }
  }
}

export function updateEnemyVisuals(elapsed) {
  for (const e of juego.enemigos) {
    const M = e.mesh;
    if (e.dead) {
      const k = clamp(e.dieT / 0.3, 0, 1); M.g.scale.setScalar(k);
      if (k <= 0) M.g.visible = false;
      M.g.position.copy(e.pos); continue;
    }
    M.g.visible = true; M.g.position.copy(e.pos); orient(M.g, e.up, e.facing);
    let s = 1; if (e.state === 'wind') s = 1 + Math.sin(elapsed * 40) * 0.06 + 0.1;
    M.g.scale.setScalar(s);
    if (M.antenas) for (const [i, a] of M.antenas.entries()) a.rotation.x = Math.sin(elapsed * 6 + i * 2 + e.r) * 0.18;   // antenas que se mueven
    if (e.T.visual) e.T.visual(e, elapsed);
    M.body.rotation.z = e.stun > 0 ? Math.sin(elapsed * 25) * 0.35 : 0;
    const em = e.flash > 0 ? 0xffffff : e.state === 'wind' ? 0x990000 : e.state === 'charge' ? 0x550000 : e.stun > 0 ? 0x333344 : 0x000000;
    M.mat.emissive.setHex(em);
    M.pips.visible = (juego.debug || e.hp < e.T.hp) && !e.T.jefe;   // el jefe tiene su barra arriba (ui.js)
  }
}
