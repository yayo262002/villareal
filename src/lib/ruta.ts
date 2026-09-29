import type { Ubicacion } from "./direcciones.ts";

/**
 * El orden en que conviene visitar a los clientes al despachar: se sale de
 * la tienda, se pasa por todos y se vuelve, andando lo menos posible.
 *
 * La distancia se cuenta en cuadras, como se anda por una cuadrícula: las
 * que hay de calle a calle más las que hay de carrera a carrera. No sabe de
 * sentidos de las calles ni de tráfico; para eso está el enlace a Google
 * Maps, que recibe las paradas ya en este orden.
 *
 * Con pocas paradas se prueban todos los órdenes y sale el mejor. Con
 * muchas se parte del «vecino más cercano» y se mejora cambiando tramos de
 * sitio hasta que ningún cambio acorta la ruta.
 *
 * En una cuadrícula muchas vueltas miden lo mismo. Entre dos iguales gana
 * la que llega antes a los clientes: la que suma menos espera entre todos.
 * Cálculo puro, con pruebas.
 */

export type Parada<T> = { dato: T; ubicacion: Ubicacion };

export type Ruta<T> = {
  /** Las paradas en el orden de visita. */
  paradas: (Parada<T> & { cuadrasDesdeLaAnterior: number })[];
  /** Las cuadras de toda la vuelta, contando el regreso a la tienda. */
  cuadras: number;
  cuadrasDeVuelta: number;
};

/** Hasta este número de paradas se prueban todos los órdenes posibles. */
const LIMITE_PARA_PROBARLO_TODO = 8;

/** Metros de una cuadra del centro de Barquisimeto, de esquina a esquina. */
export const METROS_POR_CUADRA = 100;

export function cuadrasEntre(a: Ubicacion, b: Ubicacion): number {
  return Math.abs(a.calle - b.calle) + Math.abs(a.carrera - b.carrera);
}

/** Cuánto mide una vuelta y cuánto hace esperar a los clientes. */
type Medida = { largo: number; espera: number };

const IGUALES = 1e-9;

/** Si la medida `a` es mejor que la `b`: más corta o, midiendo lo mismo, con menos espera. */
function esMejor(a: Medida, b: Medida): boolean {
  if (a.largo < b.largo - IGUALES) return true;
  if (a.largo > b.largo + IGUALES) return false;
  return a.espera < b.espera - IGUALES;
}

/**
 * Salir del origen, pasar por los puntos en ese orden y volver. La espera
 * es la suma de las cuadras recorridas al llegar a cada cliente.
 */
function medirLaVuelta(origen: Ubicacion, puntos: Ubicacion[]): Medida {
  let recorrido = 0;
  let espera = 0;
  let anterior = origen;
  for (const punto of puntos) {
    recorrido += cuadrasEntre(anterior, punto);
    espera += recorrido;
    anterior = punto;
  }
  return { largo: recorrido + cuadrasEntre(anterior, origen), espera };
}

function vecinoMasCercano(origen: Ubicacion, puntos: Ubicacion[]): number[] {
  const pendientes = puntos.map((_, i) => i);
  const orden: number[] = [];
  let actual = origen;
  while (pendientes.length > 0) {
    let mejor = 0;
    for (let i = 1; i < pendientes.length; i++) {
      if (cuadrasEntre(actual, puntos[pendientes[i]]) < cuadrasEntre(actual, puntos[pendientes[mejor]])) mejor = i;
    }
    const [elegido] = pendientes.splice(mejor, 1);
    orden.push(elegido);
    actual = puntos[elegido];
  }
  return orden;
}

/** Todos los órdenes posibles. Solo para pocas paradas: crecen muy deprisa. */
function mejorDeTodos(origen: Ubicacion, puntos: Ubicacion[]): number[] {
  let mejor: number[] = puntos.map((_, i) => i);
  let medida = medirLaVuelta(origen, puntos);
  const orden: number[] = [];
  const usado = puntos.map(() => false);

  const probar = (recorrido: number, espera: number, ultimo: Ubicacion) => {
    // Lo andado ya pasa de la mejor vuelta entera: por aquí no sale nada mejor.
    if (recorrido > medida.largo + IGUALES) return;
    if (orden.length === puntos.length) {
      const candidata = { largo: recorrido + cuadrasEntre(ultimo, origen), espera };
      if (esMejor(candidata, medida)) {
        medida = candidata;
        mejor = [...orden];
      }
      return;
    }
    for (let i = 0; i < puntos.length; i++) {
      if (usado[i]) continue;
      usado[i] = true;
      orden.push(i);
      const hasta = recorrido + cuadrasEntre(ultimo, puntos[i]);
      probar(hasta, espera + hasta, puntos[i]);
      orden.pop();
      usado[i] = false;
    }
  };
  probar(0, 0, origen);
  return mejor;
}

