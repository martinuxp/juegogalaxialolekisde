/* =========================================================
   combate.js · Qué pasa cuando el jugador toca a un enemigo
   ---------------------------------------------------------
   - Pisotón directo: 3 de daño + onda expansiva.
   - Caerle encima: rebote (al grande no le duele, tiene púas).
   - Dash: daño a chicos y medianos; el grande te rebota.
   - Cualquier otro contacto: el enemigo te quita vida
     (2 corazones si es el grande embistiendo).
   - JEFE: solo el pisotón le hace daño (1), y solo si está
     mareado (después de su salto). Todo lo demás rebota en
     su casco.
   ========================================================= */
import { V3, tangent } from './util.js';
import { CFG } from './config.js';
import { input } from './entrada.js';
import { juego } from './estado.js';
import { hurtEnemy } from './enemigos.js';
import { shockwave } from './efectos.js';
import { hurtPlayer } from './jugador.js';
import { cam } from './camara.js';

const _n = new V3(), _t = new V3(), _t2 = new V3();

export function stepContacts() {
  const p = juego.jugador;
  if (p.state === 'launch' || p.state === 'vuelo') return;
  for (const e of juego.enemigos) {
    if (e.dead) continue;
    _n.copy(p.pos).sub(e.pos);
    const d = _n.length(), min = p.r + e.r;
    if (d >= min) continue;
    _n.divideScalar(d || 1);
    const above = _n.dot(e.up);                                // ¿estoy encima?
    const vrel = _t.copy(p.vel).sub(e.vel).dot(e.up);          // ¿voy bajando hacia él?

    if (e.T.jefe && p.state === 'pound') {                     // pisotón al jefe
      if (e.mareado) {
        hurtEnemy(e, 1, _t.copy(e.up).multiplyScalar(-2), 0.4);
        e.mareado = 0; e.golpeado = true;                       // jefe.js decide qué hace después
        cam.shake = 0.6;
      } else { e.flash = 0.1; cam.shake = 0.2; }                // ¡clanc! rebota en el casco cerrado
      p.state = 'normal'; tangent(p.vel, p.vel, p.up);
      tangent(_t, _n, p.up); if (_t.lengthSq() < 1e-4) _t.copy(p.facing).negate();
      p.vel.addScaledVector(p.up, 13).addScaledVector(_t.normalize(), 6);   // sales rebotando hacia afuera
      p.jumping = true; p.jumpCut = true; p.airDash = true;
      p.pos.copy(e.pos).addScaledVector(_n, min); continue;
    }
    if (p.state === 'pound') {                                 // pisotón directo
      hurtEnemy(e, 3, _t.copy(e.up).multiplyScalar(-3), 1.5);
      shockwave(_t2.copy(e.pos).addScaledVector(_n, e.r), p.up, e);
      p.state = 'normal'; tangent(p.vel, p.vel, p.up); p.vel.addScaledVector(p.up, 12); p.jumping = true; p.jumpCut = true;
      p.pos.copy(e.pos).addScaledVector(_n, min); cam.shake = 0.35; continue;
    }
    if (above > 0.5 && vrel < 0.5) {                           // caer encima → rebote
      if (e.T.stomp > 0) hurtEnemy(e, e.T.stomp, _t.copy(e.up).multiplyScalar(-2), 0.8); else e.flash = 0.08;
      if (p.state === 'dash' || p.state === 'poundWind') p.state = 'normal';
      tangent(p.vel, p.vel, p.up); p.vel.addScaledVector(p.up, input.jumpHeld ? CFG.stompHeld : CFG.stomp);
      p.jumping = true; p.jumpCut = false; p.airDash = true; p.grounded = false;
      p.pos.copy(e.pos).addScaledVector(_n, min); continue;
    }
    if (p.state === 'dash') {
      if (e.T.dash > 0) {
        if (!p.dashHit.has(e)) { p.dashHit.add(e); hurtEnemy(e, e.T.dash, _t.copy(p.dashDir).multiplyScalar(11).addScaledVector(e.up, 5), 0.6); }
      } else { p.state = 'normal'; p.vel.copy(_n).multiplyScalar(10).addScaledVector(p.up, 6); e.flash = 0.08; cam.shake = 0.15; }
      p.pos.copy(e.pos).addScaledVector(_n, min); continue;
    }
    p.pos.copy(e.pos).addScaledVector(_n, min);
    if (e.stun > 0 || e.mareado > 0) continue;                 // aturdido o mareado = inofensivo
    hurtPlayer(e.state === 'charge' ? 2 : 1, _n);
  }
}
