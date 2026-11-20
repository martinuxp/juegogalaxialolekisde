/* =========================================================
   cineIcaro.js · Llegada a Ícaro y la charla de la cueva
   ---------------------------------------------------------
   OJO: todo esto es ANIMACIÓN (como en el cine), no física.
   Las posiciones se calculan con curvas, no con Newton.

   1) LLEGADA (≈ 12 s, en el espacio y después en la cueva)
      0,0 s  plano general: Ícaro gigante, su sol y el cinturón
             de piedras. Tú pasas junto a la cámara como una
             estrellita con estela, rumbo a Ícaro.
      2,2 s  corte: cámara detrás tuyo. Una piedra enorme crece
             adelante…
      3,2 s  ¡CHOQUE! destello blanco, temblor y pedacitos.
      3,2 s  sales dando vueltas hacia la GRIETA gigante.
      5,5 s  fundido a negro.
      6,8 s  la cueva: estás tirad@ en la arena. Abres los ojos,
             te levantas mared@ y empieza el juego.
   2) CHARLA (cuando entras a la sala de la personaje)
      Los planos siguen el guion del grupo, línea por línea.
      Cada línea espera a que toques para seguir. Al final te
      deja unas BOTAS DE SALTO; al tomarlas se abre una caja de
      información con el botón y la física.

   La cámara usa SUAVIZADO EXPONENCIAL para seguir cosas:
       mira ← mira + (meta − mira)·(1 − e^(−k·dt))
   con k chico la cámara llega "con retraso", como un
   camarógrafo que reacciona tarde (así sigue la mano).
   ========================================================= */
import { THREE, V3, clamp, damp, rng } from './util.js';
import { scene, camera, toon, outline, planetGeo, aplicarAmbiente } from './escena.js';
import { juego, emitir, escuchar } from './estado.js';
import { player, mallaJugador, respawnPlayer, mostrarBotas } from './jugador.js';
import { cam } from './camara.js';
import { mostrarHUD } from './ui.js';
import { limpiarEntrada } from './entrada.js';
import { crearEstela, crearBrillo, NEST } from './cineDespegue.js';
import { crearMisteriosa, animarMisteriosa, manoDerecha, caraDe } from './misteriosa.js';
import { crearBotasSuelo } from './cueva.js';
import { mundo } from './fisica.js';
import { decir, cerrarCharla } from './dialogo.js';

const $ = id => document.getElementById(id);
const suave = k => k * k * (3 - 2 * k);                      // sube suave y frena suave (smoothstep)
const entre = (t, a, b) => clamp((t - a) / (b - a), 0, 1);  // 0 antes de a, 1 después de b

/* =========================================================
   1) LLEGADA
   ========================================================= */
const T_CHOQUE = 3.2, T_FUNDIDO = 5.5, T_CUEVA = 6.8, T_FIN = 12.6;
const O = new V3(0, 4000, 0);                 // el "set" del espacio: lejos de la cueva (la cámara no ve ambas)
const L = { activo: false, t: 0, fin: null, set: null, piedra: null, trozos: null, velTrozos: [], estela: null, brillo: null, puntos: [] };
const IC = O.clone().add(new V3(0, -120, -1500)), R_ICARO = 400;
const N_GRIETA = new V3(0.1, 0.25, 1).normalize();            // dónde está la grieta (mirando hacia la cámara)
const GRIETA = IC.clone().addScaledVector(N_GRIETA, R_ICARO);
const P0 = O.clone().add(new V3(2.5, -1.8, -6));               // pasas justo frente a la cámara
const K = P0.clone().lerp(GRIETA, 0.4);                        // la piedra con la que chocas
const DIR1 = GRIETA.clone().sub(P0).normalize();
const D1 = P0.distanceTo(K) - 9;                               // te detienes en la superficie de la piedra (R = 9)
const LADO = new V3().crossVectors(DIR1, new V3(0, 1, 0)).normalize();
const ARRIBA1 = new V3().crossVectors(LADO, DIR1).normalize();
const DIR2 = GRIETA.clone().sub(K).normalize();               // después del choque: hacia la grieta

