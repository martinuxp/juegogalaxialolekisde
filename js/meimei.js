/* =========================================================
   meimei.js · MEIMEI, la leopardo de las nieves de Kepler
   ---------------------------------------------------------
   Diseño propio del grupo: leopardo de las nieves gris claro
   con rosetas negras, ojos enormes y una cola larguísima y
   gorda. Tiene las antenas verdes de la tribu de gatos-alien.
   Lleva un FRAGMENTO de la luna de Columba.

   LA CARRERA (en el planeta): MeiMei corre por el camino con
   la misma física del deslizar (pendiente − roce − aire):
       a = g·(senθ − μ·cosθ) − c·v²   (+ lo que empuja corriendo)
   y además va "amarrada" a un punto 20 m delante tuyo con un
   RESORTE INVISIBLE (ley de Hooke con amortiguador):
       a_extra = k·(20 − distancia) − b·(v_ella − v_tú)
   Si te acercas, el resorte se comprime y ella acelera; si te
   quedas atrás, se estira y ella te espera (y se burla). Esto es
   una AYUDA DEL JUEGO (para que la carrera sea pareja), no física
   del planeta. Cada tanto te tira BOLAS DE NIEVE (tiro parabólico).

   Al final usa el resorte del lago y vuela a la Luna 2 con la
   MISMA física que tú (salto de rana con la gravedad de Kepler).

   LA PELEA (en la Luna 2, 3 golpes; todo medido RESPECTO A LA LUNA):
     fase 1: SALTA sobre ti (parábola: h = v_y·t − ½·g·t², con la
             gravedad de la luna, g = 6: salta "lento", como en la
             Luna de verdad) y al caer DERRAPA en el hielo. Si choca
             con un pilar queda MAREADA: ¡salta sobre su cabeza!
     fase 2: además te tira bolas de nieve y llama a 2 gatos-alien.
     fase 3: además da un SALTO ORBITAL: corre a v = √(G·m/r) y
             queda dando vueltas a la luna como un satélite, a
             1,5 m del suelo. Cuando pase por tu lado, ¡cáele encima!
   Al ganar suelta el fragmento y escapa de la luna saltando con
   su velocidad de escape √(2·G·m/R). Aparece un resorte de salida.
   ========================================================= */
import { THREE, V3, rng, tangent, clamp, anyPerp } from './util.js';
import { toon, outline, orient } from './escena.js';
import { mundo } from './fisica.js';
import { juego, emitir, escuchar } from './estado.js';
import { player, hurtPlayer, mostrarLunita } from './jugador.js';
import { agregarEnemigo, quitarEnemigos } from './enemigos.js';
import { cam } from './camara.js';
import { CFG } from './config.js';
import { input } from './entrada.js';
import { toast } from './ui.js';
import * as K from './keplerDatos.js';

const $ = id => document.getElementById(id);
const RM = 1.15;                                  // "radio" de MeiMei (para chocar)
const L2 = K.LUNAS[1];
const P2 = () => mundo.planetas[2];
const RL = L2.R;

/* constantes de la carrera */
export const ELASTICO = { distancia: 20, k: 1.0, b: 1.2, empuje: 4, vCorre: 13, vMax: 40 };
/* constantes de la pelea */
export const PELEA_MEI = {
  H: 1.8,                // altura del salto (m)
  vDerrape: K.PELEA.vDerrape,  // rapidez al caer: entre 6 y 10 m/s (si no, patinaba media luna)
  muFrena: K.PELEA.muFrena,    // roce efectivo: el hielo solo da μ = 0,012, ella frena con las garras (a = 0,8·6 = 4,8 m/s²)
  pasada: 25,            // en el salto orbital, frena 25 m después de pasar por encima tuyo
  mareo: 3.4,            // s que queda mareada
  ataquesCansa: 4,       // si no choca en 4 saltos, se cansa (también queda mareada)
};

let kep = null;           // el estado de kepler.js (para no importarlo en círculo)

export const mei = {
  modo: 'nada',           // cine · carrera · espera · vuela · aterriza · luna · pelea · ganada
  s: 0, v: 0, lado: 0,    // en la carrera: metros por el camino, rapidez, metros al costado
  pos: new V3(), vel: new V3(), facing: new V3(0, 0, 1), up: new V3(0, 1, 0),
  g: null, malla: null, pose: 'corre',
  // en la luna (coordenadas locales respecto al centro de la Luna 2)
  dir: new V3(0, 1, 0), h: 0, vt: 0, local: new V3(), velL: new V3(),
  arena: new V3(0, 1, 0),
  hp: 3, fase: 1, f: 'nada', t: 0, ataques: 0, tBola: 3, flash: 0,
  bolas: [], salida: null, fragmento: null,
};

/* =========================================================
   DIBUJO
   ========================================================= */
const bola = new THREE.SphereGeometry(1, 16, 12);
const negro = new THREE.MeshBasicMaterial({ color: 0x10131c });
const blanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
function parte(mat, sx, sy, sz, x, y, z, borde = 0.05) {
  const m = new THREE.Mesh(bola, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  return borde ? outline(m, borde) : m;
}
function halo(rgba, tam) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba); grd.addColorStop(0.4, 'rgba(255,240,190,.5)'); grd.addColorStop(1, 'rgba(255,230,150,0)');
  c.fillStyle = grd; c.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(tam);
  return s;
}
/** El fragmento de luna: un cristal que brilla. */
function crearFragmento(u) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(u, 0), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
  outline(c, 0.08);
  g.add(c, halo('rgba(255,250,220,1)', u * 6));
  g.userData.cristal = c;
  return g;
}

