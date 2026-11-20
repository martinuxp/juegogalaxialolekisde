/* =========================================================
   mundo.js · Construye lo que se ve de un nivel
   ---------------------------------------------------------
   Lee la definición del nivel (js/niveles/...) y crea:
   planetas, mar, islas, rocas, carteles, flores, el cañón,
   la vegetación (vegetacion.js), el fragmento del alma lunar
   y los anillos (Laboratorio).
   También le pasa los sólidos a fisica.js para que la
   gravedad y los choques usen exactamente lo mismo.

   ISLAS: son esferas grandes medio hundidas en el planeta.
   Lo que asoma sobre el agua parece una isla redonda.
   El mar NO es sólido: si caes al agua, vuelves a tierra.
   ========================================================= */
import { THREE, V3, rng, tangent } from './util.js';
import { scene, toon, outline, planetGeo, faceNormal, orient, cartel, gradMap } from './escena.js';
import { definirMundo, mundo, superficieEn, agregarMuro } from './fisica.js';
import { juego } from './estado.js';
import { iconoEnCanvas } from './iconos.js';
import { crearVegetacion } from './vegetacion.js';
import { paletaDe } from './niveles/formato.js';

let grupo = null;          // todo lo del nivel cuelga de aquí, así se borra fácil
export const piezas = {    // cosas del nivel que nivel.js necesita mover o mostrar
  fragmento: null,
  canon: null,
  carteles: [],     // { obj, pos, arriba, paginas, icono }
  flores: null,
  muros: [],        // { mesh, solido, base }: los muros que baja el botón (o el campo de fuerza que apaga el jefe)
  vegetacion: null,
  lejano: null,     // { mesh, pos, R, nombre }: planeta del fondo al que apunta el cañón
  boton: null,      // { mesh, pos, arriba, apretado }
};

/** Nivel "del suelo" de un planeta: el mar si tiene, si no su radio. */
export const nivelBase = P => P.mar || P.R;

/** Punto a cierta altura sobre el nivel base de un planeta. */
export function puntoSobre(P, dir, altura = 0) {
  return P.c.clone().addScaledVector(dir, nivelBase(P) + altura);
}

/** Punto parado en el suelo real (isla, roca o planeta) en esa dirección. */
export function puntoEnSuelo(P, dir, altura = 0) {
  return P.c.clone().addScaledVector(dir, superficieEn(P, dir) + altura);
}

/** Borra el nivel anterior de la escena (y libera la memoria de la tarjeta de video). */
export function limpiarMundo() {
  if (!grupo) return;
  grupo.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) {      // puede ser un material o una lista
      if (m.map && m.map.isCanvasTexture) m.map.dispose();
      m.dispose();
    }
  });
  scene.remove(grupo);
  grupo = null;
  piezas.fragmento = null; piezas.canon = null; piezas.carteles = []; piezas.flores = null;
  piezas.muros = []; piezas.boton = null; piezas.vegetacion = null; piezas.lejano = null;
  juego.pads = null;
}

/** Halo suave (sprite con degradado radial) para cosas que brillan. */
function halo(color, tam) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(tam);
  return s;
}

/** Dos vectores perpendiculares a "arriba" (para repartir cosas sobre el suelo). */
function base2(arriba) {
  const a = new V3(1, 0, 0); if (Math.abs(arriba.x) > 0.9) a.set(0, 0, 1);
  a.addScaledVector(arriba, -a.dot(arriba)).normalize();
  const b = new V3().crossVectors(arriba, a);
  return [a, b];
}

/* ---- el mar: esfera translúcida con olitas ---- */
const marUniforms = { uTiempo: { value: 0 } };
function crearMar(P) {
  const lava = paletaDe(P).dano;                       // la lava brilla sola y casi no se ve a través
  const mat = new THREE.MeshToonMaterial({ color: P.colorMar || 0x5a8796, gradientMap: gradMap, transparent: true, opacity: lava ? 0.95 : 0.86,
    emissive: lava ? 0x8a2200 : 0x000000 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTiempo = marUniforms.uTiempo;
    sh.vertexShader = 'uniform float uTiempo;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n' +
      'float ola = sin(position.x*1.3 + uTiempo*1.2)*0.5 + sin(position.z*1.7 - uTiempo*1.5)*0.35 + sin((position.y+position.x)*2.6 + uTiempo*2.1)*0.2;\n' +
      'transformed += normal * ola * 0.05;');
  };
  const m = new THREE.Mesh(new THREE.SphereGeometry(P.mar, 96, 64), mat);
  m.position.copy(P.c);
  m.renderOrder = 2;
  return m;
}

