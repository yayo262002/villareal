import type { Ubicacion } from "./direcciones.ts";

/**
 * El plano de Barquisimeto: la cuadrícula del centro (calles y carreras
 * numeradas) puesta sobre el mapa de verdad, para que una dirección por
 * calle y carrera y un lugar con nombre (un centro comercial, una avenida)
 * se puedan comparar en el mismo plano y entrar en la misma ruta.
 *
 * La fórmula sale de OpenStreetMap: el 30/09/2026 se bajaron las calles y
 * carreras numeradas de la ciudad, se calcularon 605 cruces de la
 * cuadrícula del centro (calles 8 a 55, carreras 5 a 36) y se ajustó una
 * relación lineal (calle, carrera) → (latitud, longitud). El error medio es
 * de unos 20 metros y el mayor, de 60. Fuera del centro la cuadrícula se
 * prolonga en línea recta: sirve para ordenar una ruta, no para encontrar
 * una puerta. Cálculo puro, con pruebas.
 */

export type Punto = { lat: number; lon: number };

export const CUADRICULA = {
  latA: 10.049010320706032,
  latB: -0.00007451196463776712,
  latC: 0.0009953970400978398,
  lonA: -69.29012274039363,
  lonB: -0.0009826542750129516,
  lonC: -0.00007827933507720218,
};

/** Metros que mide una cuadra, según esa misma fórmula: 108 de calle a calle, 111 de carrera a carrera. */
export const METROS_POR_CUADRA_DE_CALLE = 108;
export const METROS_POR_CUADRA_DE_CARRERA = 111;

/** Dónde cae en el mapa un cruce de la cuadrícula (o un punto entre dos). */
export function puntoDeCuadricula(u: Ubicacion): Punto {
  const c = CUADRICULA;
  return {
    lat: c.latA + c.latB * u.calle + c.latC * u.carrera,
    lon: c.lonA + c.lonB * u.calle + c.lonC * u.carrera,
  };
}

/**
 * Al revés: a qué calle y carrera (con decimales) corresponde un punto del
 * mapa. Un lugar fuera del centro da números fuera de la cuadrícula, hasta
 * negativos; solo sirven para medir cuadras hasta él.
 */
export function cuadriculaDePunto(p: Punto): Ubicacion {
  const c = CUADRICULA;
  const dLat = p.lat - c.latA;
  const dLon = p.lon - c.lonA;
  const det = c.latB * c.lonC - c.latC * c.lonB;
  return {
    calle: (dLat * c.lonC - c.latC * dLon) / det,
    carrera: (c.latB * dLon - c.lonB * dLat) / det,
  };
}

/** Distancia en línea recta entre dos puntos del mapa, en metros. */
export function metrosEntre(a: Punto, b: Punto): number {
  const radio = 6371000;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radio * Math.asin(Math.sqrt(h));
}

/** Los alrededores de Barquisimeto (con Cabudare). Un punto fuera de aquí no es de un cliente de la ruta. */
export const ALREDEDORES = { latMin: 9.95, latMax: 10.2, lonMin: -69.45, lonMax: -69.15 };

export function estaEnLosAlrededores(p: Punto): boolean {
  return p.lat >= ALREDEDORES.latMin && p.lat <= ALREDEDORES.latMax && p.lon >= ALREDEDORES.lonMin && p.lon <= ALREDEDORES.lonMax;
}

/** «10.0765,-69.3299», como lo entiende Google Maps de destino. */
export function puntoParaElMapa(p: Punto): string {
  return `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
}