/** MEIMEI. u = tamaño. Mira hacia +z, arriba +y. El centro del grupo es el centro del cuerpo. */
function crearMeiMei(u) {
  const g = new THREE.Group();
  const piel = toon(0xeef0f4, { emissive: 0x24262c }), panza = toon(0xffffff, { emissive: 0x24262c });
  const gris = toon(0xc9ced8, { emissive: 0x1a1b20 }), nariz = toon(0x8a8f9c);
  const mats = [piel, panza, gris];
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  cuerpo.add(parte(piel, u * 0.6, u * 0.55, u * 1.0, 0, 0, 0, 0.04));
  cuerpo.add(parte(panza, u * 0.5, u * 0.32, u * 0.82, 0, -u * 0.26, u * 0.05, 0));
  // ROSETAS: anillos negros con el centro gris (como el leopardo de verdad) + puntitos
  const r = rng(27);
  const aro = new THREE.TorusGeometry(1, 0.32, 6, 12);
  for (let i = 0; i < 22; i++) {
    const a = (r() - 0.5) * 2.6, z = (r() - 0.5) * 1.6;            // a = ángulo alrededor del lomo, z = a lo largo
    const n = new V3(Math.sin(a) * 0.6, Math.cos(a) * 0.55, z * 0.95).normalize();
    const p = new V3(Math.sin(a) * u * 0.6, Math.cos(a) * u * 0.55, z * u * 0.62);
    const ros = new THREE.Mesh(aro, negro);
    const t = u * (0.07 + r() * 0.05);
    ros.scale.set(t, t, t * 0.6);
    ros.position.copy(p).multiplyScalar(1.01);
    ros.quaternion.setFromUnitVectors(new V3(0, 0, 1), n);
    cuerpo.add(ros);
  }
  // patas (cada una cuelga de su "cadera" para poder moverla)
  const patas = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const cadera = new THREE.Group(); cadera.position.set(x * u * 0.32, -u * 0.2, z * u * 0.58);
    cadera.add(parte(piel, u * 0.15, u * 0.34, u * 0.16, 0, -u * 0.28, 0, 0.05));
    cadera.add(parte(panza, u * 0.17, u * 0.11, u * 0.21, 0, -u * 0.6, u * 0.05, 0.05));   // la pata ancha (de nieve)
    if (z > 0) {                                     // almohadillas negras (se ven cuando levanta la patita, como en la foto)
      cadera.add(parte(negro, u * 0.09, u * 0.03, u * 0.08, 0, -u * 0.71, u * 0.06, 0));
      for (const dx of [-0.09, -0.03, 0.03, 0.09]) cadera.add(parte(negro, u * 0.035, u * 0.02, u * 0.035, dx * u, -u * 0.7, u * 0.19, 0));
    }
    cuerpo.add(cadera); patas.push(cadera);
  }
  // COLA: larga y gorda, con anillos negros. Cada segmento cuelga del anterior (se mueve como látigo)
  const cola = [];
  let padre = cuerpo, z0 = -u * 0.9;
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? u * 0.15 : 0, i === 0 ? z0 : -u * 0.3);
    const rad = u * (0.21 - i * 0.004);
    seg.add(parte(i % 2 ? piel : gris, rad, rad, u * 0.2, 0, 0, -u * 0.15, 0.05));
    if (i % 2 === 0) { const an = new THREE.Mesh(aro, negro); an.scale.set(rad * 0.95, rad * 0.95, rad * 0.9); an.position.z = -u * 0.15; seg.add(an); }
    padre.add(seg); cola.push(seg); padre = seg;
  }
  const punta = parte(toon(0x2b2f3d), u * 0.2, u * 0.2, u * 0.22, 0, 0, -u * 0.32, 0.05);
  padre.add(punta);
  // CABEZA
  const cabeza = new THREE.Group(); cabeza.position.set(0, u * 0.42, u * 0.95); g.add(cabeza);
  cabeza.add(parte(piel, u * 0.52, u * 0.46, u * 0.48, 0, 0, 0, 0.04));
  cabeza.add(parte(panza, u * 0.3, u * 0.2, u * 0.2, 0, -u * 0.16, u * 0.38, 0.03));      // hocico blanco
  cabeza.add(parte(nariz, u * 0.07, u * 0.05, u * 0.05, 0, -u * 0.06, u * 0.56, 0));       // nariz gris
  for (const sx of [-1, 1]) {
    // OJOS enormes (lo que más se ve en la foto): oscuros con dos brillos
    cabeza.add(parte(panza, u * 0.17, u * 0.2, u * 0.08, sx * u * 0.21, u * 0.07, u * 0.4, 0));          // el pelito blanco alrededor
    cabeza.add(parte(toon(0x2a1c14), u * 0.14, u * 0.16, u * 0.08, sx * u * 0.21, u * 0.07, u * 0.43, 0.03));   // ojo café muy oscuro
    cabeza.add(parte(negro, u * 0.09, u * 0.11, u * 0.05, sx * u * 0.21, u * 0.07, u * 0.48, 0));
    const b1 = new THREE.Mesh(bola, blanco); b1.scale.setScalar(u * 0.045); b1.position.set(sx * u * 0.18, u * 0.13, u * 0.51); cabeza.add(b1);
    const b2 = new THREE.Mesh(bola, blanco); b2.scale.setScalar(u * 0.02); b2.position.set(sx * u * 0.24, u * 0.02, u * 0.51); cabeza.add(b2);
    // orejas redondas y chicas, con el borde negro
    const oreja = parte(piel, u * 0.16, u * 0.17, u * 0.06, sx * u * 0.33, u * 0.38, -u * 0.05, 0.12);   // pálida, con borde oscuro (el contorno)
    oreja.add(parte(gris, 0.6, 0.6, 1.2, 0, -0.1, 0.25, 0));
    cabeza.add(oreja);
    // antenas verdes de la tribu
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.022, u * 0.03, u * 0.5, 6), gris);
    antena.position.set(sx * u * 0.15, u * 0.6, -u * 0.05); antena.rotation.z = -sx * 0.3;
    const bolita = new THREE.Mesh(bola, toon(0x9cf27a, { emissive: 0x2f7a14 })); bolita.scale.setScalar(u * 0.09);
    bolita.position.set(sx * u * 0.23, u * 0.85, -u * 0.05);
    cabeza.add(antena, bolita);
    // bigotes
    for (const dy of [-0.02, 0.05]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.006, u * 0.006, u * 0.4, 3), negro);
      b.position.set(sx * u * 0.3, -u * 0.12 + dy * u, u * 0.42); b.rotation.z = Math.PI / 2 + sx * dy * 3; cabeza.add(b);
    }
  }
  // manchitas en la frente
  for (let i = 0; i < 16; i++) {
    const x = (r() - 0.5) * u * 0.5, y = u * (0.2 + r() * 0.2);
    const zz = Math.sqrt(Math.max(0, 1 - (x / (u * 0.52)) ** 2 - (y / (u * 0.46)) ** 2)) * u * 0.48;   // pegadas a la cabeza
    const tam = u * (0.02 + r() * 0.025);
    cabeza.add(parte(negro, tam, tam, tam * 0.5, x, y, zz + u * 0.005, 0));
  }
  // el FRAGMENTO, delante del pecho (lo lleva entre las patas)
  const frag = crearFragmento(u * 0.2); frag.position.set(0, -u * 0.05, u * 1.35); g.add(frag);
  // estrellitas de mareo y destello de carga
  const estrellas = new THREE.Group(); estrellas.position.set(0, u * 1.2, u * 0.9); estrellas.visible = false;
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(u * 0.14, 0), new THREE.MeshBasicMaterial({ color: 0xfff27a }));
    const a = i / 5 * Math.PI * 2; s.position.set(Math.cos(a) * u * 0.7, 0, Math.sin(a) * u * 0.7);
    estrellas.add(s);
  }
  g.add(estrellas);
  const destello = halo('rgba(230,250,255,1)', u * 5); destello.material.opacity = 0; g.add(destello);
  return { g, cuerpo, cabeza, patas, cola, frag, estrellas, destello, mats };
}

