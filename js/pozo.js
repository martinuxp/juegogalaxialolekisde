/* =========================================================
   pozo.js · El POZO de Ícaro: un laberinto vertical hasta la luz
   ---------------------------------------------------------
   Detrás de la sala de la personaje se abre un pozo de 18 m de
   radio y 64 m de alto, con paredes de "mesas" de capas de
   colores (como las rocas del desierto: cada capa es un tiempo
   distinto en que se fue juntando arena). Adentro flotan
   REPISAS que suben en zigzag; arriba entra la luz: la salida.

   El mapa es PROCEDURAL: lo arma el código a partir de una
   SEMILLA (un número). La misma semilla da siempre el mismo
   pozo (para ensayar la feria); con  ?semilla=123  en la
   dirección sale otro.

   Para que SIEMPRE se pueda pasar, cada salto se revisa con
   física antes de aceptarlo (VALIDADOR):
     · Altura: un salto normal sube  h = v²/(2g) = 14²/40 = 4,9 m
       y uno con botas  20²/40 = 10 m. Cada repisa queda entre
       5,5 m y 8 m más arriba: sin botas no llegas, con botas sí
       (sobran 2 m para pasar el borde).
     · Distancia: subiendo dh, el vuelo dura
           t = (v + √(v² − 2·g·dh)) / g
       (la segunda raíz de  dh = v·t − ½·g·t²: cuando ya vienes
       BAJANDO a esa altura) y en ese tiempo avanzas  x = v_h·t.
       El hueco entre repisas tiene que ser menor que la mitad
       de eso (margen para el que no corre a fondo).
     · Espacio: ninguna repisa puede tapar el salto de otra
       (12 m libres hacia arriba, más que los 10 del súper salto).
   ========================================================= */
import { THREE, V3, rng } from './util.js';
import { toon, mezclarAmbiente } from './escena.js';
import { agregarMuro } from './fisica.js';
import { juego, ajustes, guardarAjustes, emitir } from './estado.js';
import { POZO, R_SET } from './pozoGenerador.js';
export { POZO, generarPozo, semillaDeLaUrl, alcance, alturaMax } from './pozoGenerador.js';

/* =========================================================
   MARCO LOCAL del pozo
   A 58 m del centro de la cueva la esfera de R 2 000 m se curva
   solo  x²/(2R) = 16²/4000 ≈ 6 cm  dentro del pozo, así que lo
   tratamos como plano: x a la derecha, y hacia arriba, z atrás.
   ========================================================= */
const ARRIBA = new V3(POZO.x, R_SET, POZO.z).normalize();
const DER = new V3(1, 0, 0).addScaledVector(ARRIBA, -ARRIBA.x).normalize();
const ATRAS = new V3().crossVectors(DER, ARRIBA).normalize();
const ORIGEN = new V3(0, -R_SET, 0).addScaledVector(ARRIBA, R_SET);
export const marco = { ARRIBA, DER, ATRAS, ORIGEN };
/** Punto del mundo a partir de (x, y, z) del pozo (centro del pozo = 0, 0, 0). */
export const punto = (x, y, z, v = new V3()) => v.copy(ORIGEN).addScaledVector(DER, x).addScaledVector(ARRIBA, y).addScaledVector(ATRAS, z);
/** Al revés: coordenadas del pozo de un punto del mundo. */
const _l = new V3();
export function local(p) { _l.copy(p).sub(ORIGEN); return { x: _l.dot(DER), y: _l.dot(ARRIBA), z: _l.dot(ATRAS) }; }

/** Una caja del pozo: centro, ejes y medias medidas (sirve para chocar y para dibujar). */
function caja(x, z, y0, y1, ancho, fondo, giro) {
  const ex = DER.clone().multiplyScalar(Math.cos(giro)).addScaledVector(ATRAS, -Math.sin(giro));
  const ez = new V3().crossVectors(ex, ARRIBA).normalize();
  return { c: punto(x, (y0 + y1) / 2, z), ex, ey: ARRIBA.clone(), ez, medio: new V3(ancho / 2, (y1 - y0) / 2, fondo / 2) };
}

/* ---------- CAPAS (estratos) ----------
   Las mismas franjas a la misma altura en TODAS las paredes, como
   en las rocas de verdad: cada capa es una época. */
