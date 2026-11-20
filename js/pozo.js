/* =========================================================
   pozo.js · El LABERINTO de la cueva de Ícaro (dibujo y juego)
   ---------------------------------------------------------
   El plano lo arma js/pozoGenerador.js (con semilla). Aquí:
     · lo que CHOCA: cajas (muros de fisica.js) para paredes,
       suelos y techos
     · lo que SE VE: esas mismas cajas convertidas en roca con
       capas (js/roca.js)
     · los PELIGROS:
         - ESTALACTITAS que caen cuando pasas debajo. Tiemblan,
           aparece una sombra roja y caen en CAÍDA LIBRE:
               y(t) = y₀ − ½·g·t²   →   tardan t = √(2h/g)
           Desde 5 m con g = 20: √(10/20) ≈ 0,7 s. Sal de la sombra.
         - SUELOS FRÁGILES: baldosas agrietadas que tiemblan al
           pisarlas y 0,9 s después se caen (al piso de abajo).
     · CORAZONES en un callejón sin salida de cada piso (premio
       por explorar)
     · la LUZ de cada chimenea (te dice por dónde subir)
     · checkpoint en cada piso, rescate si caes muy abajo, y la
       SALIDA: un súper salto por la última chimenea → la luz.
   ========================================================= */
import { THREE, V3, rng } from './util.js';
import { scene, toon, mezclarAmbiente } from './escena.js';
import { agregarMuro, mundo } from './fisica.js';
import { juego, ajustes, guardarAjustes, emitir } from './estado.js';
import { hurtPlayer } from './jugador.js';
import { cam } from './camara.js';
import { crearRoca, ruido } from './roca.js';
import { POZO, R_SET, G, centroCelda, puertaClave } from './pozoGenerador.js';
export { POZO, generarPozo, semillaDeLaUrl, alcance, alturaMax } from './pozoGenerador.js';

/* =========================================================
   MARCO LOCAL del laberinto
   A 66 m del centro de la cueva la esfera de R 2 000 m se curva
   solo x²/(2R) = 24²/4000 ≈ 14 cm dentro del laberinto, así que
   lo tratamos como plano: x a la derecha, y arriba, z atrás.
   ========================================================= */
const ARRIBA = new V3(POZO.x, R_SET, POZO.z).normalize();
const DER = new V3(1, 0, 0).addScaledVector(ARRIBA, -ARRIBA.x).normalize();
const ATRAS = new V3().crossVectors(DER, ARRIBA).normalize();
const ORIGEN = new V3(0, -R_SET, 0).addScaledVector(ARRIBA, R_SET);
export const marco = { ARRIBA, DER, ATRAS, ORIGEN };
/** Punto del mundo a partir de (x, y, z) del laberinto. */
export const punto = (x, y, z, v = new V3()) => v.copy(ORIGEN).addScaledVector(DER, x).addScaledVector(ARRIBA, y).addScaledVector(ATRAS, z);
const _l = new V3();
/** Al revés: coordenadas del laberinto de un punto del mundo. */
export function local(p) { _l.copy(p).sub(ORIGEN); return { x: _l.dot(DER), y: _l.dot(ARRIBA), z: _l.dot(ATRAS) }; }

