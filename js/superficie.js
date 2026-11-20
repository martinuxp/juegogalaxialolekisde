/* =========================================================
   superficie.js · La SUPERFICIE de Ícaro (parte 2 del nivel 2)
   ---------------------------------------------------------
   Saliste del laberinto por la grieta y llegas a un desierto
   de arena HIRVIENDO bajo un sol gigante. La arena quema: hay
   que avanzar saltando de roca en roca y por pasillos de
   piedra. Más adelante la tierra se partió en FISURAS: un
   lado quedó 6,5 m más arriba y solo se sube con las botas.
   Al fondo, en un árbol seco, espera MEOWL (js/meowl.js).

   EL PLANETA: Ícaro mide R = 400 m (10 veces Columba) y en la
   arena g = 20 m/s². La arena es la "superficie del mar" del
   planeta (P.mar = 400): no es sólida, y si la tocas te quemas.
   Las rocas son CAJAS (fisica.js → agregarMuro) puestas sobre
   la esfera, cada una con su propio "arriba" (la dirección
   desde el centro del planeta), porque a 150 m del inicio el
   suelo ya está inclinado 150/400 rad ≈ 21°.

   COORDENADAS: (x, z) = metros medidos SOBRE la arena desde el
   inicio (el polo norte del planeta). x = derecha, z = atrás:
   el camino avanza hacia −z. h = altura sobre la arena.
   ========================================================= */
import { THREE, V3, rng, tangent } from './util.js';
import { scene, camera, toon, outline } from './escena.js';
import { agregarMuro, mundo } from './fisica.js';
import { juego, ajustes, guardarAjustes, emitir } from './estado.js';
import { player, hurtPlayer, respawnPlayer } from './jugador.js';
import { cam, camaraAlInicio } from './camara.js';
import { crearRoca, ruido } from './roca.js';
import { mostrarHUD } from './ui.js';
import { limpiarEntrada } from './entrada.js';

export { R_ARENA, G_ARENA, dirXZ, puntoXZ, localXZ, ejesEn, H_FISURA, H_ARENA_JEFE, PIEZAS, ARENA_JEFE, TRAMOS, tiroDeVuelta } from './superficieDatos.js';
import { R_ARENA, G_ARENA, dirXZ, puntoXZ, localXZ, ejesEn, H_FISURA, H_ARENA_JEFE, PIEZAS, ARENA_JEFE, TRAMOS, tiroDeVuelta,
  COLUMNAS, ARCO, OBELISCOS, ESTATUA, BRAZO, solidosRuinas } from './superficieDatos.js';

const FONDO = 4;

/* paleta del desierto: capas de arenisca (de abajo hacia arriba se repiten) */
const CAPAS = [0xd27a2c, 0xf2b75a, 0xb4612a, 0xe99b40, 0xf8cf78, 0xc56f2e, 0xe2a24a, 0x9c5426];
const _c = new THREE.Color(), _o = new THREE.Color(0x5a2a10);
const ARRIBA_C = [new THREE.Color(0xf0b968), new THREE.Color(0xdc9a4c), new THREE.Color(0xf7cf86)];
function colorRoca(y, hundido, n) {
  if (hundido < 0.08) {                                     // cara de arriba (donde se pisa): manchas de arena
    const k = n * 3;
    return _c.copy(ARRIBA_C[0]).lerp(ARRIBA_C[k < 1.4 ? 1 : 2], Math.abs(k - 1.4) * 0.9);
  }
  const capa = Math.floor((y + n * 0.9 + 40) / 1.15);
  _c.setHex(CAPAS[((capa % CAPAS.length) + CAPAS.length) % CAPAS.length]);
  return _c.lerp(_o, Math.min(0.55, hundido * 0.6)).multiplyScalar(0.92 + n * 0.16);
}

export const sup = {
  muros: [], tramo: 0, t: 0, ultimaQuema: -9, humos: [], vapores: [], corazones: [],
  domo: null, sol: null, brillos: [], grieta: null,
};

/** Arma la caja de una pieza (sin agregarla a la física todavía). */
function cajaDe(k) {
  const { ex, ey, ez } = ejesEn(k.x, k.z, k.giro || 0);
  const c = puntoXZ(k.x, k.z, (k.h - FONDO) / 2);
  return { c, ex, ey, ez, arriba: ey, medio: new V3(k.w / 2, (k.h + FONDO) / 2, k.d / 2), pieza: k };
}

