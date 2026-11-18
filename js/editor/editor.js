/* =========================================================
   editor.js · EDITOR DE PLANETAS (modo debug, pensado para PC)
   ---------------------------------------------------------
   Idea: armar los niveles nosotros mismos, con la física real.
   - Abajo, la PALETA de bloques (como cajas de herramientas).
   - A la derecha, el INSPECTOR: lo que tengas seleccionado.
   - Arriba: deshacer, abrir, exportar, PROBAR y salir.

   Mouse:  clic izquierdo = usar la herramienta
           clic derecho o rueda apretada (arrastrar) = girar la cámara
           rueda = zoom
   Teclas: 1…0 herramientas, N nota · Supr borrar · Ctrl+Z / Ctrl+Y
           F mirar lo seleccionado · P probar · Shift+P probar desde el mouse
           Esc salir de la prueba

   El nivel se guarda como un objeto simple (ver niveles/formato.js).
   Cada cambio lo convierte en la definición del juego y vuelve a
   construir el mundo con mundo.js: lo que ves es EXACTAMENTE lo
   que choca, porque son las mismas esferas de fisica.js.
   ========================================================= */
import { THREE, V3, clamp, damp } from '../util.js';
import { scene, camera, toon, outline, faceNormal, cartel } from '../escena.js';
import { juego, escuchar } from '../estado.js';
import { mundo, GM } from '../fisica.js';
import { construirMundo, nivelBase, animarMundo } from '../mundo.js';
import { spawnEnemies, updateEnemyVisuals } from '../enemigos.js';
import { player, respawnPlayer, updatePlayerVisuals } from '../jugador.js';
import { cargarNivel } from '../nivel.js';
import { mostrarHUD, toast } from '../ui.js';
import { icono } from '../iconos.js';
import { limpiarEntrada } from '../entrada.js';
import { CFG } from '../config.js';
import { BASES, TIPOS, nivelVacio, nivelDesdeEditor, editorDesdeNivel, leerNivelJSON, hexATexto } from '../niveles/formato.js';
import { NIVELES, LABORATORIO } from '../niveles/index.js';

const CLAVE = 'almaLunarEditor';
const $ = id => document.getElementById(id);
const arr = v => [v.x, v.y, v.z].map(n => +n.toFixed(4));
const r1 = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

/* ---------- estado del editor ---------- */
export const ed = {
  nivel: null,          // el nivel que se edita (formato del editor)
  def: null,            // ese nivel convertido para el juego
  herramienta: 'mano',
  opc: { clase: 'small', alto: 1.5, ancho: 4 },
  sel: null,            // { k: 'obj', i } o { k: 'planeta', i }
  foco: 0,              // planeta al que mira la cámara
  deshacer: [], rehacer: [],
  probando: false,
  sucio: false,         // hay que reconstruir el mundo en el próximo cuadro
  hover: null,          // lo que está bajo el mouse
  islaDe: [], rocaDe: [],   // sólido de la física → índice del objeto
};
let salirAlMenu = () => {};
const teclas = new Set();
export function conectarEditor(fn) { salirAlMenu = fn; }

/* ---------- herramientas (la paleta) ---------- */
const HERR = [
  { id: 'mano', ic: 'edMano', nom: 'Seleccionar y mover', grupo: 0 },
  { id: 'borrar', ic: 'edBorrar', nom: 'Borrar', grupo: 0 },
  { id: 'isla', ic: 'edTerreno', nom: 'Terreno: clic sube, Shift+clic baja, arrastra para pintar', grupo: 1 },
  { id: 'roca', ic: 'edRoca', nom: 'Roca', grupo: 1 },
  { id: 'enemigo', ic: 'edEnemigo', nom: 'Enemigo', grupo: 2 },
  { id: 'cartel', ic: 'leer', nom: 'Cartel', grupo: 3 },
  { id: 'boton', ic: 'edBoton', nom: 'Botón (baja los muros con un pisotón)', grupo: 3 },
  { id: 'muros', ic: 'edMuros', nom: 'Muros', grupo: 3 },
  { id: 'canon', ic: 'canon', nom: 'Cañón', grupo: 3 },
  { id: 'inicio', ic: 'edInicio', nom: 'Inicio del jugador', grupo: 4 },
  { id: 'flores', ic: 'edFlores', nom: 'Cama de flores', grupo: 4 },
  { id: 'fragmento', ic: 'edFragmento', nom: 'Fragmento lunar', grupo: 4 },
  { id: 'nota', ic: 'edNota', nom: 'Nota: un bloque que todavía no existe', grupo: 5 },
];
const CLASES = { small: 'Chico', medium: 'Mediano', large: 'Grande' };
const ICONOS_CARTEL = ['leer', 'mover', 'salto', 'dash', 'puno', 'pisoton', 'canon', 'super', 'luna', 'brillo'];

/* =========================================================
   CONSTRUIR EL MUNDO A PARTIR DEL NIVEL
   ========================================================= */
function reconstruir() {
  ed.sucio = false;
  ed.def = nivelDesdeEditor(ed.nivel);
  ed.def.editor = true;
  juego.nivel = ed.def;
  mundo.gravMul = 1;
  construirMundo(ed.def);
  spawnEnemies(ed.def.enemigos);
  respawnPlayer();                 // el protagonista se para en el inicio
  player.invul = 0;
  // qué objeto es cada esfera de la física (mismo orden que nivelDesdeEditor y construirMundo)
  ed.islaDe = []; ed.rocaDe = [];
  ed.nivel.objetos.forEach((o, i) => {
    if (o.planeta >= ed.nivel.planetas.length) return;
    if (o.tipo === 'isla') ed.islaDe.push(i);
    if (o.tipo === 'roca') ed.rocaDe.push(i);
  });
  dibujarAyudas();
  guardarLocal();
}
const pedir = () => { ed.sucio = true; };

function guardarLocal() {
  try { localStorage.setItem(CLAVE, JSON.stringify(ed.nivel)); } catch (e) { /* sin espacio */ }
}

/** Guarda una copia para Ctrl+Z (una por gesto: clic, arrastre o cambio en el inspector). */
function antes() {
  ed.deshacer.push(JSON.stringify(ed.nivel));
  if (ed.deshacer.length > 100) ed.deshacer.shift();
  ed.rehacer.length = 0;
}
function deshacer(volver = false) {
  const de = volver ? ed.rehacer : ed.deshacer, a = volver ? ed.deshacer : ed.rehacer;
  if (!de.length) return;
  a.push(JSON.stringify(ed.nivel));
  ed.nivel = JSON.parse(de.pop());
  if (ed.sel && !existeSel()) ed.sel = null;
  ed.foco = Math.min(ed.foco, ed.nivel.planetas.length - 1);
  reconstruir(); pintarPanel();
}
function existeSel() {
  return ed.sel.k === 'obj' ? ed.sel.i < ed.nivel.objetos.length : ed.sel.i < ed.nivel.planetas.length;
}

