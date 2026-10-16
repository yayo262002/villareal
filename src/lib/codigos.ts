import "server-only";
import { ejecutar, fila } from "./db";

/**
 * Los códigos de barras y los SKU de lo que se vende: el código es el que
 * lee el lector (y tiene que ser único en todo el catálogo); el SKU es un
 * nombre corto propio, opcional. Van en el artículo (marca) si el tipo
 * tiene marcas, y en el tipo si se vende de una sola forma.
 */

/** Un código tal como lo manda el lector: sin espacios ni lo que no sea letra o número. */
export function limpiarCodigo(texto: string): string {
  return texto.replace(/[^0-9A-Za-z-]/g, "").trim();
}

export function limpiarSku(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 40);
}

export type DuenoDelCodigo = { tipo: "producto" | "variante"; id: number; producto_id: number; nombre: string };

/** Quién tiene ya ese código (un tipo o un artículo), o null si está libre. */
export async function duenoDelCodigo(codigo: string): Promise<DuenoDelCodigo | null> {
  if (!codigo) return null;
  const enVariante = await fila<{ id: number; producto_id: number; nombre: string; producto: string }>(
    "select v.id, v.producto_id, v.nombre, p.nombre as producto from variantes v join productos p on p.id = v.producto_id where v.codigo_barras = ?",
    [codigo],
  );
  if (enVariante) return { tipo: "variante", id: enVariante.id, producto_id: enVariante.producto_id, nombre: `${enVariante.producto} ${enVariante.nombre}` };
  const enProducto = await fila<{ id: number; nombre: string }>("select id, nombre from productos where codigo_barras = ?", [codigo]);
  return enProducto ? { tipo: "producto", id: enProducto.id, producto_id: enProducto.id, nombre: enProducto.nombre } : null;
}

export async function ponerCodigoAProducto(productoId: number, codigo: string, sku: string): Promise<void> {
  await ejecutar("update productos set codigo_barras = ?, sku = ? where id = ?", [codigo, sku, productoId]);
}

export async function ponerCodigoAVariante(varianteId: number, codigo: string, sku: string): Promise<void> {
  await ejecutar("update variantes set codigo_barras = ?, sku = ? where id = ?", [codigo, sku, varianteId]);
}