const PALETA = [0xb5653a, 0xc9773f, 0xdcb68a, 0x8a4f32, 0x9e3b2a, 0xd8a23a, 0xe3d0b2, 0xa85a36];
function capas(semilla) {
  const r = rng(semilla * 31 + 7), lista = [];
  let y = 0;
  while (y < POZO.alto) {
    const grosor = r() < 0.3 ? 0.4 + r() * 0.5 : 1.2 + r() * 2;     // capas finitas y gruesas
    lista.push({ y0: y, y1: Math.min(POZO.alto, y + grosor), color: PALETA[Math.floor(r() * PALETA.length)] });
    y += grosor;
  }
  return lista;
}
const colorEn = (lista, y) => (lista.find(c => y >= c.y0 && y < c.y1) || lista[lista.length - 1]).color;

/**
 * Pone el pozo en el mundo: las cajas que chocan (muros de fisica.js)
 * y las que se ven (InstancedMesh: cientos de cajas en UNA sola
 * llamada de dibujo, para que ande en el celular).
 */
export function construirPozo(grupo, datos) {
  const lista = capas(datos.semilla), r = rng(datos.semilla * 13 + 5);
  const vistas = [];          // { caja, color }
  const ponerMuro = k => agregarMuro(k.c, k.ex, k.ey, k.ez, k.medio);

  // PAREDES: 22 columnas alrededor. Chocan como UNA caja alta cada una; se ven como capas
  // que se meten un poco o sobresalen (terrazas), cada capa de su color.
  const NC = 22, FONDO = 8;
  for (let i = 0; i < NC; i++) {
    const a = i / NC * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    const puerta = dz > 0.85;                       // las que miran hacia la sala: dejan la entrada abierta
    const desde = puerta ? POZO.puerta : 0;
    const ancho = 2 * Math.PI * (POZO.r + FONDO / 2) / NC * 1.08;
    const rc = POZO.r + FONDO / 2;
    ponerMuro(caja(dx * rc, dz * rc, desde, POZO.alto, ancho, FONDO, a));
    for (const capa of lista) {
      if (capa.y1 <= desde) continue;
      const hundida = r() * 1.3;                    // 0 a 1,3 m hacia adentro de la pared: terrazas
      const rr = POZO.r + hundida + FONDO / 2;
      vistas.push({ k: caja(dx * rr, dz * rr, Math.max(desde, capa.y0), capa.y1, ancho * (0.92 + r() * 0.14), FONDO, a), color: capa.color });
    }
    if (puerta) vistas.push({ k: caja(dx * rc, dz * rc, desde - 0.6, desde, ancho, FONDO, a), color: 0x5a3626 });   // dintel
  }

  // REPISAS: una losa arriba (la que pisas) y "raíces" que cuelgan, cada vez más chicas,
  // como un pedazo de mesa que se quedó flotando.
  for (const rp of datos.repisas) {
    const losa = caja(rp.x, rp.z, rp.h - 1.2, rp.h, rp.m * 2, rp.m * 2, rp.giro);
    ponerMuro(losa);
    vistas.push({ k: losa, color: colorEn(lista, rp.h - 0.6) });
    vistas.push({ k: caja(rp.x, rp.z, rp.h - 0.15, rp.h + 0.02, rp.m * 2 + 0.06, rp.m * 2 + 0.06, rp.giro), color: 0xc79a6a });  // arena encima
    let lado = rp.m * 2, y = rp.h - 1.2;
    const raices = 2 + Math.floor(r() * 2);
    for (let j = 0; j < raices; j++) {
      lado *= 0.72; const g = 0.9 + r() * 1.2;
      const k = caja(rp.x + (r() - 0.5) * 0.6, rp.z + (r() - 0.5) * 0.6, y - g, y, lado, lado * (0.8 + r() * 0.3), rp.giro + (r() - 0.5) * 0.3);
      if (j === 0) ponerMuro(k);                     // la raíz más grande también choca (te puedes golpear la cabeza)
      vistas.push({ k, color: colorEn(lista, y - g / 2) });
      y -= g;
    }
  }

  // todas las cajas en UNA malla instanciada (color por instancia)
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = toon(0xffffff, { map: null });
  const malla = new THREE.InstancedMesh(geo, mat, vistas.length);
  const M = new THREE.Matrix4(), S = new THREE.Matrix4(), col = new THREE.Color();
  vistas.forEach(({ k, color }, i) => {
    M.makeBasis(k.ex, k.ey, k.ez).setPosition(k.c);
    S.makeScale(k.medio.x * 2, k.medio.y * 2, k.medio.z * 2);
    malla.setMatrixAt(i, M.multiply(S));
    col.setHex(color).multiplyScalar(0.9 + ((i * 7919) % 100) / 1000);   // un poquito distinto cada una
    malla.setColorAt(i, col);
  });
  malla.instanceMatrix.needsUpdate = true; malla.instanceColor.needsUpdate = true;
  malla.computeBoundingSphere();
  grupo.add(malla);
  return { malla, cajas: vistas.length };
}