/* =========================================================
   AYUDAS VISUALES (solo del editor)
   notas, anillo de selección, meta y el cursor
   ========================================================= */
const ayudas = new THREE.Group();
const notasGrupo = new THREE.Group();
ayudas.add(notasGrupo);
const anilloSel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 48), new THREE.MeshBasicMaterial({ color: 0x7dffa8 }));
const anilloPlaneta = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: 0x7dffa8 }));
const cursor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.85, depthTest: false }));
cursor.renderOrder = 10;
const metaAro = new THREE.Mesh(new THREE.TorusGeometry(1, 0.015, 6, 120), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
let metaTexto = null;
ayudas.add(anilloSel, anilloPlaneta, cursor, metaAro);

/** Punto del suelo donde está parado un objeto. */
function anclaDe(o) {
  const P = mundo.planetas[o.planeta];
  if (!P) return null;
  const d = new V3(...o.dir).normalize();
  if (o.tipo === 'roca') return P.c.clone().addScaledVector(d, nivelBase(P) + o.h + o.R);
  if (o.tipo === 'nota') return P.c.clone().addScaledVector(d, Math.max(superficie(P, d), nivelBase(P)));   // flota sobre el mar
  return P.c.clone().addScaledVector(d, superficie(P, d));
}
/** Altura del suelo (igual que fisica.superficieEn, pero sin contar rocas flotando). */
function superficie(P, d) {
  let mejor = P.R;
  for (const s of mundo.solidos) {
    if (s !== P && s.planeta !== P) continue;
    const o = P.c.clone().sub(s.c), b = o.dot(d), c = o.lengthSq() - s.R * s.R, disc = b * b - c;
    if (disc < 0) continue;
    const t = -b + Math.sqrt(disc);
    if (t > mejor && t < P.R * 3) mejor = t;
  }
  return mejor;
}

function dibujarAyudas() {
  for (const c of [...notasGrupo.children]) {
    notasGrupo.remove(c);
    c.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map) x.material.map.dispose(); x.material.dispose(); } });
  }
  // NOTAS: un pilar rosado con la nota encima. En la prueba no chocan (son un "aquí va algo").
  ed.nivel.objetos.forEach(o => {
    if (o.tipo !== 'nota' || !mundo.planetas[o.planeta]) return;
    const pos = anclaDe(o), d = new V3(...o.dir).normalize(), t = o.tam || 2;
    const caja = new THREE.Mesh(new THREE.BoxGeometry(t, t, t),
      new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0.45, depthWrite: false }));
    caja.add(new THREE.LineSegments(new THREE.EdgesGeometry(caja.geometry), new THREE.LineBasicMaterial({ color: 0xff7ad9 })));
    caja.position.copy(pos).addScaledVector(d, t / 2);
    caja.quaternion.setFromUnitVectors(new V3(0, 1, 0), d);
    const txt = (o.texto || 'Nota vacía').slice(0, 60) + ((o.texto || '').length > 60 ? '…' : '');
    const s = cartel('NOTA\n' + partir(txt, 22), { ancho: 4.5, fondo: 'rgba(120,20,90,.78)' });
    s.position.copy(pos).addScaledVector(d, t + 1.6);
    notasGrupo.add(caja, s);
  });
  // META: un aro dorado alrededor del planeta donde hay que aterrizar
  if (metaTexto) { ayudas.remove(metaTexto); metaTexto.material.map.dispose(); metaTexto.material.dispose(); metaTexto = null; }
  const m = ed.def.meta && mundo.planetas[ed.def.meta.aterrizarEn];
  metaAro.visible = !!m;
  if (m) {
    const R = nivelBase(m) * 1.35 + 2;
    metaAro.position.copy(m.c); metaAro.scale.setScalar(R);
    metaTexto = cartel('META', { ancho: 3.2, fondo: 'rgba(90,60,0,.75)', color: '#ffd36b' });
    metaTexto.position.copy(m.c).add(new V3(0, R + 1.5, 0));
    ayudas.add(metaTexto);
  }
}
function partir(t, n) {
  const pal = t.split(/\s+/), lin = [];
  let l = '';
  for (const p of pal) { if ((l + ' ' + p).trim().length > n) { lin.push(l); l = p; } else l = (l + ' ' + p).trim(); }
  if (l) lin.push(l);
  return lin.slice(0, 3).join('\n');
}

function actualizarAyudas(t) {
  // anillo de selección
  anilloSel.visible = anilloPlaneta.visible = false;
  if (ed.sel && !ed.probando) {
    if (ed.sel.k === 'obj') {
      const o = ed.nivel.objetos[ed.sel.i], a = o && anclaDe(o);
      if (a) {
        const d = new V3(...o.dir).normalize();
        anilloSel.visible = true;
        anilloSel.position.copy(a).addScaledVector(d, 0.12);
        faceNormal(anilloSel, d);
        anilloSel.scale.setScalar(o.tipo === 'isla' ? Math.max(1, o.ancho * 0.6) : o.tipo === 'roca' ? o.R + 0.4 : o.tipo === 'muros' ? o.lado + 0.8 : 1.3 + Math.sin(t * 5) * 0.08);
      }
    } else {
      const P = mundo.planetas[ed.sel.i];
      if (P) {
        anilloPlaneta.visible = true;
        anilloPlaneta.position.copy(P.c);
        anilloPlaneta.scale.setScalar(nivelBase(P) + 1.2);
        anilloPlaneta.quaternion.copy(camera.quaternion);      // siempre de frente a la cámara
      }
    }
  }
  metaAro.rotation.set(1.1, t * 0.3, 0.4);
  // cursor: un aro sobre el suelo bajo el mouse
  const h = ed.hover;
  cursor.visible = !!(h && h.punto && !ed.probando && ed.herramienta !== 'mano');
  if (cursor.visible) {
    cursor.position.copy(h.punto).addScaledVector(h.dir, 0.08);
    faceNormal(cursor, h.dir);
    cursor.scale.setScalar(ed.herramienta === 'isla' ? ed.opc.ancho * 0.6 : 1);
    cursor.material.color.setHex(ed.herramienta === 'borrar' || (ed.herramienta === 'isla' && h.shift) ? 0xff6b6b : 0x9fe8ff);
  }
}

/* =========================================================
   CÁMARA: gira alrededor del planeta enfocado
   ========================================================= */