/** La grieta: una cinta negra y dentada sobre la superficie, con bordes ámbar que brillan. */
function crearGrieta() {
  const g = new THREE.Group(), r = rng(5);
  const t = new V3().crossVectors(N_GRIETA, new V3(1, 0.2, 0)).normalize();   // a lo largo de la grieta
  const tiras = (ancho, color, opacidad, alto) => {
    const pos = [], idx = [], N = 40;
    for (let i = 0; i <= N; i++) {
      const s = i / N * 2 - 1;
      const d = N_GRIETA.clone().applyAxisAngle(new V3().crossVectors(N_GRIETA, t).normalize(), s * 0.42);
      d.addScaledVector(t, Math.sin(i * 2.3) * 0.012).normalize();
      const b = new V3().crossVectors(d, t).normalize();
      const w = (ancho * (1 - s * s) + 4) * (0.75 + 0.5 * r());
      const c = IC.clone().addScaledVector(d, R_ICARO + alto);
      const a = c.clone().addScaledVector(b, w), z = c.clone().addScaledVector(b, -w);
      pos.push(a.x, a.y, a.z, z.x, z.y, z.z);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: opacidad < 1, opacity: opacidad, side: THREE.DoubleSide, depthWrite: opacidad >= 1, blending: opacidad < 1 ? THREE.AdditiveBlending : THREE.NormalBlending }));
  };
  g.add(tiras(46, 0xff8a3a, 0.55, 0.6), tiras(30, 0x070405, 1, 1.2));
  return g;
}

function halo(rgba, tam) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(tam);
  return s;
}

function crearSetEspacio() {
  const set = new THREE.Group(), r = rng(17);
  // Ícaro: 10 veces el radio de Columba
  const icaro = new THREE.Mesh(planetGeo(R_ICARO, 0xd08540, 77), toon(0xffffff, { map: null, vertexColors: true }));
  icaro.position.copy(IC);
  set.add(icaro, crearGrieta());
  const aura = halo('rgba(255,160,80,.35)', R_ICARO * 2.9); aura.position.copy(IC); set.add(aura);
  // su sol, MUY cerca (por eso se llama Ícaro, como el del mito que voló cerca del sol)
  const SOL = O.clone().add(new V3(1500, 500, -2700));
  const sol = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
  sol.position.copy(SOL);
  const corona = halo('rgba(255,210,120,.9)', 1900); corona.position.copy(SOL);
  set.add(sol, corona);
  // CINTURÓN DE PIEDRAS: un anillo alrededor de Ícaro que pasa justo por la piedra K
  const radio = K.distanceTo(IC);
  const u = K.clone().sub(IC).normalize();
  const nAnillo = new V3().crossVectors(u, new V3(1, 0.35, 0)).normalize();
  const w = new V3().crossVectors(nAnillo, u).normalize();
  const N = 420, geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = toon(0x7a6658, { flatShading: true });
  const piedras = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), sc = new V3();
  for (let i = 0; i < N; i++) {
    // la mitad se amontona cerca de K (lo que la cámara ve de cerca); el resto da la vuelta completa
    const a = i < N / 2 ? (r() - 0.5) * 0.5 : r() * Math.PI * 2;
    const rr = radio + (r() - 0.5) * 120;
    p.copy(IC).addScaledVector(u, Math.cos(a) * rr).addScaledVector(w, Math.sin(a) * rr).addScaledVector(nAnillo, (r() - 0.5) * 40);
    // no tapar la piedra, la cámara ni el camino de la caída
    const sCaida = clamp(_d.copy(p).sub(K).dot(DIR2), 0, 260);
    if (p.distanceTo(K) < 35 || p.distanceTo(O) < 60 || p.distanceTo(_c.copy(K).addScaledVector(DIR2, sCaida)) < 40) { i--; continue; }
    const tam = 2 + r() * r() * 16;
    sc.set(tam, tam * (0.6 + r() * 0.5), tam * (0.7 + r() * 0.4));
    q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6));
    piedras.setMatrixAt(i, m4.compose(p, q, sc));
  }
  set.add(piedras);
  // LA piedra: la del choque
  const piedra = outline(new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), toon(0x6d5a4e, { flatShading: true })), 0.03);
  piedra.position.copy(K);
  set.add(piedra);
  // pedacitos que saltan con el choque
  const trozos = new THREE.InstancedMesh(geo, mat, 40);
  trozos.visible = false;
  set.add(trozos);
  L.velTrozos = Array.from({ length: 40 }, () => new V3().randomDirection().multiplyScalar(6 + r() * 22).addScaledVector(DIR1, -8));
  L.tamTrozos = Array.from({ length: 40 }, () => 0.3 + r() * 1.4);
  L.piedra = piedra; L.trozos = trozos;
  return set;
}