/* ---- isla o colina: esfera de arena y pasto (los colores dependen de la base del planeta) ---- */
function crearIsla(s, P, seed) {
  const g = new THREE.IcosahedronGeometry(s.R, Math.min(20, Math.max(6, Math.round(s.R * 1.6))));
  const pos = g.attributes.position, n = new V3(), w = new V3(), cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const pal = paletaDe(P);
  const arena = new THREE.Color(pal.orilla), pasto = new THREE.Color(pal.cima), roca = new THREE.Color(pal.fondo);
  const r = rng(seed);
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    w.copy(n).multiplyScalar(s.R).add(s.c);                     // punto en el mundo
    const sobreMar = w.distanceTo(P.c) - nivelBase(P);          // altura sobre el agua (o sobre el suelo)
    if (sobreMar > 0.45) c.copy(pasto); else if (sobreMar > -0.3) c.copy(arena); else c.copy(roca);
    c.multiplyScalar(0.9 + r() * 0.14);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, toon(0xffffff, { map: null, vertexColors: true, flatShading: !!pal.plano }));
  m.position.copy(s.c);
  return m;
}

/* ---- cama de flores ---- */
function crearFlores(P, dir) {
  const g = new THREE.Group();
  const centro = puntoEnSuelo(P, dir, 0);
  const [a, b] = base2(dir);
  const hojas = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(0x5f9a58));
  hojas.scale.set(1.5, 0.18, 1.0);
  hojas.position.copy(centro);
  hojas.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
  g.add(outline(hojas, 0.04));
  const colores = [0xff8fb8, 0xffe07a, 0xffffff, 0xc9a2ff, 0xff9f6b];
  const r = rng(17), tallo = toon(0x4f8a4a);
  const petalo = colores.map(cc => toon(cc));
  for (let i = 0; i < 46; i++) {
    const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 1.7;
    const p = centro.clone().addScaledVector(a, Math.cos(ang) * rad * 1.2).addScaledVector(b, Math.sin(ang) * rad * 0.85);
    const alto = 0.12 + r() * 0.2;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, alto, 4), tallo);
    st.position.copy(p).addScaledVector(dir, alto / 2); st.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + r() * 0.05, 0), petalo[i % petalo.length]);
    fl.position.copy(p).addScaledVector(dir, alto);
    g.add(st, fl);
  }
  return g;
}

/* ---- cañón: base + tubo apuntando "hacia arriba" (opuesto a la gravedad) ---- */
function crearCanon(P, dir) {
  const g = new THREE.Group();
  const suelo = puntoEnSuelo(P, dir, 0);
  g.position.copy(suelo);
  g.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
  const metal = toon(0x4c4f63), cobre = toon(0xc98a4b), madera = toon(0x8a5a3c);
  const base = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.45, 20), madera), 0.04);
  base.position.y = 0.22;
  const tubo = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 2.1, 22, 1, true), metal), 0.04);
  tubo.position.y = 1.35; tubo.material.side = THREE.DoubleSide;
  const aro1 = outline(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.1, 8, 24), cobre), 0.06);
  aro1.rotation.x = Math.PI / 2; aro1.position.y = 2.35;
  const aro2 = aro1.clone(); aro2.position.y = 0.75; aro2.scale.setScalar(1.15);
  const brillo = halo('rgba(125,255,168,.7)', 3.4); brillo.position.y = 2.5;
  g.add(base, tubo, aro1, aro2, brillo);
  g.userData = { dir, brillo, boca: suelo.clone().addScaledVector(dir, 1.7), suelo };
  return g;
}

/* ---- cartel: poste de madera + tabla con un ícono (se lee con el botón LEER) ---- */
const _norte = new V3(0, 1, 0);
function crearCartel(P, c) {
  const suelo = puntoEnSuelo(P, c.dir, 0);
  const obj = new THREE.Group();
  obj.position.copy(suelo);
  // la tabla mira hacia donde viene el jugador (hacia el polo norte, el inicio del camino)
  const mira = tangent(new V3(), c.mira || _norte, c.dir);
  if (mira.lengthSq() < 1e-6) mira.set(0, 0, 1);
  orient(obj, c.dir, mira.normalize());
  const madera = toon(0x8a5a3c), clara = toon(0xc49a6c);
  const poste = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8), madera), 0.03);
  poste.position.y = 0.75;
  // tabla: la cara de adelante (+Z) lleva el dibujo del ícono
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = '#c49a6c'; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(90,55,30,.35)'; g.lineWidth = 3;
  for (let y = 26; y < 160; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + 4); g.stroke(); }   // vetas
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  iconoEnCanvas(g, c.icono || 'leer', 70, 22, 116, '#3b2414', 2.4).then(() => { tex.needsUpdate = true; });
  const frente = toon(0xffffff, { map: tex });
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.12), [clara, clara, clara, clara, frente, clara]);
  tabla.position.y = 1.55;
  outline(tabla, 0.04);
  obj.add(poste, tabla);
  return { obj, pos: suelo.clone().addScaledVector(c.dir, 1), arriba: c.dir.clone(), paginas: c.paginas, icono: c.icono };
}

