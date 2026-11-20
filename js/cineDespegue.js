/* =========================================================
   cineDespegue.js · Escapaste de Columba: despegue + pantalla de carga
   ---------------------------------------------------------
   1) nivel.js avisa 'escapo' cuando tu energía ½v² − G·M/r ≥ 0
      (o sea, ya pasaste v_esc y la gravedad no te trae de vuelta).
   2) CINEMÁTICA (3,2 s): la cámara se queda junto al cañón y te
      ve alejarte hacia Ícaro con una estela, hasta ser un puntito.
      Ojo: esto es ANIMACIÓN, no física. Lejos de Columba la
      gravedad casi no frena, así que seguirías casi a la misma
      rapidez y el viaje real duraría muchos segundos. Lo
      aceleramos para que la escena dure poco.
         distancia(t) = v·t + (D − v·T)·(t/T)³
      Parte con tu rapidez real v y llega a D metros en T segundos.
   3) FUNDIDO a negro y PANTALLA DE CARGA "Rumbo a Ícaro": tarjetas
      con las fórmulas que usaste en el nivel (con los números del
      nivel, calculados aquí mismo) y datos curiosos reales.
      La barra no carga archivos (el siguiente nivel ya está en el
      juego): es una pausa para leer. Al llenarse aparece la flecha.
   ========================================================= */
import { THREE, V3 } from './util.js';
import { scene, camera } from './escena.js';
import { juego, escuchar, emitir } from './estado.js';
import { mundo, GM, velocidadEscape } from './fisica.js';
import { player } from './jugador.js';
import { piezas } from './mundo.js';
import { mostrarHUD } from './ui.js';
import { limpiarEntrada } from './entrada.js';
import { completarNivel } from './nivel.js';
import { CFG } from './config.js';
import { icono } from './iconos.js';

const $ = id => document.getElementById(id);
const T = 3.2;             // duración de la cinemática (s)
const FUNDE = 1.9;         // cuándo empieza el fundido a negro (s)
const FOV0 = 65, FOV1 = 38;

const c = {
  activo: false, t: 0, v: 0, D: 0,
  inicio: new V3(), dir: new V3(), camPos: new V3(), destino: new V3(),
  estela: null, brillo: null, puntos: [],
};
let vDespegue = 0;
escuchar('despegue', ({ v }) => { vDespegue = v; });
escuchar('escapo', () => iniciarDespegue());

/* ---- estela: una línea con los últimos puntos por donde pasaste ---- */
export const NEST = 70;
export function crearEstela() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NEST * 3), 3));
  const col = new Float32Array(NEST * 3);
  for (let i = 0; i < NEST; i++) { const k = i / (NEST - 1); col[i * 3] = 0.7 * k; col[i * 3 + 1] = 0.75 * k; col[i * 3 + 2] = 1 * k; }   // se apaga hacia la cola
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  l.frustumCulled = false;
  return l;
}
/* ---- brillo: un sprite que sigue al jugador, así se ve como una estrellita cuando ya está lejos ---- */
export function crearBrillo() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(185,195,255,.7)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  return s;
}

export function iniciarDespegue() {
  if (c.activo) return;
  c.activo = true; c.t = 0;
  juego.modo = 'cine';
  mostrarHUD(false);
  limpiarEntrada();
  c.inicio.copy(player.pos);
  c.v = Math.max(player.vel.length(), 20);
  const L = piezas.lejano;
  c.destino.copy(L ? L.pos : player.pos.clone().addScaledVector(player.vel.clone().normalize(), 600));
  c.dir.copy(c.destino).sub(c.inicio).normalize();
  // llega hasta un poco antes de la superficie de Ícaro
  c.D = c.inicio.distanceTo(c.destino) - (L ? L.R * 1.6 : 60);
  // cámara: al lado del cañón, un poco arriba. Desde ahí se ve el horizonte de Columba abajo,
  // al jugador subiendo y a Ícaro de fondo (están casi en la misma línea).
  const P = mundo.planetas[0];
  const arriba = (piezas.canon ? piezas.canon.userData.dir : c.dir).clone();
  const base = piezas.canon ? piezas.canon.userData.boca : P.c.clone().addScaledVector(arriba, (P.mar || P.R) + 2);
  const lado = new V3().crossVectors(arriba, Math.abs(arriba.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0)).normalize();
  c.camPos.copy(base).addScaledVector(lado, 20).addScaledVector(arriba, 2);
  c.camUp = arriba;
  c.puntos = [];
  c.estela = crearEstela(); c.brillo = crearBrillo();
  scene.add(c.estela, c.brillo);
  emitir('cineDespegue');
}

