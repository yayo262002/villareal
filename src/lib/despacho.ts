import { cruceParaElMapa, describirUbicacion, leerDireccion, type Ubicacion } from "./direcciones.ts";
import { enlacesDeRuta, ordenarRuta, type Ruta } from "./ruta.ts";
import { cuadriculaDePunto, estaEnLosAlrededores, puntoParaElMapa, type Punto } from "./plano.ts";

/**
 * El plan de un despacho: a partir de la dirección de la tienda y de los
 * clientes elegidos, en qué orden visitarlos y qué clientes se quedan fuera
 * porque su dirección no se pudo situar.
 *
 * Un cliente se sitúa de dos maneras: por la cuadrícula, si su dirección
 * dice calle y carrera, o por el mapa, si en su momento se buscó y se
 * encontró (un centro comercial, una avenida con nombre). Las dos acaban
 * en el mismo plano (`plano.ts`), así que entran en la misma ruta.
 * Cálculo puro, con pruebas.
 */

export type ConDireccion = {
  id: number;
  direccion: string;
  lat?: number | null;
  lon?: number | null;
  sitio?: string | null;
};

export type Situacion =
  | { situada: true; ubicacion: Ubicacion; origen: "cuadricula"; texto: string; destino: string }
  | { situada: true; ubicacion: Ubicacion; origen: "mapa"; texto: string; destino: string; aproximada: boolean }
  | { situada: false; motivo: string };

/**
 * Dónde está un cliente. Primero la cuadrícula; si la dirección no dice
 * calle y carrera pero el mapa la encontró, el punto del mapa. Si dice solo
 * la calle (o solo la carrera) y nombra una avenida que el mapa conoce, se
 * junta lo uno con lo otro: la calle escrita y la carrera de la avenida.
 */
export function situar(cliente: ConDireccion, ciudad: string): Situacion {
  const lectura = leerDireccion(cliente.direccion);
  if (lectura.ubicada) {
    return {
      situada: true,
      ubicacion: lectura.ubicacion,
      origen: "cuadricula",
      texto: describirUbicacion(lectura.ubicacion),
      destino: cruceParaElMapa(lectura.ubicacion, ciudad),
    };
  }
  // Sin dirección no hay nada que el mapa haya podido situar, diga lo que diga la ficha.
  const punto = cliente.direccion.trim() ? puntoDelCliente(cliente) : null;
  if (!punto) return { situada: false, motivo: lectura.motivo };

  const proyectado = cuadriculaDePunto(punto);
  const parcial = lectura.parcial ?? {};
  const ubicacion = { calle: parcial.calle ?? proyectado.calle, carrera: parcial.carrera ?? proyectado.carrera };
  const completada = parcial.calle !== undefined || parcial.carrera !== undefined;
  const sitio = cliente.sitio?.trim() || "un punto del mapa";
  return {
    situada: true,
    ubicacion,
    origen: "mapa",
    texto: completada
      ? `${sitio}, a la altura de la ${parcial.calle !== undefined ? `calle ${parcial.calle}` : `carrera ${parcial.carrera}`}`
      : sitio,
    // Con la calle o la carrera escrita, el punto es bueno; una avenida sola es un sitio cualquiera de ella.
    aproximada: !completada && /un punto de la avenida/.test(sitio),
    destino: completada ? cruceParaElMapa(ubicacion, ciudad) : puntoParaElMapa(punto),
  };
}

function puntoDelCliente(cliente: ConDireccion): Punto | null {
  if (cliente.lat === null || cliente.lat === undefined || cliente.lon === null || cliente.lon === undefined) return null;
  const punto = { lat: Number(cliente.lat), lon: Number(cliente.lon) };
  return Number.isFinite(punto.lat) && Number.isFinite(punto.lon) && estaEnLosAlrededores(punto) ? punto : null;
}

export type SituacionHallada = Extract<Situacion, { situada: true }>;

/** Una parada de la ruta: el cliente, dónde cae en la cuadrícula y cómo se supo. */
export type ParadaDeDespacho<T> = { dato: T; ubicacion: Ubicacion; situacion: SituacionHallada };

export type Plan<T> = {
  /** Dónde está la tienda en la cuadrícula, o null si su dirección no se entiende. */
  tienda: Ubicacion | null;
  ruta: Ruta<ParadaDeDespacho<T>>;
  /** Clientes que no entran en la ruta, con el motivo, para arreglar su dirección. */
  sinUbicar: { cliente: T; motivo: string }[];
  /** Enlaces a Google Maps con la ruta ya ordenada, en tramos de nueve paradas. */
  enlaces: { desde: number; hasta: number; enlace: string }[];
};

export function planDeDespacho<T extends ConDireccion>(
  tienda: { direccion: string; ciudad: string },
  clientes: T[],
): Plan<T> {
  const origen = leerDireccion(tienda.direccion);
  if (!origen.ubicada) {
    return {
      tienda: null,
      ruta: { paradas: [], cuadras: 0, cuadrasDeVuelta: 0 },
      sinUbicar: clientes.map((cliente) => ({ cliente, motivo: "la dirección de la tienda no se pudo situar" })),
      enlaces: [],
    };
  }

  const situados: ParadaDeDespacho<T>[] = [];
  const sinUbicar: { cliente: T; motivo: string }[] = [];
  for (const cliente of clientes) {
    const situacion = situar(cliente, tienda.ciudad);
    if (situacion.situada) situados.push({ dato: cliente, ubicacion: situacion.ubicacion, situacion });
    else sinUbicar.push({ cliente, motivo: situacion.motivo });
  }

  const ruta = ordenarRuta(origen.ubicacion, situados);
  const enlaces = enlacesDeRuta(
    cruceParaElMapa(origen.ubicacion, tienda.ciudad),
    ruta.paradas.map((p) => p.situacion.destino),
  );
  return { tienda: origen.ubicacion, ruta, sinUbicar, enlaces };
}

/** Enlace a Google Maps para buscar la dirección de un cliente: el cruce, el punto del mapa, o el texto tal cual. */
export function enlaceAlMapa(cliente: ConDireccion | string, ciudad: string): string | null {
  const datos: ConDireccion = typeof cliente === "string" ? { id: 0, direccion: cliente } : cliente;
  if (!datos.direccion.trim()) return null;
  const situacion = situar(datos, ciudad);
  const consulta = situacion.situada ? situacion.destino : `${datos.direccion}, ${ciudad}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