/** Empieza la llegada. fin() se llama al terminar (main.js prende el HUD y da el control). */
export function iniciarLlegada(fin) {
  limpiarLlegada();
  L.activo = true; L.t = 0; L.fin = fin; L.cueva = false;
  L.set = crearSetEspacio(); scene.add(L.set);
  L.estela = crearEstela(); L.brillo = crearBrillo(); L.puntos = [];
  scene.add(L.estela, L.brillo);
  // en el espacio: luz del sol de Ícaro, estrellas y sin niebla (la cueva lo cambia después)
  aplicarAmbiente({ sol: 2.4, luzCielo: 0.45, cielo: 0xffd9b0, suelo: 0x1a1220, dirSol: [1500, 500, -1200], fondo: 0x05040a });
  camera.far = 6000; camera.updateProjectionMatrix();
  player.state = 'dormido'; player.acostado = 0; player.ojos = 1; player.invul = 0;
  juego.modo = 'cine';
  mostrarHUD(false);
  limpiarEntrada();
  $('negro').classList.add('ver');
  setTimeout(() => $('negro').classList.remove('ver'), 60);     // aparece desde negro
  emitir('musica', null);                                      // la cueva todavía no suena
  emitir('icaroLlegada');
}

const _p = new V3(), _m = new V3(), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _s = new V3();
let girado = false;
/** Hace girar al jugador como un trompo (rota su "arriba" y su "frente"). */
function girar(ang, eje) {
  _q.setFromAxisAngle(eje, ang);
  player.up.applyQuaternion(_q); player.facing.applyQuaternion(_q);
}

function pasoLlegada(dt) {
  L.t += dt;
  const t = L.t, p = player;
  if (t < T_CUEVA) {
    // ---------- en el espacio ----------
    let camPos, mira;
    if (t < T_CHOQUE) {
      // vas derecho hacia la grieta, cada vez un poco más rápido
      const k = t / T_CHOQUE;
      p.pos.copy(P0).addScaledVector(DIR1, D1 * Math.pow(k, 1.25));
      p.facing.copy(DIR1); p.up.copy(ARRIBA1);
    } else {
      if (!L.choco) {
        L.choco = true;
        emitir('choqueCinturon'); emitir('caidaGrieta');
        cam.shake = 0.5;
        $('blanco').classList.add('ver'); setTimeout(() => $('blanco').classList.remove('ver'), 90);
        L.trozos.visible = true; L.brillo.visible = false;
        L.desde = p.pos.clone();
      }
      // rebotas hacia un lado y después caes hacia la grieta, acelerando (curva de Bézier)
      const k = entre(t, T_CHOQUE, T_CUEVA);
      const a = L.desde, c = a.clone().addScaledVector(ARRIBA1, 26).addScaledVector(LADO, 18), b = GRIETA.clone().addScaledVector(N_GRIETA, -30);
      const s = Math.pow(k, 1.7), u = 1 - s;
      p.pos.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(c, 2 * u * s).addScaledVector(b, s * s);
      girar(dt * (9 - 4 * k), _p.set(0.6, 0.2, 0.75).normalize());
      // la piedra se sacude y los pedacitos vuelan
      const tc = t - T_CHOQUE;
      L.piedra.position.copy(K).addScaledVector(DIR1, Math.min(4, tc * 6));
      L.piedra.rotation.x += dt * 0.6 * Math.exp(-tc);
      for (let i = 0; i < 40; i++) {
        _m.copy(K).addScaledVector(L.velTrozos[i], tc);
        _q.setFromAxisAngle(_p.set(1, 1, 0).normalize(), tc * (2 + i % 5));
        _s.setScalar(L.tamTrozos[i]);
        L.trozos.setMatrixAt(i, _m4.compose(_m, _q, _s));
      }
      L.trozos.instanceMatrix.needsUpdate = true;
    }
    // estela y estrellita
    L.puntos.push(p.pos.clone()); if (L.puntos.length > NEST) L.puntos.shift();
    const arr = L.estela.geometry.attributes.position.array;
    for (let i = 0; i < NEST; i++) { const q = L.puntos[Math.max(0, L.puntos.length - NEST + i)] || p.pos; arr[i * 3] = q.x; arr[i * 3 + 1] = q.y; arr[i * 3 + 2] = q.z; }
    L.estela.geometry.attributes.position.needsUpdate = true;
    L.brillo.position.copy(p.pos); L.brillo.scale.setScalar(1 + camera.position.distanceTo(p.pos) * 0.03);

    // ---------- planos ----------
    if (t < 2.2) {
      // plano 1: general, la cámara casi quieta (se acerca un poquito: "respira")
      camPos = _p.copy(O).addScaledVector(DIR1, t * 2);
      mira = _m.copy(p.pos).lerp(IC, 0.55 + 0.1 * t / 2.2);
      camera.fov = 55;
    } else if (t < T_CHOQUE + 0.05) {
      // plano 2: detrás tuyo, la piedra crece adelante
      L.brillo.visible = false;
      camPos = _p.copy(p.pos).addScaledVector(DIR1, -5.5).addScaledVector(ARRIBA1, 1.5).addScaledVector(LADO, 1.1);
      mira = _m.copy(K);
      camera.fov = 62;
    } else if (t < 4.5) {
      // plano 3: la cámara se queda junto a la piedra y te ve salir volando
      camPos = _p.copy(K).addScaledVector(LADO, -14).addScaledVector(ARRIBA1, 8).addScaledVector(DIR1, -30);
      mira = _m.copy(p.pos);
      camera.fov = 58;
    } else {
      // plano 4: te sigue desde atrás y arriba mientras la grieta se agranda
      const k = entre(t, 4.5, T_CUEVA);
      const atras = _s.copy(p.pos).sub(GRIETA).normalize();
      camPos = _p.copy(p.pos).addScaledVector(atras, 16 - 6 * k).addScaledVector(LADO, 5).addScaledVector(ARRIBA1, 3);
      mira = _m.copy(p.pos).lerp(GRIETA, 0.3 + 0.4 * k);
      camera.fov = 62 + 14 * k;
    }
    camera.position.copy(camPos);
    if (cam.shake > 0) { cam.shake -= dt; const s = cam.shake * 1.4; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s; }
    camera.up.set(0, 1, 0);
    camera.lookAt(mira);
    camera.updateProjectionMatrix();
    if (t >= T_FUNDIDO) $('fundido').classList.add('ver');
    return true;
  }

  // ---------- en la cueva ----------
  if (!L.cueva) entrarALaCueva();
  const tc = t - T_CUEVA;
  p.ojos = tc < 2.4 ? 0.06 : tc < 2.6 ? 0.4 : tc < 2.9 ? 0.06 : tc < 3.3 ? 0.8 : 1;
  p.acostado = 1 - suave(entre(tc, 3.6, 4.2));
  // se levanta mared@: la cabeza da vueltas y se calma
  const mareo = entre(tc, 4.2, 4.3) * Math.exp(-Math.max(0, tc - 4.2) / 0.5);
  mallaJugador.head.rotation.z = Math.sin(tc * 11) * 0.35 * mareo;
  // cámara: desde arriba mirando hacia abajo, baja despacio; al final se pone detrás (como en el juego)
  const k = suave(entre(tc, 0, 4.8));
  _p.copy(p.pos).addScaledVector(p.up, 9 - 5.5 * k).addScaledVector(p.facing, -1 - 2 * k);
  _m.copy(p.pos);
  const kj = suave(entre(tc, 4.6, T_FIN - T_CUEVA - 0.2));
  _s.copy(p.pos).addScaledVector(p.facing, -6.2).addScaledVector(p.up, 3.4);
  _p.lerp(_s, kj);
  _m.addScaledVector(p.up, kj);
  camera.position.copy(_p);
  camera.up.copy(p.facing).lerp(p.up, kj).normalize();
  camera.lookAt(_m);
  if (t >= T_FIN) terminarLlegada();
  return true;
}