/* ---- muros: un cuadrado de 4 cajas alrededor del cañón ---- */
function crearMuros(P, d) {
  const centro = puntoEnSuelo(P, d.dir, 0);
  const arriba = d.dir.clone();
  const x = tangent(new V3(), new V3(1, 0, 0), arriba).normalize();
  const z = new V3().crossVectors(x, arriba).normalize();
  // estilo 'campo': campo de fuerza de los aliens (paneles verdes con marco de metal); si no, muro de piedra.
  // El CHOQUE es el mismo en los dos estilos: 4 cajas orientadas (agregarMuro).
  const campo = d.estilo === 'campo';
  const piedra = toon(0x8d8a9e, { flatShading: true });
  const borde = campo ? toon(0x55506e) : toon(0x6c6880);
  // panel de energía: plano SIN grosor y con mezcla normal. Una caja aditiva gruesa, vista de lado,
  // suma su color en todo el grosor y se ve como una raya brillante: eso era lo raro de los muros laterales.
  const energia = new THREE.MeshBasicMaterial({ color: 0x8cff6b, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  const hundido = 0.6;                                  // parte que queda bajo el suelo (por la curvatura)
  const altoTotal = d.alto + hundido;
  for (const [eje, signo] of [[x, 1], [x, -1], [z, 1], [z, -1]]) {
    const otro = eje === x ? z : x;
    // medio = la mitad de cada medida (ancho, alto, grosor) en los ejes del muro
    const largo = d.lado + d.grosor;                    // cubre las esquinas
    const c = centro.clone().addScaledVector(eje, signo * d.lado).addScaledVector(arriba, altoTotal / 2 - hundido);
    const medio = new V3(d.grosor / 2, altoTotal / 2, largo);
    const solido = agregarMuro(c, eje, arriba, otro, medio);
    let mesh;
    if (campo) {
      // ejes locales: y = arriba, z = a lo largo del muro. Cada lado mide 2·lado, así los
      // 4 paneles se juntan justo en las esquinas en vez de cruzarse.
      mesh = new THREE.Group();
      const yPie = -altoTotal / 2 + hundido;            // altura del suelo (en el centro del muro)
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(d.lado * 2, d.alto), energia);
      panel.rotation.y = Math.PI / 2;
      panel.position.y = yPie + d.alto / 2;
      panel.renderOrder = 3;
      const tope = outline(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, d.lado * 2), borde), 0.05);
      tope.position.y = altoTotal / 2;
      // riel de abajo: baja 0,35 m bajo el suelo. El suelo es curvo (a 3 m del centro baja
      // 3²/(2·43,6) ≈ 0,1 m), así el riel nunca queda flotando en las puntas.
      const riel = outline(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, d.lado * 2), borde), 0.05);
      riel.position.y = yPie - 0.05;
      // un solo poste por muro, en su punta +z: con los 4 muros quedan las 4 esquinas, sin postes repetidos
      const poste = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, altoTotal + 0.2, 8), borde), 0.06);
      poste.position.set(0, 0, d.lado);
      mesh.add(panel, tope, riel, poste);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(d.grosor, altoTotal, largo * 2), piedra);
      const tope = new THREE.Mesh(new THREE.BoxGeometry(d.grosor + 0.2, 0.25, largo * 2 + 0.2), borde);
      tope.position.y = altoTotal / 2;
      mesh.add(tope);
      outline(mesh, 0.03);
    }
    mesh.position.copy(c);
    // OJO: la base del dibujo tiene que ser "derecha" (x × y = z). Con (z, arriba, x) queda
    // espejada y la rotación que sale de ella está mal: los 2 muros laterales se dibujaban
    // torcidos (la raya verde que cruzaba) aunque su choque estaba bien. Por eso el tercer eje
    // se calcula con el producto cruz. El choque (agregarMuro) no cambia.
    const m4 = new THREE.Matrix4().makeBasis(eje, arriba, new V3().crossVectors(eje, arriba));
    mesh.quaternion.setFromRotationMatrix(m4);
    grupo.add(mesh);
    piezas.muros.push({ mesh, solido, base: c.clone(), arriba, bajada: altoTotal + 0.1 });
  }
}