const orb = { yaw: 0.7, pitch: 0.55, dist: 70, distQ: 70, centro: new V3() };
function enfocar(i, cerca = false) {
  ed.foco = i;
  const p = ed.nivel.planetas[i];
  orb.distQ = clamp((p.mar || p.R) * (cerca ? 1.9 : 2.6) + 12, 12, 600);
}
function actualizarCamara(dt) {
  const p = ed.nivel.planetas[ed.foco] || ed.nivel.planetas[0];
  orb.centro.lerp(new V3(...p.c), damp(6, dt));
  orb.dist += (orb.distQ - orb.dist) * damp(8, dt);
  const cp = Math.cos(orb.pitch);
  camera.position.set(Math.sin(orb.yaw) * cp, Math.sin(orb.pitch), Math.cos(orb.yaw) * cp).multiplyScalar(orb.dist).add(orb.centro);
  camera.up.set(0, 1, 0);
  camera.lookAt(orb.centro);
}

/* =========================================================
   RAYO DEL MOUSE: ¿qué toca en el mundo?
   Intersección rayo–esfera: |o + t·d − c|² = R²  →  t² + 2b·t + k = 0
   con b = (o − c)·d y k = |o − c|² − R². Nos quedamos con el t más chico > 0.
   ========================================================= */
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function rayo(ev, soloBase = false) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  let mejor = Infinity, planeta = -1, solido = null;
  const probar = (c, R, i, s) => {
    const oc = o.clone().sub(c), b = oc.dot(d), k = oc.lengthSq() - R * R, disc = b * b - k;
    if (disc < 0) return;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < mejor) { mejor = t; planeta = i; solido = s; }
  };
  mundo.planetas.forEach((P, i) => { probar(P.c, P.R, i, P); if (P.mar) probar(P.c, P.mar, i, null); });
  if (!soloBase) for (const s of mundo.rocas) probar(s.c, s.R, mundo.planetas.indexOf(s.planeta), s);
  if (planeta < 0) return null;
  const punto = o.clone().addScaledVector(d, mejor), P = mundo.planetas[planeta];
  const dir = punto.clone().sub(P.c).normalize();
  let objeto = -1;                       // si tocó una isla o roca, qué objeto es
  const k = mundo.rocas.indexOf(solido);
  if (k >= 0) objeto = k < ed.islaDe.length ? ed.islaDe[k] : ed.rocaDe[k - ed.islaDe.length];
  return { punto, dir, planeta, objeto, alto: punto.distanceTo(P.c) - nivelBase(P), shift: ev.shiftKey };
}

/** Objeto "chico" (no isla ni roca) cerca del mouse en la pantalla, a menos de 24 px. */
function objetoCerca(ev) {
  let mejor = 24, idx = -1;
  const v = new V3();
  ed.nivel.objetos.forEach((o, i) => {
    if (o.tipo === 'isla' || o.tipo === 'roca') return;
    const a = anclaDe(o); if (!a) return;
    const P = mundo.planetas[o.planeta];
    if (a.clone().sub(P.c).dot(camera.position.clone().sub(a)) < 0) return;   // está del otro lado del planeta
    v.copy(a).addScaledVector(new V3(...o.dir).normalize(), o.tipo === 'nota' ? (o.tam || 2) / 2 : 0.6).project(camera);
    const dx = (v.x + 1) / 2 * innerWidth - ev.clientX, dy = (1 - v.y) / 2 * innerHeight - ev.clientY;
    const dd = Math.hypot(dx, dy);
    if (dd < mejor) { mejor = dd; idx = i; }
  });
  return idx;
}

/* =========================================================
   EDITAR
   ========================================================= */
function nuevoObjeto(tipo, h) {
  const T = TIPOS[tipo];
  const o = { tipo, planeta: h.planeta, dir: arr(h.dir), ...structuredClone(T.props) };
  if (tipo === 'enemigo') o.clase = ed.opc.clase;
  if (tipo === 'isla') { o.alto = ed.opc.alto; o.ancho = ed.opc.ancho; }
  if (tipo === 'roca') o.h = +(Math.max(0, h.alto) + o.R * 0.6).toFixed(2);   // el centro queda un poco sobre lo que tocaste
  if (T.unico) {
    const i = ed.nivel.objetos.findIndex(x => x.tipo === tipo);
    if (i >= 0) { Object.assign(ed.nivel.objetos[i], { planeta: o.planeta, dir: o.dir }); return i; }
  }
  ed.nivel.objetos.push(o);
  return ed.nivel.objetos.length - 1;
}

function borrarObjeto(i) {
  const o = ed.nivel.objetos[i];
  if (!o) return;
  if (o.tipo === 'inicio') { toast('El inicio no se borra<small>Muévelo con la mano o pon otro</small>', 1800); return; }
  antes();
  ed.nivel.objetos.splice(i, 1);
  if (ed.sel && ed.sel.k === 'obj') ed.sel = ed.sel.i === i ? null : ed.sel.i > i ? { k: 'obj', i: ed.sel.i - 1 } : ed.sel;
  reconstruir(); pintarPanel();
}

function agregarPlaneta() {
  antes();
  const n = ed.nivel.planetas.length, P0 = ed.nivel.planetas[ed.foco];
  const der = new V3().setFromMatrixColumn(camera.matrixWorld, 0);   // "derecha" de la cámara
  const R = 10, c = new V3(...P0.c).addScaledVector(der, (P0.mar || P0.R) + R + 30);
  const base = ['roca', 'tierra', 'arena', 'hielo'][n % 4];
  ed.nivel.planetas.push({ name: `Planeta ${n + 1}`, c: arr(c).map(x => +x.toFixed(1)), R, g: 30, base, color: hexATexto(BASES[base].color), seed: 7 + n * 31 });
  ed.sel = { k: 'planeta', i: n };
  enfocar(n);
  reconstruir(); pintarPanel();
}

function borrarPlaneta(i) {
  if (ed.nivel.planetas.length < 2) { toast('Tiene que quedar al menos un planeta', 1600); return; }
  antes();
  const N = ed.nivel;
  N.planetas.splice(i, 1);
  N.objetos = N.objetos.filter(o => o.planeta !== i);
  for (const o of N.objetos) if (o.planeta > i) o.planeta--;
  if (!N.objetos.some(o => o.tipo === 'inicio')) N.objetos.push({ tipo: 'inicio', planeta: 0, dir: [0, 1, 0] });
  if (N.meta) { if (N.meta.aterrizarEn === i) N.meta = null; else if (N.meta.aterrizarEn > i) N.meta.aterrizarEn--; }
  ed.sel = null; enfocar(0);
  reconstruir(); pintarPanel();
}

/* ---- el mouse sobre el mundo ---- */
let gesto = null;       // lo que hace el botón izquierdo mientras está apretado
let orbitando = null;

