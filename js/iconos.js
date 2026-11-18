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

  // ---- otros ----
  luna: `<path d="M3 11.5066C3 16.7497 7.25034 21 12.4934 21C16.2209 21 19.4466 18.8518 21 15.7259C12.4934 15.7259 8.27411 11.5066 8.27411 3C5.14821 4.55344 3 7.77915 3 11.5066Z" ${L}/>`,   // Iconoir half-moon
  brillo: `<path d="M8 15C12.8747 15 15 12.949 15 8C15 12.949 17.1104 15 22 15C17.1104 15 15 17.1104 15 22C15 17.1104 12.8747 15 8 15Z" ${L}/><path d="M2 6.5C5.13376 6.5 6.5 5.18153 6.5 2C6.5 5.18153 7.85669 6.5 11 6.5C7.85669 6.5 6.5 7.85669 6.5 11C6.5 7.85669 5.13376 6.5 2 6.5Z" ${L}/>`,   // Iconoir sparks
  celular: `<path d="M12 16.01L12.01 15.9989" ${L}/><path d="M7 19.4V4.6C7 4.26863 7.26863 4 7.6 4H16.4C16.7314 4 17 4.26863 17 4.6V19.4C17 19.7314 16.7314 20 16.4 20H7.6C7.26863 20 7 19.7314 7 19.4Z" stroke="currentColor"/>`,   // Iconoir smartphone-device
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
