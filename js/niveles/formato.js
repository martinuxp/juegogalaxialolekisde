/* =========================================================
   formato.js · El archivo nivel.json del editor de planetas
   ---------------------------------------------------------
   El editor (js/editor/) guarda los niveles en un formato
   simple, pensado para que se pueda leer a mano:

   {
     "formato": "alma-lunar-nivel", "version": 1,
     "nombre": "Mi planeta", "ley": "Gravitación de Newton",
     "planetas": [ { "name": "Columba", "c": [0,0,0], "R": 40, "g": 27.5,
                     "base": "agua", "color": "#4d5f66", "colorMar": "#5d8a99", "mar": 42 } ],
     "objetos":  [ { "tipo": "isla", "planeta": 0, "dir": [0,1,0], "alto": 1.2, "ancho": 9 }, ... ],
     "meta": { "aterrizarEn": 1 }
   }

   - Las posiciones van como [x, y, z].
   - "dir" es la dirección desde el centro del planeta (vector
     unitario): el objeto queda parado en el suelo en esa dirección.
   - Los colores van como "#rrggbb".

   nivelDesdeEditor(json) lo convierte en la definición que usan
   mundo.js y nivel.js (la misma forma que js/niveles/nivel1-columba.js).
   Como un JSON también es JavaScript válido, para dejar un nivel
   en el juego basta un archivo así:

     import { nivelDesdeEditor } from './formato.js';
     export default nivelDesdeEditor({ ...pegar aquí el nivel.json... });
   ========================================================= */
import { V3 } from '../util.js';

/* ---- tipos de suelo del planeta ----
   mar: si es true, el planeta tiene un "mar" (no sólido) sobre el fondo.
   cima / orilla / fondo: colores de las colinas e islas (arriba, borde y lo que queda bajo el mar).
   lava: es un mar que además quita un corazón. */
export const BASES = {
  tierra: { nombre: 'Tierra', color: 0x6f9e58, mar: false, cima: 0x7fae6e, orilla: 0x9b7b55, fondo: 0x6e5a44 },
  agua:   { nombre: 'Agua',   color: 0x4d5f66, colorMar: 0x5d8a99, mar: true, cima: 0x7fae6e, orilla: 0xd8cca8, fondo: 0x77736e },
  roca:   { nombre: 'Roca',   color: 0x8d8a9e, mar: false, cima: 0xa29fb0, orilla: 0x7d798c, fondo: 0x6a6678, plano: true },
  arena:  { nombre: 'Arena',  color: 0xd9bf86, mar: false, cima: 0xe4cf98, orilla: 0xc8a96e, fondo: 0xb08f58 },
  hielo:  { nombre: 'Hielo',  color: 0xbfe2f2, mar: false, cima: 0xf2fbff, orilla: 0xa6d2e6, fondo: 0x86b6cc, plano: true },
  lava:   { nombre: 'Lava',   color: 0x3a2b2e, colorMar: 0xff6a1f, mar: true, cima: 0x4d3b3e, orilla: 0x2b2023, fondo: 0x1f1719, dano: true },
};

/** Colores de las islas/colinas de un planeta según su base (los de siempre si no tiene). */
export function paletaDe(P) {
  return BASES[P.base] || BASES.agua;
}

/* ---- tipos de objeto que entiende el editor ----
   unico: solo puede haber uno por nivel (poner otro lo mueve).
   props: valores por defecto. */
export const TIPOS = {
  isla:      { nombre: 'Colina / isla', props: { alto: 1.5, ancho: 4 } },
  roca:      { nombre: 'Roca', props: { R: 1.4, h: 0.8 } },
  enemigo:   { nombre: 'Enemigo', props: { clase: 'small' } },
  cartel:    { nombre: 'Cartel', props: { icono: 'leer', paginas: ['Escribe aquí lo que dice el cartel.'] } },
  boton:     { nombre: 'Botón', unico: true, props: {} },
  muros:     { nombre: 'Muros', unico: true, props: { lado: 3, alto: 5.5, grosor: 0.6 } },
  canon:     { nombre: 'Cañón', unico: true, props: {} },
  flores:    { nombre: 'Cama de flores', unico: true, props: {} },
  inicio:    { nombre: 'Inicio', unico: true, props: {} },
  fragmento: { nombre: 'Fragmento lunar', unico: true, props: { h: 1.4 } },
  nota:      { nombre: 'Nota (bloque nuevo)', props: { texto: '', tam: 2 } },
};