/* =========================================================
   CONSTRUIR (lo llama kepler.js)
   ========================================================= */
export function construirMeiMei(grupo, estadoKepler) {
  kep = estadoKepler;
  mei.malla = crearMeiMei(RM);
  mei.g = mei.malla.g;
  grupo.add(mei.g);
  mei.modo = 'nada'; mei.hp = 3; mei.fase = 1; mei.f = 'nada';
  mei.arena.set(0, 1, 0);
  mei.bolas.forEach(b => { b.m.removeFromParent(); b.anillo.removeFromParent(); });
  mei.bolas = [];
  mei.grupo = grupo;
  // en la Luna 2: el fragmento que suelta y el resorte de salida (hijos del grupo de la luna: se mueven con ella)
  const L = kep.lunas[1];
  mei.fragmento = crearFragmento(0.3); mei.fragmento.visible = false; L.g.add(mei.fragmento);
  mei.salida = crearResorteSalida(); mei.salida.g.visible = false; L.g.add(mei.salida.g);
}
function crearResorteSalida() {
  const g = new THREE.Group();
  const metal = toon(0x4a5a7a), cobre = toon(0xffd27a, { emissive: 0x5a3a00 });
  const pie = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.1, 0.5, 20), metal), 0.04); pie.position.y = 0.25;
  const resortes = new THREE.Group(); resortes.position.y = 0.5;
  for (let i = 0; i < 4; i++) {
    const a = outline(new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 8, 20), cobre), 0.06);
    a.rotation.x = Math.PI / 2; a.position.y = 0.22 + i * 0.3; resortes.add(a);
  }
  const plato = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.28, 20), toon(0xfff3d0, { emissive: 0x4a3a10 })), 0.04);
  plato.position.y = 1.75;
  const luz = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 40, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  luz.position.y = 20;
  g.add(pie, resortes, plato, luz);
  return { g, plato, resortes, luz, local: new V3(), arriba: new V3(), estado: 'oculto', t: 0, comp: 0 };
}

/* ---------- posiciones ---------- */
export function colocarMeiMei(pos, facing) {
  mei.pos.copy(pos);
  mei.up.copy(pos).normalize();
  if (facing) mei.facing.copy(facing);
  mei.g.visible = true;
}
export function mostrarMeiMei(v) { if (mei.g) mei.g.visible = v; }
export function poseMeiMei(p) { mei.pose = p; }

/** La carrera parte (o vuelve a partir) con MeiMei en el metro s del camino. */
export function carreraDesde(s) {
  mei.modo = 'carrera'; mei.s = s; mei.v = 8; mei.lado = 0; mei.tBola = 4;
  mei.pose = 'corre'; mei.g.visible = true; mei.malla.frag.visible = true;
  K.puntoCamino(s, 0, RM, mei.pos);
  limpiarBolas();
}

/* =========================================================
   CADA PASO DE FÍSICA (kepler.js → alPaso)
   ========================================================= */
export function pasoMeiMei(dt) {
  if (!kep) return;
  switch (mei.modo) {
    case 'carrera': pasoCarrera(dt); break;
    case 'espera': pasoEspera(dt); break;
    case 'vuela': pasoVuela(dt); break;
    case 'aterriza': pasoAterriza(dt); break;
    case 'luna':
      // espera en la luna a que llegues: la pelea parte cuando pisas el suelo de la luna
      if (kep.enLuna && player.grounded) empezarPelea();
      break;
    case 'pelea': pasoPelea(dt); break;
    case 'ganada': pasoGanada(dt); break;
  }
  pasoBolas(dt);
  pasoSalida(dt);
}

/* ---------- LA CARRERA ---------- */
function pasoCarrera(dt) {
  const s = mei.s;
  // la pendiente del camino: dh/ds (centrada). Bajando, senθ > 0
  const dh = (K.alturaCamino(s + 1) - K.alturaCamino(s - 1)) / 2;
  const sen = -dh / Math.sqrt(1 + dh * dh), cos = 1 / Math.sqrt(1 + dh * dh);
  const r = K.R + K.alturaCamino(s), g = K.G0 * (K.R / r) ** 2;
  const mu = s > K.S_LAGO[0] && s < K.S_LAGO[1] ? K.DESLIZ.mu[1] : K.DESLIZ.mu[3];
  let a = g * (sen - mu * cos) - K.DESLIZ.c * mei.v * mei.v;
  if (juego.modo === 'juego' && !kep.enLuna) {
    // el resorte invisible que la amarra 20 m delante tuyo (AYUDA DEL JUEGO).
    // vP = tu rapidez A LO LARGO del camino (lo que te acerca a ella)
    const gap = s - kep.sP, vP = Math.max(0, player.vel.dot(K.muestraEn(kep.sP).t));
    a += ELASTICO.k * (ELASTICO.distancia - gap) - ELASTICO.b * (mei.v - vP);
    if (gap < ELASTICO.distancia && mei.v < ELASTICO.vCorre) a += ELASTICO.empuje;   // te tiene cerca: corre con todo
    mei.burla = gap > 30 && mei.v < 3;                              // muy atrás: te espera mirándote
  } else if (mei.v < ELASTICO.vCorre) a += ELASTICO.empuje;
  mei.v = clamp(mei.v + a * dt, 0, ELASTICO.vMax);
  mei.s = Math.min(K.S_RESORTE - 3, s + mei.v * dt);
  // zigzag suave dentro del camino (se ve más viva)
  const ancho = K.anchoEn(mei.s);
  mei.lado += (Math.sin(mei.s * 0.045) * ancho * 0.45 - mei.lado) * Math.min(1, dt * 2);
  K.puntoCamino(mei.s, mei.lado, RM * 0.9, mei.pos);
  mei.up.copy(mei.pos).normalize();
  mei.facing.copy(K.muestraEn(mei.s).t);
  mei.pose = mei.burla ? 'patita' : 'corre';
  // bolas de nieve: cada 4 a 6 s, si estás a una distancia razonable
  mei.tBola -= dt;
  const gap = mei.s - kep.sP;
  if (mei.tBola <= 0 && gap > 10 && gap < 45 && juego.modo === 'juego' && mei.s < K.S_LAGO[1]) {
    mei.tBola = 4 + Math.random() * 2;
    tirarBola(mundo.planetas[0], mei.pos, player.pos, player.vel, 1.1);
  }
  if (mei.s >= K.S_RESORTE - 3) {                                  // llegó al resorte
    mei.modo = 'espera'; mei.t = 0;
    const R = kep.resorte;
    mei.pos.copy(R.base.pos).addScaledVector(R.base.arriba, RM + 0.2).addScaledVector(lado(R.base), 3.2);
    emitir('meimeiRisa');
  }
}
const lado = base => new V3().crossVectors(base.adelante, base.arriba).normalize();

