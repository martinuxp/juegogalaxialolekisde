/* Lista de niveles en orden. Para agregar uno: crear el archivo y sumarlo aquí. */
import columba from './nivel1-columba.js';
import icaro from './nivel2-icaro.js';
import laboratorio from './laboratorio.js';
import superficieIcaro from './nivel2-icaro-superficie.js';

export const NIVELES = [columba, icaro];   // pronto: kepler, aestus, fortaleza
export const LABORATORIO = laboratorio;
export const SUPERFICIE_ICARO = superficieIcaro;   // Ícaro, parte 2 (se llega desde el laberinto de la cueva)