const _mira = new V3();
/** Devuelve true mientras la cinemática controla la cámara. */
export function actualizarCineDespegue(dt) {
  if (!c.activo) return false;
  c.t += dt;
  const t = Math.min(c.t, T), k = t / T;
  // posición: animación (ver arriba)
  const d = c.v * t + Math.max(0, c.D - c.v * T) * k * k * k;
  player.pos.copy(c.inicio).addScaledVector(c.dir, d);
  player.vel.copy(c.dir).multiplyScalar(c.v);
  // estela
  c.puntos.push(player.pos.clone());
  if (c.puntos.length > NEST) c.puntos.shift();
  const arr = c.estela.geometry.attributes.position.array;
  for (let i = 0; i < NEST; i++) {
    const q = c.puntos[Math.max(0, c.puntos.length - NEST + i)] || player.pos;
    arr[i * 3] = q.x; arr[i * 3 + 1] = q.y; arr[i * 3 + 2] = q.z;
  }
  c.estela.geometry.attributes.position.needsUpdate = true;
  // la estrellita del jugador: crece con la distancia para seguir viéndose como un punto
  const dist = camera.position.distanceTo(player.pos);
  c.brillo.position.copy(player.pos);
  c.brillo.scale.setScalar(1.2 + dist * 0.025);
  // cámara: quieta junto al cañón, mira entre el jugador e Ícaro y hace zoom
  camera.position.copy(c.camPos);
  camera.up.copy(c.camUp);
  _mira.copy(player.pos).lerp(c.destino, 0.15 + 0.35 * k);
  camera.lookAt(_mira);
  camera.fov = FOV0 + (FOV1 - FOV0) * (k * k * (3 - 2 * k));
  camera.updateProjectionMatrix();
  if (c.t >= FUNDE) $('fundido').classList.add('ver');
  if (c.t >= T + 0.5) terminar();
  return true;
}

function terminar() {
  c.activo = false;
  scene.remove(c.estela, c.brillo);
  c.estela.geometry.dispose(); c.estela.material.dispose();
  c.brillo.material.map.dispose(); c.brillo.material.dispose();
  camera.fov = FOV0; camera.updateProjectionMatrix();
  mostrarCarga();
}

/* =========================================================
   PANTALLA DE CARGA
   ========================================================= */
const f1 = n => n.toFixed(1).replace('.', ',');
const f0 = n => Math.round(n).toLocaleString('es-CL');