/* ---------- espera en el resorte a que la Luna 2 pase ---------- */
function pasoEspera(dt) {
  mei.t += dt;
  const R = kep.resorte;
  mei.up.copy(R.base.arriba);
  _a.copy(player.pos).sub(mei.pos); tangent(mei.facing, _a, mei.up); mei.facing.normalize();
  mei.pose = 'patita';
  const cerca = kep.sP > K.S_RESORTE - 45 || kep.resorte.estado !== 'libre';
  if (cerca && mei.t > 1 && (kep.proxima ? kep.proxima() : 0) === 0 && kep.t > (mei.intento || 0)) {
    mei.intento = kep.t + 0.3;                        // calcular un tiro cuesta: no en cada paso
    const sol = K.tiroALaLuna(R.base, kep.t, 1 / 60);
    if (!sol) return;
    // salta con el mismo tiro que te va a lanzar a ti (es un leopardo: no necesita el plato)
    mei.modo = 'vuela'; mei.t = 0; mei.pose = 'salto';
    mei.vel.copy(sol.vel);
    mei.malla.frag.visible = true;
    emitir('meimeiSalta');
    emitir('resorteSuelta', { v: sol.v, k: K.kResorte(sol.v) });
  }
}

/* ---------- vuelo a la Luna 2: salto de rana con la gravedad de Kepler (igual que pasoNewton) ---------- */
const _a = new V3(), _b = new V3(), _c = new V3(), _pd = new V3();
function gravKepler(pos, out) { const r = pos.length(); return out.copy(pos).multiplyScalar(-K.GM_K / (r * r * r)); }
function pasoVuela(dt) {
  mei.t += dt;
  mei.vel.addScaledVector(gravKepler(mei.pos, _a), dt / 2);
  mei.pos.addScaledVector(mei.vel, dt);
  mei.vel.addScaledVector(gravKepler(mei.pos, _a), dt / 2);
  mei.up.copy(mei.pos).normalize();
  if (mei.vel.lengthSq() > 1) mei.facing.copy(mei.vel).normalize();
  const P = P2(), d = mei.pos.distanceTo(P.c);
  if (d < L2.hill || mei.t > 12) {
    // entró a la esfera de Hill: desde aquí todo se mide respecto a la luna
    mei.local.copy(mei.pos).sub(P.c);
    mei.velL.copy(mei.vel).sub(K.velLuna(L2, kep.t, _a));
    if (mei.t > 12) mei.local.setLength(RL + 8);
    mei.modo = 'aterriza'; mei.t = 0;
  }
}
function pasoAterriza(dt) {
  mei.t += dt;
  // gravedad de la luna + la "atrapada" (la misma ayuda que a ti)
  const r = mei.local.length();
  mei.velL.addScaledVector(mei.local, -L2.gm / (r * r * r) * dt);
  if (mei.t < 0.6) { mei.velL.multiplyScalar(Math.exp(-dt / 0.22)); mei.velL.addScaledVector(mei.local, -6 * dt / r); }
  mei.local.addScaledVector(mei.velL, dt);
  mei.pos.copy(P2().c).add(mei.local);
  if (mei.local.length() <= RL + RM || mei.t > 6) {
    mei.dir.copy(mei.local).normalize(); mei.h = 0; mei.vt = 0;
    anyPerp(mei.facing, mei.dir);
    colocarArena(mei.dir);
    mei.modo = 'luna'; mei.pose = 'patita';
    cam.shake = Math.max(cam.shake, 0.3);
    emitir('tocaSuelo', 8);
  }
}

/** Reparte los pilares de hielo alrededor del punto donde aterrizó MeiMei (ahí es la pelea). */
const _q = new THREE.Quaternion();
export function colocarArena(dir) {
  mei.arena.copy(dir).normalize();
  const L = kep.lunas[1];
  _q.setFromUnitVectors(new V3(0, 1, 0), mei.arena);
  for (const s of L.pilares) {
    s.base ||= s.local.clone();
    s.local.copy(s.base).applyQuaternion(_q);
    s.c.copy(L.P.c).add(s.local);
    if (s.malla) { s.malla.position.copy(s.local); s.malla.quaternion.setFromUnitVectors(new V3(0, 1, 0), _a.copy(s.local).normalize()); }
  }
  // el resorte de salida: a 7 m del centro de la arena
  const S = mei.salida;
  anyPerp(_b, mei.arena);
  S.arriba.copy(mei.arena).addScaledVector(_b, 7 / RL).normalize();
  S.local.copy(S.arriba).multiplyScalar(RL);
  S.g.position.copy(S.local);
  S.g.quaternion.setFromUnitVectors(new V3(0, 1, 0), S.arriba);
}

/* =========================================================
   LA PELEA
   ========================================================= */
const enLuna = () => mei.modo === 'pelea';
function empezarPelea() {
  mei.modo = 'pelea'; mei.hp = 3; mei.fase = 1; mei.ataques = 0;
  mei.f = 'intro'; mei.t = 0; mei.pose = 'patita'; mei.h = 0; mei.vt = 0;
  mei.malla.frag.visible = true; mei.g.visible = true;
  kep.pelea = true;
  juego.checkpoint = kep.puntoLuna ? kep.puntoLuna() : null;
  if (kep.guardar) kep.guardar({ luna: true, ganado: false });
  emitir('arena');                               // audio.js: entra la música de la pelea
  emitir('meimeiRisa');
  cam.shake = 0.3;
}
/** Si ya ibas en la luna: la pelea espera (o, si ya ganaste, solo falta el resorte). */
export function peleaDesde(ganado) {
  limpiarBolas();
  colocarArena(mei.arena);
  mei.fragmento.visible = false;
  if (ganado) {
    mei.modo = 'ganada'; mei.f = 'fuera'; mei.g.visible = false;
    mostrarLunita(true);
    subirSalida(true);
    return;
  }
  mei.modo = 'luna'; mei.pose = 'patita';
  anyPerp(_b, mei.arena);
  mei.dir.copy(mei.arena).addScaledVector(_b, 12 / RL).normalize(); mei.h = 0;
  tangent(mei.facing, _a.copy(mei.arena).sub(mei.dir), mei.dir).normalize();
  mei.g.visible = true;
}
/** Te ganó: la pelea vuelve a empezar (como con Meowl). */
escuchar('reaparecer', () => {
  if (!kep || !juego.nivel || juego.nivel.id !== 'kepler' || mei.modo !== 'pelea') return;
  quitarEnemigos(e => e.deMei);
  limpiarBolas();
  mei.modo = 'luna'; mei.f = 'nada';
  anyPerp(_b, mei.arena);
  mei.dir.copy(mei.arena).addScaledVector(_b, 12 / RL).normalize(); mei.h = 0; mei.vt = 0;
  emitir('jefe', null);
});