function alApretar(ev) {
  if (ed.probando) return;
  lienzo.setPointerCapture(ev.pointerId);
  if (ev.button === 2 || ev.button === 1 || (ev.button === 0 && ev.altKey)) {
    orbitando = { x: ev.clientX, y: ev.clientY }; return;
  }
  if (ev.button !== 0) return;
  const h = rayo(ev), herr = ed.herramienta;

  if (herr === 'mano') {
    let i = objetoCerca(ev);
    if (i < 0 && h) i = h.objeto;
    if (i >= 0) { ed.sel = { k: 'obj', i }; gesto = { tipo: 'mover', i, movido: false }; }
    else if (h) { ed.sel = { k: 'planeta', i: h.planeta }; if (h.planeta !== ed.foco) enfocar(h.planeta); }
    else ed.sel = null;
    pintarPanel(); return;
  }
  if (herr === 'borrar') {
    let i = objetoCerca(ev);
    if (i < 0 && h) i = h.objeto;
    if (i >= 0) borrarObjeto(i);
    gesto = { tipo: 'borrar' };
    return;
  }
  if (!h) return;
  if (herr === 'isla') {
    antes();
    const i = h.objeto >= 0 && ed.nivel.objetos[h.objeto].tipo === 'isla' ? h.objeto : -1;
    if (h.shift) { if (i >= 0) subir(i, -0.5); gesto = { tipo: 'terreno', i, bajar: true, t: 0.18 }; return; }
    const j = i >= 0 ? (subir(i, 0.5), i) : nuevoObjeto('isla', h);
    ed.sel = { k: 'obj', i: j };
    gesto = { tipo: 'terreno', i: j, t: 0.25 };
    pedir(); pintarPanel(); return;
  }
  // los demás bloques: se ponen donde hiciste clic y puedes arrastrarlos antes de soltar
  antes();
  const i = nuevoObjeto(herr, h);
  ed.sel = { k: 'obj', i };
  gesto = { tipo: 'mover', i, movido: true, yaGuardado: true };
  pedir(); pintarPanel();
}

/** Sube (o baja) una colina. Si queda muy baja, desaparece. */
function subir(i, cuanto) {
  const o = ed.nivel.objetos[i];
  o.alto = +clamp(o.alto + cuanto, 0, 60).toFixed(2);
  if (o.alto < 0.2) { ed.nivel.objetos.splice(i, 1); ed.sel = null; gesto = null; }
  pedir();
}

function alMover(ev) {
  if (orbitando) {
    orb.yaw -= (ev.clientX - orbitando.x) * 0.006;
    orb.pitch = clamp(orb.pitch + (ev.clientY - orbitando.y) * 0.006, -1.5, 1.5);
    orbitando = { x: ev.clientX, y: ev.clientY };
    return;
  }
  const g = gesto;
  if (g && g.tipo === 'mover') {
    const o = ed.nivel.objetos[g.i];
    // las islas y rocas se arrastran sobre el suelo base (si no, el rayo chocaría con ellas mismas)
    const h = rayo(ev, o.tipo === 'isla' || o.tipo === 'roca');
    if (!h) return;
    if (!g.yaGuardado) { antes(); g.yaGuardado = true; }
    g.movido = true;
    o.planeta = h.planeta; o.dir = arr(h.dir);
    pedir();
  }
  if (g && g.tipo === 'borrar') {
    let i = objetoCerca(ev); const h = rayo(ev);
    if (i < 0 && h) i = h.objeto;
    if (i >= 0) borrarObjeto(i);
  }
  if (g && g.tipo === 'terreno' && !g.bajar) {
    // pintar: si el mouse se aleja de la colina actual, nace otra (sirve para cordilleras)
    const h = rayo(ev, true), o = ed.nivel.objetos[g.i];
    if (h && o) {
      const P = mundo.planetas[o.planeta];
      const lejos = h.planeta !== o.planeta || Math.acos(clamp(h.dir.dot(new V3(...o.dir).normalize()), -1, 1)) * nivelBase(P) > o.ancho * 0.9;
      if (lejos) { g.i = nuevoObjeto('isla', h); ed.sel = { k: 'obj', i: g.i }; g.t = 0.25; pedir(); }
    }
  }
  ed.hover = rayo(ev);
  estado(ev);
}

function alSoltar(ev) {
  if (orbitando) { orbitando = null; return; }
  if (gesto && gesto.tipo !== 'borrar') pintarPanel();
  gesto = null;
}

/** Mantener apretado el terreno: sigue subiendo (o bajando). */
function pasoGesto(dt) {
  const g = gesto;
  if (!g || g.tipo !== 'terreno' || g.i < 0) return;
  g.t -= dt;
  if (g.t > 0) return;
  g.t = 0.12;
  subir(g.i, g.bajar ? -0.4 : 0.4);
  if (gesto) actualizarCamposVivos();
}

/* ---- línea de estado (abajo): física de lo que hay bajo el mouse ---- */
function estado() {
  const h = ed.hover, el = $('edEstado');
  const herr = HERR.find(x => x.id === ed.herramienta);
  if (!h) { el.innerHTML = `<b>${herr.nom}</b>`; return; }
  const P = mundo.planetas[h.planeta];
  const r = h.punto.distanceTo(P.c), g = GM(P) / (r * r);
  let s = `<b>${herr.nom}</b> · ${P.name} · altura ${r1(h.alto)} m · g = ${r1(g)} m/s²`;
  // distancia por la superficie hasta lo seleccionado (para medir huecos)
  const o = ed.sel && ed.sel.k === 'obj' && ed.nivel.objetos[ed.sel.i];
  if (o && o.planeta === h.planeta) {
    const ang = Math.acos(clamp(h.dir.dot(new V3(...o.dir).normalize()), -1, 1));
    const dist = ang * nivelBase(P);
    s += ` · ${r1(dist)} m hasta lo seleccionado`;
    const otra = h.objeto >= 0 && ed.nivel.objetos[h.objeto];
    if (o.tipo === 'isla' && otra && otra.tipo === 'isla' && otra !== o) s += ` · hueco borde a borde ${r1(Math.max(0, dist - o.ancho - otra.ancho))} m`;
  }
  el.innerHTML = s;
}

/* =========================================================
   PROBAR (con la física de verdad) y volver
   ========================================================= */
