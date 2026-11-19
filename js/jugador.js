/* =========================================================
   jugador.js · El protagonista: cómo se mueve y cómo se ve
   ---------------------------------------------------------
   El jugador es una "máquina de estados": en cada momento está
   en UN estado y cada estado tiene sus reglas.
     normal     caminar / saltar / caer
     punch      puño en el suelo
     dash       ráfaga corta que sigue la curva del planeta
     poundWind  giro en el aire antes del pisotón
     pound      caída en picada
     poundLand  aterrizaje del pisotón (onda expansiva)
     carga      cargando el supersalto      (mecanicas/escape.js)
     vuelo      volando por el espacio      (mecanicas/escape.js)
     launch     anillo de lanzamiento (solo en el Laboratorio)

   Truco clave de caminar sobre esferas: la velocidad se separa en
   - vy: la parte "vertical" (a lo largo del arriba del jugador)
   - _hv: la parte "horizontal" (sobre el plano tangente)
   La gravedad solo cambia vy. El joystick solo cambia _hv.
   ========================================================= */
import { THREE, V3, clamp, damp, tangent, anyPerp, moveTowards, rng } from './util.js';
import { scene, toon, outline, orient, faceNormal, camera } from './escena.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CFG } from './config.js';
import { makeBody, computeGravity, updateUp, collide, mundo, superficieEn } from './fisica.js';
import { input, keys } from './entrada.js';
import { juego, ajustes, emitir } from './estado.js';
import { hurtEnemy } from './enemigos.js';
import { shockwave } from './efectos.js';
import { cam } from './camara.js';
import { empezarCarga, pasoCarga, pasoVuelo } from './mecanicas/escape.js';

/* ---------------------------------------------------------
   DATOS DEL JUGADOR
   --------------------------------------------------------- */
export const player = Object.assign(makeBody(CFG.r), {
  hp: CFG.maxHP, maxHP: CFG.maxHP,
  state: 'normal', t: 0, coyote: 0, airDash: true, dashCD: 0, invul: 0, hurtT: 0,
  jumping: false, jumpCut: false, dashDir: new V3(), punchHit: new Set(), dashHit: new Set(),
  launch: null, launchCD: 0, voidT: 0, land: 0,
  tieneSuper: false,       // ¿ya puede usar el supersalto? (por ahora: solo con el cañón)
  fijo: null,              // si carga dentro del cañón, queda fijo en este punto
  seguro: new V3(),        // último lugar seguro en tierra (para volver si caes al mar)
  acostado: 0, ojos: 1,    // para la cinemática del despertar
  carga: 0,                // velocidad cargada del supersalto (m/s)
  dashGround: false,
});
juego.jugador = player;

/* ---------------------------------------------------------
   MALLA: chibi con casco de vidrio y un planetita con ojos adentro
   --------------------------------------------------------- */
export const SUITS = [0x2f3d8f, 0xd9573b, 0x3f9b6a, 0xe8e2d4, 0x7d4bc9];   // azul noche, naranja, verde, blanco, morado
export const SUIT_NOMBRES = ['Azul noche', 'Naranja', 'Verde', 'Blanco', 'Morado'];
export const ACCS = ['sombrero', 'lazo', 'ninguno'];
export const ACC_NOMBRES = ['Sombrero de copa', 'Lazo', 'Nada'];