/** Dónde está tu centro, en coordenadas de la luna. */
const playerLocal = (out = new V3()) => out.copy(player.pos).sub(P2().c);
function pasoPelea(dt) {
  mei.t += dt;
  mei.flash = Math.max(0, mei.flash - dt);
  const pl = playerLocal(_c), pDir = _pd.copy(pl).normalize();
  const ang = Math.acos(clamp(pDir.dot(mei.dir), -1, 1)), dist = ang * RL;   // distancia por la superficie
  switch (mei.f) {
    case 'intro':
      mirarA(pDir);
      if (mei.t > 1.6) { emitir('jefe', { hp: mei.hp, max: 3, icono: 'meimei' }); emitir('jefeAterriza'); acechar(); }
      break;
    case 'acecha':
      // se acerca hasta ~9 m, de lado (rodeándote)
      mirarA(pDir);
      mei.pose = 'corre';
      if (dist > 9) caminar((dist > 20 ? 11 : 5.5) * dt);        // si quedó lejos, vuelve corriendo
      if (mei.t > mei.espera) {
        if (mei.fase >= 2 && !mei.tiro && Math.random() < 0.6) { mei.f = 'lanza'; mei.t = 0; mei.lanzadas = 0; mei.tiro = true; break; }
        mei.tiro = false;
        if (mei.fase >= 3 && mei.ataques % 2 === 1) { mei.f = 'agachaOrbita'; mei.t = 0; emitir('meimeiCarga'); break; }
        mei.f = 'destello'; mei.t = 0; emitir('meimeiCarga');
      }
      break;
    case 'lanza':                                   // 3 bolas de nieve, una cada 0,5 s
      mirarA(pDir); mei.pose = 'patita';
      if (mei.t > 0.5 * (mei.lanzadas + 1) && mei.lanzadas < 3) {
        mei.lanzadas++;
        posMundo(_a);
        tirarBola(P2(), _a, player.pos, player.vel, 1.3, true);
      }
      if (mei.t > 2) acechar(0.4);
      break;
    case 'destello':                                // brilla medio segundo y salta
      mirarA(pDir); mei.pose = 'agacha';
      if (mei.t >= 0.5) {
        // TIRO PARABÓLICO en la gravedad de la luna: cima H → v_y = √(2·g·H), vuelo t = 2·v_y/g
        const g = L2.g, vy = Math.sqrt(2 * g * PELEA_MEI.H), tVuelo = 2 * vy / g;
        mei.salto = { de: mei.dir.clone(), a: pDir.clone(), vy, tVuelo, ang };
        mei.vt = clamp(dist / tVuelo, PELEA_MEI.vDerrape[0], PELEA_MEI.vDerrape[1]);
        mei.f = 'salto'; mei.t = 0; mei.pego = false;
        emitir('meimeiSalta');
      }
      break;
    case 'salto': {
      const S = mei.salto, k = Math.min(1, mei.t / S.tVuelo);
      slerpDir(S.de, S.a, k, mei.dir);
      mei.h = Math.max(0, S.vy * mei.t - 0.5 * L2.g * mei.t * mei.t);
      tangent(mei.facing, _a.copy(S.a).sub(S.de), mei.dir); if (mei.facing.lengthSq() > 1e-6) mei.facing.normalize();
      mei.pose = 'salto';
      tocarJugador(true);
      if (k >= 1) { mei.h = 0; mei.f = 'derrapa'; mei.t = 0; emitir('meimeiDerrapa'); cam.shake = Math.max(cam.shake, 0.25); }
      break;
    }
    case 'derrapa': {
      // patina en el hielo: frena con a = μ·g (las garras)
      mei.vt = Math.max(0, mei.vt - PELEA_MEI.muFrena * L2.g * dt);
      caminar(mei.vt * dt);
      mei.pose = 'derrapa';
      tocarJugador(true);
      const pilar = chocaPilar();
      if (pilar) { marear(); emitir('meimeiChoca'); cam.shake = 0.6; break; }
      if (mei.vt <= 0) {
        mei.ataques++;
        if (mei.ataques >= PELEA_MEI.ataquesCansa) { marear(); emitir('meimeiCansada'); }
        else acechar();
      }
      break;
    }
    case 'agachaOrbita':
      mirarA(pDir); mei.pose = 'agacha';
      if (mei.t > 0.8) {
        // SALTO ORBITAL: a 1,5 m del suelo, con v = √(G·m/r) queda en órbita circular
        mei.local.copy(mei.dir).multiplyScalar(RL + K.PELEA.alturaOrbita);
        mei.velL.copy(mei.facing).multiplyScalar(K.PELEA.vOrbita());
        mei.f = 'orbita'; mei.t = 0; mei.pego = false; mei.frenada = false; mei.yaPaso = false; mei.angMin = Infinity;
        emitir('meimeiOrbita');
      }
      break;
    case 'orbita': {
      // salto de rana con la gravedad de la luna (en el marco de la luna)
      const r1 = mei.local.length();
      mei.velL.addScaledVector(mei.local, -L2.gm / (r1 * r1 * r1) * dt / 2);
      mei.local.addScaledVector(mei.velL, dt);
      const r2 = mei.local.length();
      mei.velL.addScaledVector(mei.local, -L2.gm / (r2 * r2 * r2) * dt / 2);
      mei.dir.copy(mei.local).normalize();
      mei.h = r2 - RL - RM * 0.85;
      mei.facing.copy(mei.velL).normalize();
      mei.pose = 'vuela';
      tocarJugador(true, true);
      // ¿ya pasó por encima tuyo? (el ángulo entre ella y tú, visto desde el centro de la luna, crece de nuevo)
      const angP = Math.acos(clamp(mei.dir.dot(pDir), -1, 1)) * RL;
      // (pasó cuando la distancia a ti dejó de achicarse y ya crece 2 m)
      mei.angMin = Math.min(mei.angMin, angP);
      if (!mei.yaPaso && angP > mei.angMin + 2) mei.yaPaso = true;
      // FRENA: 25 m después de pasarte (o a los 6 s, que es menos de media vuelta). Con menos que la velocidad orbital
      // la órbita se vuelve una elipse que choca con el suelo: cae enseguida
      if (!mei.frenada && ((mei.yaPaso && angP > PELEA_MEI.pasada) || mei.t > Math.min(6, K.PELEA.tOrbita() / 2))) {
        mei.frenada = true; mei.velL.multiplyScalar(K.PELEA.frenoOrbita); emitir('meimeiFrena');
      }
      if (mei.frenada && r2 <= RL + RM * 0.85) {
        // aterrizaje forzoso: queda mareada (¡ahí le caes encima!)
        mei.h = 0; mei.ataques = 0; marear(); cam.shake = 0.5; emitir('meimeiChoca');
      }
      break;
    }
    case 'mareada':
      mei.pose = 'mareada';
      mei.mareo -= dt;
      tocarJugador(false);
      if (mei.f === 'mareada' && mei.mareo <= 0) { mei.ataques = 0; acechar(); }
      break;
    case 'golpe':
      mei.pose = 'mareada';
      if (mei.t > 0.8) {
        if (mei.hp <= 0) { ganar(); return; }
        mei.fase = 4 - mei.hp;
        if (mei.fase === 2) llamarGatos();
        mei.ataques = 0;
        acechar(0.8);
      }
      break;
  }
}
function acechar(espera = 1 + Math.random()) { mei.f = 'acecha'; mei.t = 0; mei.espera = espera; mei.h = 0; }
function marear() { mei.f = 'mareada'; mei.t = 0; mei.mareo = PELEA_MEI.mareo; mei.vt = 0; mei.h = 0; emitir('meimeiMareada'); }
function mirarA(pDir) {
  tangent(_a, pDir, mei.dir);
  if (_a.lengthSq() > 1e-8) mei.facing.lerp(_a.normalize(), 0.15).normalize();
}
/** Avanza ds metros por la superficie de la luna, hacia donde mira. */
function caminar(ds) {
  mei.dir.addScaledVector(mei.facing, ds / RL).normalize();
  tangent(mei.facing, mei.facing, mei.dir).normalize();
}
function slerpDir(a, b, k, out) {
  const w = Math.acos(clamp(a.dot(b), -1, 1));
  if (w < 1e-4) return out.copy(b);
  const s = Math.sin(w);
  return out.copy(a).multiplyScalar(Math.sin((1 - k) * w) / s).addScaledVector(b, Math.sin(k * w) / s).normalize();
}
function chocaPilar() {
  posLocal(_a);
  for (const s of kep.lunas[1].pilares) if (_a.distanceTo(s.local) < s.R + RM) return s;
  return null;
}
const posLocal = out => out.copy(mei.dir).multiplyScalar(RL + RM * 0.85 + mei.h);
const posMundo = out => posLocal(out).add(P2().c);

