/* =========================================================
   Pruebas del formato del editor · node pruebas/formato.test.mjs
   ---------------------------------------------------------
   Revisan que un nivel pase por el editor SIN cambiar:
   juego → editor → JSON (texto) → editor → juego
   y que las cosas queden en el mismo lugar.
   ========================================================= */
import columba from '../js/niveles/nivel1-columba.js';
import { editorDesdeNivel, nivelDesdeEditor, nivelVacio, leerNivelJSON } from '../js/niveles/formato.js';

let fallas = 0;
function revisar(nombre, ok, detalle = '') {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? '  (' + detalle + ')' : ''}`);
  if (!ok) fallas++;
}

// ida y vuelta, pasando por texto como cuando se exporta un archivo
const texto = JSON.stringify(editorDesdeNivel(columba));
const vuelta = nivelDesdeEditor(leerNivelJSON(texto));

revisar('mismos planetas', vuelta.planetas.length === columba.planetas.length);
revisar('mismo radio, mar y gravedad', vuelta.planetas.every((p, i) => p.R === columba.planetas[i].R && p.g === columba.planetas[i].g && p.mar === columba.planetas[i].mar));
const maxDist = Math.max(...vuelta.planetas.map((p, i) => p.c.distanceTo(columba.planetas[i].c)));
revisar('planetas en el mismo lugar (±1 mm)', maxDist < 1e-3, `máx ${maxDist.toExponential(1)} m`);
revisar('mismas islas', vuelta.islas.length === columba.islas.length);
// el error de redondear la dirección a 4 decimales, en metros sobre el mar de Columba (R = 42)
const err = Math.max(...vuelta.islas.map((s, i) => s.dir.distanceTo(columba.islas[i].dir) * 42));
revisar('islas en el mismo lugar (±1 cm)', err < 0.01, `máx ${(err * 100).toFixed(2)} cm`);
revisar('mismos enemigos', vuelta.enemigos.length === columba.enemigos.length);
revisar('mismos carteles y textos', vuelta.carteles.length === columba.carteles.length &&
  vuelta.carteles.every((c, i) => c.paginas.join() === columba.carteles[i].paginas.join()));
revisar('cañón, botón, muros y flores', !!(vuelta.canon && vuelta.boton && vuelta.muros && vuelta.flores));
revisar('muros igual de altos', vuelta.muros.alto === columba.muros.alto);
revisar('misma meta (aterrizar en Ícaro)', vuelta.meta.aterrizarEn === columba.meta.aterrizarEn);

// nivel vacío
const v = nivelDesdeEditor(nivelVacio());
revisar('nivel vacío tiene inicio', !!v.inicio && v.planetas.length === 1);
let error = '';
try { leerNivelJSON('{"hola": 1}'); } catch (e) { error = e.message; }
revisar('un archivo sin planetas da un error claro', error.includes('planetas'), error);

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