/** Tarjetas con las fórmulas del nivel, calculadas con los números del nivel que acabas de jugar. */
function tarjetasDelNivel() {
  const def = juego.nivel, P = mundo.planetas[0];
  const gm = GM(P);
  const rSuelo = (P.mar || P.R) + 1.6;                       // parado en una isla
  const g = gm / (rSuelo * rSuelo);
  const h = CFG.jump * CFG.jump / (2 * g);
  const boca = piezas.canon ? piezas.canon.userData.boca.distanceTo(P.c) : rSuelo + 1.7;
  const vesc = velocidadEscape(P, boca);
  const t = [];
  t.push({ tipo: 'formula', titulo: 'Gravitación de Newton', formula: 'g = G·M / r²',
    texto: `En ${P.name}, G·M = g₀·R² = ${f0(gm)} m³/s². Parado en una isla, g ≈ ${f1(g)} m/s²: ${f1(g / 9.8)} veces la de la Tierra.` });
  t.push({ tipo: 'formula', titulo: 'Altura del salto', formula: 'h = v² / 2g',
    texto: `Saltas con ${CFG.jump} m/s, así que subes como máximo ${CFG.jump}² / (2·${f1(g)}) ≈ ${f1(h)} m. Por eso el campo de fuerza del cañón medía 5,5 m.` });
  t.push({ tipo: 'formula', titulo: 'Velocidad de escape', formula: 'v<sub>esc</sub> = √(2·G·M / r)',
    texto: `Desde la boca del cañón, v<sub>esc</sub> = ${f1(vesc)} m/s.` + (vDespegue ? ` Tú saliste a ${f1(vDespegue)} m/s (${Math.round(100 * vDespegue / vesc)} % de v<sub>esc</sub>).` : '') });
  t.push({ tipo: 'formula', titulo: 'Energía: ¿escapaste?', formula: '½·v² − G·M / r ≥ 0',
    texto: 'Así supo el juego que no ibas a volver: tu energía de movimiento le ganó a la de la gravedad. Tu masa no aparece: se cancela. Una hormiga y un elefante necesitan la misma velocidad.' });
  if (def.ovni) {
    const r = def.ovni.radio, v = Math.sqrt(gm / r);
    t.push({ tipo: 'formula', titulo: 'Órbita circular (el ovni)', formula: 'v = √(G·M / r) · T = 2πr / v',
      texto: `El ovni no tenía motor: a ${r} m del centro iba a ${f1(v)} m/s y daba una vuelta cada ${f1(2 * Math.PI * r / v)} s. Iba cayendo todo el rato, pero el planeta se curvaba igual de rápido.` });
  }
  if (def.jefe) {
    const vy = 16;
    t.push({ tipo: 'formula', titulo: 'Tiro parabólico (el jefe)', formula: 't = 2·v<sub>y</sub> / g',
      texto: `El jefe saltaba a ${vy} m/s hacia arriba y estaba ${f1(2 * vy / g)} s en el aire. Con ese tiempo calculaba qué tan rápido moverse de lado para caerte encima.` });
  }
  return t;
}

const DATOS = [
  'Para escapar de la Tierra hay que ir a 11,2 km/s: unas 33 veces la velocidad del sonido.',
  'En la Luna basta con 2,4 km/s para escapar. Por eso despegar de vuelta desde la Luna gastó muchísimo menos combustible que salir de la Tierra.',
  'La Estación Espacial Internacional va a unos 7,7 km/s y le da una vuelta a la Tierra cada 92 minutos, más o menos.',
  'Un agujero negro tiene una velocidad de escape mayor que la de la luz. Por eso ni la luz puede salir.',
  'El Sol también produce mareas en la Tierra, pero son menos de la mitad de fuertes que las de la Luna.',
  'Newton se dio cuenta de que la Luna está "cayendo" todo el tiempo hacia la Tierra, igual que una manzana. Solo que va tan rápido de lado que nunca llega.',
  'En la Luna la gravedad es unas 6 veces más débil que en la Tierra: saltarías unas 6 veces más alto.',
  'Júpiter tiene una velocidad de escape de unos 60 km/s, más de 5 veces la de la Tierra.',
];

let tarjetas = [], actual = 0, tCarga = 0, rotaT = 0, cargando = false, listo = false;
const DUR_CARGA = 7;        // segundos que tarda en llenarse la barra
const ROTA = 4.5;           // segundos por tarjeta