function probar(desdeMouse = false) {
  if (ed.probando) return;
  const def = nivelDesdeEditor(ed.nivel);
  def.editor = true;
  if (desdeMouse && ed.hover) {
    const d = ed.hover.dir;
    def.inicio = { planeta: ed.hover.planeta, dir: d.clone(), mirar: Math.abs(d.y) < 0.95 ? new V3(0, 1, 0) : new V3(0, 0, -1) };
  }
  // aviso: en un planeta de agua o lava, el suelo está bajo el mar (hay que poner una isla)
  const Pi = def.planetas[def.inicio.planeta];
  const bajoMar = Pi.mar && !ed.nivel.objetos.some(o => o.tipo === 'isla' && o.planeta === def.inicio.planeta &&
    new V3(...o.dir).normalize().angleTo(def.inicio.dir) * Pi.mar < o.ancho);
  ed.probando = true;
  ed.hover = null;
  anilloSel.visible = anilloPlaneta.visible = cursor.visible = false;
  $('editor').classList.add('probando');
  limpiarEntrada();
  cargarNivel(def);
  juego.modo = 'juego';
  mostrarHUD(true);
  toast(bajoMar ? 'El inicio está bajo el mar<small>Ponle una isla debajo con la herramienta Terreno</small>'
    : 'Probando<small>Esc o el botón de arriba para volver al editor</small>', bajoMar ? 3500 : 2200);
}
export function volverAlEditor() {
  if (!ed.probando) return;
  ed.probando = false;
  $('editor').classList.remove('probando');
  $('cartelDlg').classList.add('oculto');
  juego.modo = 'editor';
  mostrarHUD(false);
  limpiarEntrada();
  reconstruir();
}
escuchar('completo', ({ def }) => {
  if (def.editor) toast('¡Llegaste a la meta!<small>En el juego aquí termina el nivel</small>', 3000);
});

/* =========================================================
   EXPORTAR / IMPORTAR
   ========================================================= */
