import { fechaCorta } from "./dinero.ts";

/**
 * Buscar en las listas del panel escribiendo como se habla: sin tildes, sin
 * mayúsculas, y una nota por su número aunque se escriba sin los ceros.
 * Cálculo puro, con pruebas.
 */

/** Sin tildes ni mayúsculas, para que «jose» encuentre a «José». */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

type VentaBuscable = { id: number; fecha: string; cliente_nombre: string; nota: string };

/**
 * Si una venta responde a lo que se busca: el nombre del cliente, el número
 * de la nota («26», «000026» o «n.º 26»), la fecha como se lee («30/09») o
 * algo de la observación. Con la búsqueda vacía, todas.
 */
export function ventaCoincide(venta: VentaBuscable, busqueda: string): boolean {
  const q = normalizar(busqueda);
  if (!q) return true;

  // Solo cifras (con o sin «n.º» delante): es el número de la nota.
  const numero = q.match(/^(?:n\.?\s*[º°o]?\.?\s*)?0*(\d+)$/)?.[1];
  if (numero) return String(venta.id) === numero;

  return [venta.cliente_nombre, venta.nota, fechaCorta(venta.fecha)].some((campo) => normalizar(campo).includes(q));
}