const pl = {};
function headTex() {   // planetita: océano + continentes
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d'), r = rng(21);
  g.fillStyle = '#3fb6c9'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = i % 3 ? '#7cc96a' : '#5aa857';
    const x = r() * 256, y = 20 + r() * 88, rad = 8 + r() * 18;
    for (const dx of [-256, 0, 256]) { g.beginPath(); g.ellipse(x + dx, y, rad * 1.4, rad, 0, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}
{
  pl.group = new THREE.Group(); scene.add(pl.group);
  pl.body = new THREE.Group(); pl.group.add(pl.body);
  const suit = toon(SUITS[0], { emissive: 0x000000 }); pl.mat = suit;
  const grey = toon(0xb9b4c4), dark = toon(0x3a3446);
  const add = (geo, mat, x, y, z, k = 0.07) => { const m = outline(new THREE.Mesh(geo, mat), k); m.position.set(x, y, z); pl.body.add(m); return m; };
  // cuerpo: más largo de lado (profundidad) que de frente
  add(new RoundedBoxGeometry(0.62, 0.5, 0.74, 4, 0.17), suit, 0, -0.2, 0, 0.05);
  add(new THREE.CapsuleGeometry(0.11, 0.08, 4, 10), dark, -0.15, -0.48, 0.04);
  add(new THREE.CapsuleGeometry(0.11, 0.08, 4, 10), dark, 0.15, -0.48, 0.04);
  const armL = add(new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), suit, -0.38, -0.2, 0.05); armL.rotation.z = -0.6;
  const armR = add(new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), suit, 0.38, -0.2, 0.05); armR.rotation.z = 0.6;
  pl.arms = [armL, armR];
  add(new RoundedBoxGeometry(0.42, 0.38, 0.2, 3, 0.07), grey, 0, -0.14, -0.44, 0.06);   // mochila
  const collar = add(new THREE.TorusGeometry(0.31, 0.06, 8, 28), grey, 0, 0.06, 0, 0.12); collar.rotation.x = Math.PI / 2;
  // cabeza = casco de vidrio con un planetita adentro
  pl.head = new THREE.Group(); pl.head.position.y = 0.44; pl.body.add(pl.head);
  pl.planet = outline(new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 16), toon(0xffffff, { map: headTex() })), 0.05);
  pl.head.add(pl.planet);
  pl.eyes = new THREE.Group(); pl.head.add(pl.eyes);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-1, 1]) {
    const eye = outline(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), white), 0.18);
    eye.scale.set(0.065, 0.085, 0.035); eye.position.set(sx * 0.085, 0.03, 0.25); pl.eyes.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), black);
    pup.scale.set(0.035, 0.05, 0.02); pup.position.set(sx * 0.085, 0.02, 0.28); pl.eyes.add(pup);
  }
  // lunita que orbita adentro del casco: aparece al recuperar fragmentos del alma lunar
  pl.moon = outline(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), toon(0xf3efe0, { emissive: 0x332e22 })), 0.12);
  pl.moon.visible = false;
  pl.head.add(pl.moon);
  // vidrio: casi transparente + brillo cartoon + contorno que siempre mira a la cámara
  pl.glass = new THREE.Mesh(new THREE.SphereGeometry(0.43, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.14, depthWrite: false }));
  pl.head.add(pl.glass);
  const shine = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.022, 6, 20, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  shine.position.z = 0.27; shine.rotation.z = Math.PI * 0.55; pl.head.add(shine);
  pl.ring = new THREE.Mesh(new THREE.RingGeometry(0.43, 0.465, 48), new THREE.MeshBasicMaterial({ color: 0x15121c, side: THREE.DoubleSide }));
  pl.head.add(pl.ring);
  // accesorios del casco (personalización)
  pl.acc = {};
  const hat = new THREE.Group(); hat.position.set(0.04, 0.4, 0); hat.rotation.z = -0.15; pl.head.add(hat);
  const hatMat = toon(0x1c1a22), band = toon(0xc93c3c);
  hat.add(outline(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.035, 24), hatMat), 0.06));
  const crown = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 24), hatMat), 0.06); crown.position.y = 0.16; hat.add(crown);
  const bnd = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.06, 24), band); bnd.position.y = 0.05; hat.add(bnd);
  pl.acc.sombrero = hat;
  const bow = new THREE.Group(); bow.position.set(0.22, 0.33, 0.05); bow.rotation.z = -0.6; pl.head.add(bow);
  const pink = toon(0xff6fae);
  for (const sx of [-1, 1]) {
    const w = outline(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), pink), 0.12);
    w.scale.set(0.12, 0.075, 0.05); w.position.x = sx * 0.1; w.rotation.z = sx * 0.35; bow.add(w);
  }
  bow.add(outline(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), pink), 0.15));
  pl.acc.lazo = bow;
  pl.fist = outline(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), toon(0xffd36b, { emissive: 0x553300 })), 0.1);
  pl.fist.visible = false; pl.body.add(pl.fist);
  pl.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(pl.shadow);
}
export const mallaJugador = pl;

