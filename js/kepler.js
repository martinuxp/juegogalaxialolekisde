/* =========================================================
   kepler.js · KEPLER, el planeta de nieve (nivel 3)
   ---------------------------------------------------------
   Llegas en el cañón de Ícaro, de cabeza en la nieve, y MeiMei
   (un leopardo de las nieves de la tribu de gatos-alien, ver
   meimei.js) se escapa cerro abajo con un FRAGMENTO de la luna
   de Columba. La persigues PATINANDO por un planeta lleno de
   montañas: la Gran Bajada, el Desfiladero y el Lago Congelado.
   Al final, un RESORTE te lanza a la Luna 2, donde es la pelea.

   Este archivo dibuja el planeta y maneja sus reglas:
     · el relieve (los datos están en keplerDatos.js)
     · las LUNAS en órbita y el MARCO DE LA LUNA: dentro de su
       esfera de Hill te mueves con ella (caes junto con ella)
     · el resorte que apunta adelantado a la Luna 2
     · los carámbanos del desfiladero, las avalanchas de fondo
     · los checkpoints, la regla de "se te escapó" y el guardado
     · la cinemática de llegada
   ========================================================= */
import { THREE, V3, rng, tangent, clamp, damp } from './util.js';
import { scene, camera, toon, outline, orient, planetGeo } from './escena.js';
import { mundo } from './fisica.js';
import { juego, ajustes, guardarAjustes, emitir, escuchar } from './estado.js';
import { player, respawnPlayer, hurtPlayer, mallaJugador } from './jugador.js';
import { cam, camaraAlInicio, moverCamara } from './camara.js';
import { mostrarHUD, toast } from './ui.js';
import { limpiarEntrada, input } from './entrada.js';
import * as K from './keplerDatos.js';
import { mei, construirMeiMei, pasoMeiMei, animarMeiMei, carreraDesde, peleaDesde, colocarMeiMei, mostrarMeiMei, poseMeiMei, esperaSalida } from './meimei.js';

const $ = id => document.getElementById(id);

/* el relieve se arma una vez (tarda ~0,1 s) y se reusa */
let RELIEVE = null;
export const relieveKepler = () => (RELIEVE ||= K.crearRelieve());

export const kep = {
  t: 0,                      // reloj de las órbitas (s)
  lunas: [],                 // { L, P, g, prev, sombra }
  sP: 0, iP: -1, lateral: 0, // dónde vas en el camino (s, metros al costado)
  tramo: 0, lejosT: 0, perdiendo: false,
  resorte: null,             // { base, g, plato, resortes, comp, estado, sol, tEspera, ventanas, calc }
  ritmo: 1, ritmoObj: 1, vSuave: 10, tRitmo: 0,   // RITMO del reloj de las órbitas (ayuda del juego, ver calcularRitmo)
  atrapa: 0,                 // s que quedan de la "atrapada" al entrar a la esfera de Hill
  carambanos: [], avalanchas: [], nieve: null, domo: null, sol: null,
  enLuna: false, pelea: false, ganado: false,
  ultimaPos: new V3(),
};
export const P_LUNA2 = 2;     // índice de la Luna 2 en mundo.planetas (0 = Kepler, 1 = Luna 1)

/* =========================================================
   CONSTRUIR (def.decorado)
   ========================================================= */
export function construirKepler(grupo, planetas) {
  const rel = relieveKepler();
  kep.t = 0; kep.ritmo = 1; kep.ritmoObj = 1; kep.vSuave = 10; kep.tRitmo = 0; kep.tramo = 0; kep.lejosT = 0; kep.perdiendo = false; kep.atrapa = 0;
  kep.iP = -1; kep.enLuna = false; kep.pelea = false; kep.ganado = false;
  grupo.add(crearTerreno(rel));
  grupo.add(crearCielo());
  crearDecorado(grupo, rel);
  crearLunas(grupo, planetas);
  crearResorte(grupo, rel);
  crearCarambanos(grupo);
  crearAvalanchas(grupo, rel);
  crearNieve(grupo);
  // lo que meimei.js necesita de este archivo (así no se importan en círculo)
  kep.proxima = proximaVentana; kep.puntoLuna = puntoLuna; kep.guardar = guardarKepler; kep.relieve = relieveKepler;
  construirMeiMei(grupo, kep);
}