/** ¿Te toca? peligrosa = saltando, derrapando u orbitando (1 corazón). orbital = se le puede pegar desde arriba. */
function tocarJugador(peligrosa, orbital = false) {
  const p = player;
  posMundo(_a);
  _c.copy(p.pos).sub(_a);
  const d = _c.length(), min = RM + p.r + 0.2;
  if (d > min) return;
  const up = _b.copy(_a).sub(P2().c).normalize(), encima = _c.dot(up) / (d || 1), baja = p.vel.dot(up);
  if ((mei.f === 'mareada' || orbital) && encima > 0.45 && baja < 1) { golpe(_c, up); return; }
  if (encima > 0.5 && baja < 1 && !peligrosa) { rebotar(p, _c, up, CFG.stomp); return; }
  p.pos.copy(_a).addScaledVector(_c.normalize(), min);
  if (peligrosa && !mei.pego) { mei.pego = true; hurtPlayer(1, _c); emitir('meimeiPega'); }
}
function golpe(n, up) {
  mei.hp--; mei.f = 'golpe'; mei.t = 0; mei.mareo = 0; mei.flash = 0.3; mei.h = 0; mei.vt = 0;
  cam.shake = 0.7;
  emitir('meimeiGolpe', mei.hp);
  emitir('jefe', mei.hp > 0 ? { hp: mei.hp, max: 3, icono: 'meimei' } : null);
  rebotar(player, n, up, input.jumpHeld ? CFG.stompHeld : CFG.stomp);
}
function rebotar(p, n, up, v) {
  tangent(p.vel, p.vel, p.up); p.vel.addScaledVector(p.up, v);
  tangent(_a, n, up); if (_a.lengthSq() > 1e-4) p.vel.addScaledVector(_a.normalize(), 4);
  p.state = 'normal'; p.jumping = true; p.jumpCut = false; p.airDash = true; p.grounded = false;
}
/** Fase 2: llama a 2 gatos-alien de la tribu (aparecen en la luna, se mueven con ella). */
function llamarGatos() {
  for (const s of [-1, 1]) {
    anyPerp(_a, mei.arena).applyAxisAngle(mei.arena, s * 1.2);
    const dir = mei.arena.clone().addScaledVector(_a, 14 / RL).normalize();
    const e = agregarEnemigo('alien', 2, dir, 0.4);
    e.marco = P2(); e.deMei = true;                 // ya nace en el marco de la luna (sin restarle su velocidad)
  }
  emitir('meimeiLlama');
}

/* ---------- ganar: suelta el fragmento y escapa ---------- */
function ganar() {
  mei.modo = 'ganada'; mei.f = 'huye'; mei.t = 0;
  emitir('jefe', null);
  emitir('jefeVencido');
  for (const e of juego.enemigos) if (e.deMei && !e.dead) { e.dead = true; e.dieT = 0.3; }
  limpiarBolas();
  // el fragmento cae a su lado (queda en la luna)
  posLocal(mei.fragmento.position).addScaledVector(mei.facing, 1.6).setLength(RL + 0.6);
  mei.fragmento.visible = true;
  mei.malla.frag.visible = false;
  // y ella se va: salta hacia arriba con su velocidad de escape de la luna  v = √(2·G·m/R)
  mei.local.copy(mei.dir).multiplyScalar(RL + RM);
  mei.velL.copy(mei.dir).multiplyScalar(Math.sqrt(2 * L2.gm / RL) * 1.05);
  mei.pose = 'salto';
  emitir('meimeiHuye');
  toast('¡MeiMei soltó el fragmento!', 2400);
}
function pasoGanada(dt) {
  mei.t += dt;
  if (mei.f === 'huye') {
    const r = mei.local.length();
    mei.velL.addScaledVector(mei.local, -L2.gm / (r * r * r) * dt);
    mei.local.addScaledVector(mei.velL, dt);
    mei.dir.copy(mei.local).normalize(); mei.h = r - RL - RM * 0.85;
    if (mei.t > 3.5) { mei.f = 'fuera'; mei.g.visible = false; }
  }
  // tomar el fragmento
  if (mei.fragmento.visible) {
    _a.copy(mei.fragmento.position).add(P2().c);
    if (player.pos.distanceTo(_a) < 1.9) {
      mei.fragmento.visible = false;
      mostrarLunita(true);
      if (kep.guardar) kep.guardar({ luna: true, ganado: true });
      emitir('fragmento');
      toast('¡Recuperaste un fragmento de la luna!<small>Súbete al resorte para salir de Kepler</small>', 3200);
      subirSalida(false);
    }
  }
}

