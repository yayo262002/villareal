import { cruceParaElMapa, leerDireccion, type Ubicacion } from "./direcciones.ts";
import { enlacesDeRuta, ordenarRuta, type Ruta } from "./ruta.ts";

/**
 * El plan de un despacho: a partir de la dirección de la tienda y de los
 * clientes elegidos, en qué orden visitarlos y qué clientes se quedan fuera
 * porque su dirección no se pudo situar. Cálculo puro, con pruebas.
 */

export type ConDireccion = { id: number; direccion: string };

export type Plan<T> = {
  /** Dónde está la tienda en la cuadrícula, o null si su dirección no se entiende. */
  tienda: Ubicacion | null;
  ruta: Ruta<T>;
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

  const ubicados: { dato: T; ubicacion: Ubicacion }[] = [];
  const sinUbicar: { cliente: T; motivo: string }[] = [];
  for (const cliente of clientes) {
    const lectura = leerDireccion(cliente.direccion);
    if (lectura.ubicada) ubicados.push({ dato: cliente, ubicacion: lectura.ubicacion });
    else sinUbicar.push({ cliente, motivo: lectura.motivo });
  }

  const ruta = ordenarRuta(origen.ubicacion, ubicados);
  const enlaces = enlacesDeRuta(
    cruceParaElMapa(origen.ubicacion, tienda.ciudad),
    ruta.paradas.map((p) => cruceParaElMapa(p.ubicacion, tienda.ciudad)),
  );
  return { tienda: origen.ubicacion, ruta, sinUbicar, enlaces };
}

/** Enlace a Google Maps para buscar una dirección tal como está escrita. */
export function enlaceAlMapa(direccion: string, ciudad: string): string | null {
  if (!direccion.trim()) return null;
  const lectura = leerDireccion(direccion);
  const consulta = lectura.ubicada ? cruceParaElMapa(lectura.ubicacion, ciudad) : `${direccion}, ${ciudad}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
