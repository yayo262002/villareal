import "server-only";
import { ejecutar, filas } from "./db";
import { claveDe } from "./catalogo";

/**
 * El precio especial de un cliente para un producto (o para una de sus
 * marcas): lo que se le cobra a él en vez del precio al mayor. La caja lo
 * usa sola al elegir al cliente; en su ficha se ponen y se quitan.
 */

export type PrecioEspecial = {
  id: number;
  cliente_id: number;
  producto_id: number;
  variante_id: number | null;
  precio_usd: number;
  creado_en: string;
};

export async function listarPreciosEspecialesDe(clienteId: number): Promise<PrecioEspecial[]> {
  return filas<PrecioEspecial>("select * from precios_especiales where cliente_id = ? order by id", [clienteId]);
}

/** Todos, por cliente y por clave de artículo («3», «3-7»): lo que la caja se lleva al abrir. */
export async function preciosEspecialesPorCliente(): Promise<Record<number, Record<string, number>>> {
  const lista = await filas<PrecioEspecial>("select * from precios_especiales");
  const porCliente: Record<number, Record<string, number>> = {};
  for (const p of lista) {
    porCliente[p.cliente_id] ??= {};
    porCliente[p.cliente_id][claveDe(p.producto_id, p.variante_id ?? null)] = Number(p.precio_usd);
  }
  return porCliente;
}

export async function guardarPrecioEspecial(clienteId: number, productoId: number, varianteId: number | null, precioUsd: number): Promise<void> {
  await ejecutar(
    `insert into precios_especiales (cliente_id, producto_id, variante_id, precio_usd) values (?, ?, ?, ?)
     on conflict(cliente_id, producto_id, coalesce(variante_id, 0)) do update set precio_usd = excluded.precio_usd`,
    [clienteId, productoId, varianteId, precioUsd],
  );
}

export async function quitarPrecioEspecial(id: number): Promise<boolean> {
  const r = await ejecutar("delete from precios_especiales where id = ?", [id]);
  return r.cambios > 0;
}