/* =========================================================
   RESORTE DE SALIDA (en la Luna 2)
   Para escapar de Kepler desde la órbita de la luna hace falta
       v_esc = √(2·G·M/a) = √2 · v_luna ≈ 70 m/s
   La luna ya te regala sus 49,5 m/s. El resorte suma 32 m/s
   respecto a la luna, y solo dispara cuando apunta hacia donde
   avanza la luna (si no, las velocidades no se suman bien).
   ========================================================= */
function subirSalida(yaArriba) {
  const S = mei.salida;
  S.g.visible = true; S.estado = yaArriba ? 'listo' : 'sube'; S.t = 0; S.comp = 0;
  S.g.position.copy(S.local).addScaledVector(S.arriba, yaArriba ? 0 : -2.2);
  if (!yaArriba) emitir('canonSube');
}
/** Dirección del disparo (en el mundo): hacia donde avanza la luna, inclinada hacia arriba. */
export function direccionSalida(t, out = new V3()) {
  const S = mei.salida;
  K.velLuna(L2, t, out).normalize();
  tangent(out, out, S.arriba);
  if (out.lengthSq() < 1e-6) anyPerp(out, S.arriba);
  out.normalize().addScaledVector(S.arriba, 0.6).normalize();
  return out;
}
/** ¿Cuánto del disparo va en la dirección de la luna? (1 = todo) */
export function alineacionSalida(t) { return direccionSalida(t, _a).dot(K.velLuna(L2, t, _b).normalize()); }
export function esperaSalida(t) {
  for (let k = 0; k < 120; k++) if (alineacionSalida(t + k * 0.5) >= 0.6) return k * 0.5;
  return 0;
}
function pasoSalida(dt) {
  const S = mei.salida;
  if (!S || S.estado === 'oculto') return;
  if (S.estado === 'sube') {
    S.t += dt; const k = Math.min(1, S.t / 1.6), e = k * k * (3 - 2 * k);
    S.g.position.copy(S.local).addScaledVector(S.arriba, -2.2 * (1 - e));
    if (k >= 1) { S.estado = 'listo'; emitir('canonListo'); }
    return;
  }
  const p = player;
  _a.copy(S.local).add(P2().c).addScaledVector(S.arriba, 1.75 - S.comp * 1.2);
  const cerca = p.pos.distanceTo(_a) < 2.3 && p.state === 'normal';
  if (S.estado === 'listo' && cerca && p.grounded) { S.estado = 'espera'; S.t = 0; emitir('resortePisa'); }
  if (S.estado === 'espera') {
    if (!cerca) { S.estado = 'listo'; aviso(null); return; }
    p.pos.copy(_a).addScaledVector(S.arriba, p.r + 0.15); p.vel.set(0, 0, 0);
    S.t += dt;
    const falta = esperaSalida(kep.t);
    if (falta === 0 && S.t > 0.3) { S.estado = 'comprime'; S.t = 0; aviso(null); emitir('resorteCarga'); }
    else aviso(falta);
    if (input.jumpQ > 0) { S.estado = 'listo'; aviso(null); }
  }
  if (S.estado === 'comprime') {
    S.t += dt; S.comp = Math.min(1, S.t / 0.45);
    p.pos.copy(_a).addScaledVector(S.arriba, p.r + 0.15); p.vel.set(0, 0, 0);
    if (S.t >= 0.45) {
      // la velocidad es RESPECTO A LA LUNA (todavía estás en su marco); al salir de su esfera de Hill se le suma la de la luna
      p.state = 'vuelo'; p.grounded = false; p.airDash = false;
      p.pos.copy(S.local).add(P2().c).addScaledVector(S.arriba, 1.4);
      direccionSalida(kep.t, p.vel).multiplyScalar(K.PELEA.vSalida);
      S.estado = 'suelta'; S.t = 0;
      emitir('resorteSuelta', { v: K.PELEA.vSalida, k: K.kResorte(K.PELEA.vSalida) });
      emitir('despegue', { v: K.PELEA.vSalida, vesc: K.PELEA.vEscape() });
      cam.shake = 0.5;
    }
  }
  if (S.estado === 'suelta') { S.t += dt; S.comp = Math.max(0, 1 - S.t * 3); if (S.t > 1.5) S.estado = 'listo'; }
  if (S.estado !== 'espera' && S.aviso) aviso(null);
}
function aviso(falta) {
  const el = $('avisoK'); if (!el) return;
  mei.salida.aviso = falta !== null;
  if (falta === null) { el.classList.add('oculto'); return; }
  el.classList.remove('oculto');
  el.innerHTML = falta < 0.6 ? 'Apuntando hacia donde va la luna...' : `La luna apunta bien en <b>${Math.ceil(falta)} s</b><small>v_luna + v_resorte ≥ v_esc · salta para bajarte</small>`;
}

/* =========================================================
   BOLAS DE NIEVE (tiro parabólico)
   Para caer en el punto P en t segundos, partiendo de S:
       P = S + v₀·t + ½·g·t²   →   v₀ = (P − S − ½·g·t²) / t
   (g = el vector gravedad en el blanco: apunta al centro).
   Apunta a donde VAS a estar: P = tu posición + tu velocidad·t.
   ========================================================= */