function mezclar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function mostrarCarga() {
  const formulas = tarjetasDelNivel();
  const datos = mezclar(DATOS.slice()).slice(0, 3).map(texto => ({ tipo: 'dato', titulo: 'Dato curioso', texto }));
  // intercalar: 2 fórmulas, 1 dato, ...
  tarjetas = [];
  while (formulas.length || datos.length) {
    for (let i = 0; i < 2 && formulas.length; i++) tarjetas.push(formulas.shift());
    if (datos.length) tarjetas.push(datos.shift());
  }
  $('cgTitulo').textContent = 'Rumbo a ' + (piezas.lejano ? piezas.lejano.nombre : 'el próximo planeta');
  $('cgPuntos').innerHTML = tarjetas.map((_, i) => `<span data-i="${i}"></span>`).join('');
  actual = 0; tCarga = 0; rotaT = 0; listo = false; cargando = true;
  pintarTarjeta();
  $('cgLlena').style.width = '0%';
  $('cgSeguir').classList.add('oculto');
  $('carga').classList.remove('oculto');
  juego.modo = 'carga';
  requestAnimationFrame(tickCarga);
}

function pintarTarjeta() {
  const k = tarjetas[actual];
  const el = $('cgTarjeta');
  el.classList.toggle('dato', k.tipo === 'dato');
  $('cgEtiqueta').innerHTML = (k.tipo === 'dato' ? icono('brillo') : icono('super')) + `<span>${k.tipo === 'dato' ? 'Dato curioso' : 'Lo que usaste en el nivel'}</span>`;
  $('cgNombre').textContent = k.tipo === 'dato' ? '' : k.titulo;
  $('cgFormula').innerHTML = k.formula || '';
  $('cgTexto').innerHTML = k.texto;
  el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra');
  [...$('cgPuntos').children].forEach((s, i) => s.classList.toggle('on', i === actual));
}
function siguienteTarjeta(paso = 1) { actual = (actual + paso + tarjetas.length) % tarjetas.length; rotaT = 0; pintarTarjeta(); emitir('cargaTarjeta'); }

let ultimo = 0;
function tickCarga(now) {
  if (!cargando) return;
  const dt = ultimo ? Math.min(0.1, (now - ultimo) / 1000) : 0; ultimo = now;
  tCarga += dt; rotaT += dt;
  $('cgLlena').style.width = Math.min(100, 100 * tCarga / DUR_CARGA) + '%';
  if (!listo && tCarga >= DUR_CARGA) { listo = true; $('cgSeguir').classList.remove('oculto'); emitir('cargaLista'); }
  if (rotaT >= ROTA) siguienteTarjeta();
  requestAnimationFrame(tickCarga);
}

function seguir() {
  if (!listo) return;
  cargando = false; ultimo = 0;
  $('carga').classList.add('oculto');
  emitir('cargaFin');
  completarNivel();                                   // nivel.js: guarda el avance y abre la tarjeta de nivel completo
  setTimeout(() => $('fundido').classList.remove('ver'), 1300);
}

$('cgSeguir').onclick = seguir;
$('cgTarjeta').onclick = () => siguienteTarjeta();
$('cgPuntos').onclick = e => { const i = e.target.dataset.i; if (i != null) { actual = +i; rotaT = 0; pintarTarjeta(); } };
addEventListener('keydown', e => {
  if (juego.modo !== 'carga') return;
  if (e.code === 'ArrowRight') siguienteTarjeta(1);
  else if (e.code === 'ArrowLeft') siguienteTarjeta(-1);
  else if (e.code === 'Enter' || e.code === 'Space') seguir();
});

// si cambias de nivel o vuelves al menú, que no quede nada a medias
escuchar('nivel', () => {
  if (c.activo) terminarSinCarga();
  cargando = false;
  $('carga').classList.add('oculto');
  $('fundido').classList.remove('ver');
});
function terminarSinCarga() {
  c.activo = false;
  scene.remove(c.estela, c.brillo);
  camera.fov = FOV0; camera.updateProjectionMatrix();
}

/** Para pruebas: estado de la cinemática y de la carga. */
export const _despegue = { c, get carga() { return { cargando, listo, actual, n: tarjetas.length }; }, seguir, mostrarCarga };