/* =========================================================
   CONSTRUIR (def.decorado del nivel)
   ========================================================= */
export function construirSuperficie(grupo, planetas) {
  const P = planetas[0];
  sup.muros = []; sup.humos = []; sup.vapores = []; sup.corazones = []; sup.brillos = [];
  sup.tramo = 0; sup.t = 0; sup.ultimaQuema = -9;
  // 1) rocas: chocan (cajas) y se dibujan como roca (roca.js)
  const cajas = PIEZAS.map(cajaDe);
  for (const k of cajas) {
    const m = agregarMuro(k.c, k.ex, k.ey, k.ez, k.medio);
    m.planeta = P;                 // es SUELO de Ícaro: superficieEn la cuenta (respawn, carteles, enemigos)
    m.pieza = k.pieza.id;
    sup.muros.push(m);
  }
  const altura = p => p.length() - R_ARENA;
  grupo.add(crearRoca(cajas, { colorEn: colorRoca, altura, hundir: 0.75, plano: 0.05, paso: 1.4 }));

  // 2) arena, cielo y sol
  grupo.add(crearArena(), crearDomo());
  // 3) decorado: ruinas, la estatua enterrada, fisuras que brillan, la grieta de salida
  crearRuinas(grupo);
  // las ruinas también chocan: cajas y esferas con las MISMAS medidas del dibujo (superficieDatos.js).
  // Con m.planeta = P se pueden pisar y la sombra cae encima, igual que en las rocas.
  const { cajas: cr, esferas } = solidosRuinas();
  for (const k of cr) { const m = agregarMuro(k.c, k.ex, k.ey, k.ez, k.medio); m.planeta = P; m.ruina = true; }
  for (const e of esferas) mundo.solidos.push({ c: e.c, R: e.R, planeta: P, ruina: true });
  crearFisuras(grupo);
  crearGrieta(grupo);
  crearVapores(grupo);
  crearCorazon(grupo, 6.5, -124, H_ARENA_JEFE);
}

/* ---------- la arena: un casquete de la esfera con dunas lejos del camino ---------- */
/** Distancia (m) de (x, z) al camino: a la pieza más cercana. */
function distCamino(x, z) {
  let d = Infinity;
  for (const k of PIEZAS) {
    const c = Math.cos(k.giro || 0), s = Math.sin(k.giro || 0);
    const lx = (x - k.x) * c + (z - k.z) * s, lz = -(x - k.x) * s + (z - k.z) * c;
    const qx = Math.max(0, Math.abs(lx) - k.w / 2), qz = Math.max(0, Math.abs(lz) - k.d / 2);
    d = Math.min(d, Math.hypot(qx, qz));
  }
  return d;
}
const suaveEntre = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Altura de la arena DIBUJADA en (x, z): plana junto al camino (ahí quema) y dunas enormes lejos. */
export function alturaDuna(x, z) {
  const d = distCamino(x, z), lejos = suaveEntre(22, 120, d);
  const duna = Math.pow(ruido(x * 0.016 + 3, 0, z * 0.016), 1.6) * 34 + ruido(x * 0.05, 1, z * 0.05) * 5 + suaveEntre(8, 30, d) * 1.2;
  const ondas = Math.sin(x * 0.55 + z * 0.22 + ruido(x * 0.1, 2, z * 0.1) * 3) * 0.12;
  return ondas + lejos * duna;
}
function crearArena() {
  const g = new THREE.SphereGeometry(R_ARENA, 230, 150, 0, Math.PI * 2, 0, 330 / R_ARENA);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), v = new V3();
  const claro = new THREE.Color(0xffd27a), medio = new THREE.Color(0xf4ae48), sombra = new THREE.Color(0xd77a2c), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const l = localXZ(v), h = alturaDuna(l.x, l.z);
    v.multiplyScalar((R_ARENA + h) / R_ARENA);
    pos.setXYZ(i, v.x, v.y, v.z);
    // crestas claras, valles oscuros, y las ondas del viento
    const k = Math.sin(l.x * 0.55 + l.z * 0.22 + ruido(l.x * 0.1, 2, l.z * 0.1) * 3);
    c.copy(medio).lerp(k > 0 ? claro : sombra, Math.abs(k) * 0.35 + Math.min(0.4, h * 0.012));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon(0xffffff, { map: null, vertexColors: true, emissive: 0x2a0e00 }));
  // el resto del planeta (lejos, detrás del horizonte)
  const resto = new THREE.Mesh(new THREE.SphereGeometry(R_ARENA - 0.4, 64, 40), toon(0xe39a42, { map: null }));
  const gr = new THREE.Group(); gr.add(m, resto);
  return gr;
}

