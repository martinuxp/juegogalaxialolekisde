/* =========================================================
   efectos.js · Onda expansiva del pisotón
   ---------------------------------------------------------
   Al caer con pisotón se crea un anillo que crece y se desvanece.
   Todo enemigo dentro del radio CFG.shockR recibe 1 de daño
   y sale empujado hacia afuera.
   ========================================================= */
import { THREE, V3, tangent } from './util.js';
import { scene, faceNormal } from './escena.js';
import { CFG } from './config.js';
import { juego } from './estado.js';
import { hurtEnemy } from './enemigos.js';

const fx = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
const shockDbg = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10),
  new THREE.MeshBasicMaterial({ color: 0xfff2a8, wireframe: true, transparent: true, opacity: 0.5 }));
shockDbg.visible = false;
scene.add(shockDbg);
let shockDbgT = 0;

const _t = new V3(), _t2 = new V3();
export function shockwave(point, up, direct) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2a8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.position.copy(point).addScaledVector(up, 0.1); faceNormal(m, up); scene.add(m);
  fx.push({ m, t: 0, dur: 0.35 });
  for (const e of juego.enemigos) {
    if (e.dead || e === direct) continue;
    if (e.pos.distanceTo(point) < CFG.shockR + e.r) {
      tangent(_t, _t2.copy(e.pos).sub(point), e.up);
      if (_t.lengthSq() > 1e-6) _t.normalize();
      hurtEnemy(e, 1, _t.multiplyScalar(6).addScaledVector(e.up, 8), 1.4);
    }
  }
  if (juego.debug) { shockDbg.position.copy(point); shockDbg.scale.setScalar(CFG.shockR); shockDbg.visible = true; shockDbgT = 0.4; }
}

export function stepFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const k = f.t / f.dur;
    f.m.scale.setScalar(0.5 + k * CFG.shockR);
    f.m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); fx.splice(i, 1); }
  }
  shockDbgT -= dt;
  shockDbg.visible = juego.debug && shockDbgT > 0;
}