/** Caja alineada con la grilla: de x0 a x1, de y0 a y1, de z0 a z1. */
function caja(x0, x1, y0, y1, z0, z1) {
  return { c: punto((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ex: DER.clone(), ey: ARRIBA.clone(), ez: ATRAS.clone(),
    medio: new V3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2) };
}
const ponerMuro = k => agregarMuro(k.c, k.ex, k.ey, k.ez, k.medio);

/* ---------- colores de roca: capas por altura ---------- */
const CAPAS = [0x8a5232, 0xc8925e, 0x5e3322, 0xa86a3c, 0xdcae78, 0x6e3e26, 0xb47a46, 0x4a2a1c, 0x9c6238, 0xe0b884];
const _c = new THREE.Color(), _o = new THREE.Color(0x1a0e0a);
function colorRoca(y, hundido, n) {
  const capa = Math.floor((y + ruido(y * 0.2, 3, 1) * 1.2) / 1.1);
  _c.setHex(CAPAS[((capa % CAPAS.length) + CAPAS.length) % CAPAS.length]);
  _c.multiplyScalar(0.85 + n * 0.3);
  return _c.lerp(_o, hundido * 0.45);                    // las grietas, más oscuras
}
const alturaLocal = p => local(p).y;

/* =========================================================
   CONSTRUIR (desde def.decorado, después de definirMundo)
   ========================================================= */
const P_ = POZO, MEDIA = P_.celda / 2, TOPE = P_.pisos * P_.H;
const ancho = P_.cols * P_.celda, fondo = P_.filas * P_.celda;
const X0 = -ancho / 2, X1 = ancho / 2, Z0 = -fondo / 2, Z1 = fondo / 2;
const GROSOR = 1.2, BORDE = 2.5;

export const pz = { datos: null, fragiles: [], estalactitas: [], corazones: [], haces: [], mejor: 0, saliendo: false, salida: null };

export function construirPozo(grupo, datos) {
  pz.datos = datos; pz.fragiles = []; pz.estalactitas = []; pz.corazones = []; pz.haces = [];
  pz.mejor = 0; pz.saliendo = false;
  const fijas = [];                                     // cajas que chocan y se dibujan juntas
  const fija = k => { ponerMuro(k); fijas.push(k); };
  const { H, losa, hoyo, puerta } = P_;

  // 1) PAREDES DE AFUERA (todo el alto). Adelante, en el piso 0, la puerta que viene de la sala.
  const alto = TOPE + 5;
  fija(caja(X0 - BORDE, X0, 0, alto, Z0 - BORDE, Z1 + BORDE));
  fija(caja(X1, X1 + BORDE, 0, alto, Z0 - BORDE, Z1 + BORDE));
  fija(caja(X0, X1, 0, alto, Z0 - BORDE, Z0));
  const ent = centroCelda(1, 0), d0 = ent.x - puerta / 2, d1 = ent.x + puerta / 2;
  fija(caja(X0, d0, 0, alto, Z1, Z1 + BORDE));
  fija(caja(d1, X1, 0, alto, Z1, Z1 + BORDE));
  fija(caja(d0, d1, H - losa - 0.5, alto, Z1, Z1 + BORDE));               // dintel de la puerta

  // 2) PAREDES DE ADENTRO de cada piso: entre cámaras. Si hay puerta, la pared queda en dos pedazos.
  for (const piso of datos.pisos) {
    const y0 = piso.k * H, y1 = (piso.k + 1) * H - losa, abiertas = new Set(piso.abiertas);
    for (let i = 0; i < P_.cols; i++) for (let j = 0; j < P_.filas; j++) {
      const c = centroCelda(i, j);
      if (i + 1 < P_.cols) {                            // pared entre (i, j) y (i+1, j): un plano x = cte
        const x = c.x + MEDIA, zA = c.z - MEDIA, zB = c.z + MEDIA;
        if (abiertas.has(puertaClave({ i, j }, { i: i + 1, j }))) {
          fija(caja(x - GROSOR / 2, x + GROSOR / 2, y0, y1, zA, c.z - puerta / 2));
          fija(caja(x - GROSOR / 2, x + GROSOR / 2, y0, y1, c.z + puerta / 2, zB));
        } else fija(caja(x - GROSOR / 2, x + GROSOR / 2, y0, y1, zA - GROSOR / 2, zB + GROSOR / 2));
      }
      if (j + 1 < P_.filas) {                           // pared entre (i, j) y (i, j+1): un plano z = cte
        const z = c.z - MEDIA, xA = c.x - MEDIA, xB = c.x + MEDIA;
        if (abiertas.has(puertaClave({ i, j }, { i, j: j + 1 }))) {
          fija(caja(xA, c.x - puerta / 2, y0, y1, z - GROSOR / 2, z + GROSOR / 2));
          fija(caja(c.x + puerta / 2, xB, y0, y1, z - GROSOR / 2, z + GROSOR / 2));
        } else fija(caja(xA - GROSOR / 2, xB + GROSOR / 2, y0, y1, z - GROSOR / 2, z + GROSOR / 2));
      }
    }
  }

  // 3) SUELOS de los pisos 1, 2 y el TECHO de arriba (k = pisos). Cada cámara es una losa;
  //    la cámara de la chimenea tiene un HOYO (4 losas alrededor) y las frágiles son 4 baldosas.
  for (let k = 1; k <= P_.pisos; k++) {
    const y1 = k * H, y0 = y1 - losa;
    const hoyoAbajo = datos.pisos[k - 1].hoyo;          // la chimenea del piso de abajo sube por aquí
    const fragiles = k < P_.pisos ? datos.pisos[k].fragiles : [];
    for (let i = 0; i < P_.cols; i++) for (let j = 0; j < P_.filas; j++) {
      const c = centroCelda(i, j), xa = c.x - MEDIA, xb = c.x + MEDIA, za = c.z - MEDIA, zb = c.z + MEDIA;
      if (hoyoAbajo.i === i && hoyoAbajo.j === j) {
        const h = hoyo / 2;
        fija(caja(xa, xb, y0, y1, za, c.z - h));
        fija(caja(xa, xb, y0, y1, c.z + h, zb));
        fija(caja(xa, c.x - h, y0, y1, c.z - h, c.z + h));
        fija(caja(c.x + h, xb, y0, y1, c.z - h, c.z + h));
        crearHaz(grupo, c, k, k === P_.pisos);
      } else if (fragiles.some(f => f.i === i && f.j === j)) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const bx0 = sx < 0 ? xa : c.x, bz0 = sz < 0 ? za : c.z;
          crearFragil(grupo, caja(bx0, bx0 + MEDIA, y0, y1, bz0, bz0 + MEDIA), k);
        }
      } else fija(caja(xa, xb, y0, y1, za, zb));
    }
  }

  // toda la roca fija en UNA malla
  grupo.add(crearRoca(fijas, { colorEn: colorRoca, altura: alturaLocal, arriba: ARRIBA, hundir: 0.9, paso: 1.1 }));

  // 4) ESTALACTITAS, CORAZONES
  const r = rng(datos.semilla * 17 + 3);
  for (const piso of datos.pisos) {
    for (const cel of piso.estalactitas) {
      const c = centroCelda(cel.i, cel.j);
      crearEstalactita(grupo, c.x + (r() - 0.5) * 5, c.z + (r() - 0.5) * 5, piso.k);
    }
    if (piso.corazon) { const c = centroCelda(piso.corazon.i, piso.corazon.j); crearCorazon(grupo, c.x, c.z, piso.k); }
  }
  pz.salida = datos.salida;
  return { cajas: fijas.length };
}