/** Aplica el color del traje y el accesorio elegidos en el menú. */
export function applyLook() {
  pl.mat.color.setHex(SUITS[ajustes.traje % SUITS.length]);
  for (const k in pl.acc) pl.acc[k].visible = ACCS[ajustes.accesorio % ACCS.length] === k;
}
applyLook();

/** Muestra (o esconde) la lunita dentro del casco. */
export function mostrarLunita(v) { pl.moon.visible = v; }

/* ---------------------------------------------------------
   MOVIMIENTO
   --------------------------------------------------------- */
const _mv = new V3(), _hv = new V3(), _t = new V3(), _t2 = new V3(), _camR = new V3();

/** Convierte el joystick/teclado en una dirección sobre el planeta, relativa a la cámara. */
function moveInput(out) {
  let ix = input.jx, iy = input.jy;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
  const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  tangent(out, cam.fwd, player.up);
  if (out.lengthSq() < 1e-6) anyPerp(out, player.up);
  out.normalize();
  _camR.crossVectors(out, player.up);   // derecha de la cámara
  return out.multiplyScalar(iy).addScaledVector(_camR, ix);
}

/** Pone al jugador en el punto de inicio del nivel, con la vida llena. */
export function respawnPlayer() {
  const p = player, ini = juego.checkpoint || juego.nivel.inicio;   // checkpoint = entrada de la arena del jefe
  const P = mundo.planetas[ini.planeta];
  p.pos.copy(P.c).addScaledVector(ini.dir, superficieEn(P, ini.dir) + p.r + 0.02);
  p.vel.set(0, 0, 0); p.up.copy(ini.dir);
  tangent(p.facing, ini.mirar, ini.dir).normalize();
  p.hp = p.maxHP; p.state = 'normal'; p.invul = 2; p.carga = 0;
  p.voidT = 0; p.launch = null; p.fijo = null;
  p.seguro.copy(p.pos);
  computeGravity(p);
  cam.fwd.copy(p.facing); cam.up.copy(p.up);
  emitir('vida');
}