function entrarALaCueva() {
  L.cueva = true;
  scene.remove(L.set, L.estela, L.brillo);
  liberar(L.set); L.set = null;
  camera.far = 900; camera.fov = innerWidth / innerHeight < 1 ? 78 : 62; camera.updateProjectionMatrix();
  aplicarAmbiente(juego.nivel.ambiente);
  respawnPlayer();
  player.state = 'dormido'; player.acostado = 1; player.ojos = 0.06; player.invul = 0;
  emitir('caeCueva');
  emitir('musica', 'cueva');
  setTimeout(() => $('fundido').classList.remove('ver'), 350);
}

function terminarLlegada() {
  L.activo = false;
  const p = player;
  p.state = 'normal'; p.acostado = 0; p.ojos = 1; p.invul = 0;
  mallaJugador.head.rotation.set(0, 0, 0);
  cam.pos.copy(camera.position); cam.look.copy(p.pos).addScaledVector(p.up, 1); cam.up.copy(p.up); cam.fwd.copy(p.facing);
  const fn = L.fin; L.fin = null;
  if (fn) fn();
}

function liberar(o) {
  if (!o) return;
  o.traverse(x => {
    if (x.geometry) x.geometry.dispose();
    for (const m of [].concat(x.material || [])) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function limpiarLlegada() {
  if (L.set) { scene.remove(L.set); liberar(L.set); L.set = null; }
  if (L.estela) { scene.remove(L.estela, L.brillo); L.estela = null; }
  L.activo = false; L.choco = false; L.cueva = false;
  camera.far = 900; camera.updateProjectionMatrix();
  $('blanco').classList.remove('ver');
}

/* =========================================================
   2) CHARLA EN LA CUEVA
   ========================================================= */
const C = { activo: false, hecha: false, m: null, botas: null, saltar: null, saltado: false, beat: null, tb: 0, luz: null, saliendo: 0 };
const pos = { J: new V3(), M: new V3(), botas: new V3(), up: new V3(), f: new V3(), s: new V3() };

/** Punto del suelo de la cueva en la dirección d (desde el centro de la esfera). */
function suelo(d, out) { const P = mundo.planetas[0]; return out.copy(P.c).addScaledVector(d, P.R); }

escuchar('nivel', def => {
  limpiarLlegada();
  limpiarCharla();
  if (def.id !== 'icaro') return;
  // las botas ya están en la sala desde el principio: su brillo se ve a lo lejos en la oscuridad
  C.botas = crearBotasSuelo();
  suelo(def.charla.botas, pos.botas);
  C.botas.position.copy(pos.botas);
  C.botas.quaternion.setFromUnitVectors(new V3(0, 1, 0), def.charla.botas);
  C.botas.rotateY(0.9);
  scene.add(C.botas);
});

function limpiarCharla() {
  if (C.m) { scene.remove(C.m.grupo); liberar(C.m.grupo); C.m = null; }
  if (C.botas) { scene.remove(C.botas); liberar(C.botas); C.botas = null; }
  if (C.luz) { scene.remove(C.luz); C.luz = null; }
  if (C.activo) cerrarCharla();
  C.activo = false; C.hecha = false; C.saltado = false; C.beat = null; C.saliendo = 0; C.ojos = false; C.esperaFin = null; C.saltar = null;
}

/** Revisa en cada cuadro si entraste a la sala (y si tomaste las botas). */
function revisarCueva() {
  const def = juego.nivel;
  if (!def || def.id !== 'icaro' || juego.modo !== 'juego') return;
  const p = player;
  if (!C.hecha && !C.activo) {
    const P = mundo.planetas[0];
    _p.set(def.sala.x, 0, def.sala.z).add(P.c).setY(P.c.y + P.R);   // centro de la sala (≈ en el suelo)
    if (p.pos.distanceTo(_p) < def.charla.activa) empezarCharla();
  }
  if (C.hecha && C.botas && C.botas.visible && p.pos.distanceTo(pos.botas) < 1.4) {
    C.botas.visible = false;
    p.tieneSuper = true;
    mostrarBotas(true);
    emitir('botas');
    emitir('leer', {
      icono: 'botas',
      paginas: [
        'Botas de salto.\nMantén {super}: te agachas. Cuando brilles, suelta y saltas mucho más alto.',
        'En el aire es un salto normal: te mueves, y puedes usar {dash} o el pisotón.',
        'Las botas te lanzan a 20 m/s; un salto normal sale a 14 m/s. La gravedad te va frenando hasta que te detienes arriba.',
        'Altura máxima: h = v² / (2·g). Aquí g = 20 m/s², así que 20² / 40 = 10 m. Con un salto normal, solo 4,9 m.',
        'La salida está allá arriba, donde entra la luz.',
      ],
    });
  }
}

/* ---------- los planos ----------
   J = el protagonista, M = la personaje, f = de J hacia M, s = a la derecha, up = arriba */
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _cara = new V3(), _mano = new V3();
function caraJ(out) { return out.copy(player.pos).addScaledVector(pos.up, 0.42); }
function caraM(out) { C.m.grupo.updateMatrixWorld(true); return caraDe(C.m, out); }
/** Primer plano (CU), plano medio corto (MCU), etc.: la cámara frente a la cara, a "dist" metros. */
function frente(cara, haciaCam, dist, lado, alto, out) {
  return out.copy(cara).addScaledVector(haciaCam, dist).addScaledVector(pos.s, lado).addScaledVector(pos.up, alto);
}
// Regla de los tercios: la cámara mira un poco MÁS ABAJO de la cara, así la cara queda en el
// tercio de arriba de la pantalla y la caja de diálogo (abajo) no la tapa.
const PLANOS = {
  // primer plano del protagonista (la cámara del lado de ella, un poco a la derecha)
  cuJ: () => { caraJ(_cara); return [frente(_cara, pos.f, 1.55, 0.5, 0.05, _a), _c.copy(_cara).addScaledVector(pos.up, -0.32)]; },
  // primer plano y plano medio corto de ella (la cámara del lado del protagonista)
  cuM: () => { caraM(_cara); return [frente(_cara, _b.copy(pos.f).negate(), 1.2, 0.3, 0.0, _a), _c.copy(_cara).addScaledVector(pos.up, -0.28)]; },
  mcuM: () => { caraM(_cara); return [frente(_cara, _b.copy(pos.f).negate(), 2.1, 0.45, -0.2, _a), _c.copy(_cara).addScaledVector(pos.up, -0.5)]; },
  // plano general de costado: uno en cada orilla de la pantalla
  general: () => {
    _c.copy(player.pos).lerp(C.m.pos, 0.5).addScaledVector(pos.up, 0.75);
    return [_a.copy(_c).addScaledVector(pos.s, 3.4).addScaledVector(pos.up, 0.3), _c];
  },
};

/** Un "beat" del guion: un plano (+ animación) que dura dur segundos o hasta que pasas la línea. */
function beat({ plano, linea, dur = 0, anim = null, corte = true }) {
  if (C.saltado) return Promise.resolve();
  return new Promise(fin => {
    C.beat = { plano, anim, corte, primero: true };
    C.tb = 0;
    let listo = !linea, tiempo = dur <= 0;
    const ver = () => { if (listo && tiempo) { C.saltar = null; fin(); } };
    C.saltar = () => { listo = tiempo = true; ver(); };
    if (linea) decir(linea, { quien: '? ? ?' }).then(() => { listo = true; ver(); });
    else cerrarCharla();                     // sin línea: la caja se va (silencio)
    if (dur > 0) C.esperaFin = () => { tiempo = true; ver(); };
    C.beat.dur = dur;
  });
}

async function empezarCharla() {
  const def = juego.nivel, p = player;
  C.activo = true; C.saltado = false;
  juego.modo = 'cine';
  mostrarHUD(false);
  limpiarEntrada();
  $('saltarCine').classList.remove('oculto');
  // marcas en el piso (como en un rodaje): dónde se para cada uno
  suelo(def.charla.jugador, pos.J); suelo(def.charla.personaje, pos.M);
  pos.up.copy(def.charla.jugador);
  pos.f.copy(pos.M).sub(pos.J).normalize();
  pos.s.crossVectors(pos.f, pos.up).normalize();
  C.desdeJ = p.pos.clone();
  C.marcaJ = pos.J.clone().addScaledVector(pos.up, p.r + 0.02);
  p.state = 'normal'; p.grounded = true; p.vel.set(0, 0, 0);
  // ella: empieza en la oscuridad, al fondo de la sala, con los ojos apagados
  C.m = crearMisteriosa();
  suelo(def.charla.desde, C.m.pos);
  C.m.up.copy(def.charla.desde); C.m.facing.copy(pos.f).negate();
  scene.add(C.m.grupo);
  animarMisteriosa(C.m, 0);
  // LUZ DE RELLENO: como en un rodaje, una luz suave junto a la cámara para que se vean las caras
  C.luz = new THREE.PointLight(0xffe0c8, 0, 9, 1.5); scene.add(C.luz);
  emitir('musica', null);

  const m = C.m.meta;
  // 1) "Vaya, vaya." — el protagonista mira a todos lados y retrocede un poco
  await beat({ plano: 'cuJ', linea: 'Vaya, vaya.', anim: tb => {
    const k = suave(entre(tb, 0, 0.9));
    p.pos.copy(C.desdeJ).lerp(C.marcaJ, k);                         // llega a su marca…
    p.facing.copy(pos.f);
    p.vel.copy(pos.f).multiplyScalar(tb < 0.9 ? 4 : 0);              // (para que balancee los brazos)
    const atras = suave(entre(tb, 1.2, 2.0));                        // …y retrocede medio metro
    p.pos.addScaledVector(pos.f, -0.6 * atras);
    if (tb >= 0.9) p.vel.copy(pos.f).multiplyScalar(-atras * (1 - atras) * 3);
    mallaJugador.head.rotation.y = Math.sin(tb * 2.6) * 0.55 * entre(tb, 0.3, 0.8) * (1 - entre(tb, 2.6, 3.2));
  } });
  // 2) giro hacia la sombra: se encienden dos ojos rojos y ella sale caminando lento
  emitir('musica', 'misteriosa');
  await beat({ plano: tb => {
    caraJ(_cara); caraM(_c);
    const kp = suave(entre(tb, 0, 1.1));                              // la cámara gira hacia la sombra
    const k2 = suave(entre(tb, 1.6, 5.4));                            // y se acerca a ella: medio → primer plano
    frente(_cara, pos.f, 1.55, 0.5, 0.05, _a).lerp(_b.copy(pos.J).addScaledVector(pos.f, -1.5).addScaledVector(pos.s, 1.0).addScaledVector(pos.up, 1.35), kp);
    _a.lerp(frente(_c, _d.copy(pos.f).negate(), 1.35, 0.3, 0, _b), k2);
    return [_a, _cara.lerp(_c, kp).addScaledVector(pos.up, -0.3)];
  }, dur: 5.8, corte: false, anim: tb => {
    mallaJugador.head.rotation.y = 0;
    if (tb > 0.7 && !C.ojos) { C.ojos = true; m.ojos = 1; emitir('ojosRojos'); }
    const k = suave(entre(tb, 1.4, 5.2));
    suelo(_c.copy(def.charla.desde).lerp(def.charla.personaje, k).normalize(), C.m.pos);
    m.anda = tb > 1.4 && tb < 5.0 ? 1.1 : 0;
  } });
  // 3)
  await beat({ plano: 'cuM', linea: 'Algo me dice tu rostro que tu misión no era llegar aquí, ¿eh?', anim: () => { m.inclina = 0.7; } });
  // 4) el protagonista niega con la cabeza
  await beat({ plano: 'cuJ', dur: 1.7, anim: tb => { mallaJugador.head.rotation.y = Math.sin(tb * 10) * 0.4 * (1 - entre(tb, 1.1, 1.6)); } });
  // 5)
  await beat({ plano: 'mcuM', linea: 'Qué raro que tu pecerita no haya explotado con la presión del planeta. Si no, estaríamos hablando de otro tema, ¿hm?', anim: () => { m.inclina = -0.5; } });
  // 6) suspira
  m.suspiro = 0;
  await beat({ plano: 'cuM', linea: '(suspiro) Te dejaría ir, pero no sé si me conviene dejar a mi planeta sin alguien que lo mantenga. ¿Entiendes, no, pecerita?', anim: tb => { m.inclina = 0; m.suspiro = tb > 0.2 ? 1 : 0; } });
  // 7) se encoge de hombros: "no sé"
  await beat({ plano: 'mcuM', linea: 'O quién sabe, tal vez después tenga que salir de mi cueva a restablecer el orden. Puede que sí me convenga, después de todo.', anim: () => { m.suspiro = 0; m.hombros = 1; } });
  // 8) plano general, silencio. Ella se queda en la pose… y la suelta
  await beat({ plano: 'general', dur: 2.6, anim: tb => { m.hombros = tb < 1.6 ? 1 : 0; } });
  // 9)
  await beat({ plano: 'general', linea: 'Por un momento pensé que podrías hablar sin boca.', corte: false });
  // 10) el protagonista: que no con la cabeza
  await beat({ plano: 'cuJ', dur: 1.7, anim: tb => { mallaJugador.head.rotation.y = Math.sin(tb * 10) * 0.4 * (1 - entre(tb, 1.1, 1.6)); } });
  // 11)
  m.suspiro = 0;
  await beat({ plano: 'mcuM', linea: '(suspiro) Vale, lo intenté.', anim: tb => { mallaJugador.head.rotation.y = 0; m.suspiro = tb > 0.15 ? 1 : 0; } });
  // 12) apunta a las botas. La cámara sigue la mano con retraso y se aleja a un plano medio de las botas.
  C.mira = null;
  await beat({ plano: (tb, dt) => {
    manoDerecha(C.m, _mano);
    if (!C.mira) { caraM(_cara); C.mira = _cara.clone(); C.camP = camera.position.clone(); }
    const kB = suave(entre(tb, 1.3, 3.2));                           // de la mano a las botas
    _c.copy(_mano).lerp(_b.copy(pos.botas).addScaledVector(pos.up, 0.35), kB);
    C.mira.lerp(_c, damp(2.2, dt));                                  // retraso exponencial
    const meta = _a.copy(C.mira).addScaledVector(pos.f, -2.4 - 1.2 * kB).addScaledVector(pos.up, 0.5 + 0.6 * kB).addScaledVector(pos.s, -0.4);
    C.camP.lerp(meta, damp(1.6, dt));
    return [C.camP, C.mira];
  }, linea: 'Toma esas botas y sube. Espero que seas mejor saltando que hablando; si no, dudo que puedas salir.', dur: 3.4, corte: false, anim: () => { m.suspiro = 0; m.apunta = 1; } });
  // 13) corte a ella; se va caminando por la izquierda de la pantalla mientras habla
  C.salida = null;
  await beat({ plano: tb => {
    if (!C.salida) { caraM(_cara); C.salida = [frente(_cara, _b.copy(pos.f).negate(), 2.1, 0.45, -0.2, new V3()), _cara.clone().addScaledVector(pos.up, -0.5)]; }
    return C.salida;
  }, linea: 'Anda, ve, tómalas. Que yo ya me aburrí.', dur: 3.2, anim: (tb, dt) => { m.apunta = 0; irse(tb, dt); } });
  terminarCharla();
}

/** Ella se va: gira hacia su derecha (izquierda de la pantalla) y camina hacia la oscuridad. */
function irse(tb, dt) {
  const m = C.m;
  _c.copy(pos.s).negate().addScaledVector(pos.f, 0.35).normalize();       // −s = izquierda de la pantalla
  m.facing.lerp(_c, clamp(tb * 2, 0, 1)).normalize();
  if (tb > 0.5) { m.meta.anda = 1.2; m.pos.addScaledVector(m.facing, 1.2 * dt); }
}

function terminarCharla() {
  cerrarCharla();
  C.activo = false; C.hecha = true; C.beat = null; C.saltar = null;
  $('saltarCine').classList.add('oculto');
  if (C.luz) { scene.remove(C.luz); C.luz = null; }
  // si se saltó la escena, que igual quede todo en su lugar
  const p = player;
  if (C.saltado) { p.pos.copy(C.marcaJ); p.facing.copy(pos.f); }
  mallaJugador.head.rotation.set(0, 0, 0);
  C.saliendo = 1;                       // ella sigue caminando a la oscuridad y se apagan sus ojos
  C.m.meta.ojos = 0; C.m.meta.apunta = 0; C.m.meta.hombros = 0;
  if (C.saltado) C.m.facing.copy(pos.s).negate();
  emitir('musica', 'cueva');
  // la cámara del juego parte desde donde quedó, detrás del protagonista
  cam.fwd.copy(p.facing); cam.up.copy(p.up);
  cam.pos.copy(camera.position); cam.look.copy(p.pos).addScaledVector(p.up, 1);
  juego.modo = 'juego';
  mostrarHUD(true);
}

/* ---------- se llama una vez por cuadro (main.js) ---------- */
export function actualizarCineIcaro(dt) {
  if (L.activo) return pasoLlegada(dt);
  revisarCueva();
  if (C.m) {
    if (C.saliendo > 0) {               // después de la charla: camina hacia la oscuridad y desaparece
      C.saliendo += dt;
      C.m.pos.addScaledVector(C.m.facing, 1.2 * dt);
      C.m.meta.anda = 1.2;
      if (C.saliendo > 7) { scene.remove(C.m.grupo); liberar(C.m.grupo); C.m = null; return false; }
    }
    animarMisteriosa(C.m, dt);
  }
  if (!C.activo || !C.beat) return false;
  // ---- un beat de la charla ----
  C.tb += dt;
  const b = C.beat;
  if (b.dur > 0 && C.tb >= b.dur && C.esperaFin) { const f = C.esperaFin; C.esperaFin = null; f(); }
  if (b.anim) b.anim(C.tb, dt);
  player.grounded = true;
  const [cp, mira] = typeof b.plano === 'function' ? b.plano(C.tb, dt) : PLANOS[b.plano]();
  // cámara "en mano": se mueve apenitas, como si alguien la sostuviera
  camera.position.copy(cp);
  camera.position.x += Math.sin(C.tb * 1.3) * 0.012; camera.position.y += Math.sin(C.tb * 1.7 + 1) * 0.01;
  camera.up.copy(pos.up);
  camera.lookAt(mira);
  C.luz.position.copy(camera.position).addScaledVector(pos.up, 0.4);
  C.luz.intensity = 5;
  return true;
}

/** Botón Saltar / Esc: si hay una cinemática de Ícaro corriendo, la salta. Devuelve true si saltó algo. */
export function saltarCineIcaro() {
  if (L.activo) {
    if (!L.cueva) { scene.remove(L.set, L.estela, L.brillo); liberar(L.set); L.set = null; entrarALaCueva(); $('fundido').classList.remove('ver'); }
    L.t = T_FIN; pasoLlegada(0);
    return true;
  }
  if (C.activo) {
    C.saltado = true;
    if (C.m) { suelo(juego.nivel.charla.personaje, C.m.pos); C.m.meta.ojos = 1; }
    if (C.saltar) C.saltar();
    cerrarCharla();
    return true;
  }
  return false;
}

/** Para pruebas automáticas. */
export const _icaro = { L, C, saltar: saltarCineIcaro };