/* ---- ayudas ---- */
const aV3 = a => new V3(a[0], a[1], a[2]);
const aArr = (v, d = 4) => [v.x, v.y, v.z].map(n => +n.toFixed(d));
export const hexATexto = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
export const textoAHex = s => typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16);

/** Una dirección cualquiera "hacia adelante" sobre el plano tangente (para que el jugador mire). */
function adelante(dir) {
  const a = Math.abs(dir.y) < 0.95 ? new V3(0, 1, 0) : new V3(0, 0, -1);
  return a.addScaledVector(dir, -a.dot(dir)).normalize();
}

/** Nivel vacío: un planeta de tierra con el inicio en el polo norte. */
export function nivelVacio() {
  return {
    formato: 'alma-lunar-nivel', version: 1,
    nombre: 'Planeta nuevo', ley: 'Gravitación de Newton',
    planetas: [{ name: 'Planeta 1', c: [0, 0, 0], R: 20, g: 25, base: 'tierra', color: hexATexto(BASES.tierra.color), seed: 21 }],
    objetos: [{ tipo: 'inicio', planeta: 0, dir: [0, 1, 0] }],
    meta: null,
  };
}

/**
 * Editor → juego. Devuelve la definición del nivel (con V3) que entiende mundo.js.
 * No cambia el json original.
 */
export function nivelDesdeEditor(n) {
  const planetas = n.planetas.map((p, i) => {
    const B = BASES[p.base] || BASES.tierra;
    const P = {
      name: p.name || `Planeta ${i + 1}`, c: aV3(p.c), R: p.R, g: p.g, base: p.base || 'tierra',
      color: textoAHex(p.color ?? B.color), seed: p.seed ?? 11 + i * 13,
    };
    if (B.mar) { P.mar = p.mar || p.R + 2; P.colorMar = textoAHex(p.colorMar ?? B.colorMar); }
    return P;
  });
  const def = {
    id: n.id || 'editor', numero: n.numero || 0, nombre: n.nombre || 'Sin nombre', ley: n.ley || '',
    superDesdeInicio: !!n.superDesdeInicio,
    planetas, islas: [], rocas: [], enemigos: [], carteles: [], notas: [],
    objetivos: {},
    meta: n.meta && n.meta.aterrizarEn != null && n.meta.aterrizarEn < planetas.length ? { aterrizarEn: n.meta.aterrizarEn } : null,
  };
  for (const o of n.objetos || []) {
    if (o.planeta >= planetas.length) continue;
    const dir = aV3(o.dir).normalize(), planeta = o.planeta;
    switch (o.tipo) {
      case 'isla': def.islas.push({ planeta, dir, alto: o.alto, ancho: o.ancho, ...(o.veg ? { veg: o.veg } : {}), ...(o.canon ? { canon: true } : {}) }); break;
      case 'roca': def.rocas.push({ planeta, dir, h: o.h, R: o.R }); break;
      case 'enemigo': def.enemigos.push([o.clase || 'small', planeta, dir]); break;
      case 'cartel': def.carteles.push({ planeta, dir, icono: o.icono || 'leer', paginas: (o.paginas || []).filter(Boolean).length ? o.paginas.filter(Boolean) : ['…'] }); break;
      case 'boton': def.boton = { planeta, dir }; break;
      case 'muros': def.muros = { planeta, dir, lado: o.lado, alto: o.alto, grosor: o.grosor, ...(o.estilo ? { estilo: o.estilo } : {}) }; break;
      case 'canon': def.canon = { planeta, dir }; break;
      case 'flores': def.flores = { planeta, dir }; break;
      case 'inicio': def.inicio = { planeta, dir, mirar: adelante(dir) }; break;
      case 'fragmento': def.fragmento = { planeta, dir, h: o.h }; break;
      case 'nota': def.notas.push({ planeta, dir, texto: o.texto || '', tam: o.tam || 2 }); break;
    }
  }
  if (!def.inicio) def.inicio = { planeta: 0, dir: new V3(0, 1, 0), mirar: new V3(0, 0, -1) };
  // extras que el editor todavía no dibuja, pero que no se pueden perder al ir y volver (ovni, jefe, vegetación)
  const ex = n.extras || {};
  if (ex.vegetacion) def.vegetacion = { ...ex.vegetacion, camino: ex.vegetacion.camino && aV3(ex.vegetacion.camino) };
  if (ex.ovni) def.ovni = { ...ex.ovni, normal: aV3(ex.ovni.normal).normalize(), empieza: aV3(ex.ovni.empieza) };
  if (ex.jefe) def.jefe = { ...ex.jefe, dir: aV3(ex.jefe.dir).normalize(), entrada: aV3(ex.jefe.entrada).normalize() };
  return def;
}