export function stepPlayer(dt) {
  const p = player;
  p.dashCD -= dt; p.invul -= dt; p.launchCD -= dt; p.hurtT -= dt;
  input.jumpQ -= dt; input.atkQ -= dt; input.dashQ -= dt;
  computeGravity(p);
  if (p.state === 'dormido') return;                 // cinemática del despertar
  if (p.state === 'launch') { stepLaunch(dt); return; }
  if (p.state === 'vuelo') { pasoVuelo(p, dt); revisarVacio(dt); return; }
  if (p.state === 'carga') { pasoCarga(p, dt); return; }
  updateUp(p, dt);

  const mv = moveInput(_mv), mvLen = mv.length();
  let vy = p.vel.dot(p.up);        // parte vertical de la velocidad
  tangent(_hv, p.vel, p.up);       // parte horizontal

  // SUPERSALTO: mantener SÚPER en el suelo empieza a cargar
  // (o dentro del cañón, que hace lo mismo: un impulso de una vez)
  if (input.superHeld && p.grounded && p.state === 'normal') {
    if (juego.enCanon) { empezarCarga(p, juego.enCanon); return; }
    if (p.tieneSuper) { empezarCarga(p, null); return; }
  }

  // LEER: junto a un cartel, el botón de ataque abre el diálogo (nivel.js decide si hay uno cerca)
  if (input.atkQ > 0 && juego.cartelCerca && p.grounded && p.state === 'normal') {
    input.atkQ = 0;
    emitir('leer', juego.cartelCerca);
  }
  // ATAQUE: en el suelo = puño; en el aire = pisotón
  if (input.atkQ > 0 && (p.state === 'normal' || p.state === 'dash')) {
    input.atkQ = 0;
    if (p.grounded) { p.state = 'punch'; p.t = 0; p.punchHit.clear(); }
    else { p.state = 'poundWind'; p.t = 0; }
  }
  // DASH (uno en el aire hasta tocar suelo)
  if (input.dashQ > 0 && p.dashCD <= 0 && p.state === 'normal' && (p.grounded || p.airDash)) {
    input.dashQ = 0; p.state = 'dash'; p.t = 0; p.dashCD = CFG.dashCD;
    if (!p.grounded) p.airDash = false;
    p.dashDir.copy(mvLen > 0.2 ? mv : p.facing); tangent(p.dashDir, p.dashDir, p.up).normalize();
    p.facing.copy(p.dashDir); p.dashHit.clear(); p.dashGround = p.grounded;
  }
  // SALTO (con "coyote time": puedes saltar un ratito después de salir de un borde)
  if (input.jumpQ > 0 && (p.grounded || p.coyote > 0) && (p.state === 'normal' || p.state === 'dash' || p.state === 'punch')) {
    input.jumpQ = 0; p.coyote = 0; vy = CFG.jump; p.jumping = true; p.jumpCut = false; p.grounded = false;
    if (p.state === 'dash') _hv.copy(p.dashDir).multiplyScalar(CFG.dashSpeed * 0.75);   // dash + salto = salto largo
    p.state = 'normal'; p.land = -0.25;
  }
  // salto variable: si sueltas el botón antes, sube menos
  if (p.jumping && !input.jumpHeld && vy > 0 && !p.jumpCut) { vy *= CFG.jumpCut; p.jumpCut = true; }

  switch (p.state) {
    case 'normal': case 'punch': {
      const ctrl = p.hurtT > 0 ? 0.15 : (p.state === 'punch' ? 0.3 : 1);
      _t.copy(mv).multiplyScalar(CFG.run * ctrl);
      moveTowards(_hv, _t, (p.grounded ? CFG.groundAccel : CFG.airAccel) * dt);
      vy -= p.gmag * dt;                                   // GRAVEDAD: acelera hacia el centro del planeta
      if (p.state === 'punch') { p.t += dt; punchHits(); if (p.t >= CFG.punchTime) p.state = 'normal'; }
      break;
    }
    case 'dash':
      p.t += dt; tangent(p.dashDir, p.dashDir, p.up).normalize();   // sigue la curvatura del planeta
      _hv.copy(p.dashDir).multiplyScalar(CFG.dashSpeed);
      vy = p.dashGround ? -6 : 0;                                    // en el suelo se pega a la superficie
      if (p.t >= CFG.dashTime) { p.state = 'normal'; _hv.multiplyScalar(CFG.dashKeep); }
      break;
    case 'poundWind':
      p.t += dt; _hv.set(0, 0, 0); vy = 0; if (p.t >= CFG.poundWind) p.state = 'pound';
      break;
    case 'pound':
      _hv.set(0, 0, 0); vy = -CFG.poundSpeed;
      break;
    case 'poundLand':
      p.t += dt; _hv.multiplyScalar(Math.max(0, 1 - 12 * dt)); vy -= p.gmag * dt;
      if (p.t >= CFG.poundLand) p.state = 'normal';
      break;
  }
  if (vy < -45) vy = -45;
  p.vel.copy(_hv).addScaledVector(p.up, vy);
  p.pos.addScaledVector(p.vel, dt);

  const was = p.grounded;
  collide(p);
  if (p.grounded) {
    p.coyote = CFG.coyote; p.airDash = true; p.jumping = false;
    if (!was) p.land = Math.min(0.35, 0.1 + Math.abs(vy) * 0.01);
    if (p.state === 'pound') {
      p.state = 'poundLand'; p.t = 0;
      shockwave(_t2.copy(p.pos).addScaledVector(p.up, -p.r), p.up, null); cam.shake = 0.35;
      emitir('pisoton', _t2);
    }
  } else p.coyote -= dt;

  // MAR: el agua no es sólida. Si te hundes, vuelves al último lugar seguro.
  const P = p.planet;
  if (P && P.mar) {
    const r = p.pos.distanceTo(P.c);
    if (r < P.mar + 0.05) {
      p.pos.copy(p.seguro); p.vel.set(0, 0, 0); p.state = 'normal'; p.invul = Math.max(p.invul, 0.8);
      emitir('agua');
    } else if (p.grounded && r > P.mar + p.r + 0.15) p.seguro.copy(p.pos);
  } else if (p.grounded) p.seguro.copy(p.pos);

  if (mvLen > 0.1 && p.state === 'normal') { _t.copy(mv).normalize(); p.facing.lerp(_t, damp(14, dt)); }
  tangent(p.facing, p.facing, p.up);
  if (p.facing.lengthSq() < 1e-6) anyPerp(p.facing, p.up);
  p.facing.normalize();

  if (p.launchCD <= 0 && p.state === 'normal' && juego.pads)
    for (const pad of juego.pads) if (p.pos.distanceTo(pad.pos) < 1.5) { startLaunch(pad); break; }

  revisarVacio(dt);
}

