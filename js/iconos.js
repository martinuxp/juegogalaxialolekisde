/* =========================================================
   iconos.js · Íconos SVG del juego (nada de emojis)
   ---------------------------------------------------------
   Casi todos vienen de Iconoir (licencia MIT, © Luca Burgio,
   https://iconoir.com). Los marcados como PROPIO los dibujamos
   nosotros con el mismo estilo: líneas de 24×24 sin relleno.
   Van escritos aquí (no se descargan), así el juego funciona
   sin internet en la feria.

   Uso:  icono('dash')  → texto <svg>…</svg> para innerHTML
         <span data-icono="dash"></span> en el HTML se rellena solo.
   ========================================================= */
const L = 'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

const TRAZOS = {
  // ---- acciones (botones) ----
  dash: `<path d="M13 6L19 12L13 18" ${L}/><path d="M5 6L11 12L5 18" ${L}/>`,                          // Iconoir fast-arrow-right
  salto: `<path d="M12 16V4M12 4L7.5 8.5M12 4L16.5 8.5" ${L}/><path d="M5 20H19" ${L}/><path d="M8 17L9 15.5M16 17L15 15.5" ${L}/>`,   // PROPIO
  puno: `<path d="M8.48901 17.7273H18.3556M8.48901 17.7273V21H18.3556V17.7273M8.48901 17.7273C5.20016 15.5455 3.55573 10.0909 4.10387 8.45455C4.54239 7.14545 6.47916 7.54545 7.39273 7.90909C7.39273 4.09091 9.03715 3 13.4223 3C17.8074 3 20 4.09091 20 9.54545C20 13.9091 18.9037 16.8182 18.3556 17.7273" ${L}/><path d="M7.39282 7.90909C7.75825 8.27272 8.81799 9 10.1335 9C11.4491 9 13.9705 9 15.0668 9" ${L}/><path d="M7.39282 7.90909C7.39282 11.7273 9.03725 12.2727 10.1335 12.2727" ${L}/>`,   // Iconoir boxing-glove
  pisoton: `<path d="M12 3V14M12 14L7.5 9.5M12 14L16.5 9.5" ${L}/><path d="M3 19H21" ${L}/><path d="M6 16.5L4 15M18 16.5L20 15" ${L}/>`,   // PROPIO
  canon: `<path d="M7.5 13.5L16 5L19.5 8.5L11 17" ${L}/><circle cx="9" cy="17" r="3" ${L}/><path d="M4 21H14" ${L}/><path d="M20 2.5V3.5M22 5H21M21.5 2.5L20.8 3.2" ${L}/>`,   // PROPIO
  super: `<path d="M16.0614 10.4037L14 17L10 17L7.93865 10.4037C7.35085 8.52273 7.72417 6.47307 8.93738 4.92015L11.5272 1.6052C11.7674 1.29772 12.2326 1.29772 12.4728 1.6052L15.0626 4.92015C16.2758 6.47307 16.6491 8.52273 16.0614 10.4037Z" ${L}/><path d="M10 20C10 22 12 23 12 23C12 23 14 22 14 20" ${L}/><path d="M8.5 12.5C5 15 7 19 7 19L10 17" ${L}/><path d="M15.9312 12.5C19.4312 15 17.4312 19 17.4312 19L14.4312 17" ${L}/>`,   // Iconoir rocket
  leer: `<path d="M12 21V12" ${L}/><path d="M5 4H16.5L20 7.5L16.5 11H5V4Z" ${L}/><path d="M8 7.5H14" ${L}/><path d="M9 21H15" ${L}/>`,   // PROPIO (cartel)
  teclaE: `<rect x="3" y="3" width="18" height="18" rx="4" ${L}/><path d="M15 8H9.5V16H15M9.5 12H14" ${L}/>`,   // PROPIO (tecla E, para el PC)
  mover: `<path d="M12.4409 9.12717L11.0322 14.7618L15.9626 21.1008" ${L}/><path d="M10.3278 18.2835L8.21484 21.1008" ${L}/><path d="M8.21484 13.3532C8.21484 9.40889 11.0323 9.12714 12.4409 9.12717L13.8494 9.12714C14.0842 10.301 15.1172 12.7897 17.3711 13.3531" ${L}/><path d="M13 7C14.1046 7 15 6.10457 15 5C15 3.89543 14.1046 3 13 3C11.8954 3 11 3.89543 11 5C11 6.10457 11.8954 7 13 7Z" ${L}/>`,   // Iconoir walking

  // ---- herramientas de arriba ----
  menu: `<path d="M3 5H21M3 12H21M3 19H21" ${L}/>`,                                                      // Iconoir menu
  tiempo: `<path d="M9 2L15 2" ${L}/><path d="M12 10L12 14" ${L}/><path d="M12 22C16.4183 22 20 18.4183 20 14C20 9.58172 16.4183 6 12 6C7.58172 6 4 9.58172 4 14C4 18.4183 7.58172 22 12 22Z" ${L}/>`,   // Iconoir timer
  camara: `<path d="M15 12V16.4C15 16.7314 14.7314 17 14.4 17H3.6C3.26863 17 3 16.7314 3 16.4V7.6C3 7.26863 3.26863 7 3.6 7H14.4C14.7314 7 15 7.26863 15 7.6V12ZM15 12L20.0159 7.82009C20.4067 7.49443 21 7.77232 21 8.28103V15.719C21 16.2277 20.4067 16.5056 20.0159 16.1799L15 12Z" ${L}/>`,   // Iconoir video-camera
  enemigos: `<path d="M21.1679 8C19.6247 4.46819 16.1006 2 11.9999 2C6.81459 2 2.55104 5.94668 2.04932 11" ${L}/><path d="M17 8H21.4C21.7314 8 22 7.73137 22 7.4V3" ${L}/><path d="M2.88146 16C4.42458 19.5318 7.94874 22 12.0494 22C17.2347 22 21.4983 18.0533 22 13" ${L}/><path d="M7.04932 16H2.64932C2.31795 16 2.04932 16.2686 2.04932 16.6V21" ${L}/>`,   // Iconoir refresh-double
  gravedad: `<circle cx="12" cy="12" r="8" stroke="currentColor"/><path d="M17.4995 6.34835C19.7975 5.80967 21.4447 5.87208 21.8376 6.66002C22.5686 8.12616 18.6797 11.5491 13.1515 14.3053C7.62327 17.0616 2.5492 18.1074 1.81821 16.6413C1.4263 15.8553 2.36234 14.5067 4.16701 13.0001" stroke="currentColor"/>`,   // Iconoir planet
  debug: `<path d="M13.5 6L10 18.5" ${L}/><path d="M6.5 8.5L3 12L6.5 15.5" ${L}/><path d="M17.5 8.5L21 12L17.5 15.5" ${L}/>`,   // Iconoir code
  saltar: `<path d="M18 7V17" ${L}/><path d="M6.97179 5.2672C6.57832 4.95657 6 5.23682 6 5.73813V18.2619C6 18.7632 6.57832 19.0434 6.97179 18.7328L14.9035 12.4709C15.2078 12.2307 15.2078 11.7693 14.9035 11.5291L6.97179 5.2672Z" ${L}/>`,   // Iconoir skip-next
  flecha: `<path d="M9 6L15 12L9 18" ${L}/>`,                                                              // Iconoir nav-arrow-right

  sonido: `<path d="M1 13.8571V10.1429C1 9.51167 1.48842 9 2.09091 9H6.09091L10.6727 4.2C11.3001 3.54281 12.2727 4.00961 12.2727 4.95562V19.0444C12.2727 19.9904 11.3001 20.4572 10.6727 19.8L6.09091 15H2.09091C1.48842 15 1 14.4883 1 13.8571Z" ${L}/><path d="M16 8.5C16 8.5 17.5 9.5 17.5 12C17.5 14.5 16 15.5 16 15.5" ${L}/><path d="M19 5.5C19 5.5 21.5 7.5 21.5 12C21.5 16.5 19 18.5 19 18.5" ${L}/>`,   // Iconoir sound-high
  silencio: `<path d="M1 13.8571V10.1429C1 9.51167 1.48842 9 2.09091 9H6.09091L10.6727 4.2C11.3001 3.54281 12.2727 4.00961 12.2727 4.95562V19.0444C12.2727 19.9904 11.3001 20.4572 10.6727 19.8L6.09091 15H2.09091C1.48842 15 1 14.4883 1 13.8571Z" ${L}/><path d="M16 9.5L21 14.5M21 9.5L16 14.5" ${L}/>`,   // Iconoir sound-off

  // ---- otros ----
  luna: `<path d="M3 11.5066C3 16.7497 7.25034 21 12.4934 21C16.2209 21 19.4466 18.8518 21 15.7259C12.4934 15.7259 8.27411 11.5066 8.27411 3C5.14821 4.55344 3 7.77915 3 11.5066Z" ${L}/>`,   // Iconoir half-moon
  brillo: `<path d="M8 15C12.8747 15 15 12.949 15 8C15 12.949 17.1104 15 22 15C17.1104 15 15 17.1104 15 22C15 17.1104 12.8747 15 8 15Z" ${L}/><path d="M2 6.5C5.13376 6.5 6.5 5.18153 6.5 2C6.5 5.18153 7.85669 6.5 11 6.5C7.85669 6.5 6.5 7.85669 6.5 11C6.5 7.85669 5.13376 6.5 2 6.5Z" ${L}/>`,   // Iconoir sparks
  celular: `<path d="M12 16.01L12.01 15.9989" ${L}/><path d="M7 19.4V4.6C7 4.26863 7.26863 4 7.6 4H16.4C16.7314 4 17 4.26863 17 4.6V19.4C17 19.7314 16.7314 20 16.4 20H7.6C7.26863 20 7 19.7314 7 19.4Z" stroke="currentColor"/>`,   // Iconoir smartphone-device
  misteriosa: `<path d="M5.5 11C5.5 6.5 8.5 3.5 12 3.5C15.5 3.5 18.5 6.5 18.5 11C18.5 15.5 15.5 18.5 12 18.5C8.5 18.5 5.5 15.5 5.5 11Z" ${L}/><path d="M6 9.5C7.5 5.5 16.5 5.5 18 9.5" ${L}/><path d="M6.2 12.5C5 15 5 19 4.5 21M17.8 12.5C19 15 19 19 19.5 21" ${L}/><circle cx="10" cy="11.5" r="1.4" fill="currentColor" ${L}/><circle cx="14.2" cy="12" r="1" fill="currentColor" ${L}/>`,   // PROPIO (la personaje misteriosa de Ícaro)
  botas: `<path d="M7 3H12V13L18 15.5C19.2 16 20 17.2 20 18.5V19H5V3.5" ${L}/><path d="M5 21H20" ${L}/><path d="M7 7H10M7 10H10" ${L}/>`,   // PROPIO (botas de salto)
  alien: `<path d="M5 10.5L4.5 5.5L8.5 8M19 10.5L19.5 5.5L15.5 8" ${L}/><path d="M12 8C17 8 19.5 10.5 19.5 14C19.5 17.5 16.5 20 12 20C7.5 20 4.5 17.5 4.5 14C4.5 10.5 7 8 12 8Z" ${L}/><path d="M10 8L9 3.5M14 8L15 3.5" ${L}/><circle cx="9" cy="3" r="0.6" ${L}/><circle cx="15" cy="3" r="0.6" ${L}/><path d="M8.5 13.5H10.5M13.5 13.5H15.5M11.3 16.3L12 16.8L12.7 16.3" ${L}/>`,   // PROPIO (gato-alien de Ícaro)
  meowl: `<path d="M6 9.5L5.5 4.5L9.5 7M18 9.5L18.5 4.5L14.5 7" ${L}/><path d="M12 6.8C16 6.8 18.5 9 18.5 12.5C18.5 14.3 17.6 15.6 16.5 16.4L17 21H7L7.5 16.4C6.4 15.6 5.5 14.3 5.5 12.5C5.5 9 8 6.8 12 6.8Z" ${L}/><circle cx="9.6" cy="11.6" r="1.5" ${L}/><circle cx="14.4" cy="11.6" r="1.5" ${L}/><path d="M11.4 14.2L12 14.8L12.6 14.2M9 21V18.5M15 21V18.5" ${L}/>`,   // PROPIO (Meowl: cabeza de gato, cuerpo de búho)
  meimei: `<path d="M6.5 9.5C6 7.5 6.3 6 7.5 5.6C8.5 5.3 9.3 6.2 9.6 7.3M17.5 9.5C18 7.5 17.7 6 16.5 5.6C15.5 5.3 14.7 6.2 14.4 7.3" ${L}/><path d="M12 7C16.4 7 19 9.6 19 13C19 16.6 16 19 12 19C8 19 5 16.6 5 13C5 9.6 7.6 7 12 7Z" ${L}/><ellipse cx="9.3" cy="12.4" rx="1.5" ry="1.8" ${L}/><ellipse cx="14.7" cy="12.4" rx="1.5" ry="1.8" ${L}/><path d="M11.2 15.3L12 16L12.8 15.3M10.6 4L9.8 1.8M13.4 4L14.2 1.8M12 9.2V9.3M8 16.7L7.9 16.8M16 16.7L16.1 16.8" ${L}/><path d="M19 15C21 15.5 22 17 21.5 19.5C21 21 19.5 21.5 18 21" ${L}/>`,   // PROPIO (MeiMei: cara de leopardo de las nieves, ojos grandes, antenas y la cola gorda)
  ovni: `<path d="M8 10C8 7.5 9.8 6 12 6C14.2 6 16 7.5 16 10" ${L}/><path d="M3 12.5C3 11.1 7 10 12 10C17 10 21 11.1 21 12.5C21 13.9 17 15 12 15C7 15 3 13.9 3 12.5Z" ${L}/><path d="M9 18L8 20.5M15 18L16 20.5M12 18.5V21" ${L}/>`,   // PROPIO (ovni)

  // ---- editor de planetas (todos PROPIOS, mismo estilo de líneas) ----
  edMano: `<path d="M5 3L5 18L9 14.5L12 21L14.5 20L11.5 13.5H17L5 3Z" ${L}/>`,
  edTerreno: `<path d="M2 20L9 8L13 14L16 10L22 20H2Z" ${L}/><path d="M7.5 10.5L9 12L10.5 10.5" ${L}/>`,
  edRoca: `<path d="M4 18L6 10L11 6L17 7.5L20.5 13L19 18H4Z" ${L}/><path d="M11 6L12 12L20.5 13M12 12L6 10M12 12L10 18" ${L}/>`,
  edEnemigo: `<path d="M4 18C4 11 7.5 6 12 6C16.5 6 20 11 20 18H4Z" ${L}/><path d="M9 12.5V13.5M15 12.5V13.5" ${L}/><path d="M8 9L10 10.5M16 9L14 10.5" ${L}/>`,
  edBoton: `<path d="M3 17H21" ${L}/><path d="M5 17V15.5C5 14.7 5.7 14 6.5 14H17.5C18.3 14 19 14.7 19 15.5V17" ${L}/><path d="M8 14V12C8 11.4 8.4 11 9 11H15C15.6 11 16 11.4 16 12V14" ${L}/><path d="M12 3V8M12 8L9.5 5.5M12 8L14.5 5.5" ${L}/>`,
  edMuros: `<path d="M3 20V6H21V20" ${L}/><path d="M3 10H21M3 15H21M8 6V10M15 6V10M11.5 10V15M5.5 15V20M18 15V20M11.5 15V20M18.5 10V15M5.5 10V15" ${L}/>`,
  edFlores: `<circle cx="12" cy="8" r="2.2" ${L}/><path d="M12 5.8C12 3 14.5 3 14.5 3C14.5 3 14.5 5.5 12 5.8ZM12 5.8C12 3 9.5 3 9.5 3C9.5 3 9.5 5.5 12 5.8Z" ${L}/><path d="M12 10.2V21M12 17C9 17 7.5 14.5 7.5 14.5C10.5 14 12 16 12 17ZM12 15C15 15 16.5 12.5 16.5 12.5C13.5 12 12 14 12 15Z" ${L}/><path d="M6 21H18" ${L}/>`,
  edInicio: `<path d="M6 21V4" ${L}/><path d="M6 4H18L15.5 8L18 12H6" ${L}/>`,
  edFragmento: `<path d="M12 2L17 9L12 22L7 9L12 2Z" ${L}/><path d="M7 9H17M12 2V22" ${L}/>`,
  edNota: `<path d="M5 3H15L19 7V21H5V3Z" ${L}/><path d="M15 3V7H19" ${L}/><path d="M9.5 11C9.5 9.6 10.6 8.8 12 8.8C13.4 8.8 14.5 9.6 14.5 11C14.5 12.6 12 12.8 12 14.5" ${L}/><path d="M12 17.5V17.6" ${L}/>`,
  edBorrar: `<path d="M20 20H9L4 15C3.4 14.4 3.4 13.6 4 13L13 4C13.6 3.4 14.4 3.4 15 4L20 9C20.6 9.6 20.6 10.4 20 11L11 20" ${L}/><path d="M9 8L16 15" ${L}/>`,
  edDeshacer: `<path d="M9 14L4 9L9 4" ${L}/><path d="M4 9H15C18 9 20 11.2 20 14.5C20 17.8 18 20 15 20H8" ${L}/>`,
  edRehacer: `<path d="M15 14L20 9L15 4" ${L}/><path d="M20 9H9C6 9 4 11.2 4 14.5C4 17.8 6 20 9 20H16" ${L}/>`,
  edExportar: `<path d="M12 3V15M12 15L7.5 10.5M12 15L16.5 10.5" ${L}/><path d="M4 17V20H20V17" ${L}/>`,
  edImportar: `<path d="M12 15V3M12 3L7.5 7.5M12 3L16.5 7.5" ${L}/><path d="M4 17V20H20V17" ${L}/>`,
  edCopiar: `<path d="M8 8H20V20H8V8Z" ${L}/><path d="M16 8V4H4V16H8" ${L}/>`,
  edProbar: `<path d="M7 4.5V19.5C7 20 7.6 20.3 8 20L19.5 12.5C19.9 12.2 19.9 11.8 19.5 11.5L8 4C7.6 3.7 7 4 7 4.5Z" ${L}/>`,
  edSalir: `<path d="M6 6L18 18M18 6L6 18" ${L}/>`,
  edNuevo: `<path d="M5 3H14L19 8V21H5V3Z" ${L}/><path d="M12 11V17M9 14H15" ${L}/>`,
  edPlanetaMas: `<circle cx="10" cy="13" r="7" ${L}/><path d="M19 2V8M16 5H22" ${L}/>`,
  edFoco: `<circle cx="12" cy="12" r="3" ${L}/><path d="M3 8V3H8M16 3H21V8M21 16V21H16M8 21H3V16" ${L}/>`,
  edEditor: `<path d="M14 6L18 10" ${L}/><path d="M4 20L4.5 16.5L15.5 5.5C16.3 4.7 17.7 4.7 18.5 5.5C19.3 6.3 19.3 7.7 18.5 8.5L7.5 19.5L4 20Z" ${L}/>`,
  corazon: `<path fill-rule="evenodd" clip-rule="evenodd" d="M11.9999 3.94228C13.1757 2.85872 14.7069 2.25 16.3053 2.25C18.0313 2.25 19.679 2.95977 20.8854 4.21074C22.0832 5.45181 22.75 7.1248 22.75 8.86222C22.75 10.5997 22.0831 12.2728 20.8854 13.5137C20.089 14.3393 19.2938 15.1836 18.4945 16.0323C16.871 17.7562 15.2301 19.4985 13.5256 21.14L13.5216 21.1438C12.6426 21.9779 11.2505 21.9476 10.409 21.0754L3.11399 13.5136C0.62867 10.9374 0.62867 6.78707 3.11399 4.21085C5.54605 1.68984 9.46239 1.60032 11.9999 3.94228Z" fill="currentColor"/>`,   // Iconoir heart (solid)
};

/** Devuelve el SVG del ícono como texto. grosor = ancho de la línea. */
export function icono(nombre, grosor = 1.8) {
  const t = TRAZOS[nombre];
  if (!t) return '';
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke-width="${grosor}" aria-hidden="true">${t}</svg>`;
}

/** Rellena todos los elementos del HTML que tengan data-icono="…". */
export function pintarIconos(raiz = document) {
  for (const el of raiz.querySelectorAll('[data-icono]')) {
    el.innerHTML = icono(el.dataset.icono, +(el.dataset.grosor || 1.8));
  }
}

/** Dibuja un ícono en un canvas 2D (para las tablas de los carteles 3D). */
export function iconoEnCanvas(g, nombre, x, y, tam, color = '#fff', grosor = 1.8) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke-width="${grosor}" style="color:${color}">${TRAZOS[nombre].replaceAll('currentColor', color)}</svg>`;
  const img = new Image();
  return new Promise(ok => {
    img.onload = () => { g.drawImage(img, x, y, tam, tam); ok(); };
    img.onerror = () => ok();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
