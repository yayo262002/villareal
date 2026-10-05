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

/**
 * Si un producto de la web responde a lo que se busca: cada palabra tiene
 * que estar en alguno de sus textos (nombre, marcas, presentación,
 * descripción, familias), sin tildes ni mayúsculas, y una palabra en plural
 * vale también en singular («quesos» encuentra «queso»). Con la búsqueda
 * vacía, todos.
 */
export function textoCoincide(textos: (string | null | undefined)[], busqueda: string): boolean {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const donde = normalizar(textos.filter(Boolean).join(" "));
  return palabras.every((p) => donde.includes(p) || (p.length > 3 && p.endsWith("s") && donde.includes(p.slice(0, -1))));
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