/** JSON con sangría, pero con los vectores en una línea: [x, y, z]. */
export function textoDelNivel() {
  return JSON.stringify(ed.nivel, null, 2).replace(/\[\s+([-\d.e,\s]+?)\s+\]/g, (m, g) => '[' + g.trim().split(/\s*,\s*/).join(', ') + ']');
}
function nombreArchivo() {
  const s = (ed.nivel.nombre || 'nivel').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (s || 'nivel') + '.json';
}
function exportar() {
  const blob = new Blob([textoDelNivel()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombreArchivo();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Descargado ${nombreArchivo()}<small>Mándaselo a Claude y lo deja en el juego</small>`, 2600);
}
async function copiar() {
  const t = textoDelNivel();
  try { await navigator.clipboard.writeText(t); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast('Nivel copiado<small>Pégalo en el chat tal cual</small>', 2000);
}
function cargar(n, aviso) {
  antes();
  ed.nivel = n; ed.sel = null;
  enfocar(0);
  reconstruir(); pintarPanel(); pintarArriba();
  if (aviso) toast(aviso, 1800);
}
function importarTexto(texto) {
  try { cargar(leerNivelJSON(texto), 'Nivel abierto'); }
  catch (e) { toast('No se pudo abrir<small>' + e.message + '</small>', 3000); }
}

/* =========================================================
   INTERFAZ (se crea desde aquí para no llenar index.html)
   ========================================================= */
const raiz = document.createElement('div');
raiz.id = 'editor';
raiz.className = 'oculto';
raiz.innerHTML = `
  <div id="edLienzo"></div>
  <header id="edArriba">
    <input id="edNombre" maxlength="40" title="Nombre del nivel" autocomplete="off">
    <div class="edGrupo">
      <button class="edB" id="edDeshacer" title="Deshacer (Ctrl+Z)">${icono('edDeshacer', 2)}</button>
      <button class="edB" id="edRehacer" title="Rehacer (Ctrl+Y)">${icono('edRehacer', 2)}</button>
    </div>
    <div class="edGrupo">
      <button class="edB" id="edAbrir" title="Nuevo o abrir un nivel">${icono('edNuevo', 2)}</button>
      <button class="edB" id="edImportar" title="Abrir un archivo .json">${icono('edImportar', 2)}</button>
      <button class="edB" id="edExportar" title="Descargar nivel.json">${icono('edExportar', 2)}</button>
      <button class="edB" id="edCopiar" title="Copiar el nivel (para pegarlo en el chat)">${icono('edCopiar', 2)}</button>
    </div>
    <button class="edB grande" id="edProbar" title="Probar (P) · Shift: desde donde está el mouse">${icono('edProbar', 2)}</button>
    <button class="edB" id="edSalir" title="Volver al menú">${icono('edSalir', 2)}</button>
    <div id="edMenuAbrir" class="oculto">
      <button data-abrir="vacio">Nivel vacío</button>
      <button data-abrir="columba">Columba (nivel 1)</button>
      <button data-abrir="lab">Laboratorio</button>
    </div>
  </header>
  <aside id="edPanel"></aside>
  <div id="edAbajo">
    <div id="edOpciones"></div>
    <nav id="edPaleta"></nav>
    <div id="edEstado"></div>
  </div>
  <input type="file" id="edArchivo" accept=".json,application/json" hidden>
`;
document.body.appendChild(raiz);
const volverBtn = document.createElement('button');
volverBtn.id = 'edVolver'; volverBtn.className = 'tb'; volverBtn.title = 'Volver al editor (Esc)';
volverBtn.innerHTML = icono('edEditor', 2);
document.body.appendChild(volverBtn);
volverBtn.onclick = volverAlEditor;

const lienzo = $('edLienzo');
lienzo.addEventListener('pointerdown', alApretar);
lienzo.addEventListener('pointermove', alMover);
lienzo.addEventListener('pointerup', alSoltar);
lienzo.addEventListener('pointercancel', alSoltar);
lienzo.addEventListener('pointerleave', () => { ed.hover = null; });
lienzo.addEventListener('wheel', ev => { ev.preventDefault(); orb.distQ = clamp(orb.distQ * Math.exp(ev.deltaY * 0.0012), 6, 800); }, { passive: false });

$('edDeshacer').onclick = () => deshacer();
$('edRehacer').onclick = () => deshacer(true);
$('edExportar').onclick = exportar;
$('edCopiar').onclick = copiar;
$('edImportar').onclick = () => $('edArchivo').click();
$('edArchivo').onchange = async e => { const f = e.target.files[0]; if (f) importarTexto(await f.text()); e.target.value = ''; };
$('edProbar').onclick = e => probar(e.shiftKey);
$('edSalir').onclick = () => cerrarEditor();
$('edAbrir').onclick = () => $('edMenuAbrir').classList.toggle('oculto');
$('edMenuAbrir').onclick = e => {
  const k = e.target.dataset.abrir; if (!k) return;
  $('edMenuAbrir').classList.add('oculto');
  if (k === 'vacio') cargar(nivelVacio(), 'Nivel vacío');
  if (k === 'columba') cargar(editorDesdeNivel(NIVELES[0]), 'Columba abierto (es una copia: el nivel 1 no cambia)');
  if (k === 'lab') cargar(editorDesdeNivel(LABORATORIO), 'Laboratorio abierto (sin los anillos)');
};
$('edNombre').addEventListener('input', e => { ed.nivel.nombre = e.target.value; guardarLocal(); });
// arrastrar un .json encima de la ventana también lo abre
addEventListener('dragover', e => { if (juego.modo === 'editor') e.preventDefault(); });
addEventListener('drop', async e => {
  if (juego.modo !== 'editor') return;
  e.preventDefault();
  const f = e.dataTransfer.files[0]; if (f) importarTexto(await f.text());
});

function pintarArriba() { $('edNombre').value = ed.nivel.nombre || ''; }

/* ---- paleta y opciones de la herramienta ---- */
function pintarPaleta() {
  let html = '', grupo = -1;
  HERR.forEach((h, n) => {
    if (h.grupo !== grupo && grupo >= 0) html += '<span class="edSep"></span>';
    grupo = h.grupo;
    html += `<button class="edT ${h.id === ed.herramienta ? 'on' : ''} ${h.id === 'nota' ? 'nota' : ''}" data-h="${h.id}" title="${h.nom}">
      ${icono(h.ic, 2)}<small>${n < 10 ? (n + 1) % 10 : h.id === 'nota' ? 'N' : ''}</small></button>`;
  });
  $('edPaleta').innerHTML = html;
  pintarOpciones();
}
$('edPaleta').onclick = e => { const b = e.target.closest('[data-h]'); if (b) elegir(b.dataset.h); };
function elegir(id) { ed.herramienta = id; pintarPaleta(); estado(); }

function pintarOpciones() {
  const el = $('edOpciones'), h = ed.herramienta;
  if (h === 'enemigo') {
    el.innerHTML = Object.entries(CLASES).map(([k, n]) => `<button class="edChip ${ed.opc.clase === k ? 'on' : ''}" data-clase="${k}">${n}</button>`).join('');
  } else if (h === 'isla') {
    el.innerHTML = deslizador('opcAlto', 'Alto al crear', ed.opc.alto, 0.5, 20, 0.5, 'm') + deslizador('opcAncho', 'Ancho', ed.opc.ancho, 1, 25, 0.5, 'm');
  } else el.innerHTML = '';
  el.classList.toggle('oculto', !el.innerHTML);
}
$('edOpciones').addEventListener('click', e => { const b = e.target.closest('[data-clase]'); if (b) { ed.opc.clase = b.dataset.clase; pintarOpciones(); } });
$('edOpciones').addEventListener('input', e => {
  if (e.target.id === 'opcAlto') ed.opc.alto = +e.target.value;
  if (e.target.id === 'opcAncho') ed.opc.ancho = +e.target.value;
  e.target.nextElementSibling.textContent = r1(+e.target.value) + ' m';
});

/* ---- inspector ---- */
function deslizador(id, nombre, v, min, max, paso, u = '') {
  return `<label class="edCampo"><span>${nombre}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${paso}" value="${v}"><output>${r1(v)} ${u}</output></label>`;
}
const salto = P => CFG.jump * CFG.jump / (2 * GM(P) / (nivelBase(P) ** 2));   // h = v²/2g

function pintarPanel() {
  const N = ed.nivel, el = $('edPanel');
  let h = `<h3>Planetas</h3><div class="edPlanetas">`;
  N.planetas.forEach((p, i) => {
    const on = ed.sel && ed.sel.k === 'planeta' && ed.sel.i === i;
    h += `<button class="edChip ${on ? 'on' : ''}" data-planeta="${i}"><i style="background:${p.color}"></i>${esc(p.name)}</button>`;
  });
  h += `<button class="edChip" id="edMasPlaneta" title="Agregar planeta">${icono('edPlanetaMas', 2)}</button></div>`;

  const s = ed.sel;
  if (s && s.k === 'planeta') h += panelPlaneta(s.i);
  else if (s && s.k === 'obj') h += panelObjeto(s.i);
  else {
    const cuenta = {};
    for (const o of N.objetos) cuenta[o.tipo] = (cuenta[o.tipo] || 0) + 1;
    h += `<h3>Nivel</h3>
      <label class="edCampo col"><span>Ley física</span><input id="fLey" value="${esc(N.ley || '')}"></label>
      <label class="edCheck"><input type="checkbox" id="fSuper" ${N.superDesdeInicio ? 'checked' : ''}> Súper salto desde el inicio</label>
      <p class="edNota">${Object.entries(cuenta).map(([k, n]) => `${TIPOS[k] ? TIPOS[k].nombre : k}: ${n}`).join(' · ') || 'Sin objetos'}</p>
      <p class="edAyuda">Toca un planeta con la mano para editarlo. Clic derecho y arrastrar gira la cámara; la rueda hace zoom.</p>`;
  }
  el.innerHTML = h;
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function panelPlaneta(i) {
  const p = ed.nivel.planetas[i], B = BASES[p.base] || BASES.tierra, P = mundo.planetas[i];
  const R = p.R, g = p.g;
  const esMeta = ed.nivel.meta && ed.nivel.meta.aterrizarEn === i;
  return `<h3>${esc(p.name)}</h3>
    <label class="edCampo col"><span>Nombre</span><input id="pNom" value="${esc(p.name)}"></label>
    <div class="edCampo col"><span>Base</span><div class="edBases">${Object.entries(BASES).map(([k, b]) =>
      `<button class="edChip ${p.base === k ? 'on' : ''}" data-base="${k}"><i style="background:${hexATexto(b.mar ? b.colorMar : b.color)}"></i>${b.nombre}</button>`).join('')}</div></div>
    <label class="edCampo"><span>Color${B.mar ? ' del fondo' : ''}</span><input type="color" id="pColor" value="${p.color}"></label>
    ${B.mar ? `<label class="edCampo"><span>Color del ${p.base === 'lava' ? 'magma' : 'mar'}</span><input type="color" id="pColorMar" value="${p.colorMar || hexATexto(B.colorMar)}"></label>
      ${deslizador('pMar', 'Profundidad', +((p.mar || R + 2) - R).toFixed(1), 0.5, 8, 0.1, 'm')}` : ''}
    ${deslizador('pR', 'Radio R', R, 3, 80, 0.5, 'm')}
    ${deslizador('pG', 'Gravedad g', g, 3, 60, 0.5, 'm/s²')}
    <div class="edCampo col"><span>Posición del centro (x, y, z)</span><div class="edXYZ">
      ${p.c.map((v, k) => `<input type="number" step="1" data-xyz="${k}" value="${+v.toFixed(1)}">`).join('')}</div></div>
    <label class="edCheck"><input type="checkbox" id="pMeta" ${esMeta ? 'checked' : ''}> Meta: aterrizar aquí termina el nivel</label>
    <div class="edFisica" id="edFisica">${fisicaPlaneta(i)}</div>
    <div class="edFila"><button class="edB" id="pFoco" title="Mirar este planeta (F)">${icono('edFoco', 2)}</button>
    <button class="edB peligro" id="pBorrar" title="Borrar planeta">${icono('edBorrar', 2)}</button></div>`;
}
function fisicaPlaneta(i) {
  const P = mundo.planetas[i]; if (!P) return '';
  const r = nivelBase(P), gm = GM(P), gs = gm / (r * r);
  return `<b>Física</b><br>G·M = g·R² = ${r1(gm)} m³/s²<br>g en el suelo = G·M/r² = ${r1(gs)} m/s²<br>
    v<sub>esc</sub> = √(2·G·M/r) = ${r1(Math.sqrt(2 * gm / r))} m/s<br>salto máximo = v²/2g = ${r1(salto(P))} m`;
}

function panelObjeto(i) {
  const o = ed.nivel.objetos[i], T = TIPOS[o.tipo], P = mundo.planetas[o.planeta];
  let h = `<h3>${T.nombre}</h3><p class="edNota">En ${esc(ed.nivel.planetas[o.planeta].name)}</p>`;
  if (o.tipo === 'isla') {
    h += deslizador('oAlto', 'Alto (sobre el suelo)', o.alto, 0.2, 40, 0.1, 'm') + deslizador('oAncho', 'Ancho (radio)', o.ancho, 1, 30, 0.1, 'm');
    h += `<p class="edFisica" id="edFisica">${fisicaAltura(o.alto, P)}</p>`;
  }
  if (o.tipo === 'roca') h += deslizador('oR', 'Radio', o.R, 0.4, 10, 0.1, 'm') + deslizador('oH', 'Altura del centro', o.h, -2, 40, 0.1, 'm');
  if (o.tipo === 'enemigo') h += `<div class="edCampo col"><span>Tamaño</span><div>${Object.entries(CLASES).map(([k, n]) => `<button class="edChip ${o.clase === k ? 'on' : ''}" data-oclase="${k}">${n}</button>`).join('')}</div></div>`;
  if (o.tipo === 'cartel') {
    h += `<div class="edCampo col"><span>Dibujo de la tabla</span><div class="edIconos">${ICONOS_CARTEL.map(k => `<button class="edChip ${o.icono === k ? 'on' : ''}" data-oicono="${k}" title="${k}">${icono(k, 2)}</button>`).join('')}</div></div>
      <label class="edCampo col"><span>Lo que dice (una línea en blanco separa las páginas)</span><textarea id="oPaginas" rows="7">${esc((o.paginas || []).join('\n\n'))}</textarea></label>`;
  }
  if (o.tipo === 'muros') {
    h += deslizador('oLado', 'Distancia al centro', o.lado, 1, 12, 0.1, 'm') + deslizador('oMAlto', 'Alto', o.alto, 0.5, 15, 0.1, 'm') + deslizador('oGrosor', 'Grosor', o.grosor, 0.2, 3, 0.1, 'm');
    h += `<p class="edFisica" id="edFisica">${fisicaAltura(o.alto, P)}</p><p class="edAyuda">Un pisotón sobre el Botón los baja.</p>`;
  }
  if (o.tipo === 'fragmento') h += deslizador('oFH', 'Altura', o.h, 0.5, 15, 0.1, 'm');
  if (o.tipo === 'nota') {
    h += `<label class="edCampo col"><span>¿Qué bloque quieres aquí?</span><textarea id="oTexto" rows="7" placeholder="Ej: un trampolín que te lance el doble de alto, o una plataforma que se mueve en órbita">${esc(o.texto || '')}</textarea></label>
      ${deslizador('oTam', 'Tamaño', o.tam || 2, 0.5, 10, 0.5, 'm')}
      <p class="edAyuda">Las notas son un "aquí va algo". En la prueba no chocan. Exporta el nivel y Claude convierte cada nota en un bloque de verdad.</p>`;
  }
  if (o.tipo === 'boton') h += `<p class="edAyuda">Un pisotón encima baja los Muros.</p>`;
  if (o.tipo === 'canon') h += `<p class="edAyuda">Súbete y mantén L para cargar. La barra marca v<sub>esc</sub> de este planeta.</p>`;
  h += `<div class="edFila"><button class="edB" id="oFoco" title="Mirar (F)">${icono('edFoco', 2)}</button>
    ${o.tipo !== 'inicio' ? `<button class="edB peligro" id="oBorrar" title="Borrar (Supr)">${icono('edBorrar', 2)}</button>` : ''}</div>`;
  return h;
}
function fisicaAltura(alto, P) {
  if (!P) return '';
  const hs = salto(P);
  return `Salto máximo aquí: v²/2g = ${r1(hs)} m<br>${alto <= hs - 0.3 ? 'Se sube saltando.' : alto <= hs + 0.4 ? 'Justo al límite del salto.' : 'Más alto que un salto: pide otra mecánica.'}`;
}

/** Al mover un deslizador del inspector, solo se actualizan los textos (no se rehace el panel). */
function actualizarCamposVivos() {
  const s = ed.sel; if (!s) return;
  if (s.k === 'obj') {
    const o = ed.nivel.objetos[s.i]; if (!o) return;
    const a = $('oAlto'); if (a && o.tipo === 'isla') { a.value = o.alto; a.nextElementSibling.textContent = r1(o.alto) + ' m'; }
    const f = $('edFisica'); if (f && (o.tipo === 'isla' || o.tipo === 'muros')) f.innerHTML = fisicaAltura(o.alto, mundo.planetas[o.planeta]);
  } else {
    const f = $('edFisica'); if (f) f.innerHTML = fisicaPlaneta(s.i);
  }
}

// un solo "antes()" por gesto en el inspector: al empezar a tocar un campo
$('edPanel').addEventListener('focusin', e => { if (e.target.matches('input, textarea')) antes(); });
$('edPanel').addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) antes(); });