/** Enemigos del laberinto para el nivel: [tipo, planeta, dirección, altura, casa]. */
export function enemigosDelPozo(datos) {
  const lista = [];
  for (const piso of datos.pisos) for (const cel of piso.enemigos) {
    const c = centroCelda(cel.i, cel.j);
    lista.push(['alien', 0, dirDe(c.x, c.z), piso.k * P_.H, 3.5]);
  }
  return lista;
}

/** Dirección (desde el centro de la esfera de la cueva) del punto (x, z) del laberinto. */
function dirDe(x, z) { return punto(x, 0, z).sub(new V3(0, -R_SET, 0)).normalize(); }

/* ---------- la luz que baja por cada chimenea ---------- */
let texHaz = null;
function crearHaz(grupo, c, k, esSalida) {
  if (!texHaz) {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    texHaz = new THREE.CanvasTexture(cv);
  }
  const largo = esSalida ? 40 : P_.H + 2, yTop = k * P_.H + (esSalida ? 30 : 0);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(P_.hoyo * 0.42, P_.hoyo * 0.55, largo, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: esSalida ? 0xfff0c8 : 0xffd9a0, map: texHaz, transparent: true, opacity: esSalida ? 0.22 : 0.1,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  punto(c.x, yTop - largo / 2, c.z, m.position);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), ARRIBA);
  grupo.add(m);
  // charco de luz en el suelo de abajo
  const charco = new THREE.Mesh(new THREE.CircleGeometry(P_.hoyo * 0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: esSalida ? 0.2 : 0.12, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  punto(c.x, (k - 1) * P_.H + 0.04, c.z, charco.position);
  charco.quaternion.setFromUnitVectors(new V3(0, 0, 1), ARRIBA);
  grupo.add(charco);
  pz.haces.push(m);
}

/* ---------- suelos frágiles ---------- */
function crearFragil(grupo, k, piso) {
  const m = crearRoca([k], { hundir: 0.25, plano: 0.04, colorEn: (y, h, n) => {
    // arenisca más clara con grietas oscuras (el aviso: "esto no aguanta")
    const grieta = Math.abs(Math.sin((n * 9 + y) * 3.1)) < 0.12;
    return _c.setHex(grieta ? 0x2a1a12 : 0xc79a6a).multiplyScalar(0.85 + n * 0.25);
  }, altura: alturaLocal, arriba: ARRIBA });
  grupo.add(m);
  pz.fragiles.push({ caja: k, mesh: m, muro: ponerMuro(k), piso, estado: 'firme', t: 0, base: m.position.clone() });
}

/* ---------- estalactitas ---------- */
const geoEst = new THREE.ConeGeometry(0.55, 2.4, 7);
geoEst.rotateX(Math.PI);                         // la punta hacia abajo
geoEst.translate(0, -1.2, 0);                    // el origen queda en la base (pegada al techo)
function crearEstalactita(grupo, x, z, k) {
  const yTecho = (k + 1) * P_.H - P_.losa;
  const m = new THREE.Mesh(geoEst, toon(0x5a3a2a, { map: null }));
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), ARRIBA);
  punto(x, yTecho, z, m.position);
  const sombra = new THREE.Mesh(new THREE.RingGeometry(0.2, 1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, depthWrite: false }));
  sombra.quaternion.setFromUnitVectors(new V3(0, 0, 1), ARRIBA);
  punto(x, k * P_.H + 0.05, z, sombra.position);
  grupo.add(m, sombra);
  pz.estalactitas.push({ x, z, k, yTecho, y: yTecho, v: 0, estado: 'cuelga', t: 0, mesh: m, sombra });
}