const geoBola = new THREE.IcosahedronGeometry(0.42, 1);
const matBola = toon(0xffffff, {});
function tirarBola(P, desde, aPos, aVel, t, enLaLuna = false) {
  const c = P.c;
  const S = desde.clone().sub(c).addScaledVector(mei.up, 0.6);
  const blanco = aPos.clone().sub(c);
  if (!enLaLuna) blanco.addScaledVector(aVel, t * 0.8);            // en la carrera: adelanta el tiro
  // apoyar el blanco en el suelo
  const u = blanco.clone().normalize();
  const suelo = enLaLuna ? RL : (kep.relieve ? kep.relieve().radio(u) : K.R);
  blanco.copy(u).multiplyScalar(suelo + 0.3);
  const gm = enLaLuna ? L2.gm : K.GM_K, g = gm / blanco.lengthSq();
  const gv = u.clone().multiplyScalar(-g);
  const v0 = blanco.clone().sub(S).addScaledVector(gv, -0.5 * t * t).divideScalar(t);
  const m = outline(new THREE.Mesh(geoBola, matBola), 0.06);
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 24), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  anillo.renderOrder = 3;
  mei.grupo.add(m, anillo);
  mei.bolas.push({ P, enLaLuna, pos: S, vel: v0, m, anillo, blanco, t: 0, gm });
  emitir('bolaTira');
}
function pasoBolas(dt) {
  for (let i = mei.bolas.length - 1; i >= 0; i--) {
    const b = mei.bolas[i];
    b.t += dt;
    const r1 = b.pos.length();
    b.vel.addScaledVector(b.pos, -b.gm / (r1 * r1 * r1) * dt / 2);
    b.pos.addScaledVector(b.vel, dt);
    const r2 = b.pos.length();
    b.vel.addScaledVector(b.pos, -b.gm / (r2 * r2 * r2) * dt / 2);
    const u = _a.copy(b.pos).normalize();
    const suelo = b.enLaLuna ? RL : (kep.relieve ? kep.relieve().radio(u) : K.R);
    if (r2 <= suelo + 0.4 || b.t > 4) {
      _b.copy(b.pos).add(b.P.c);
      if (player.pos.distanceTo(_b) < 1.7) hurtPlayer(1, _c.copy(player.pos).sub(_b));
      emitir('bolaRompe', _b.distanceTo(player.pos));
      b.m.removeFromParent(); b.anillo.removeFromParent();
      mei.bolas.splice(i, 1);
    }
  }
}
function limpiarBolas() {
  for (const b of mei.bolas) { b.m.removeFromParent(); b.anillo.removeFromParent(); }
  mei.bolas = [];
}

/* =========================================================
   CADA CUADRO: dibujo y poses
   ========================================================= */
const _up = new V3();
export function animarMeiMei(dt, t) {
  if (!mei.g || !kep) return;
  // en la cinemática de llegada no corre la física: la movemos aquí (solo animación)
  if (juego.modo === 'cine' && mei.modo === 'carrera') {
    mei.s += 12 * dt;
    K.puntoCamino(mei.s, 0, RM * 0.9, mei.pos); mei.up.copy(mei.pos).normalize();
    mei.facing.copy(K.muestraEn(mei.s).t);
  }
  // posición en el mundo según dónde está
  if (['luna', 'pelea'].includes(mei.modo) || (mei.modo === 'ganada' && mei.f === 'huye')) {
    posMundo(mei.pos); mei.up.copy(mei.dir);
  } else if (mei.modo === 'aterriza') {
    mei.up.copy(mei.local).normalize();
  }
  const M = mei.malla, g = mei.g;
  g.position.copy(mei.pos);
  orient(g, mei.up, mei.facing);
  // pose
  const corre = mei.pose === 'corre', sienta = mei.pose === 'patita' || mei.pose === 'mira';
  const vel = mei.modo === 'carrera' ? mei.v : mei.modo === 'pelea' && mei.f === 'acecha' ? 5.5 : 0;
  const frec = corre ? 3 + vel * 0.35 : 0;
  mei.fase_ = (mei.fase_ || 0) + frec * dt * Math.PI * 2;
  const f = mei.fase_;
  M.cuerpo.rotation.set(sienta ? -0.45 : mei.pose === 'agacha' ? 0.1 : 0, 0, mei.pose === 'derrapa' ? 0.35 : 0);
  M.cuerpo.position.y = corre ? Math.abs(Math.sin(f)) * 0.12 : sienta ? -0.15 : mei.pose === 'agacha' ? -0.25 : 0;
  M.cabeza.position.y = RM * 0.42 + (sienta ? 0.25 : mei.pose === 'agacha' ? -0.2 : 0);
  M.cabeza.rotation.set(sienta ? 0.15 : 0, 0, mei.pose === 'mareada' ? Math.sin(t * 6) * 0.35 : sienta ? Math.sin(t * 2) * 0.12 : 0);
  M.patas.forEach((p, i) => {
    const adelante = i < 2, izq = i % 2 === 0;
    let r = 0;
    if (corre) r = Math.sin(f + (adelante ? 0 : Math.PI) + (izq ? 0 : 0.5)) * 0.9;   // galope: pares adelante/atrás
    else if (mei.pose === 'salto' || mei.pose === 'vuela') r = adelante ? -1.1 : 1.1;
    else if (mei.pose === 'derrapa') r = adelante ? -0.7 : 0.6;
    else if (sienta) r = adelante ? 0.45 : -1.2;
    if (mei.pose === 'patita' && i === 1) r = -2.0 + Math.sin(t * 9) * 0.35;           // ¡la patita! (saluda burlona)
    p.rotation.x = r;
  });
  M.cola.forEach((s, i) => {
    s.rotation.y = Math.sin(t * (corre ? 7 : 2.4) - i * 0.6) * (corre ? 0.18 : 0.14);
    s.rotation.x = (sienta ? -0.12 : 0.1) + (i === 0 ? (sienta ? 0.9 : -0.35) : 0) + Math.sin(t * 1.7 - i * 0.5) * 0.05;
  });
  M.estrellas.visible = mei.pose === 'mareada';
  if (M.estrellas.visible) M.estrellas.rotation.y = t * 4;
  const cargando = mei.f === 'destello' || mei.f === 'agachaOrbita';
  M.destello.material.opacity = cargando ? 0.5 + 0.4 * Math.sin(t * 30) : 0;
  M.destello.scale.setScalar(RM * (cargando ? 5 + mei.t * 4 : 5));
  const fl = mei.flash > 0 && Math.floor(mei.flash * 20) % 2 === 0;
  for (const m of M.mats) m.emissive.setHex(fl ? 0x775555 : 0x24262c);      // un poco de brillo propio: es blanca aunque el sol le llegue por atrás
  M.frag.rotation.y = t * 2; M.frag.position.y = -RM * 0.05 + Math.sin(t * 3) * 0.05;
  // fragmento suelto y resorte de salida
  if (mei.fragmento && mei.fragmento.visible) { mei.fragmento.rotation.y = t * 1.5; }
  const S = mei.salida;
  if (S && S.g.visible) {
    S.plato.position.y = 1.75 - S.comp * 1.2; S.resortes.scale.y = 1 - S.comp * 0.7;
    S.luz.material.opacity = 0.14 + 0.07 * Math.sin(t * 3);
  }
  // bolas de nieve y sus anillos
  for (const b of mei.bolas) {
    b.m.position.copy(b.pos).add(b.P.c); b.m.rotation.x += dt * 8;
    _up.copy(b.blanco).normalize();
    b.anillo.position.copy(b.blanco).add(b.P.c);
    b.anillo.quaternion.setFromUnitVectors(new V3(0, 0, 1), _up);
    b.anillo.material.opacity = 0.3 + 0.3 * Math.sin(b.t * 18);
  }
}
