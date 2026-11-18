/* =========================================================
   enemigos.js · Enemigos chico, mediano y grande
   ---------------------------------------------------------
   Usan la MISMA física que el jugador (gravedad de Newton y
   choques con esferas), así que también caminan sobre planetas.

   IA simple:
   - Si estás en su planeta y cerca, te persiguen.
   - Si no, pasean en direcciones al azar.
   - El grande se prepara (tiembla en rojo) y embiste.
   ========================================================= */
import { THREE, V3, damp, tangent, anyPerp, clamp } from './util.js';
import { scene, toon, outline, orient } from './escena.js';
import { makeBody, computeGravity, updateUp, collide, mundo, superficieEn } from './fisica.js';
import { juego } from './estado.js';

export const ETYPES = {
  // stomp/punch/dash = daño que reciben de cada ataque (0 = inmune)
  small:  { r: 0.45, hp: 1, speed: 4.6, color: 0xff4d6d, aggro: 12, stomp: 1, punch: 1, dash: 1, mass: 1 },
  medium: { r: 0.9,  hp: 3, speed: 3.4, color: 0xffa53d, aggro: 14, stomp: 1, punch: 1, dash: 1, mass: 2.5 },
  large:  { r: 1.8,  hp: 6, speed: 2.4, color: 0x8b5cff, aggro: 16, stomp: 0, punch: 0, dash: 0, mass: 8, charger: true },
};

const eyeGeo = new THREE.SphereGeometry(1, 10, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pupMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const pipGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const pipOn = new THREE.MeshBasicMaterial({ color: 0x7dff8a });
const pipOff = new THREE.MeshBasicMaterial({ color: 0x333333 });

let spawnsActuales = [];

function makeEnemy(kind, planetIdx, dir) {
  const T = ETYPES[kind], P = mundo.planetas[planetIdx];
  const e = Object.assign(makeBody(T.r), {
    kind, T, hp: T.hp, dead: false, dieT: 0, stun: 0, flash: 0, cd: 1, state: 'walk', t: 0,
    chargeDir: new V3(), wanderDir: new V3(), wanderT: 0,
  });
  e.pos.copy(P.c).addScaledVector(dir, superficieEn(P, dir) + T.r + 0.05);   // parado en el suelo (isla o planeta)
  e.up.copy(dir);
  anyPerp(e.facing, dir);
  e.wanderDir.copy(e.facing);

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
  juego.enemigos = spawns.map(([k, pi, d]) => makeEnemy(k, pi, d));
}

export function hurtEnemy(e, dmg, knock, stun) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.15; e.stun = Math.max(e.stun, stun); e.state = 'walk';
  e.vel.copy(knock).divideScalar(Math.sqrt(e.T.mass));   // los pesados salen menos volando
  e.mesh.pips.children.forEach((pp, i) => pp.material = i < e.hp ? pipOn : pipOff);
  if (e.hp <= 0) { e.dead = true; e.dieT = 0.3; }
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
    if (e.stun > 0) { /* aturdido: no se mueve por sí mismo */ }
    else if (e.state === 'wind') { e.t -= dt; if (e.t <= 0) { e.state = 'charge'; e.t = 0.75; } }
    else if (e.state === 'charge') {
      e.t -= dt; tangent(_w, e.chargeDir, e.up).normalize(); spd = 14;
      if (e.t <= 0) { e.state = 'walk'; e.cd = 2.2; }
    } else {
      _toP.copy(p.pos).sub(e.pos);
      const dist = _toP.length();
      chasing = p.planet === e.planet && dist < e.T.aggro && p.state !== 'launch' && p.state !== 'vuelo';
      if (chasing) {
        tangent(_w, _toP, e.up).normalize();
        if (e.T.charger && e.cd <= 0 && dist < 11) { e.state = 'wind'; e.t = 0.7; e.chargeDir.copy(_w); _w.set(0, 0, 0); }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderDir.applyAxisAngle(e.up, (Math.random() - 0.5) * 2.5); e.wanderT = 1.5 + Math.random() * 2; }
        tangent(_w, e.wanderDir, e.up).normalize(); e.wanderDir.copy(_w); spd *= 0.45;
      }
    }
    let vy = e.vel.dot(e.up);
    tangent(_eh, e.vel, e.up);
    _t.copy(_w).multiplyScalar(spd);
    _eh.lerp(_t, damp(e.grounded ? (e.stun > 0 ? 3 : 8) : 1.2, dt));
    if (chasing && e.kind === 'small' && e.grounded && Math.random() < dt * 0.7) vy = 7;   // los chicos dan saltitos
    vy -= e.gmag * dt;                                                                 // gravedad
    e.vel.copy(_eh).addScaledVector(e.up, vy);
    _prev.copy(e.pos);
    e.pos.addScaledVector(e.vel, dt);
    collide(e);
    // no se tiran al mar: si el paso los deja en el agua, se devuelven y cambian de rumbo
    const P = e.planet;
    if (P && P.mar && e.stun <= 0 && e.pos.distanceTo(P.c) < P.mar + e.r * 0.8) {
      e.pos.copy(_prev); tangent(e.vel, e.vel, e.up).multiplyScalar(-0.3);
      e.wanderDir.negate(); e.wanderT = 1.5;
    }
    if (P && P.mar && e.pos.distanceTo(P.c) < P.mar - e.r) { e.dead = true; e.dieT = 0.3; }   // se hundió
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
    M.body.rotation.z = e.stun > 0 ? Math.sin(elapsed * 25) * 0.35 : 0;
    const em = e.flash > 0 ? 0xffffff : e.state === 'wind' ? 0x990000 : e.state === 'charge' ? 0x550000 : e.stun > 0 ? 0x333344 : 0x000000;
    M.mat.emissive.setHex(em);
    M.pips.visible = juego.debug || e.hp < e.T.hp;
  }
}