/** Mejora un orden dándole la vuelta a tramos y moviendo paradas sueltas, hasta que nada acorta. */
function mejorar(origen: Ubicacion, puntos: Ubicacion[], inicial: number[]): number[] {
  let orden = [...inicial];
  let medida = medirLaVuelta(origen, orden.map((i) => puntos[i]));
  const intentar = (candidato: number[]): boolean => {
    const nueva = medirLaVuelta(origen, candidato.map((i) => puntos[i]));
    if (esMejor(nueva, medida)) {
      orden = candidato;
      medida = nueva;
      return true;
    }
    return false;
  };

  let huboMejora = true;
  while (huboMejora) {
    huboMejora = false;
    // Dar la vuelta a un tramo.
    for (let i = 0; i < orden.length - 1; i++) {
      for (let j = i + 1; j < orden.length; j++) {
        const candidato = [...orden.slice(0, i), ...orden.slice(i, j + 1).reverse(), ...orden.slice(j + 1)];
        if (intentar(candidato)) huboMejora = true;
      }
    }
    // Sacar una parada y meterla en otro sitio.
    for (let i = 0; i < orden.length; i++) {
      for (let j = 0; j < orden.length; j++) {
        if (i === j) continue;
        const candidato = [...orden];
        const [parada] = candidato.splice(i, 1);
        candidato.splice(j, 0, parada);
        if (intentar(candidato)) huboMejora = true;
      }
    }
  }
  return orden;
}

export function ordenarRuta<T>(origen: Ubicacion, paradas: Parada<T>[]): Ruta<T> {
  const puntos = paradas.map((p) => p.ubicacion);
  const orden =
    paradas.length <= LIMITE_PARA_PROBARLO_TODO
      ? mejorDeTodos(origen, puntos)
      : mejorar(origen, puntos, vecinoMasCercano(origen, puntos));

  let anterior = origen;
  const ordenadas = orden.map((i) => {
    const cuadrasDesdeLaAnterior = cuadrasEntre(anterior, paradas[i].ubicacion);
    anterior = paradas[i].ubicacion;
    return { ...paradas[i], cuadrasDesdeLaAnterior };
  });
  const cuadrasDeVuelta = ordenadas.length > 0 ? cuadrasEntre(anterior, origen) : 0;
  return {
    paradas: ordenadas,
    cuadras: ordenadas.reduce((s, p) => s + p.cuadrasDesdeLaAnterior, 0) + cuadrasDeVuelta,
    cuadrasDeVuelta,
  };
}

/** «8 cuadras», «21 cuadras (unos 2,1 km)». */
export function distanciaLegible(cuadras: number): string {
  const redondas = Math.round(cuadras);
  const texto = `${redondas} ${redondas === 1 ? "cuadra" : "cuadras"}`;
  const metros = cuadras * METROS_POR_CUADRA;
  if (metros < 1000) return texto;
  return `${texto} (unos ${(metros / 1000).toFixed(1).replace(".", ",")} km)`;
}

/** Google Maps admite nueve paradas intermedias por enlace. */
const PARADAS_POR_ENLACE = 9;

/**
 * Enlaces a Google Maps con la ruta ya ordenada. Si hay más paradas de las
 * que caben en un enlace, salen varios tramos seguidos: cada uno empieza
 * donde acabó el anterior. El último vuelve a la tienda.
 */
export function enlacesDeRuta(origen: string, paradas: string[]): { desde: number; hasta: number; enlace: string }[] {
  const enlaces: { desde: number; hasta: number; enlace: string }[] = [];
  let salida = origen;
  for (let i = 0; i < paradas.length; i += PARADAS_POR_ENLACE) {
    const tramo = paradas.slice(i, i + PARADAS_POR_ENLACE);
    const esElUltimo = i + PARADAS_POR_ENLACE >= paradas.length;
    // En el último tramo el destino es la tienda y todas las paradas son intermedias.
    const destino = esElUltimo ? origen : tramo[tramo.length - 1];
    const intermedias = esElUltimo ? tramo : tramo.slice(0, -1);
    const parametros = new URLSearchParams({ api: "1", origin: salida, destination: destino, travelmode: "driving" });
    if (intermedias.length > 0) parametros.set("waypoints", intermedias.join("|"));
    enlaces.push({ desde: i + 1, hasta: i + tramo.length, enlace: `https://www.google.com/maps/dir/?${parametros}` });
    salida = tramo[tramo.length - 1];
  }
  return enlaces;
}