/* =========================================================
   EN EL JUEGO (cada paso de física, desde nivel2-icaro.js)
   ========================================================= */
const estado = { mejor: -1, saliendo: false };
export function reiniciarPozo() { estado.mejor = -1; estado.saliendo = false; }

/** Dirección (desde el centro de la esfera de la cueva) del punto (x, z) del pozo. */
function dirDe(x, z) { return punto(x, 0, z).sub(new V3(0, -R_SET, 0)).normalize(); }

/** El checkpoint de la repisa k: si pierdes o caes muy abajo, vuelves aquí. */
export function checkpointDeRepisa(datos, k) {
  const rp = datos.repisas[k];
  estado.mejor = Math.max(estado.mejor, k);
  return { planeta: 0, dir: dirDe(rp.x, rp.z), mirar: new V3(0, 0, -1), alto: rp.h };
}

/** ¿El punto (x, z) del pozo está encima de la repisa? (la giramos a sus propios ejes) */
function encima(rp, x, z, margen = 0) {
  const dx = x - rp.x, dz = z - rp.z, c = Math.cos(rp.giro), s = Math.sin(rp.giro);
  return Math.abs(dx * c - dz * s) < rp.m + margen && Math.abs(dx * s + dz * c) < rp.m + margen;
}

const cl01 = v => Math.min(1, Math.max(0, v));
export function actualizarPozo(dt, datos, def) {
  const p = juego.jugador;
  if (!p) return;
  const l = local(p.pos);

  // 1) LUZ: la cueva es negra; adentro del pozo baja luz fría desde arriba y la niebla se aleja.
  //    f = qué tan adentro estás (0 en el pasillo, 1 en el pozo); arriba = qué tan cerca de la salida.
  const f = cl01((POZO.r + 10 - Math.hypot(l.x, l.z)) / 10);
  mezclarAmbiente(def.ambiente, def.ambientePozo, f * f * (3 - 2 * f), cl01(l.y / datos.salida.h));
  if (juego.modo !== 'juego' || estado.saliendo) return;

  // 2) REPISAS: al pararte en una nueva, queda de checkpoint y se GUARDA
  if (p.grounded) {
    for (let k = estado.mejor + 1; k < datos.repisas.length; k++) {
      const rp = datos.repisas[k];
      if (Math.abs(l.y - rp.h) < 1.5 && encima(rp, l.x, l.z)) {
        juego.checkpoint = checkpointDeRepisa(datos, k);
        if (ajustes.guardado && ajustes.guardado.nivel === 'icaro') { ajustes.guardado.repisa = k; ajustes.guardado.semilla = datos.semilla; guardarAjustes(); }
        emitir('repisa', k);
      }
    }
  }

  // 3) RESCATE: si caes más de 14 m bajo tu mejor repisa, un parpadeo negro y vuelves a ella
  //    (subir 50 m de nuevo por un error sería muy frustrante en la feria)
  if (estado.mejor >= 0 && l.y < datos.repisas[estado.mejor].h - 14 && p.vel.dot(p.up) < -10) {
    const rp = datos.repisas[estado.mejor];
    punto(rp.x, rp.h + p.r + 0.05, rp.z, p.pos);
    p.vel.set(0, 0, 0); p.state = 'normal'; p.invul = Math.max(p.invul, 1);
    const n = document.getElementById('negro'); n.classList.add('ver'); setTimeout(() => n.classList.remove('ver'), 60);
    emitir('rescate');
  }

  // 4) SALIDA: un súper salto desde la última repisa te mete en la luz
  if (l.y > datos.salida.h - 0.5 && Math.hypot(l.x - datos.salida.x, l.z - datos.salida.z) < 6) salir();
}

/** Fundido a blanco: llegaste a la luz. La superficie de Ícaro todavía no existe: "Continuará". */
function salir() {
  estado.saliendo = true;
  juego.modo = 'cine';
  emitir('salidaLuz');
  const b = document.getElementById('blanco');
  b.style.transition = 'opacity 1.8s ease-in';
  b.classList.add('ver');
  const t = document.createElement('div');
  t.id = 'continuara'; t.textContent = 'Continuará…';
  setTimeout(() => { b.append(t); requestAnimationFrame(() => t.classList.add('ver')); }, 1900);
  setTimeout(() => {
    t.remove(); b.style.transition = ''; b.classList.remove('ver');
    emitir('irMenu');
  }, 5600);
}