/**
 * Juego → editor. Sirve para abrir en el editor un nivel ya hecho (Columba, Laboratorio).
 * Los anillos del Laboratorio no se pasan: no son física (curva de Bézier).
 */
export function editorDesdeNivel(def) {
  const n = {
    formato: 'alma-lunar-nivel', version: 1,
    nombre: def.nombre, ley: def.ley || '', superDesdeInicio: !!def.superDesdeInicio,
    planetas: def.planetas.map(p => {
      const base = p.base || (p.mar ? 'agua' : 'tierra');
      const q = { name: p.name, c: aArr(p.c, 3), R: p.R, g: p.g, base, color: hexATexto(p.color), seed: p.seed ?? 11 };
      if (p.mar) { q.mar = p.mar; q.colorMar = hexATexto(p.colorMar ?? BASES.agua.colorMar); }
      return q;
    }),
    objetos: [],
    meta: def.meta ? { aterrizarEn: def.meta.aterrizarEn } : null,
  };
  const add = (tipo, o, extra = {}) => n.objetos.push({ tipo, planeta: o.planeta, dir: aArr(o.dir.clone().normalize()), ...extra });
  for (const s of def.islas || []) add('isla', s, { alto: s.alto, ancho: s.ancho, ...(s.veg ? { veg: s.veg } : {}), ...(s.canon ? { canon: true } : {}) });
  for (const r of def.rocas || []) add('roca', r, { R: r.R, h: r.h });
  for (const [clase, planeta, dir] of def.enemigos || []) add('enemigo', { planeta, dir }, { clase });
  for (const c of def.carteles || []) add('cartel', c, { icono: c.icono || 'leer', paginas: c.paginas || [c.texto || ''] });
  for (const k of ['boton', 'canon', 'flores', 'inicio']) if (def[k]) add(k, def[k]);
  if (def.muros) add('muros', def.muros, { lado: def.muros.lado, alto: def.muros.alto, grosor: def.muros.grosor, ...(def.muros.estilo ? { estilo: def.muros.estilo } : {}) });
  const extras = {};
  if (def.vegetacion) extras.vegetacion = { ...def.vegetacion, camino: def.vegetacion.camino && aArr(def.vegetacion.camino) };
  if (def.ovni) extras.ovni = { ...def.ovni, normal: aArr(def.ovni.normal), empieza: aArr(def.ovni.empieza) };
  if (def.jefe) extras.jefe = { ...def.jefe, dir: aArr(def.jefe.dir), entrada: aArr(def.jefe.entrada) };
  if (Object.keys(extras).length) n.extras = extras;
  if (def.fragmento) add('fragmento', def.fragmento, { h: def.fragmento.h || 1.4 });
  for (const t of def.notas || []) add('nota', t, { texto: t.texto, tam: t.tam });
  return n;
}

/** Revisa que un texto sea un nivel del editor y lo devuelve como objeto (o lanza un error claro). */
export function leerNivelJSON(texto) {
  const n = JSON.parse(texto);
  if (!n || !Array.isArray(n.planetas) || !n.planetas.length) throw new Error('El archivo no tiene planetas.');
  if (!Array.isArray(n.objetos)) n.objetos = [];
  return n;
}