/** Lejos de todo planeta (gravedad casi cero) o sin vida → volver al inicio. */
function revisarVacio(dt) {
  const p = player;
  p.voidT = p.gmag < 0.8 ? p.voidT + dt : 0;
  if (p.voidT > 2.5 || p.hp <= 0) { emitir('reaparecer', p.hp <= 0 ? 'vida' : 'vacio'); respawnPlayer(); }
}

function punchHits() {
  const p = player; if (p.t < CFG.punchFrom || p.t > CFG.punchTo) return;
  const hc = _t2.copy(p.pos).addScaledVector(p.facing, CFG.punchReach);
  for (const e of juego.enemigos) {
    if (e.dead || p.punchHit.has(e)) continue;
    if (hc.distanceTo(e.pos) < CFG.punchR + e.r) {
      p.punchHit.add(e);
      if (e.T.punch > 0) hurtEnemy(e, e.T.punch, _t.copy(p.facing).multiplyScalar(9).addScaledVector(e.up, 5), 0.5);
      else { e.flash = 0.08; _hv.addScaledVector(p.facing, -10); cam.shake = 0.12; }   // el grande no siente el puño
    }
  }
}

/* --- anillos de lanzamiento (solo Laboratorio): curva de Bézier hacia otro planeta.
       OJO: esto NO es física, es un "atajo" de prueba. En los niveles se usa el supersalto. --- */
function startLaunch(pad) {
  const p = player, P = mundo.planetas[pad.to];
  const p0 = p.pos.clone(), n = p0.clone().sub(P.c).normalize(), p1 = P.c.clone().addScaledVector(n, P.R + 3);
  const dist = p0.distanceTo(p1);
  const ctrl = p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(p.up.clone().add(n).normalize(), dist * 0.35);
  p.launch = { p0, p1, ctrl, t: 0, dur: 1 + dist / 70, n }; p.state = 'launch'; p.vel.set(0, 0, 0);
}
const _b = new V3();
function stepLaunch(dt) {
  const p = player, L = p.launch; L.t += dt;
  const s = clamp(L.t / L.dur, 0, 1), e = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2, u = 1 - e;
  const prev = _b.copy(p.pos);
  p.pos.set(0, 0, 0).addScaledVector(L.p0, u * u).addScaledVector(L.ctrl, 2 * u * e).addScaledVector(L.p1, e * e);
  updateUp(p, dt * 0.6);
  _t.copy(p.pos).sub(prev); tangent(_t, _t, p.up); if (_t.lengthSq() > 1e-8) p.facing.copy(_t).normalize();
  if (s >= 1) { p.state = 'normal'; p.vel.copy(L.n).multiplyScalar(-6); p.launchCD = 1; p.airDash = true; p.launch = null; }
}

export function hurtPlayer(dmg, awayN) {
  const p = player; if (p.invul > 0) return;
  if (p.state === 'carga') { p.carga = 0; p.fijo = null; }
  p.hp -= dmg; p.invul = CFG.invul; p.hurtT = 0.35; p.state = 'normal';
  tangent(_t, awayN, p.up); if (_t.lengthSq() < 1e-6) _t.copy(p.facing).negate(); _t.normalize();
  p.vel.copy(_t).multiplyScalar(9).addScaledVector(p.up, 7); cam.shake = 0.2;
  emitir('vida', true);
}

/* ---------------------------------------------------------
   VISUALES DEL JUGADOR
   --------------------------------------------------------- */