/* ---------- el cielo: un domo que sigue a la cámara, con el SOL gigante ----------
   Es un ShaderMaterial chiquito: el color depende de qué tan arriba mira cada punto
   del domo (respecto al "arriba" del lugar donde está la cámara) y de qué tan cerca
   está del sol. Los colores se escriben tal cual (ya son los que se ven en pantalla). */
export const DIR_SOL = new V3(0.12, 0.2, -1).normalize();   // bajo, detrás del árbol de Meowl
function crearDomo() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uArriba: { value: new V3(0, 1, 0) }, uSol: { value: DIR_SOL.clone() }, uT: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uArriba; uniform vec3 uSol; uniform float uT; varying vec3 vDir;
      void main(){
        float e = dot(vDir, uArriba);
        vec3 horizonte = vec3(1.0, 0.86, 0.52), medio = vec3(1.0, 0.62, 0.2), cenit = vec3(0.86, 0.36, 0.1);
        vec3 col = mix(horizonte, medio, smoothstep(0.0, 0.25, e));
        col = mix(col, cenit, smoothstep(0.25, 0.9, e));
        col = mix(col, vec3(0.95, 0.55, 0.22), smoothstep(0.0, -0.3, e));
        float s = max(dot(vDir, uSol), 0.0);
        col += vec3(1.0, 0.85, 0.5) * pow(s, 6.0) * 0.55 + vec3(1.0, 0.95, 0.8) * pow(s, 60.0) * 0.8;
        // vetas de nubes de polvo que se mueven lento
        float n = sin(vDir.x * 9.0 + uT * 0.05) * sin(vDir.z * 7.0 - vDir.y * 4.0 + uT * 0.03);
        col = mix(col, vec3(1.0, 0.78, 0.45), smoothstep(0.55, 0.95, n) * smoothstep(0.05, 0.3, e) * 0.35);
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
      }`,
  });
  const domo = new THREE.Mesh(new THREE.SphereGeometry(480, 40, 20), mat);
  domo.renderOrder = -10; domo.frustumCulled = false;
  // sigue a la cámara: se mueve justo antes de dibujarse (así nunca queda "lejos")
  domo.onBeforeRender = (r, s, cm) => {
    domo.matrixWorld.makeTranslation(cm.position.x, cm.position.y, cm.position.z);
    mat.uniforms.uArriba.value.copy(cm.position).normalize();
  };
  domo.matrixAutoUpdate = false;
  sup.domo = domo;
  // el disco del sol: un sprite con degradado, ENORME
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.28, 'rgba(255,246,200,1)'); grd.addColorStop(0.34, 'rgba(255,214,130,.85)');
  grd.addColorStop(0.6, 'rgba(255,170,70,.25)'); grd.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
  sol.scale.setScalar(330); sol.renderOrder = -9;
  sup.sol = sol;
  const gr = new THREE.Group(); gr.add(domo, sol);
  return gr;
}

/* ---------- ruinas: columnas, arcos, obeliscos y una estatua enterrada (sus choques: solidosRuinas) ---------- */
function crearRuinas(grupo) {
  const r = rng(404), piedra = toon(0xe8b465, { map: null }), oscura = toon(0xb86e32, { map: null });
  const poner = (obj, x, z, h, giro = 0, inclina = 0) => {
    const { ex, ey, ez } = ejesEn(x, z, giro);
    obj.position.copy(puntoXZ(x, z, h));
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
    obj.rotateZ(inclina);
    grupo.add(obj);
    return obj;
  };
  // COLUMNA: tambores apilados con un capitel; algunas rotas
  const columna = (alto, rota) => {
    const g = new THREE.Group();
    let y = -1;
    const n = Math.ceil((alto + 1) / 1.6);
    for (let i = 0; i < n; i++) {
      const t = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 1.55, 10), i % 2 ? piedra : oscura), 0.03);
      t.position.y = y + 0.8; t.rotation.y = r() * 3; y += 1.6;
      if (rota && i === n - 1) { t.scale.y = 0.6; t.rotation.z = 0.25; }
      g.add(t);
    }
    if (!rota) { const cap = outline(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 2.1), oscura), 0.03); cap.position.y = y + 0.25; g.add(cap); }
    return g;
  };
  // columnas a los dos lados de los pasillos y entre las islas
  for (const [x, z, alto, rota] of COLUMNAS)
    poner(columna(alto, rota), x, z, 0, r() * 3, rota ? (r() - 0.5) * 0.3 : 0);
  // ARCO sobre el primer pasillo: dos pilares y un dintel (a 10 m: no te topas al saltar)
  const arco = new THREE.Group();
  for (const sx of [-1, 1]) { const p = columna(ARCO.alto, false); p.position.x = sx * ARCO.sep; arco.add(p); }
  const dintel = outline(new THREE.Mesh(new THREE.BoxGeometry(...ARCO.dintel), oscura), 0.03); dintel.position.y = ARCO.yDintel;
  arco.add(dintel);
  poner(arco, ARCO.x, ARCO.z, 0);
  // OBELISCOS con el anillo de antena de los aliens
  const obelisco = alto => {
    const g = new THREE.Group();
    const b = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, alto, 4), piedra), 0.03); b.position.y = alto / 2 - 1; b.rotation.y = Math.PI / 4;
    const anillo = outline(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.28, 8, 20), oscura), 0.04); anillo.position.y = alto + 0.4;
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), toon(0x9cf27a, { map: null, emissive: 0x2a6a10 }));
    bola.position.y = alto + 0.4;
    g.add(b, anillo, bola);
    return g;
  };
  for (const [x, z, alto, giro] of OBELISCOS) poner(obelisco(alto), x, z, 0, giro);
  // ESTATUA enterrada: la cabeza gigante de un gato-alien (diseño propio), medio hundida en la arena
  const cab = new THREE.Group();
  const cara = outline(new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), piedra), 0.015); cara.scale.set(1.1, 0.92, 1);
  cab.add(cara);
  for (const sx of [-1, 1]) {
    const oreja = outline(new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 4), oscura), 0.02);
    oreja.position.set(sx * 4.6, 6, 0); oreja.rotation.z = -sx * 0.45; cab.add(oreja);
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), toon(0x5a2a10, { map: null })); ojo.scale.set(1, 0.7, 0.5);
    ojo.position.set(sx * 2.7, 1.2, 6.2); cab.add(ojo);
    const antena = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 6, 6), oscura), 0.03);
    antena.position.set(sx * 1.6, 8.5, -0.5); antena.rotation.z = sx * 0.3; cab.add(antena);
  }
  poner(cab, ESTATUA.x, ESTATUA.z, ESTATUA.h, ESTATUA.giro, ESTATUA.inclina);
  // un brazo de piedra roto que sale de la arena, al otro lado
  const brazo = new THREE.Group();
  const ante = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 12, 8), piedra), 0.02); ante.position.y = 4;
  const mano = outline(new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), oscura), 0.02); mano.position.y = 10.5; mano.scale.set(1, 1.2, 0.7);
  brazo.add(ante, mano);
  poner(brazo, BRAZO.x, BRAZO.z, BRAZO.h, BRAZO.giro, BRAZO.inclina);
}

/* ---------- fisuras: rajas en la arena al pie de cada pared, que brillan de calor ---------- */
function crearFisuras(grupo) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const raja = (x, z, largo, giro) => {
    const r = rng(Math.round(x * 13 + z * 7));
    const pts = [];
    for (let i = 0; i <= 14; i++) pts.push(new THREE.Vector2((i / 14 - 0.5) * largo, (r() - 0.5) * 0.9));
    const forma = new THREE.Shape();
    pts.forEach((p, i) => i ? forma.lineTo(p.x, p.y + 0.35) : forma.moveTo(p.x, p.y + 0.35));
    for (let i = pts.length - 1; i >= 0; i--) forma.lineTo(pts[i].x, pts[i].y - 0.35);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), mat);
    const { ex, ey, ez } = ejesEn(x, z, giro);
    m.position.copy(puntoXZ(x, z, 0.08));
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ez.clone().negate(), ey));
    grupo.add(m); sup.brillos.push(m);
  };
  raja(9.5, -99.5, 16, 0.05); raja(5.5, -114, 13, -0.08); raja(14, -98.5, 7, 0.6); raja(1, -115, 6, -0.7);
}

/* ---------- la grieta por donde sales de la cueva (en la losa de la salida) ---------- */
export const GRIETA = { x: 0, z: 3.2 };
function crearGrieta(grupo) {
  const g = new THREE.Group();
  const hoyo = new THREE.Mesh(new THREE.CircleGeometry(1.6, 18), new THREE.MeshBasicMaterial({ color: 0x120804 }));
  hoyo.rotation.x = -Math.PI / 2; hoyo.scale.set(1.3, 0.8, 1); hoyo.position.y = 0.04;
  g.add(hoyo);
  const r = rng(12), piedra = toon(0xc0702a, { map: null });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, roca = outline(new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + r() * 0.35, 0), piedra), 0.05);
    roca.position.set(Math.cos(a) * 2.2, 0.1, Math.sin(a) * 1.4); roca.rotation.set(r() * 3, r() * 3, 0);
    g.add(roca);
  }
  const { ex, ey, ez } = ejesEn(GRIETA.x, GRIETA.z);
  g.position.copy(puntoXZ(GRIETA.x, GRIETA.z, 2.5));
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  grupo.add(g);
  sup.grieta = g;
}

/* ---------- vapor de calor que sube de la arena junto al camino ---------- */
let texVapor = null;
function crearVapores(grupo) {
  if (!texVapor) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,240,210,.55)'); grd.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    texVapor = new THREE.CanvasTexture(cv);
  }
  const r = rng(77);
  for (let i = 0; i < 46; i++) {
    const k = PIEZAS[Math.floor(r() * 12)];
    const lado = r() < 0.5 ? -1 : 1;
    const x = k.x + lado * (k.w / 2 + 1 + r() * 3), z = k.z + (r() - 0.5) * k.d;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texVapor, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(1.5);
    grupo.add(s);
    sup.vapores.push({ s, x, z, t: r() * 3, dur: 2.2 + r() * 1.5 });
  }
}

/* ---------- corazón que se toma ---------- */
function crearCorazon(grupo, x, z, h) {
  const g = new THREE.Group(), mat = toon(0xff3a5c, { map: null, emissive: 0x7a0a1e });
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat), b = a.clone();
  a.position.set(-0.2, 0.12, 0); b.position.set(0.2, 0.12, 0);
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.55, 16), mat);
  punta.rotation.z = Math.PI; punta.position.y = -0.2;
  g.add(a, b, punta);
  const arriba = dirXZ(x, z);
  g.quaternion.setFromUnitVectors(new V3(0, 1, 0), arriba);
  g.position.copy(puntoXZ(x, z, h + 1.1));
  grupo.add(g);
  sup.corazones.push({ g, base: g.position.clone(), arriba, tomado: false });
}

/* =========================================================
   LA ARENA QUEMA (jugador.js llama a def.quemar cuando la tocas)
   ---------------------------------------------------------
   Te quita un corazón y SALTAS DEL SUSTO de vuelta al último
   lugar seguro. Ese salto es un tiro parabólico calculado:
     Δ = seguro − aquí:  h = altura que hay que subir,
                         d = distancia horizontal
     se elige una cima H = h + 2,2 m sobre el punto de partida
       subida:  v_y = √(2·g·H)          tiempo t₁ = v_y / g
       bajada:  de H a h                t₂ = √(2·(H − h) / g)
     v_horizontal = d / (t₁ + t₂)
   Durante ese salto no hay control (el jugador vuela como una
   pelota: solo la gravedad). Si el salto sería demasiado
   grande (una mesa muy alta) o te quemas otra vez enseguida,
   vuelves directo al lugar seguro.
   ========================================================= */
const _d = new V3(), _h = new V3();
export function quemar(p) {
  emitir('quemadura', p.pos.clone());
  humo(p.pos);
  const seguidas = sup.t - sup.ultimaQuema < 2.5;
  sup.ultimaQuema = sup.t;
  p.invul = 0; hurtPlayer(1, p.up);
  _d.copy(p.seguro).sub(p.pos);
  const h = _d.dot(p.up), dist = tangent(_h, _d, p.up).length();
  const { vy, vx: vh } = tiroDeVuelta(h, dist, p.gmag || G_ARENA);   // (superficieDatos.js)
  if (seguidas || vy > 16 || vh > 14 || p.hp <= 0) {
    p.pos.copy(p.seguro); p.vel.set(0, 0, 0); p.state = 'normal'; p.guiado = null;
    p.invul = Math.max(p.invul, 0.8);
    humo(p.pos);
    return;
  }
  // el vuelo: la posición sale DIRECTO de las ecuaciones del tiro parabólico
  //   x(t) = v_x·t        y(t) = v_y·t − ½·g·t²
  // (así no se engancha en el borde de la roca al subir pegado a la pared). Al llegar, queda en el lugar seguro.
  const ini = p.pos.clone().normalize().multiplyScalar(R_ARENA + p.r + 0.12), arriba = ini.clone().normalize();
  const lado = dist > 1e-3 ? _h.clone().normalize() : new V3();
  const fin = p.seguro.clone(), gg = p.gmag || G_ARENA, T = tiroDeVuelta(h, dist, gg).t;
  let t = 0;
  p.state = 'guiado'; p.grounded = false;
  p.guiado = dt => {
    t = Math.min(T, t + dt);
    p.pos.copy(ini).addScaledVector(lado, vh * t).addScaledVector(arriba, vy * t - 0.5 * gg * t * t);
    p.vel.copy(lado).multiplyScalar(vh).addScaledVector(arriba, vy - gg * t);
    if (t >= T) { p.pos.copy(fin); p.vel.set(0, 0, 0); p.state = 'normal'; p.guiado = null; }
  };
}

/* ---------- humo (al quemarte) ---------- */
function humo(pos) {
  if (!texVapor) return;
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texVapor, transparent: true, depthWrite: false, color: 0xfff0e0 }));
    s.position.copy(pos).add(new V3((Math.random() - 0.5) * 1.2, (Math.random() - 0.2) * 0.8, (Math.random() - 0.5) * 1.2));
    s.scale.setScalar(1);
    scene.add(s);
    sup.humos.push({ s, t: 0, vel: pos.clone().normalize().multiplyScalar(2 + Math.random() * 2) });
  }
}

/* =========================================================
   CADA PASO DE FÍSICA (def.alPaso)
   ========================================================= */
const _l = new V3();
export function actualizarSuperficie(dt) {
  sup.t += dt;
  const p = player;
  // puntos de control: el último tramo que pisaste (y se guarda, para seguir otro día)
  if (p.grounded && p.state === 'normal') {
    const l = localXZ(p.pos);
    TRAMOS.forEach((tr, i) => {
      if (i <= sup.tramo) return;
      const k = PIEZAS.find(q => q.id === tr.pieza);
      if (Math.abs(l.x - k.x) < k.w / 2 + 0.5 && Math.abs(l.z - k.z) < k.d / 2 + 0.5 && l.h > k.h - 0.5) {
        sup.tramo = i;
        juego.checkpoint = puntoDeTramo(i);
        guardarParte({ tramo: i });
        emitir('repisa');
      }
    });
  }
  // corazones
  for (const c of sup.corazones) {
    if (c.tomado || p.pos.distanceTo(c.g.position) > 1.4) continue;
    c.tomado = true; c.g.visible = false;
    if (p.hp < p.maxHP) p.hp++;
    emitir('vida', false); emitir('corazon');
  }
}
export function puntoDeTramo(i) {
  const tr = TRAMOS[i];
  return { planeta: 0, dir: dirXZ(tr.x, tr.z), mirar: ejesEn(tr.x, tr.z).ez.negate() };
}
/** Guarda en qué parte de Ícaro vas (main.js lo lee para seguir donde quedaste). */
export function guardarParte(extra = {}) {
  const g = ajustes.guardado && ajustes.guardado.nivel === 'icaro' ? ajustes.guardado : { nivel: 'icaro' };
  ajustes.guardado = { ...g, botas: true, parte: 'superficie', ...extra };
  guardarAjustes();
}

/** Si ya ibas en la superficie, sigues en el último tramo que pisaste. */
export function reanudarSuperficie() {
  const g = ajustes.guardado;
  const k = g && g.parte === 'superficie' ? Math.min(TRAMOS.length - 1, g.tramo || 0) : 0;
  sup.tramo = k;
  juego.checkpoint = k > 0 ? puntoDeTramo(k) : null;
  respawnPlayer(); camaraAlInicio();
}

/* =========================================================
   CADA CUADRO (también durante las cinemáticas): sol, vapor,
   humo, fisuras que laten y corazones que giran.
   ========================================================= */
export function animarSuperficie(dt, t) {
  if (sup.domo) sup.domo.material.uniforms.uT.value = t;
  if (sup.sol) sup.sol.position.copy(camera.position).addScaledVector(DIR_SOL, 430);
  for (const b of sup.brillos) b.material.opacity = 0.6 + Math.sin(t * 2.3) * 0.25;
  for (const v of sup.vapores) {
    v.t += dt;
    const k = (v.t % v.dur) / v.dur;
    v.s.position.copy(puntoXZ(v.x, v.z, 0.2 + k * 3.5));
    v.s.material.opacity = Math.sin(k * Math.PI) * 0.35;
    v.s.scale.setScalar(1.2 + k * 2.2);
  }
  for (let i = sup.humos.length - 1; i >= 0; i--) {
    const h = sup.humos[i];
    h.t += dt;
    h.s.position.addScaledVector(h.vel, dt);
    h.s.scale.setScalar(1 + h.t * 3);
    h.s.material.opacity = Math.max(0, 0.9 - h.t * 1.1);
    if (h.t > 0.85) { scene.remove(h.s); h.s.material.dispose(); sup.humos.splice(i, 1); }
  }
  for (const c of sup.corazones) if (!c.tomado) { c.g.rotateY(dt * 2); c.g.position.copy(c.base).addScaledVector(c.arriba, Math.sin(t * 2.5) * 0.15); }
}

/* =========================================================
   CINEMÁTICA DE LLEGADA A LA SUPERFICIE
   ---------------------------------------------------------
   1. (0–2,1 s) sales disparad@ de la grieta: es un tiro
      vertical de verdad, y = y₀ + v·t − ½·g·t² con v = 13 m/s
      y g = 20 m/s², y caes de pie junto al hoyo
   2. (2,6–3,9 s) corte al árbol: Meowl te está mirando
   3. (3,9–6,7 s) la cámara vuela RÁPIDO desde el árbol hasta
      ti siguiendo el camino (curva Catmull-Rom por los puntos
      del recorrido): así sabes adónde tienes que ir.
   Todo es animación (no física), salvo el salto de la grieta.
   ========================================================= */
const C = { activo: false, t: 0, fin: null, curva: null, mirar: null, lugar: new V3(), salto: null };
const T1 = 2.1, T2 = 2.6, T3 = 3.9, T4 = 6.7, TFIN = 7.1;
export const cineSuperficie = C;
let meowlCine = null;
/** Meowl (js/meowl.js) le dice a la cinemática dónde está su rama, para el plano del árbol. */
export function registrarMeowlCine(m) { meowlCine = m; }

export function iniciarSalidaSuperficie(fin) {
  C.activo = true; C.t = 0; C.fin = fin;
  juego.modo = 'cine';
  mostrarHUD(false);
  limpiarEntrada();
  // la luz blanca de la salida del pozo se va
  const b = document.getElementById('blanco');
  b.style.transition = 'opacity 1.4s ease-out';
  requestAnimationFrame(() => b.classList.remove('ver'));
  setTimeout(() => { b.style.transition = ''; }, 1500);
  // el salto: desde 1,2 m bajo la losa hasta caer 3 m adelante del hoyo
  const ini = puntoXZ(GRIETA.x, GRIETA.z, 2.5 - 1.2), finP = puntoXZ(GRIETA.x, GRIETA.z - 4.2, 2.5 + player.r);
  C.salto = { ini, finP, vy: 13 };
  player.state = 'dormido'; player.vel.set(0, 0, 0);
  player.up.copy(dirXZ(0, 0)); player.facing.set(0, 0, -1);
  player.pos.copy(ini);
  // el recorrido de la cámara: del árbol de Meowl hasta detrás del jugador
  const camPts = [[0, -146, 30], [2, -128, 28], [6, -112, 22], [10, -96, 16], [9, -78, 13], [3, -62, 12], [0, -44, 11], [0, -26, 10], [0, -10, 9], [0, 4.5, 6.2]];
  const mirarPts = [[0, -153, 22], [3, -122, 17], [9, -105, 10], [10, -88, 4], [8, -70, 3], [1, -56, 3], [0, -40, 3], [0, -22, 3], [0, -6, 3], [0, -1.8, 3.6]];
  C.curva = new THREE.CatmullRomCurve3(camPts.map(([x, z, h]) => puntoXZ(x, z, h)));
  C.mirar = new THREE.CatmullRomCurve3(mirarPts.map(([x, z, h]) => puntoXZ(x, z, h)));
  emitir('salirGrieta');
}

const _m = new V3(), _u = new V3();
const suave = k => k * k * (3 - 2 * k);
/** Devuelve true mientras la cinemática controla la cámara. */
export function actualizarCineSuperficie(dt) {
  if (!C.activo) return false;
  C.t += dt;
  const t = C.t, S = C.salto;
  // 1) el salto fuera de la grieta: tiro vertical y(t) = v·t − ½·g·t² (y = 0 a 1,2 m bajo la losa)
  //    y de lado avanza parejo hasta 3 m adelante del hoyo
  const tv = Math.max(0, t - 0.5), sube = 1.2 + player.r;               // cuánto más arriba termina
  const vuelo = (S.vy + Math.sqrt(S.vy * S.vy - 2 * G_ARENA * sube)) / G_ARENA;   // cuándo cae a esa altura
  if (tv < vuelo) {
    const k = tv / vuelo, y = S.vy * tv - 0.5 * G_ARENA * tv * tv;
    puntoXZ(GRIETA.x, GRIETA.z - 4.2 * k, 2.5 - 1.2 + y, player.pos);
    if (tv > 0 && !C.salio) { C.salio = true; emitir('superSalto'); cam.shake = 0.5; }
  } else if (!C.aterrizo) { C.aterrizo = true; player.pos.copy(S.finP); emitir('tocaSuelo', 12); player.land = 0.35; }

  if (t < T2) {
    // plano general sobre la losa de la salida, mirando la grieta
    camera.position.copy(puntoXZ(6.5, 8, 6.5));
    _m.copy(puntoXZ(0, 0, 4.5));
  } else if (t < T3) {
    // plano del árbol: Meowl en su rama, la cámara se acerca despacio
    const k = suave((t - T2) / (T3 - T2));
    const rama = meowlCine ? meowlCine.posRama : puntoXZ(0, -153.5, H_ARENA_JEFE + 9);
    camera.position.copy(puntoXZ(4.5 - k * 1.2, -141 - k * 2.5, H_ARENA_JEFE + 8.4));
    _m.copy(rama);
    if (meowlCine) meowlCine.mirarA = camera.position;
  } else {
    // el vuelo rápido hasta ti
    const k = Math.min(1, (t - T3) / (T4 - T3)), s = suave(k);
    camera.position.copy(C.curva.getPoint(s));
    _m.copy(C.mirar.getPoint(s));
    if (meowlCine) meowlCine.mirarA = null;
  }
  _u.copy(camera.position).normalize();
  camera.up.copy(_u);
  camera.lookAt(_m);
  if (t >= TFIN) terminarCine();
  return true;
}
function terminarCine() {
  C.activo = false; C.salio = false; C.aterrizo = false;
  player.pos.copy(C.salto.finP); player.state = 'normal'; player.vel.set(0, 0, 0);
  player.seguro.copy(player.pos);
  camaraAlInicio();
  const fin = C.fin; C.fin = null;
  if (fin) fin();
}
/** Botón "saltar" de las cinemáticas. */
export function saltarCineSuperficie() {
  if (!C.activo) return false;
  if (meowlCine) meowlCine.mirarA = null;
  terminarCine();
  return true;
}