/**
 * Radio de la esfera de una isla para que asome "alto" metros y su orilla
 * quede a "ancho" metros (medidos sobre el mar) de su centro.
 * Rm = radio del mar; T = Rm + alto (punto más alto); φ = ancho / Rm (ángulo de la orilla).
 * La orilla está en el mar (a Rm del centro del planeta) y a ρ del centro de la isla,
 * que está a T − ρ del centro del planeta. Por el teorema del coseno:
 *   ρ² = Rm² + (T − ρ)² − 2·Rm·(T − ρ)·cos φ   →   ρ = (Rm² + T² − 2·Rm·T·cos φ) / (2·(T − Rm·cos φ))
 */
export function radioDeIsla(Rm, alto, ancho) {
  const T = Rm + alto, c = Math.cos(ancho / Rm);
  return (Rm * Rm + T * T - 2 * Rm * T * c) / (2 * (T - Rm * c));
}

export function construirMundo(def) {
  limpiarMundo();
  grupo = new THREE.Group();
  scene.add(grupo);

  // 1) sólidos → física
  const planetas = def.planetas.map(p => ({ ...p, c: p.c.clone() }));
  const islas = (def.islas || []).map(is => {
    const P = planetas[is.planeta];
    const radio = is.radio || radioDeIsla(nivelBase(P), is.alto, is.ancho);
    const tope = nivelBase(P) + is.alto;                 // altura del punto más alto de la isla
    return { c: P.c.clone().addScaledVector(is.dir, tope - radio), R: radio, isla: true, planeta: P };
  });
  const rocas = (def.rocas || []).map(r => {
    const P = planetas[r.planeta];
    return { c: puntoSobre(P, r.dir, r.h), R: r.R, roca: true, planeta: P, oculta: !!r.oculta };
  });
  definirMundo(planetas, [...islas, ...rocas]);

  // 2) planetas, mar, islas y rocas → dibujo
  for (const P of mundo.planetas) {
    if (P.oculto) continue;            // chocas con él pero no se dibuja (lo dibuja el decorado del nivel)
    const m = new THREE.Mesh(planetGeo(P.R, P.color, P.seed || 11 + P.R * 7), toon(0xffffff, { map: null, vertexColors: true, flatShading: !!(P.base && paletaDe(P).plano) }));
    outline(m, 0.012); m.position.copy(P.c); grupo.add(m);
    if (P.mar) grupo.add(crearMar(P));
  }
  islas.forEach((s, i) => grupo.add(crearIsla(s, s.planeta, 40 + i)));
  for (const Rk of mundo.rocas) {
    if (Rk.isla || Rk.oculta) continue;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(Rk.R, 1), toon(0x9a96a8, { flatShading: true }));
    outline(m, 0.05); m.position.copy(Rk.c); grupo.add(m);
  }

  // 2·) decorado propio del nivel (ej. la cueva de Ícaro): una función que dibuja lo que quiera
  if (def.decorado) def.decorado(grupo, mundo.planetas);

  // 2a) planeta lejano (solo dibujo, sin gravedad): el destino del cañón
  if (def.lejano) {
    const L = def.lejano;
    const pos = (mundo.planetas[0] ? mundo.planetas[0].c.clone() : new V3()).addScaledVector(L.dir, L.dist);
    const m = new THREE.Mesh(planetGeo(L.R, L.color, L.seed || 77), toon(0xffffff, { map: null, vertexColors: true }));
    outline(m, 0.01); m.position.copy(pos);
    const brillo = halo('rgba(255,170,90,.35)', L.R * 3.2); brillo.position.copy(pos);
    grupo.add(m, brillo);
    piezas.lejano = { mesh: m, pos, R: L.R, nombre: L.nombre };
  }

  // 2b) vegetación (solo decoración, no choca)
  if (def.vegetacion) {
    const P = mundo.planetas[def.vegetacion.planeta];
    const lista = (def.islas || []).map((d, i) => ({ def: d, solido: islas[i] })).filter(x => x.def.planeta === def.vegetacion.planeta);
    const evitar = [];
    for (const c of def.carteles || []) evitar.push(puntoEnSuelo(mundo.planetas[c.planeta], c.dir));
    for (const k of ['canon', 'boton', 'flores']) if (def[k]) evitar.push(puntoEnSuelo(mundo.planetas[def[k].planeta], def[k].dir));
    for (const [, pi, d] of def.enemigos || []) evitar.push(puntoEnSuelo(mundo.planetas[pi], d));
    piezas.vegetacion = crearVegetacion(P, lista, { evitar, camino: def.vegetacion.camino, seed: def.vegetacion.seed || 5 });
    grupo.add(piezas.vegetacion);
  }

  // 3) carteles: un poste con una tabla. Con "paginas" se leen como diálogo (dialogo.js);
  //    los que solo tienen "texto" (Laboratorio) son letreros flotantes como antes.
  for (const c of def.carteles || []) {
    const P = mundo.planetas[c.planeta];
    if (c.paginas) {
      const k = crearCartel(P, c);
      grupo.add(k.obj); piezas.carteles.push(k);
      continue;
    }
    const s = cartel(c.texto, { ancho: c.ancho || 6 });
    s.position.copy(puntoEnSuelo(P, c.dir, c.h || 2.6));
    s.visible = !c.despues;
    s.userData.despues = !!c.despues;
    grupo.add(s);
  }

  // 4) cama de flores donde despierta el protagonista
  if (def.flores) { piezas.flores = crearFlores(mundo.planetas[def.flores.planeta], def.flores.dir); grupo.add(piezas.flores); }

  // 5) cañón (lanza con la velocidad que cargues)
  if (def.canon) { piezas.canon = crearCanon(mundo.planetas[def.canon.planeta], def.canon.dir); grupo.add(piezas.canon); }

  // 5b) muros alrededor del cañón y el botón que los baja
  if (def.muros) crearMuros(mundo.planetas[def.muros.planeta], def.muros);
  if (def.boton) {
    const P = mundo.planetas[def.boton.planeta];
    const pos = puntoEnSuelo(P, def.boton.dir, 0);
    const m = new THREE.Group();
    const base = outline(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.16, 28), toon(0x5a5a6e)), 0.04);
    const tapa = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.22, 28), toon(0xff7a59, { emissive: 0x551a0a })), 0.05);
    base.position.y = 0.04; tapa.position.y = 0.2;
    m.add(base, tapa);
    m.position.copy(pos); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), def.boton.dir);
    grupo.add(m);
    piezas.boton = { mesh: m, tapa, pos, arriba: def.boton.dir.clone(), apretado: false };
  }

  // 6) fragmento del alma lunar: cristal pálido que flota y gira
  if (def.fragmento) {
    const f = new THREE.Group();
    const cristal = outline(new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0),
      toon(0xf6f1dc, { emissive: 0x8a8060, flatShading: true })), 0.08);
    cristal.scale.y = 1.4;
    f.add(cristal, halo('rgba(255,246,210,.85)', 3.2));
    const P = mundo.planetas[def.fragmento.planeta];
    f.position.copy(puntoEnSuelo(P, def.fragmento.dir, def.fragmento.h || 1.4));
    f.userData = { base: f.position.clone(), arriba: def.fragmento.dir.clone(), cristal };
    grupo.add(f); piezas.fragmento = f;
  }

  // 7) anillos de lanzamiento (solo Laboratorio)
  if (def.pads) {
    juego.pads = def.pads.map(pd => {
      const P = mundo.planetas[pd.planet];
      const pos = puntoSobre(P, pd.dir);
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.2, 10, 32),
        new THREE.MeshStandardMaterial({ color: 0x6fe7ff, emissive: 0x2bb8ff, emissiveIntensity: 1.2 }));
      m.position.copy(pos).addScaledVector(pd.dir, 0.2); faceNormal(m, pd.dir); grupo.add(m);
      return { ...pd, pos, mesh: m };
    });
  }
}

/** Animaciones simples del nivel. */
export function animarMundo(dt, t) {
  marUniforms.uTiempo.value = t;
  const f = piezas.fragmento;
  if (f && f.visible) {
    f.position.copy(f.userData.base).addScaledVector(f.userData.arriba, Math.sin(t * 2) * 0.25);
    f.userData.cristal.rotation.y += dt * 1.5;
  }
  if (piezas.canon) piezas.canon.userData.brillo.material.opacity = 0.55 + Math.sin(t * 4) * 0.35;
  if (juego.pads) for (const pad of juego.pads) {
    pad.mesh.rotation.z += dt * 2;
    pad.mesh.material.emissiveIntensity = 1 + Math.sin(t * 5) * 0.4;
  }
}