/* ---------- corazones ---------- */
function crearCorazon(grupo, x, z, k) {
  const g = new THREE.Group(), mat = toon(0xff3a5c, { map: null, emissive: 0x7a0a1e });
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat), b = a.clone();
  a.position.set(-0.2, 0.12, 0); b.position.set(0.2, 0.12, 0);
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.55, 16), mat);
  punta.rotation.z = Math.PI; punta.position.y = -0.2;
  g.add(a, b, punta);
  const luz = new THREE.PointLight(0xff4060, 1.2, 6, 1.5); g.add(luz);
  g.quaternion.setFromUnitVectors(new V3(0, 1, 0), ARRIBA);
  punto(x, k * P_.H + 1.1, z, g.position);
  grupo.add(g);
  pz.corazones.push({ g, base: g.position.clone(), tomado: false });
}

/* =========================================================
   EN EL JUEGO (cada paso de física, desde def.alPaso)
   ========================================================= */
export function reiniciarPozo() { pz.mejor = 0; pz.saliendo = false; cam.limite = null; }

/** Checkpoint del piso k: junto a la chimenea por la que llegaste, sobre el suelo (no sobre el hoyo). */
export function checkpointDeRepisa(datos, k) {
  const ent = datos.pisos[k].entrada, c = centroCelda(ent.i, ent.j);
  const abiertas = new Set(datos.pisos[k].abiertas);
  let dx = 0, dz = 1;
  for (const [di, dj, ddx, ddz] of [[1, 0, 1, 0], [-1, 0, -1, 0], [0, 1, 0, -1], [0, -1, 0, 1]])
    if (abiertas.has(puertaClave(ent, { i: ent.i + di, j: ent.j + dj }))) { dx = ddx; dz = ddz; break; }
  const x = c.x + dx * 4.5, z = c.z + dz * 4.5;
  pz.mejor = Math.max(pz.mejor, k);
  return { planeta: 0, dir: dirDe(x, z), mirar: new V3(dx, 0, dz).normalize(), alto: k * P_.H };
}

