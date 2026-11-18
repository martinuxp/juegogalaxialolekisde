/* =========================================================
   camara.js · Cámara que sigue al jugador
   ---------------------------------------------------------
   El "arriba" de la cámara se va alineando con el "arriba" del
   jugador, así el planeta siempre se ve "abajo" aunque estés
   parado en el polo sur.
   Al cargar el supersalto o volar, la cámara se aleja para
   que se vea la trayectoria y el planeta de destino.
   ========================================================= */
import { V3, clamp, damp, tangent, anyPerp } from './util.js';
import { camera } from './escena.js';
import { input, keys } from './entrada.js';
import { juego } from './estado.js';

export const cam = {
  fwd: new V3(0, 0, -1), up: new V3(0, 1, 0),
  pitch: 0.42, dist: 8.5, distActual: 8.5,
  pos: new V3(0, 30, 20), look: new V3(), shake: 0,
};
const _c1 = new V3(), _c2 = new V3();

export function updateCamera(dt) {
  const p = juego.jugador;
  const volando = p.state === 'launch' || p.state === 'vuelo';
  cam.up.lerp(p.up, damp(volando ? 3 : 6, dt)).normalize();
  tangent(cam.fwd, cam.fwd, cam.up);
  if (cam.fwd.lengthSq() < 1e-6) anyPerp(cam.fwd, cam.up);
  cam.fwd.normalize();
  const keyYaw = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  const yaw = input.camDX * 0.007 + keyYaw * 2.4 * dt; input.camDX = 0;
  if (yaw) cam.fwd.applyAxisAngle(cam.up, -yaw);
  cam.pitch = clamp(cam.pitch + input.camDY * 0.004, 0.08, 1.25); input.camDY = 0;
  if (input.recenter) { cam.fwd.copy(p.facing); input.recenter = false; }

  // distancia: más lejos mientras cargas o vuelas
  let objetivo = cam.dist;
  if (p.state === 'carga') objetivo = 16;
  if (p.state === 'vuelo' && p.planet) {
    const altura = p.pos.distanceTo(p.planet.c) - p.planet.R;
    objetivo = 16 + clamp(altura * 0.5, 0, 30);
  }
  cam.distActual += (objetivo - cam.distActual) * damp(2.5, dt);

  const target = _c1.copy(p.pos).addScaledVector(cam.up, 1.0);
  const d = cam.distActual;
  const want = _c2.copy(target).addScaledVector(cam.fwd, -Math.cos(cam.pitch) * d).addScaledVector(cam.up, Math.sin(cam.pitch) * d);
  cam.pos.lerp(want, damp(volando ? 4 : 10, dt));
  cam.look.lerp(target, damp(16, dt));
  camera.position.copy(cam.pos);
  if (cam.shake > 0) {
    cam.shake -= dt; const s = cam.shake * 0.9;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
  camera.up.copy(cam.up);
  camera.lookAt(cam.look);
}

/** Pone la cámara detrás del jugador de golpe (al empezar un nivel). */
export function camaraAlInicio() {
  const p = juego.jugador;
  cam.up.copy(p.up); cam.fwd.copy(p.facing); cam.distActual = cam.dist;
  cam.pos.copy(p.pos).addScaledVector(cam.fwd, -6).addScaledVector(cam.up, 4);
  cam.look.copy(p.pos);
}