$('edPanel').addEventListener('input', e => {
  const t = e.target, v = +t.value, s = ed.sel; if (!s) return;
  if (t.type === 'range' && t.nextElementSibling) t.nextElementSibling.textContent = r1(v) + ' ' + (t.nextElementSibling.textContent.split(' ')[1] || '');
  if (s.k === 'planeta') {
    const p = ed.nivel.planetas[s.i];
    if (t.id === 'pNom') { p.name = t.value; guardarLocal(); return; }
    if (t.id === 'pColor') p.color = t.value;
    if (t.id === 'pColorMar') p.colorMar = t.value;
    if (t.id === 'pR') { const prof = (p.mar || p.R + 2) - p.R; p.R = v; if (p.mar) p.mar = +(v + prof).toFixed(2); }
    if (t.id === 'pMar') p.mar = +(p.R + v).toFixed(2);
    if (t.id === 'pG') p.g = v;
    if (t.dataset.xyz) p.c[+t.dataset.xyz] = v;
  } else {
    const o = ed.nivel.objetos[s.i];
    const campos = { oAlto: 'alto', oAncho: 'ancho', oR: 'R', oLado: 'lado', oMAlto: 'alto', oGrosor: 'grosor', oFH: 'h', oTam: 'tam' };
    if (campos[t.id]) o[campos[t.id]] = v;
    if (t.id === 'oH') o.h = v;
    if (t.id === 'oPaginas') { o.paginas = t.value.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean); guardarLocal(); return; }
    if (t.id === 'oTexto') o.texto = t.value;
  }
  pedir();
  requestAnimationFrame(actualizarCamposVivos);
});
$('edPanel').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'pMeta') { antes(); ed.nivel.meta = t.checked ? { aterrizarEn: ed.sel.i } : null; pedir(); }
  if (t.id === 'fSuper') { antes(); ed.nivel.superDesdeInicio = t.checked; guardarLocal(); }
  if (t.id === 'fLey') { ed.nivel.ley = t.value; guardarLocal(); }
  if (t.id === 'pNom') pintarPanel();
});
$('edPanel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const s = ed.sel;
  if (b.dataset.planeta) { ed.sel = { k: 'planeta', i: +b.dataset.planeta }; enfocar(+b.dataset.planeta); pintarPanel(); return; }
  if (b.id === 'edMasPlaneta') return agregarPlaneta();
  if (b.dataset.base) {
    antes();
    const p = ed.nivel.planetas[s.i], B = BASES[b.dataset.base];
    p.base = b.dataset.base; p.color = hexATexto(B.color);
    if (B.mar) { p.colorMar = hexATexto(B.colorMar); p.mar = p.mar || +(p.R + 2).toFixed(2); } else { delete p.mar; delete p.colorMar; }
    reconstruir(); pintarPanel(); return;
  }
  if (b.id === 'pFoco') return enfocar(s.i, false);
  if (b.id === 'pBorrar') return borrarPlaneta(s.i);
  if (b.id === 'oBorrar') return borrarObjeto(s.i);
  if (b.id === 'oFoco') return mirarObjeto(s.i);
  const o = s && s.k === 'obj' && ed.nivel.objetos[s.i];
  if (b.dataset.oclase) { antes(); o.clase = b.dataset.oclase; pedir(); pintarPanel(); }
  if (b.dataset.oicono) { antes(); o.icono = b.dataset.oicono; pedir(); pintarPanel(); }
});