/* ---------- el terreno: la MISMA grilla que choca, convertida en triángulos ---------- */
const COL = {
  nieve: new THREE.Color(0xf4f8ff), nieveSombra: new THREE.Color(0xd7e3f8), camino: new THREE.Color(0xdde7f6),
  hielo: new THREE.Color(0x8fd3ef), hieloClaro: new THREE.Color(0xc8f0ff), roca: new THREE.Color(0x66748f), rocaClara: new THREE.Color(0x8a97b2),
};
function crearTerreno(rel) {
  const NL = K.NLAT, NO = K.NLON, n = NL * NO;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const u = new V3(), nr = new V3(), c = new THREE.Color();
  for (let i = 0; i < NL; i++) for (let j = 0; j < NO; j++) {
    const k = i * NO + j, lat = -90 + i * K.PASO_GRILLA, lon = -180 + j * K.PASO_GRILLA;
    K.dirLL(lat, lon, u);
    const h = rel.alt[k], t = rel.tipo[k];
    pos[k * 3] = u.x * (K.R + h); pos[k * 3 + 1] = u.y * (K.R + h); pos[k * 3 + 2] = u.z * (K.R + h);
    rel.normal(u, nr);
    const plano = nr.dot(u);                                    // 1 = plano, 0 = pared vertical
    const veta = Math.sin(lat * 3.1 + lon * 1.7) * Math.sin(lat * 7.3 - lon * 4.1);
    if (t === 1) c.copy(COL.hielo).lerp(COL.hieloClaro, 0.35 + 0.35 * veta);
    else if (t === 3) c.copy(COL.camino).lerp(COL.nieve, 0.4 + 0.3 * veta);
    else c.copy(COL.nieve).lerp(COL.nieveSombra, clamp(0.25 + 0.35 * veta - h * 0.004, 0, 1));
    if (t !== 1 && plano < 0.8) c.lerp(COL.roca, clamp((0.8 - plano) / 0.3, 0, 1) * (t === 3 ? 0.4 : 0.9));   // lo empinado es roca
    if (t === 2) c.lerp(COL.rocaClara, 0.7);
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = [];
  for (let i = 0; i < NL - 1; i++) for (let j = 0; j < NO; j++) {
    const a = i * NO + j, b = i * NO + (j + 1) % NO, d = (i + 1) * NO + j, e = (i + 1) * NO + (j + 1) % NO;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ¿los triángulos quedaron mirando hacia adentro? (depende del orden) → los damos vuelta
  const nn = g.attributes.normal, mid = (Math.floor(NL / 2) * NO + 5);
  if (nn.getX(mid) * pos[mid * 3] + nn.getY(mid) * pos[mid * 3 + 1] + nn.getZ(mid) * pos[mid * 3 + 2] < 0) {
    for (let q = 0; q < idx.length; q += 3) { const tmp = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, toon(0xffffff, { map: null, vertexColors: true }));
  return m;
}

/* ---------- el cielo: celeste pálido en el horizonte, azul fuerte arriba, con un sol frío ---------- */
export const DIR_SOL = new V3(0.55, 0.65, -0.52).normalize();
function crearCielo() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uArriba: { value: new V3(0, 1, 0) }, uSol: { value: DIR_SOL.clone() }, uT: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uArriba; uniform vec3 uSol; uniform float uT; varying vec3 vDir;
      void main(){
        float e = dot(vDir, uArriba);
        vec3 horizonte = vec3(0.90, 0.95, 1.0), medio = vec3(0.62, 0.78, 0.98), cenit = vec3(0.22, 0.38, 0.78);
        vec3 col = mix(horizonte, medio, smoothstep(0.0, 0.3, e));
        col = mix(col, cenit, smoothstep(0.3, 0.95, e));
        col = mix(col, vec3(0.86, 0.92, 1.0), smoothstep(0.0, -0.3, e));
        float s = max(dot(vDir, uSol), 0.0);
        col += vec3(1.0, 0.97, 0.9) * pow(s, 80.0) * 0.9 + vec3(0.9, 0.95, 1.0) * pow(s, 8.0) * 0.18;
        // AURORA: cintas verdes y celestes que ondulan arriba (es decorado)
        float banda = sin(vDir.x * 6.0 + uT * 0.12 + sin(vDir.z * 4.0 + uT * 0.07) * 1.5) * 0.5 + 0.5;
        float aur = smoothstep(0.55, 0.95, e) * pow(banda, 6.0) * (0.5 + 0.5 * sin(vDir.z * 9.0 - uT * 0.2));
        col = mix(col, vec3(0.45, 1.0, 0.78), aur * 0.35);
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
      }`,
  });
  const domo = new THREE.Mesh(new THREE.SphereGeometry(860, 40, 20), mat);
  domo.renderOrder = -10; domo.frustumCulled = false; domo.matrixAutoUpdate = false;
  domo.onBeforeRender = (r, s, cm) => {
    domo.matrixWorld.makeTranslation(cm.position.x, cm.position.y, cm.position.z);
    mat.uniforms.uArriba.value.copy(cm.position).normalize();
  };
  kep.domo = domo;
  return domo;
}

/* ---------- pinos de hielo, trozos de hielo y rocas (InstancedMesh: muchos por el precio de uno) ---------- */
function crearDecorado(grupo, rel) {
  const r = rng(2701);
  const u = new V3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), esc = new V3(), y = new V3(0, 1, 0), p = new V3();
  const lejosDelCamino = (uu, min) => K.proyectar(uu.clone().multiplyScalar(K.R)).dist > min;
  // pinos de hielo: 2 conos celestes
  const NP = 260, pinoA = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 3.6, 7), toon(0x9fd0ee, {}), NP);
  const pinoB = new THREE.InstancedMesh(new THREE.ConeGeometry(1.0, 2.6, 7), toon(0xd8f1ff, {}), NP);
  let np = 0;
  for (let tries = 0; np < NP && tries < 4000; tries++) {
    const m = K.CAMINO[Math.floor(r() * K.CAMINO.length)];
    if (m.s > K.S_DESFILADERO[0] && m.s < K.S_DESFILADERO[1]) continue;     // en el desfiladero no hay espacio
    const lado = (r() < 0.5 ? -1 : 1) * (m.ancho + 4 + r() * 30);
    u.copy(m.u).addScaledVector(m.lado, lado / K.R).normalize();
    if (!lejosDelCamino(u, m.ancho + 2.5)) continue;
    const rr = rel.radio(u), s = 0.7 + r() * 0.9;
    q.setFromUnitVectors(y, u);
    p.copy(u).multiplyScalar(rr + 1.6 * s);
    pinoA.setMatrixAt(np, m4.compose(p, q, esc.set(s, s, s)));
    p.copy(u).multiplyScalar(rr + 3.4 * s);
    pinoB.setMatrixAt(np, m4.compose(p, q, esc.set(s, s, s)));
    np++;
  }
  pinoA.count = pinoB.count = np;
  grupo.add(pinoA, pinoB);
  // trozos de hielo: cristales celestes medio enterrados (algunos grandes, lejos del camino)
  const NT = 220, trozos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
    toon(0xbfe9ff, { transparent: true, opacity: 0.88, emissive: 0x0d2a3a }), NT);
  let nt = 0;
  for (let tries = 0; nt < NT && tries < 4000; tries++) {
    const m = K.CAMINO[Math.floor(r() * K.CAMINO.length)];
    const lejos = r() < 0.3;
    const lado = (r() < 0.5 ? -1 : 1) * (m.ancho + 2 + r() * (lejos ? 70 : 14));
    u.copy(m.u).addScaledVector(m.lado, lado / K.R).normalize();
    if (!lejosDelCamino(u, m.ancho + 1.5)) continue;
    const s = lejos ? 2 + r() * 4 : 0.5 + r() * 1.2;
    q.setFromUnitVectors(y, u).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)));
    p.copy(u).multiplyScalar(rel.radio(u) + s * 0.3);
    trozos.setMatrixAt(nt++, m4.compose(p, q, esc.set(s, s * (1.2 + r()), s)));
  }
  trozos.count = nt;
  grupo.add(trozos);
  // la explanada de la cima: un mojón de piedra con una bandera de los gatos (donde te espera MeiMei)
  const cima = K.puntoCamino(16, -6, 0), uc = cima.clone().normalize();
  const mojon = outline(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), toon(0x7d8aa6, {})), 0.04);
  mojon.position.copy(uc).multiplyScalar(relieveKepler().radio(uc) + 0.6); mojon.scale.set(1.2, 0.8, 1);
  mojon.quaternion.setFromUnitVectors(y, uc);
  grupo.add(mojon);
}

/* =========================================================
   LAS LUNAS: se dibujan aparte (se mueven) y sus sombras
   ========================================================= */
function crearLunas(grupo, planetas) {
  kep.lunas = [];
  K.LUNAS.forEach((L, i) => {
    const P = planetas[i + 1];
    const g = new THREE.Group();
    const m = new THREE.Mesh(planetGeo(L.R, L.color, 40 + i * 13, 0.35), toon(0xffffff, { map: null, vertexColors: true }));
    outline(m, 0.015);
    g.add(m);
    g.traverse(o => { if (o.material) o.material.fog = false; });     // se ven nítidas en el cielo aunque haya niebla
    grupo.add(g);
    // sombra de la luna sobre la nieve (mini eclipse): un disco oscuro donde el sol no llega
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(L.R * 1.05, 40),
      new THREE.MeshBasicMaterial({ color: 0x1b2a55, transparent: true, opacity: 0.22, depthWrite: false }));
    sombra.renderOrder = 1;
    grupo.add(sombra);
    K.posLuna(L, kep.t, P.c);
    g.position.copy(P.c);
    kep.lunas.push({ L, P, g, prev: P.c.clone(), sombra });
  });
  // la Luna 2 (la de la pelea) tiene PILARES de hielo: chocan (esferas que se mueven con ella) y MeiMei se estrella con ellos
  const L2 = kep.lunas[1], r = rng(91);
  L2.pilares = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + r() * 0.4, b = 0.35 + r() * 0.9;
    const dir = new V3(Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b));
    // repartidos alrededor del "polo" de la luna que mira hacia afuera de Kepler al llegar (se calcula en el mundo de la luna)
    const local = dir.multiplyScalar(L2.L.R + 0.6);
    const solido = { c: L2.P.c.clone().add(local), R: 1.6, planeta: L2.P, pilar: true, local };
    mundo.solidos.push(solido);
    const pg = new THREE.Group();
    const cristal = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 4.4, 6), toon(0xbfe9ff, { emissive: 0x10304a })), 0.04);
    cristal.position.y = 1.4;
    const punta = outline(new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 6), toon(0xe6f8ff, {})), 0.04);
    punta.position.y = 4.3;
    pg.add(cristal, punta);
    pg.position.copy(local); pg.quaternion.setFromUnitVectors(new V3(0, 1, 0), local.clone().normalize());
    L2.g.add(pg);
    solido.malla = pg;
    L2.pilares.push(solido);
  }
}

/** Sombra de cada luna: el punto del suelo que queda detrás de la luna mirando desde el sol. */
const _sp = new V3(), _sn = new V3();
function ponerSombras() {
  const rel = relieveKepler();
  for (const l of kep.lunas) {
    // rayo desde la luna en contra del sol: c − DIR_SOL·t. ¿Dónde toca el suelo (≈ R + h)?
    const c = l.P.c, b = c.dot(DIR_SOL), rr = K.R + 30, disc = b * b - (c.lengthSq() - rr * rr);
    if (disc < 0 || b < 0) { l.sombra.visible = false; continue; }
    const t = b - Math.sqrt(disc);
    _sp.copy(c).addScaledVector(DIR_SOL, -t).normalize();
    const h = rel.radio(_sp);
    l.sombra.visible = true;
    l.sombra.position.copy(_sp).multiplyScalar(h + 0.4);
    rel.normal(_sp, _sn);
    l.sombra.quaternion.setFromUnitVectors(new V3(0, 0, 1), _sn);
  }
}

/* =========================================================
   CADA PASO: las lunas se mueven y te llevan (MARCO DE LA LUNA)
   ---------------------------------------------------------
   Dentro de la esfera de Hill de una luna, tú y la luna caen
   juntos alrededor de Kepler. Por eso ahí la física se calcula
   RESPECTO A LA LUNA: cuando ella avanza Δ, tú avanzas Δ, y tu
   velocidad se mide respecto a ella.
     al entrar:  v_rel = v − v_luna        al salir:  v = v_rel + v_luna
   ========================================================= */
const _d = new V3(), _vl = new V3();
export function antesDelPaso(dt) {
  calcularRitmo(dt);
  kep.t += dt * kep.ritmo;
  for (const l of kep.lunas) {
    l.prev.copy(l.P.c);
    K.posLuna(l.L, kep.t, l.P.c);
    _d.copy(l.P.c).sub(l.prev);
    for (const s of mundo.solidos) if (s.planeta === l.P) s.c.add(_d);
    for (const m of mundo.muros) if (m.planeta === l.P) m.c.add(_d);
    if (player.marco === l.P) { player.pos.add(_d); player.seguro.add(_d); if (juego.modo === 'juego') moverCamara(_d); }
    for (const e of juego.enemigos) if (e.marco === l.P) e.pos.add(_d);
  }
  // ¿entraste o saliste de la esfera de Hill de alguna luna?
  const saltoGrande = player.pos.distanceTo(kep.ultimaPos) > 25;         // reapareciste: no es un cruce de verdad
  revisarMarco(player, saltoGrande);
  for (const e of juego.enemigos) revisarMarco(e, false);
  // LA ATRAPADA: al entrar volando, la luna te "frena" en 0,6 s (ayuda del juego, no es física:
  // sin ella llegarías a ~25 m/s respecto a la luna y rebotarías)
  if (kep.atrapa > 0 && player.marco) {
    kep.atrapa -= dt;
    player.vel.multiplyScalar(Math.exp(-dt / 0.22));
    _d.copy(player.marco.c).sub(player.pos).normalize();
    player.vel.addScaledVector(_d, 6 * dt);            // y te acerca un poco a la luna
  }
  topeSalto();
  kep.ultimaPos.copy(player.pos);
}

/* =========================================================
   EL RITMO DEL RELOJ (AYUDA DEL JUEGO, no es física)
   ---------------------------------------------------------
   Problema: el resorte solo llega a la Luna 2 unos 20 s de cada
   T = 55,8 s. Si llegabas en el momento malo, esperabas parad@ y
   la persecución se moría.
   Arreglo: mientras corres, el juego calcula cuándo vas a llegar
     t_llega = (distancia que falta) / (tu rapidez)
   y adelanta o atrasa un poco el reloj de las órbitas para que la
   ventana esté abierta justo cuando llegas:
     ritmo = 1 + desfase / t_llega     (entre 0,4 y 2,2)
   Las órbitas siguen siendo las mismas (mismo camino, mismo T²/a³);
   solo cambia qué tan rápido corre el reloj del cielo.
   IMPORTANTE: mientras alguien vuela hacia la luna, o estás en la luna
   peleando, el ritmo es 1 exacto: ahí manda la física de verdad.
   ========================================================= */
function calcularRitmo(dt) {
  const R = kep.resorte, p = player;
  let obj = 1, directo = false;
  const listo = R && R.ventanas && R.calc >= R.ventanas.length;
  const vuelaAlguien = p.state === 'vuelo' || mei.modo === 'vuela' || kep.atrapa > 0;
  if (vuelaAlguien || juego.modo !== 'juego') { kep.ritmo = 1; kep.ritmoObj = 1; return; }
  if (kep.enLuna) {
    // en la luna: solo se apura mientras esperas parad@ en el resorte de salida
    const S = mei.salida;
    if (S && S.estado === 'espera' && esperaSalida(kep.t) > 0.5) obj = 3;
    else directo = true;
  } else if (listo && R.estado === 'espera') {
    obj = proximaVentana() > 0.5 ? 3 : 1;                // parad@ en el plato y la luna no llega: el cielo se apura
    if (obj === 1) directo = true;
  } else if (listo && R.estado === 'libre' && kep.sP < K.S_RESORTE + 5 && p.planet === mundo.planetas[0]) {
    // corriendo: ¿cuándo llegas?
    kep.vSuave += (Math.max(6, p.vel.length()) - kep.vSuave) * damp(1.5, dt);
    const falta = Math.max(0, K.S_RESORTE - kep.sP);
    if (falta < 600) {
      kep.tRitmo -= dt;
      if (kep.tRitmo <= 0) { kep.tRitmo = 0.25; kep.ritmoObj = ritmoPara(falta / Math.max(8, kep.vSuave)); }
      obj = kep.ritmoObj;
    }
  } else directo = true;
  if (directo) { kep.ritmo = 1; return; }
  kep.ritmo += (obj - kep.ritmo) * damp(3, dt);
}
/** El ritmo que hace que la ventana esté abierta cuando llegues (t_llega en segundos reales). */
function ritmoPara(tLlega) {
  const R = kep.resorte, L = K.LUNAS[1], n = R.ventanas.length;
  const tl = Math.max(tLlega, 3);
  const llega = kep.t + tl + 1;                          // +1 s: subirte al plato y comprimirlo
  // ¿cuál es el instante de la órbita más cercano a "llega" en que hay un tiro corto (≤ 10 s de vuelo)
  // y además el anterior también sirve (así MeiMei, que va 20 m adelante, también alcanza)?
  const bueno = i => { const a = R.ventanas[((i % n) + n) % n], b = R.ventanas[(((i - 4) % n) + n) % n]; return a != null && a <= 10 && b != null; };
  const i0 = Math.round(llega / 0.5);
  let mejor = null;
  for (let k = 0; k <= n; k++) {
    for (const sg of k ? [1, -1] : [1]) {
      const i = i0 + sg * k;
      if (!bueno(i)) continue;
      const desfase = i * 0.5 - llega;                   // + = hay que adelantar el reloj
      if (desfase < -0.6 * tl || desfase > 1.2 * tl) continue;
      if (!mejor || Math.abs(desfase) < Math.abs(mejor)) mejor = desfase;
    }
    if (mejor !== null) break;
  }
  if (mejor === null) return 2.2;                        // falta mucho: apúrate hasta encontrar una
  return clamp(1 + mejor / tl, 0.4, 2.2);
}

/* =========================================================
   TOPE DEL SALTO EN LA LUNA
   ---------------------------------------------------------
   La Luna 2 es chica: v_esc = √(2Gm/R) = √(2·7350/35) ≈ 20,5 m/s.
   El súper salto sale a 20 m/s: ¡casi escapas! Y con 14 m/s ya
   pasabas el borde de la esfera de Hill (57,8 m), donde manda
   Kepler y te tiraba al planeta.
   Arreglo con ENERGÍA: para que lo más alto del salto quede en
   r_tope = r_Hill − 8 m, la energía de subida no puede pasar de
     ½·v_r² − Gm/r  ≤  −Gm/r_tope   →   v_r ≤ √(2Gm(1/r − 1/r_tope))
   En el suelo da ≈ 11 m/s (unos 15 m de salto). Si vas más rápido
   hacia arriba, el juego te deja en ese tope (ayuda del juego).
   El resorte de salida (estado 'vuelo') no se topa: ese sí escapa.
   ========================================================= */
const _up = new V3();
function topeSalto() {
  const p = player, P = p.marco;
  if (!P || p.state === 'vuelo') return;
  const l = kep.lunas.find(x => x.P === P); if (!l || l.L !== K.LUNAS[1]) return;   // la pelea es en la Luna 2
  _up.copy(p.pos).sub(P.c);
  const r = _up.length(); if (r < 1e-6) return;
  _up.divideScalar(r);
  const rTope = l.L.hill - K.PELEA.margenTope;
  const vr = p.vel.dot(_up);
  if (vr <= 0) return;
  if (r >= rTope) { p.vel.addScaledVector(_up, -vr); return; }      // ya en el techo: no sigues subiendo
  const vMax = K.PELEA.vTope(r);
  if (vr > vMax) p.vel.addScaledVector(_up, vMax - vr);
}
function revisarMarco(b, teletransporte) {
  let dentro = null;
  for (const l of kep.lunas) if (b.pos.distanceTo(l.P.c) < l.L.hill) dentro = l;
  const P = dentro ? dentro.P : null;
  if (P === (b.marco || null)) return;
  if (!teletransporte) {
    if (b.marco) { const lv = kep.lunas.find(l => l.P === b.marco); b.vel.add(K.velLuna(lv.L, kep.t, _vl)); }   // sales: vuelves a medir respecto a Kepler
    if (dentro) { b.vel.sub(K.velLuna(dentro.L, kep.t, _vl)); if (b === player && player.state === 'vuelo') kep.atrapa = 0.6; }
  }
  b.marco = P;
  if (b === player) { kep.enLuna = P === mundo.planetas[P_LUNA2]; if (dentro) emitir('marcoLuna', dentro.L.nombre); }
}

/* =========================================================
   CADA PASO (def.alPaso): carrera, checkpoints, resorte, peligros
   ========================================================= */
export function alPaso(dt) {
  const p = player;
  if (!kep.enLuna && p.planet === mundo.planetas[0]) {
    const pr = K.proyectar(p.pos, kep.iP);
    kep.iP = pr.i; kep.sP = pr.s; kep.lateral = pr.lateral;
    // checkpoints: el último tramo que pasaste
    for (let i = kep.tramo + 1; i < K.TRAMOS.length; i++) {
      if (kep.sP > K.TRAMOS[i].s && p.grounded) { kep.tramo = i; juego.checkpoint = puntoDeTramo(i); guardarKepler({ tramo: i }); emitir('repisa'); }
    }
    revisarPerdida(dt, pr);
  }
  pasoResorte(dt);
  pasoCarambanos(dt);
  pasoMeiMei(dt);
}
export function puntoDeTramo(i) {
  const s = K.TRAMOS[i].s, m = K.muestraEn(s);
  return { planeta: 0, dir: m.u.clone(), mirar: m.t.clone() };
}

/* ---------- ¿se te escapó MeiMei? ---------- */
function revisarPerdida(dt, pr) {
  if (mei.modo !== 'carrera' || kep.perdiendo) return;
  const atras = mei.s - kep.sP;
  const fuera = pr.dist > K.anchoEn(kep.sP) + 30;
  kep.lejosT = (atras > 95 || fuera) ? kep.lejosT + dt : 0;
  if (kep.lejosT > (fuera ? 2 : 0.6)) perderla();
}
function perderla() {
  kep.perdiendo = true;
  toast('¡Se te escapó MeiMei!<small>Vuelves al último tramo</small>', 2400);
  emitir('seEscapo');
  $('negro').classList.add('ver');
  setTimeout(() => {
    respawnPlayer(); camaraAlInicio();
    reiniciarTramo();
    requestAnimationFrame(() => $('negro').classList.remove('ver'));
    kep.perdiendo = false; kep.lejosT = 0;
  }, 650);
}
/** Vuelves al checkpoint: MeiMei te espera un poco más adelante y los carámbanos se vuelven a armar. */
function reiniciarTramo() {
  kep.iP = -1;
  const s0 = K.TRAMOS[kep.tramo].s;
  carreraDesde(s0 + 22);
  for (const c of kep.carambanos) if (c.s > s0) armarCarambano(c);
  if (kep.resorte) { kep.resorte.estado = 'libre'; kep.resorte.comp = 0; }
}
escuchar('reaparecer', () => {
  if (juego.nivel && juego.nivel.id === 'kepler' && !kep.enLuna && !kep.pelea) setTimeout(() => reiniciarTramo(), 0);
});

/* =========================================================
   EL RESORTE (Hooke + apuntar adelantado a la Luna 2)
   ========================================================= */
function crearResorte(grupo, rel) {
  const base = K.baseResorte(rel);
  const g = new THREE.Group();
  g.position.copy(base.pos);
  g.quaternion.setFromUnitVectors(new V3(0, 1, 0), base.arriba);
  const metal = toon(0x4a5a7a), cobre = toon(0x7fe0ff, { emissive: 0x0d4a66 });
  const pie = outline(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.6, 24), metal), 0.04);
  pie.position.y = 0.3;
  const resortes = new THREE.Group(); resortes.position.y = 0.6;
  for (let i = 0; i < 5; i++) {
    const aro = outline(new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 8, 24), cobre), 0.06);
    aro.rotation.x = Math.PI / 2; aro.position.y = 0.25 + i * 0.32;
    resortes.add(aro);
  }
  const plato = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.3, 24), toon(0xdff6ff, { emissive: 0x1a4a5a })), 0.04);
  plato.position.y = 2.2;
  // columna de luz: se ve desde el lago y dice "ven aquí"
  const luz = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  luz.position.y = 30;
  g.add(pie, resortes, plato, luz);
  grupo.add(g);
  kep.resorte = { base, g, plato, resortes, luz, comp: 0, estado: 'libre', sol: null, tEspera: 0, ventanas: null, calc: 0 };
  calcularVentanas();
}
/**
 * VENTANAS DE LANZAMIENTO: en qué momentos de la órbita de la Luna 2 hay un tiro que llega.
 * Se calcula una vuelta entera (T = 55,8 s), de a 0,5 s, repartido en varios cuadros para no trabar el juego.
 */
function calcularVentanas() {
  const R = kep.resorte, L = K.LUNAS[1], n = Math.ceil(L.T / 0.5);
  R.ventanas = new Array(n).fill(null); R.calc = 0;
  const lote = () => {
    if (!kep.resorte || kep.resorte !== R) return;
    // uno por vez (cada uno simula ~300 tiros: unos 12 ms) para no trabar el juego
    const sol = K.tiroALaLuna(R.base, R.calc * 0.5, 1 / 30);
    R.ventanas[R.calc] = sol ? sol.tVuelo : null; R.calc++;   // null = no llega; número = s de vuelo
    if (R.calc < n) setTimeout(lote, 16);
  };
  setTimeout(lote, 200);
}
/** Segundos hasta la próxima ventana (0 = abierta ahora). */
export function proximaVentana(t = kep.t) {
  const R = kep.resorte, L = K.LUNAS[1];
  if (!R || !R.ventanas || R.calc < R.ventanas.length) return 0;
  const n = R.ventanas.length;
  for (let k = 0; k < n; k++) {
    const i = Math.floor(((t + k * 0.5) % L.T) / 0.5) % n;
    if (R.ventanas[i] != null) return k * 0.5;
  }
  return 99;
}
const _rp = new V3();
function pasoResorte(dt) {
  const R = kep.resorte, p = player;
  if (!R) return;
  const arriba = R.base.arriba;
  _rp.copy(R.base.pos).addScaledVector(arriba, 2.2 - R.comp * 1.5);
  // el plato te "atrapa" si pasas a menos de 4 m (aunque vayas rápido)
  const cerca = p.pos.distanceTo(_rp) < (R.estado === 'libre' ? 4 : 4.5) && p.state === 'normal' && !kep.enLuna;
  if (R.estado === 'libre' && cerca && p.grounded) { R.estado = 'espera'; R.tEspera = 0; emitir('resortePisa'); }
  if (R.estado === 'espera') {
    if (!cerca && p.state === 'normal') { R.estado = 'libre'; avisoResorte(null); return; }
    // te quedas parad@ en el plato
    p.pos.copy(_rp).addScaledVector(arriba, p.r + 0.15); p.vel.set(0, 0, 0);
    R.tEspera += dt;
    const falta = proximaVentana();
    if (falta === 0 && R.tEspera > 0.3 && kep.t > (R.intento || 0)) {
      R.intento = kep.t + 0.25;                       // calcular un tiro cuesta: a lo más 4 veces por segundo
      R.sol = K.tiroALaLuna(R.base, kep.t + 0.45, 1 / 60);
      if (R.sol) { R.estado = 'comprime'; R.t = 0; emitir('resorteCarga'); avisoResorte(null); }
    } else avisoResorte(falta);
    if (input.jumpQ > 0) { R.estado = 'libre'; avisoResorte(null); }        // te bajas saltando
  }
  if (R.estado === 'comprime') {
    // se comprime x = 1,5 m en 0,45 s (en el dibujo: el plato baja)
    R.t += dt; R.comp = Math.min(1, R.t / 0.45);
    p.pos.copy(_rp).addScaledVector(arriba, p.r + 0.15); p.vel.set(0, 0, 0);
    if (R.t >= 0.45) {
      // ¡SUELTA! la energía del resorte ½·k·x² se vuelve ½·m·v²  →  v = x·√(k/m)
      p.state = 'vuelo'; p.grounded = false; p.airDash = false;
      p.pos.copy(R.base.pos).addScaledVector(arriba, 1.2);
      p.vel.copy(R.sol.vel);
      R.estado = 'suelta'; R.t = 0;
      emitir('resorteSuelta', { v: R.sol.v, k: K.kResorte(R.sol.v) });
      emitir('despegue', { v: R.sol.v, vesc: 0 });
      cam.shake = 0.5;
      guardarKepler({ tramo: K.TRAMOS.length - 1 });
    }
  }
  if (R.estado === 'suelta') { R.t += dt; R.comp = Math.max(0, 1 - R.t * 3); if (R.t > 1.2) R.estado = 'libre'; }
  if (R.estado !== 'espera' && R.aviso) avisoResorte(null);      // ya no estás esperando: se va el aviso
}
function avisoResorte(falta) {
  const el = $('avisoK');
  if (kep.resorte) kep.resorte.aviso = falta !== null && falta !== undefined;
  if (falta === null || falta === undefined) { el.classList.add('oculto'); return; }
  el.classList.remove('oculto');
  el.innerHTML = falta < 0.6 ? 'Apuntando a la Luna 2...' : `La Luna 2 llega en <b>${Math.ceil(falta)} s</b><small>T = ${K.LUNAS[1].T.toFixed(1).replace('.', ',')} s por vuelta · salta para bajarte</small>`;
}

/* =========================================================
   CARÁMBANOS del desfiladero: caen cuando pasas
     caída libre:  h = ½·g·t²   →   t = √(2h/g)
   La sombra roja aparece justo cuando empieza a caer: tienes t segundos.
   ========================================================= */
const CARAMBANOS = [[600, 3], [632, -3.5], [668, 1], [705, -2], [742, 3.5], [780, -1], [820, 2.5], [850, -3]];
function crearCarambanos(grupo) {
  kep.carambanos = [];
  const mat = toon(0xd6f3ff, { emissive: 0x123a50 });
  for (const [s, lado] of CARAMBANOS) {
    const g = new THREE.Group();
    const cono = outline(new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 6), mat), 0.05);
    cono.rotation.x = Math.PI;                 // punta hacia abajo
    g.add(cono);
    const marca = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.5, 24), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    marca.renderOrder = 3;
    grupo.add(g, marca);
    const c = { s, lado, g, marca, alto: 19, suelo: K.puntoCamino(s, lado, 0.05), arriba: null };
    c.arriba = c.suelo.clone().normalize();
    marca.position.copy(c.suelo); marca.quaternion.setFromUnitVectors(new V3(0, 0, 1), c.arriba);
    kep.carambanos.push(c);
    armarCarambano(c);
  }
}
function armarCarambano(c) {
  c.estado = 'colgado'; c.t = 0; c.y = c.alto;
  c.g.visible = true; c.marca.material.opacity = 0;
  c.g.position.copy(c.suelo).addScaledVector(c.arriba, c.alto);
  c.g.quaternion.setFromUnitVectors(new V3(0, 1, 0), c.arriba);
}
function pasoCarambanos(dt) {
  for (const c of kep.carambanos) {
    if (c.estado === 'colgado' && kep.sP > c.s - 26 && kep.sP < c.s && !kep.enLuna) { c.estado = 'cae'; c.t = 0; c.v = 0; emitir('estalactitaCruje'); }
    if (c.estado === 'cae') {
      // caída libre con la gravedad del lugar (g = 12·(300/r)²)
      const r = c.suelo.length() + c.y, g = K.G0 * (K.R / r) ** 2;
      c.v += g * dt; c.y -= c.v * dt; c.t += dt;
      c.g.position.copy(c.suelo).addScaledVector(c.arriba, Math.max(0, c.y));
      c.marca.material.opacity = 0.35 + 0.35 * Math.sin(c.t * 20);
      if (c.y <= 0) {
        c.estado = 'roto'; c.g.visible = false; c.marca.material.opacity = 0;
        emitir('estalactitaRompe');
        if (player.pos.distanceTo(c.suelo) < 1.9) hurtPlayer(1, _sp.copy(player.pos).sub(c.suelo));
      }
    }
  }
}

/* =========================================================
   AVALANCHAS de fondo: nubes de nieve que bajan por cerros lejanos
   (siguen la pendiente: en cada paso van hacia donde el suelo baja más)
   ========================================================= */
let texNube = null;
function nube() {
  if (!texNube) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(0.6, 'rgba(240,246,255,.5)'); grd.addColorStop(1, 'rgba(240,246,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    texNube = new THREE.CanvasTexture(cv);
  }
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texNube, transparent: true, depthWrite: false }));
}
function crearAvalanchas(grupo, rel) {
  kep.avalanchas = [];
  const r = rng(77), u = new V3(), n = new V3();
  for (let tries = 0; kep.avalanchas.length < 6 && tries < 600; tries++) {
    const m = K.CAMINO[Math.floor(r() * K.CAMINO.length)];
    u.copy(m.u).addScaledVector(m.lado, (r() < 0.5 ? -1 : 1) * (70 + r() * 90) / K.R).normalize();
    if (rel.h(u) < 40 || K.proyectar(u.clone().multiplyScalar(K.R)).dist < 60) continue;
    // la línea de bajada: 40 pasos de 3 m cuesta abajo
    const linea = [u.clone()];
    const w = u.clone();
    for (let k = 0; k < 40; k++) {
      rel.normal(w, n);
      const baja = tangent(new V3(), n, w);                   // la parte "de lado" de la normal apunta cuesta abajo
      if (baja.lengthSq() < 1e-6) break;
      w.addScaledVector(baja.normalize(), 3 / K.R).normalize();
      linea.push(w.clone());
    }
    const sprites = [];
    for (let k = 0; k < 14; k++) { const s = nube(); s.visible = false; grupo.add(s); sprites.push(s); }
    kep.avalanchas.push({ linea, sprites, t: -3 - r() * 12, dur: 7 });
  }
}
function animarAvalanchas(dt) {
  const rel = relieveKepler();
  for (const a of kep.avalanchas) {
    a.t += dt;
    if (a.t > a.dur + 8) a.t = -Math.random() * 10;
    const activa = a.t > 0 && a.t < a.dur;
    if (a.t > 0 && a.t - dt <= 0) {
      const d = camera.position.distanceTo(a.linea[0].clone().multiplyScalar(K.R));
      if (d < 260) emitir('avalancha', d);
    }
    a.sprites.forEach((s, k) => {
      s.visible = activa;
      if (!activa) return;
      const kk = clamp(a.t / a.dur * 1.3 - k * 0.025, 0, 1), i = Math.floor(kk * (a.linea.length - 1));
      const u = a.linea[i];
      s.position.copy(u).multiplyScalar(rel.radio(u) + 2 + (k % 3) * 1.5);
      s.scale.setScalar(6 + k * 0.6 + kk * 8);
      s.material.opacity = Math.sin(clamp(a.t / a.dur, 0, 1) * Math.PI) * 0.75;
    });
  }
}

/* ---------- copos de nieve: caen hacia el centro del planeta, alrededor de la cámara ---------- */
const NCOPOS = 1400, CAJA = 46;
function crearNieve(grupo) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(NCOPOS * 3);
  for (let i = 0; i < NCOPOS * 3; i++) pos[i] = (Math.random() - 0.5) * CAJA;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d'), grd = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grd; c.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.22, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9 }));
  pts.frustumCulled = false;
  grupo.add(pts);
  kep.nieve = { pts, base: new V3(), fase: Float32Array.from({ length: NCOPOS }, () => Math.random() * 6.28) };
}
const _ab = new V3(), _w = new V3();
function animarNieve(dt, t) {
  const N = kep.nieve; if (!N) return;
  const arr = N.pts.geometry.attributes.position.array;
  _ab.copy(camera.position).normalize();                       // "arriba" donde está la cámara
  N.pts.position.copy(camera.position);
  for (let i = 0; i < NCOPOS; i++) {
    const k = i * 3, f = N.fase[i];
    // caen a 2,4 m/s y se mecen de lado
    arr[k] += (-_ab.x * 2.4 + Math.sin(t * 0.9 + f) * 0.4) * dt;
    arr[k + 1] += (-_ab.y * 2.4) * dt;
    arr[k + 2] += (-_ab.z * 2.4 + Math.cos(t * 0.7 + f) * 0.4) * dt;
    // si salen de la caja alrededor de la cámara, vuelven por el otro lado
    for (let a = 0; a < 3; a++) { if (arr[k + a] > CAJA / 2) arr[k + a] -= CAJA; else if (arr[k + a] < -CAJA / 2) arr[k + a] += CAJA; }
  }
  N.pts.geometry.attributes.position.needsUpdate = true;
}

/* =========================================================
   CADA CUADRO (def.alCuadro)
   ========================================================= */
export function alCuadro(dt, t) {
  if (juego.modo === 'cine' && dt > 0) antesDelPasoCine(dt);
  if (kep.domo) kep.domo.material.uniforms.uT.value = t;
  // (la Luna 2 no gira: sus pilares chocan y tienen que quedar donde se dibujan)
  for (const l of kep.lunas) { l.g.position.copy(l.P.c); if (!l.pilares) l.g.rotation.y += dt * 0.05; }
  // los pilares de la Luna 2 son hijos de su grupo (se mueven solos); las esferas que chocan se movieron en antesDelPaso
  ponerSombras();
  animarAvalanchas(dt);
  animarNieve(dt, t);
  animarResorte(dt, t);
  animarMeiMei(dt, t);
  flechaMeiMei();
}
/** En las cinemáticas las lunas siguen girando (el paso de física no corre). */
function antesDelPasoCine(dt) {
  kep.t += dt;
  for (const l of kep.lunas) {
    _d.copy(l.P.c); K.posLuna(l.L, kep.t, l.P.c); _d.subVectors(l.P.c, _d);
    for (const s of mundo.solidos) if (s.planeta === l.P) s.c.add(_d);
  }
}
function animarResorte(dt, t) {
  const R = kep.resorte; if (!R) return;
  R.plato.position.y = 2.2 - R.comp * 1.5;
  R.resortes.scale.y = 1 - R.comp * 0.75;
  R.luz.material.opacity = 0.12 + 0.06 * Math.sin(t * 3);
}

/* ---------- flechita en el borde de la pantalla cuando MeiMei no se ve ---------- */
const _pr = new V3();
function flechaMeiMei() {
  const el = $('flechaMei');
  if (!el) return;
  const ver = juego.modo === 'juego' && (mei.modo === 'carrera' || mei.modo === 'espera') && mei.g && mei.g.visible;
  if (!ver) { el.classList.add('oculto'); return; }
  _pr.copy(mei.pos).project(camera);
  const detras = _pr.z > 1;
  if (!detras && Math.abs(_pr.x) < 0.92 && Math.abs(_pr.y) < 0.9) { el.classList.add('oculto'); return; }
  let x = _pr.x, y = _pr.y;
  if (detras) { x = -x; y = -y; }
  const ang = Math.atan2(y, x), m = Math.max(Math.abs(Math.cos(ang)) / 0.9, Math.abs(Math.sin(ang)) / 0.82);
  const px = (Math.cos(ang) / m * 0.5 + 0.5) * innerWidth, py = (-Math.sin(ang) / m * 0.5 + 0.5) * innerHeight;
  el.classList.remove('oculto');
  el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%) rotate(${-ang}rad)`;
}

/* =========================================================
   GUARDADO
   ========================================================= */
export function guardarKepler(extra = {}) {
  const g = ajustes.guardado && ajustes.guardado.nivel === 'kepler' ? ajustes.guardado : { nivel: 'kepler' };
  ajustes.guardado = { ...g, ...extra };
  guardarAjustes();
}
/** Si ya ibas en Kepler, sigues ahí (en tu tramo o en la luna). Devuelve false si hay que ver la llegada. */
export function reanudarKepler() {
  const g = ajustes.guardado;
  if (!g || g.nivel !== 'kepler') return false;
  emitir('musica', 'keplerCarrera');
  kep.tramo = Math.min(K.TRAMOS.length - 1, g.tramo || 0);
  if (g.luna) {
    // ya llegaste a la Luna 2: sigues en la pelea (o con el fragmento, si ya ganaste)
    juego.checkpoint = puntoLuna();
    respawnPlayer(); camaraAlInicio();
    peleaDesde(g.ganado);
    return true;
  }
  juego.checkpoint = kep.tramo > 0 ? puntoDeTramo(kep.tramo) : null;
  respawnPlayer(); camaraAlInicio();
  carreraDesde(K.TRAMOS[kep.tramo].s + 22);
  return true;
}
/** Dónde reapareces en la Luna 2: en el lado que mira hacia afuera de Kepler. */
export function puntoLuna() {
  const dir = mei.arena.clone().normalize();
  const mirar = new V3(1, 0, 0); if (Math.abs(dir.x) > 0.9) mirar.set(0, 0, 1);
  return { planeta: P_LUNA2, dir, mirar };
}

/* =========================================================
   CINEMÁTICA DE LLEGADA (animación, no física)
   1. (0–1,8 s) quedaste de cabeza en la nieve: pataleas
   2. (1,8 s)   ¡sales! (aplastar y estirar)
   3. (2,4–5,2 s) arriba del mojón, MeiMei con el fragmento: patita
   4. (5,2–6,6 s) se tira cerro abajo y la cámara vuelve detrás tuyo
   ========================================================= */
const C = { activo: false, t: 0, fin: null };
const T_SALE = 1.8, T_MEI = 2.4, T_SE_VA = 5.2, T_FIN = 6.6;
export function iniciarLlegadaKepler(fin) {
  C.activo = true; C.t = 0; C.fin = fin; C.salio = false; C.seFue = false; C.musica = false;
  juego.modo = 'cine';
  mostrarHUD(false);
  limpiarEntrada();
  kep.tramo = 0; juego.checkpoint = null;
  guardarKepler({ tramo: 0, luna: false, ganado: false });
  respawnPlayer();
  player.state = 'dormido';
  // de cabeza: el cuerpo dado vuelta y medio enterrado
  C.ini = player.pos.clone();
  player.pos.addScaledVector(player.up, -0.75);
  mallaJugador.body.rotation.z = Math.PI;
  carreraDesde(16);
  mei.modo = 'cine';
  colocarMeiMei(K.puntoCamino(16, -6, 2.4), player.facing.clone().negate());
  poseMeiMei('mira');
  $('negro').classList.add('ver');
  requestAnimationFrame(() => $('negro').classList.remove('ver'));
  emitir('llegadaKepler');
}
const _m = new V3(), _u = new V3();
export function actualizarCineKepler(dt) {
  if (!C.activo) return false;
  C.t += dt;
  const t = C.t, p = player, up = p.up;
  // la canción de muxp tiene una mini intro de 2,5 s y después "explota": la partimos
  // 2,5 s antes de que MeiMei se tire cerro abajo, para que la explosión calce con la persecución
  if (!C.musica && t >= T_SE_VA - 2.5) { C.musica = true; emitir('musica', { nombre: 'keplerCarrera', desde: 0 }); }
  if (t < T_SALE) {
    // pataleo: el cuerpo tiembla de cabeza
    mallaJugador.body.rotation.z = Math.PI + Math.sin(t * 22) * 0.18;
    camera.position.copy(C.ini).addScaledVector(up, 2.2).addScaledVector(p.facing, 4.5).add(_u.crossVectors(up, p.facing).multiplyScalar(2));
    _m.copy(C.ini).addScaledVector(up, -0.2);
  } else {
    if (!C.salio) {
      C.salio = true; p.pos.copy(C.ini); mallaJugador.body.rotation.z = 0; p.land = 0.35;
      emitir('tocaSuelo', 10); emitir('salePuf', p.pos);
    }
    if (t < T_MEI) {
      camera.position.copy(C.ini).addScaledVector(up, 2.4).addScaledVector(p.facing, 5).add(_u.crossVectors(up, p.facing).multiplyScalar(2));
      _m.copy(C.ini).addScaledVector(up, 0.6);
    } else if (t < T_SE_VA) {
      // plano de MeiMei: la cámara junto a ti, mirando al mojón (se acerca despacio)
      const k = (t - T_MEI) / (T_SE_VA - T_MEI);
      if (k > 0.25 && !C.patita) { C.patita = true; poseMeiMei('patita'); emitir('meimeiRisa'); }
      camera.position.copy(C.ini).lerp(mei.pos, 0.55 + 0.2 * k).addScaledVector(up, 1.4);
      _m.copy(mei.pos).addScaledVector(up, 0.5);
    } else {
      if (!C.seFue) { C.seFue = true; poseMeiMei('corre'); mei.modo = 'carrera'; emitir('meimeiSeVa'); }
      const k = Math.min(1, (t - T_SE_VA) / (T_FIN - T_SE_VA)), e = k * k * (3 - 2 * k);
      const detras = _u.copy(C.ini).addScaledVector(p.facing, -6).addScaledVector(up, 4);
      camera.position.lerp(detras, e * 0.3 + 0.05);
      _m.lerp(mei.pos, 0.1);
    }
  }
  camera.up.copy(up);
  camera.lookAt(_m);
  if (t >= T_FIN) terminarCine();
  return true;
}
function terminarCine() {
  C.activo = false; C.patita = false;
  player.pos.copy(C.ini); player.state = 'normal'; player.vel.set(0, 0, 0);
  mallaJugador.body.rotation.z = 0;
  mei.modo = 'carrera'; poseMeiMei('corre');
  camaraAlInicio();
  const fin = C.fin; C.fin = null;
  if (fin) fin();
}
export function saltarCineKepler() {
  if (!C.activo) return false;
  if (!C.musica) { C.musica = true; emitir('musica', 'keplerCarrera'); }     // sin cinemática: parte justo en la explosión (2,5 s)
  carreraDesde(26);
  terminarCine();
  return true;
}