const _sp = new V3(), _sn = new V3(), _q = new THREE.Quaternion();
function rayHit(origin, dir) {   // raycast de la sombra hacia el centro del planeta
  let best = Infinity, hitS = null;
  for (const s of mundo.solidos) {
    _t.copy(origin).sub(s.c); const b = _t.dot(dir), c = _t.lengthSq() - s.R * s.R;
    if (c > 0 && b > 0) continue; const disc = b * b - c; if (disc < 0) continue;
    const tt = Math.max(0, -b - Math.sqrt(disc)); if (tt < best) { best = tt; hitS = s; }
  }
  return hitS ? { t: best, s: hitS } : null;
}

export function updatePlayerVisuals(dt, elapsed) {
  const p = player;
  pl.group.position.copy(p.pos); orient(pl.group, p.up, p.facing);
  p.land += (0 - p.land) * damp(12, dt);
  let sx = 1 + p.land * 0.6, sy = 1 - p.land, sz = 1 + p.land * 0.6;
  pl.body.rotation.set(0, 0, 0);
  if (p.state === 'dash') { sx = 0.8; sy = 0.85; sz = 1.35; }
  if (p.state === 'poundWind') pl.body.rotation.x = (p.t / CFG.poundWind) * Math.PI * 2;
  if (p.state === 'pound') { sx = 0.85; sy = 1.25; sz = 0.85; }
  if (p.state === 'carga') {   // se agacha y tiembla más mientras más carga
    const k = clamp(p.carga / CFG.superMax, 0, 1);
    sy = 1 - 0.3 * k; sx = sz = 1 + 0.18 * k;
    pl.body.position.x = Math.sin(elapsed * 60) * 0.03 * k;
  } else pl.body.position.x = 0;
  if (p.state === 'vuelo') { sx = sz = 0.88; sy = 1.2; }
  pl.body.scale.set(sx, sy, sz);
  // acostado en la cama de flores (cinemática): girar el cuerpo 90° para que mire al cielo
  pl.body.rotation.x -= Math.PI / 2 * p.acostado;
  pl.body.position.y = -0.3 * p.acostado;
  pl.fist.visible = p.state === 'punch';
  if (pl.fist.visible) { const k = Math.sin(Math.PI * clamp(p.t / CFG.punchTime, 0, 1)); pl.fist.position.set(0.3, -0.12, 0.35 + k * 0.75); }
  pl.planet.rotation.y += dt * 0.6;
  const blink = (elapsed % 3.2) < 0.12, hurt = p.hurtT > 0;
  pl.eyes.scale.y = p.state === 'dormido' ? p.ojos : hurt ? 0.25 : (blink ? 0.1 : 1);
  const ma = elapsed * 1.8; pl.moon.position.set(Math.cos(ma) * 0.35, Math.sin(ma) * 0.12, Math.sin(ma) * 0.35);
  const sp = Math.min(1, tangent(_sp, p.vel, p.up).length() / CFG.run), sw = Math.sin(elapsed * 14) * 0.5 * sp * (p.grounded ? 1 : 0);
  pl.arms[0].rotation.x = sw; pl.arms[1].rotation.x = -sw;
  pl.head.getWorldQuaternion(_q); _q.invert().multiply(camera.quaternion); pl.ring.quaternion.copy(_q);
  pl.group.visible = !(p.invul > 0 && Math.floor(elapsed * 16) % 2 === 0);
  const brillo = p.state === 'pound' || p.state === 'poundWind' ? 0x664400 : p.state === 'carga' ? 0x224466 : 0x000000;
  pl.mat.emissive.setHex(brillo);
  const h = rayHit(p.pos, p.gdir);
  if (h && p.state !== 'launch') {
    _sp.copy(p.pos).addScaledVector(p.gdir, h.t); _sn.copy(_sp).sub(h.s.c).normalize();
    pl.shadow.position.copy(_sp).addScaledVector(_sn, 0.03); faceNormal(pl.shadow, _sn);
    const k = clamp(1 - h.t / 12, 0.25, 1); pl.shadow.scale.setScalar(k); pl.shadow.material.opacity = 0.45 * k; pl.shadow.visible = true;
  } else pl.shadow.visible = false;
}
