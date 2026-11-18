/* =========================================================
   mundo.js · Construye lo que se ve de un nivel
   ---------------------------------------------------------
   Lee la definición del nivel (js/niveles/...) y crea:
   planetas, mar, islas, rocas, carteles, flores, el cañón,
   el fragmento del alma lunar y los anillos (Laboratorio).
   También le pasa los sólidos a fisica.js para que la
   gravedad y los choques usen exactamente lo mismo.

   ISLAS: son esferas grandes medio hundidas en el planeta.
   Lo que asoma sobre el agua parece una isla redonda.
   El mar NO es sólido: si caes al agua, vuelves a tierra.
   ========================================================= */
import { THREE, V3, rng } from './util.js';
import { scene, toon, outline, planetGeo, faceNormal, cartel, gradMap } from './escena.js';
import { definirMundo, mundo, superficieEn } from './fisica.js';
import { juego } from './estado.js';

let grupo = null;          // todo lo del nivel cuelga de aquí, así se borra fácil
export const piezas = {    // cosas del nivel que nivel.js necesita mover o mostrar
  fragmento: null,
  canon: null,
  carteles: [],
  flores: null,
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
    if (o.material) {
      if (o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose();
      o.material.dispose();
    }
  });
  scene.remove(grupo);
  grupo = null;
  piezas.fragmento = null; piezas.canon = null; piezas.carteles = []; piezas.flores = null;
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
  const mat = new THREE.MeshToonMaterial({ color: P.colorMar || 0x5a8796, gradientMap: gradMap, transparent: true, opacity: 0.86 });
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

/* ---- isla: esfera de arena y pasto ---- */
function crearIsla(s, P, seed) {
  const g = new THREE.IcosahedronGeometry(s.R, Math.min(20, Math.max(6, Math.round(s.R * 1.6))));
  const pos = g.attributes.position, n = new V3(), w = new V3(), cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const arena = new THREE.Color(0xd8cca8), pasto = new THREE.Color(0x7fae6e), roca = new THREE.Color(0x77736e);
  const r = rng(seed);
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    w.copy(n).multiplyScalar(s.R).add(s.c);                     // punto en el mundo
    const sobreMar = w.distanceTo(P.c) - P.mar;                 // altura sobre el agua
    if (sobreMar > 0.45) c.copy(pasto); else if (sobreMar > -0.3) c.copy(arena); else c.copy(roca);
    c.multiplyScalar(0.9 + r() * 0.14);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, toon(0xffffff, { map: null, vertexColors: true, flatShading: false }));
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

export function construirMundo(def) {
  limpiarMundo();
  grupo = new THREE.Group();
  scene.add(grupo);

  // 1) sólidos → física
  const planetas = def.planetas.map(p => ({ ...p, c: p.c.clone() }));
  const islas = (def.islas || []).map(is => {
    const P = planetas[is.planeta];
    const tope = nivelBase(P) + is.alto;                 // altura del punto más alto de la isla
    return { c: P.c.clone().addScaledVector(is.dir, tope - is.radio), R: is.radio, isla: true, planeta: P };
  });
  const rocas = (def.rocas || []).map(r => {
    const P = planetas[r.planeta];
    return { c: puntoSobre(P, r.dir, r.h), R: r.R, roca: true, planeta: P };
  });
  definirMundo(planetas, [...islas, ...rocas]);

  // 2) planetas, mar, islas y rocas → dibujo
  for (const P of mundo.planetas) {
    const m = new THREE.Mesh(planetGeo(P.R, P.color, P.seed || 11 + P.R * 7), toon(0xffffff, { map: null, vertexColors: true }));
    outline(m, 0.012); m.position.copy(P.c); grupo.add(m);
    if (P.mar) grupo.add(crearMar(P));
  }
  islas.forEach((s, i) => grupo.add(crearIsla(s, s.planeta, 40 + i)));
  for (const Rk of mundo.rocas) {
    if (Rk.isla) continue;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(Rk.R, 1), toon(0x9a96a8, { flatShading: true }));
    outline(m, 0.05); m.position.copy(Rk.c); grupo.add(m);
  }

  // 3) carteles con instrucciones (h = altura sobre el suelo)
  for (const c of def.carteles || []) {
    const P = mundo.planetas[c.planeta];
    const s = cartel(c.texto, { ancho: c.ancho || 6 });
    s.position.copy(puntoEnSuelo(P, c.dir, c.h || 2.6));
    s.visible = !c.despues;
    s.userData.despues = !!c.despues;
    grupo.add(s); piezas.carteles.push(s);
  }

  // 4) cama de flores donde despierta el protagonista
  if (def.flores) { piezas.flores = crearFlores(mundo.planetas[def.flores.planeta], def.flores.dir); grupo.add(piezas.flores); }

  // 5) cañón (lanza con la velocidad que cargues)
  if (def.canon) { piezas.canon = crearCanon(mundo.planetas[def.canon.planeta], def.canon.dir); grupo.add(piezas.canon); }

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
