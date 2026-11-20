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
import { input } from './entrada.js';
import { juego } from './estado.js';
import { mundo } from './fisica.js';

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
  const yaw = input.camDX * 0.007; input.camDX = 0;   // dedo o mouse arrastrando (entrada.js)
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
  noAtravesar(target, dt);
  if (cam.shake > 0) {
    cam.shake -= dt; const s = cam.shake * 0.9;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
  camera.up.copy(cam.up);
  camera.lookAt(cam.look);
}

/* ---------------------------------------------------------
   QUE LA CÁMARA NO QUEDE DENTRO DE UNA ROCA
   Tiramos un "rayo" desde el jugador hasta la cámara. Si el rayo
   choca con una esfera (planeta, isla, roca o duna), la cámara se
   pone justo ANTES del choque, entre la roca y el jugador.
   Choque rayo–esfera: un punto del rayo es  x = o + t·d  (o = origen,
   d = dirección, t = distancia). Está en la esfera si |x − c|² = R².
   Eso da una ecuación de segundo grado en t:
       t² + 2·b·t + c' = 0,  con  b = (o − c)·d  y  c' = |o − c|² − R²
       t = −b − √(b² − c')   (el primer punto donde entra)
   Si b² − c' < 0, el rayo no toca la esfera.
   Al acercarse lo hace de golpe (para no ver el interior), y al
   alejarse vuelve suave.
   --------------------------------------------------------- */
const _rd = new V3(), _ro = new V3();
let distLibre = Infinity;
function noAtravesar(target, dt) {
  _rd.copy(camera.position).sub(target);
  const L = _rd.length();
  if (L < 1e-3) return;
  _rd.divideScalar(L);
  let tMin = L;
  for (const s of mundo.solidos) {
    _ro.copy(target).sub(s.c);
    const b = _ro.dot(_rd), c = _ro.lengthSq() - s.R * s.R;
    if (c < 0) continue;                      // el jugador está "dentro" (no pasa): no la contamos
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < tMin) tMin = t;
  }
  const libre = tMin < L ? Math.max(0.6, tMin - 0.4) : L;
  if (!isFinite(distLibre)) distLibre = libre;
  distLibre = libre < distLibre ? libre : distLibre + (libre - distLibre) * damp(3, dt);
  if (distLibre < L - 1e-3) camera.position.copy(target).addScaledVector(_rd, distLibre);
}

/** Pone la cámara detrás del jugador de golpe (al empezar un nivel). */
export function camaraAlInicio() {
  const p = juego.jugador;
  cam.up.copy(p.up); cam.fwd.copy(p.facing); cam.distActual = cam.dist;
  cam.pos.copy(p.pos).addScaledVector(cam.fwd, -6).addScaledVector(cam.up, 4);
  cam.look.copy(p.pos);
}