const cl01 = v => Math.min(1, Math.max(0, v));
const _w = new V3();
const LIMITE_CAM = { dist: 6, pitch: 0.24 };
export function actualizarPozo(dt, datos, def) {
  const p = juego.jugador;
  if (!p || !pz.datos) return;
  const l = local(p.pos);

  // 1) LUZ: en el pasillo, la cueva; adentro del laberinto, un poco más de luz y de niebla lejana;
  //    mientras más subes, más se nota la luz que viene de arriba
  const fuera = Math.max(0, l.z - Z1);
  const f = cl01(1 - fuera / 10);
  mezclarAmbiente(def.ambiente, def.ambientePozo, f * f * (3 - 2 * f), cl01(l.y / TOPE));

  // adentro del laberinto el techo está a 5,5 m: cámara más cerca y más baja
  cam.limite = fuera < 1 && l.y < TOPE + 1 ? LIMITE_CAM : null;

  animarPeligros(dt, p, l);
  if (juego.modo !== 'juego' || pz.saliendo) return;

  // 2) PISOS: al llegar a uno nuevo queda de checkpoint y se GUARDA
  const piso = Math.round((l.y - p.r) / P_.H);
  if (p.grounded && piso > pz.mejor && piso < P_.pisos && Math.abs(l.y - p.r - piso * P_.H) < 0.4) {
    juego.checkpoint = checkpointDeRepisa(datos, piso);
    if (ajustes.guardado && ajustes.guardado.nivel === 'icaro') { ajustes.guardado.repisa = piso; ajustes.guardado.semilla = datos.semilla; guardarAjustes(); }
    emitir('repisa', piso);
  }

  // 3) RESCATE: si caes más de un piso bajo tu mejor piso (no debería pasar, pero por si acaso)
  if (pz.mejor >= 1 && l.y < (pz.mejor - 1) * P_.H - 2 && p.vel.dot(p.up) < -8) {
    const cp = checkpointDeRepisa(datos, pz.mejor);
    p.pos.copy(new V3(0, -R_SET, 0)).addScaledVector(cp.dir, R_SET + cp.alto + p.r + 0.05);
    p.vel.set(0, 0, 0); p.state = 'normal'; p.invul = Math.max(p.invul, 1);
    const n = document.getElementById('negro'); n.classList.add('ver'); setTimeout(() => n.classList.remove('ver'), 60);
    emitir('rescate');
  }

  // 4) CORAZONES
  for (const c of pz.corazones) {
    if (c.tomado || p.pos.distanceTo(c.g.position) > 1.4) continue;
    c.tomado = true; c.g.visible = false;
    if (p.hp < p.maxHP) p.hp++;
    emitir('vida', false); emitir('corazon');
  }

  // 5) SALIDA: un súper salto por la última chimenea te mete en la luz
  const s = datos.salida;
  if (l.y > TOPE + 0.8 && Math.abs(l.x - s.x) < P_.hoyo / 2 + 1 && Math.abs(l.z - s.z) < P_.hoyo / 2 + 1) salir(def);
}