/** Gira la cámara para que el objeto quede al frente. */
function mirarObjeto(i) {
  const o = ed.nivel.objetos[i]; if (!o) return;
  enfocar(o.planeta, true);
  const d = new V3(...o.dir).normalize();
  orb.yaw = Math.atan2(d.x, d.z); orb.pitch = clamp(Math.asin(d.y) - 0.35, -1.45, 1.45);   // un poco de lado, para ver las alturas
}

/* ---- teclado ---- */
addEventListener('keydown', e => {
  if (juego.modo !== 'editor' && !(ed.probando && juego.modo === 'juego')) return;
  if (ed.probando) { if (e.code === 'Escape' && !e.defaultPrevented) volverAlEditor(); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.code === 'KeyZ') { e.preventDefault(); deshacer(e.shiftKey); return; }
  if (ctrl && e.code === 'KeyY') { e.preventDefault(); deshacer(true); return; }
  if (ctrl) return;
  const num = e.code.match(/^Digit(\d)$/);
  if (num) { const k = (+num[1] + 9) % 10; if (HERR[k]) elegir(HERR[k].id); return; }
  if (e.code === 'KeyP') { probar(e.shiftKey); return; }
  if (e.code === 'KeyF') { if (ed.sel && ed.sel.k === 'obj') mirarObjeto(ed.sel.i); else enfocar(ed.sel ? ed.sel.i : ed.foco, false); return; }
  if ((e.code === 'Delete' || e.code === 'Backspace') && ed.sel) { e.preventDefault(); if (ed.sel.k === 'obj') borrarObjeto(ed.sel.i); else borrarPlaneta(ed.sel.i); return; }
  if (e.code === 'Escape') { ed.sel = null; $('edMenuAbrir').classList.add('oculto'); pintarPanel(); return; }
  if (e.code === 'KeyV') elegir('mano');
  if (e.code === 'KeyX') elegir('borrar');
  if (e.code === 'KeyT') elegir('isla');
  if (e.code === 'KeyN') elegir('nota');
});

/* =========================================================
   ENTRAR, SALIR Y CADA CUADRO
   ========================================================= */
export function abrirEditor() {
  if (!ed.nivel) {
    try { ed.nivel = leerNivelJSON(localStorage.getItem(CLAVE) || ''); } catch (e) { ed.nivel = nivelVacio(); }
    enfocar(0);
    orb.dist = orb.distQ;
  }
  juego.modo = 'editor';
  mostrarHUD(false);
  scene.add(ayudas);
  raiz.classList.remove('oculto');
  document.body.classList.add('editando');
  reconstruir(); pintarArriba(); pintarPaleta(); pintarPanel(); estado();
}
function cerrarEditor() {
  if (ed.probando) volverAlEditor();
  raiz.classList.add('oculto');
  document.body.classList.remove('editando');
  scene.remove(ayudas);
  salirAlMenu();
}

/** main.js lo llama en cada cuadro mientras juego.modo === 'editor'. */
export function frameEditor(dt, t) {
  pasoGesto(dt);
  if (ed.sucio) { reconstruir(); }
  const k = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) ? 0 : 1;
  // flechas (o WASD) giran la cámara
  const gx = (teclas.has('ArrowRight') || teclas.has('KeyD') ? 1 : 0) - (teclas.has('ArrowLeft') || teclas.has('KeyA') ? 1 : 0);
  const gy = (teclas.has('ArrowUp') || teclas.has('KeyW') ? 1 : 0) - (teclas.has('ArrowDown') || teclas.has('KeyS') ? 1 : 0);
  orb.yaw += gx * 1.6 * dt * k; orb.pitch = clamp(orb.pitch + gy * 1.2 * dt * k, -1.5, 1.5);
  actualizarCamara(dt);
  animarMundo(dt, t);
  updatePlayerVisuals(0, t);
  updateEnemyVisuals(t);
  actualizarAyudas(t);
}
addEventListener('keydown', e => { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) teclas.add(e.code); });
addEventListener('keyup', e => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