/* ---------- estalactitas y suelos frágiles ---------- */
function animarPeligros(dt, p, l) {
  // ESTALACTITAS
  for (const e of pz.estalactitas) {
    const dx = l.x - e.x, dz = l.z - e.z, cerca = dx * dx + dz * dz < 2.4 * 2.4;
    const mismoPiso = l.y > e.k * P_.H - 0.5 && l.y < e.yTecho;
    switch (e.estado) {
      case 'cuelga':
        if (cerca && mismoPiso && juego.modo === 'juego') { e.estado = 'tiembla'; e.t = 0; emitir('estalactitaCruje'); }
        break;
      case 'tiembla':                                 // 0,35 s: se sacude y aparece la sombra roja
        e.t += dt;
        punto(e.x + Math.sin(e.t * 90) * 0.06, e.yTecho, e.z + Math.cos(e.t * 77) * 0.06, e.mesh.position);
        e.sombra.material.opacity = Math.min(0.75, e.t * 2.2);
        if (e.t > 0.35) { e.estado = 'cae'; e.t = 0; e.v = 0; emitir('estalactitaCae'); }
        break;
      case 'cae': {                                   // caída libre: v += g·dt, y −= v·dt
        e.v += G * dt; e.y -= e.v * dt;
        punto(e.x, e.y, e.z, e.mesh.position);
        const punta = e.y - 2.4;
        e.sombra.material.opacity = 0.75;
        // ¿te pegó? la punta está dentro de tu cuerpo (cilindro de radio 0,9 y 1,6 m de alto)
        if (dx * dx + dz * dz < 0.9 * 0.9 && punta < l.y + 0.9 && punta > l.y - p.r - 0.2) hurtPlayer(1, _w.copy(p.pos).sub(e.mesh.position));
        if (punta <= e.k * P_.H) {                    // se rompe contra el suelo
          e.estado = 'rota'; e.t = 0; e.mesh.visible = false; e.sombra.material.opacity = 0;
          emitir('estalactitaRompe', e.mesh.position.clone());
        }
        break;
      }
      case 'rota':                                    // a los 6 s vuelve a crecer
        e.t += dt;
        if (e.t > 6) { e.estado = 'cuelga'; e.y = e.yTecho; punto(e.x, e.yTecho, e.z, e.mesh.position); e.mesh.visible = true; e.mesh.scale.setScalar(0.01); }
        break;
    }
    if (e.estado === 'cuelga' && e.mesh.scale.x < 1) e.mesh.scale.setScalar(Math.min(1, e.mesh.scale.x + dt));
  }

  // SUELOS FRÁGILES
  for (const b of pz.fragiles) {
    switch (b.estado) {
      case 'firme': {
        const k = b.caja, ex = Math.abs(l.x - (b.cx ?? (b.cx = local(k.c).x))), ez = Math.abs(l.z - (b.cz ?? (b.cz = local(k.c).z)));
        if (p.grounded && ex < k.medio.x + 0.3 && ez < k.medio.z + 0.3 && Math.abs(l.y - p.r - b.piso * P_.H) < 0.5) { b.estado = 'tiembla'; b.t = 0; emitir('fragilCruje'); }
        break;
      }
      case 'tiembla':
        b.t += dt;
        b.mesh.position.copy(b.base).addScaledVector(DER, Math.sin(b.t * 70) * 0.05).addScaledVector(ATRAS, Math.cos(b.t * 63) * 0.05);
        if (b.t > 0.9) {                              // se cae: ya no choca
          b.estado = 'cae'; b.t = 0; b.v = 0;
          const i = mundo.muros.indexOf(b.muro); if (i >= 0) mundo.muros.splice(i, 1);
          emitir('fragilCae');
        }
        break;
      case 'cae':
        b.t += dt; b.v += G * dt;
        b.mesh.position.addScaledVector(ARRIBA, -b.v * dt);
        if (b.t > 1.2) { b.estado = 'ido'; b.t = 0; b.mesh.visible = false; }
        break;
      case 'ido':                                     // a los 5 s vuelve (si no estás encima de donde va)
        b.t += dt;
        if (b.t > 5) {
          b.estado = 'firme'; b.mesh.position.copy(b.base); b.mesh.visible = true;
          if (!mundo.muros.includes(b.muro)) mundo.muros.push(b.muro);
        }
        break;
    }
  }
  // la luz de las chimeneas respira un poquito
  const t = performance.now() / 1000;
  pz.haces.forEach((h, i) => { h.material.opacity = (i === pz.haces.length - 1 ? 0.22 : 0.1) * (0.85 + 0.15 * Math.sin(t * 1.3 + i)); });
  for (const c of pz.corazones) if (!c.tomado) { c.g.rotateY(dt * 2); c.g.position.copy(c.base).addScaledVector(ARRIBA, Math.sin(t * 2.5) * 0.15); }
}

/** Fundido a blanco: llegaste a la luz. Si el nivel tiene superficie, sigue ahí; si no, "Continuará". */
function salir(def) {
  pz.saliendo = true;
  juego.modo = 'cine';
  emitir('salidaLuz');
  const b = document.getElementById('blanco');
  b.style.transition = 'opacity 1.6s ease-in';
  b.classList.add('ver');
  if (def.alSalir) { setTimeout(() => def.alSalir(), 1700); return; }
  const t = document.createElement('div');
  t.id = 'continuara'; t.textContent = 'Continuará…';
  setTimeout(() => { b.append(t); requestAnimationFrame(() => t.classList.add('ver')); }, 1900);
  setTimeout(() => { t.remove(); b.style.transition = ''; b.classList.remove('ver'); emitir('irMenu'); }, 5600);
}
