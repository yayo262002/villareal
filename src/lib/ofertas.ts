import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { estaVigente } from "./catalogo";

/**
 * Las ofertas y combos: varios productos juntos (Pack Burger, Pack
 * Pizzería) con su precio, sus fechas y su estado. Nacen en borrador y no
 * salen en la web hasta que el dueño las activa; una activa sale mientras
 * esté dentro de sus fechas (`estaVigente` en `catalogo.ts`).
 */

export type EstadoOferta = "borrador" | "activa" | "inactiva";

export const NOMBRE_ESTADO_OFERTA: Record<EstadoOferta, string> = { borrador: "Borrador", activa: "En la web", inactiva: "Oculta" };

export function esEstadoDeOferta(valor: string): valor is EstadoOferta {
  return valor === "borrador" || valor === "activa" || valor === "inactiva";
}

export type ProductoDeOferta = { producto_id: number; nombre: string; cantidad: string; activo: number; borrador: number };

export type Oferta = {
  id: number;
  nombre: string;
  descripcion: string;
  /** El precio del combo en dólares; null: sin precio todavía («consulta el precio»). */
  precio_usd: number | null;
  /** Desde y hasta cuándo vale (aaaa-mm-dd); sin fecha, sin límite. */
  desde: string | null;
  hasta: string | null;
  estado: EstadoOferta;
  orden: number;
  creado_en: string;
  productos: ProductoDeOferta[];
};

export type DatosOferta = Pick<Oferta, "nombre" | "descripcion" | "precio_usd" | "desde" | "hasta" | "estado" | "orden">;

async function conProductos(ofertas: Omit<Oferta, "productos">[]): Promise<Oferta[]> {
  if (ofertas.length === 0) return [];
  const lista = await filas<ProductoDeOferta & { oferta_id: number }>(
    `select op.oferta_id, op.producto_id, op.cantidad, p.nombre, p.activo, p.borrador
     from oferta_productos op join productos p on p.id = op.producto_id
     where op.oferta_id in (${ofertas.map(() => "?").join(", ")})
     order by p.nombre collate nocase`,
    ofertas.map((o) => o.id),
  );
  return ofertas.map((o) => ({
    ...o,
    precio_usd: o.precio_usd ?? null,
    orden: Number(o.orden),
    productos: lista
      .filter((p) => Number(p.oferta_id) === o.id)
      .map((p) => ({ producto_id: Number(p.producto_id), nombre: p.nombre, cantidad: p.cantidad, activo: Number(p.activo), borrador: Number(p.borrador) })),
  }));
}

export async function listarOfertas(): Promise<Oferta[]> {
  return conProductos(await filas<Omit<Oferta, "productos">>("select * from ofertas order by orden, id"));
}

/** Las que se ven hoy en la web. */
export async function ofertasVigentes(hoy: string): Promise<Oferta[]> {
  return (await listarOfertas()).filter((o) => estaVigente(o, hoy));
}

export async function buscarOferta(id: number): Promise<Oferta | null> {
  const o = await fila<Omit<Oferta, "productos">>("select * from ofertas where id = ?", [id]);
  return o ? (await conProductos([o]))[0] : null;
}

export async function crearOferta(datos: DatosOferta): Promise<number> {
  const r = await ejecutar("insert into ofertas (nombre, descripcion, precio_usd, desde, hasta, estado, orden) values (?, ?, ?, ?, ?, ?, ?)", [
    datos.nombre,
    datos.descripcion,
    datos.precio_usd,
    datos.desde,
    datos.hasta,
    datos.estado,
    datos.orden,
  ]);
  return r.ultimoId;
}

/** Guarda la oferta y lo que lleva, todo junto. */
export async function actualizarOferta(id: number, datos: DatosOferta, productos: { producto_id: number; cantidad: string }[]): Promise<void> {
  await transaccion(async (tx) => {
    await tx.execute({
      sql: "update ofertas set nombre = ?, descripcion = ?, precio_usd = ?, desde = ?, hasta = ?, estado = ?, orden = ? where id = ?",
      args: [datos.nombre, datos.descripcion, datos.precio_usd, datos.desde, datos.hasta, datos.estado, datos.orden, id],
    });
    await tx.execute({ sql: "delete from oferta_productos where oferta_id = ?", args: [id] });
    for (const p of productos) {
      await tx.execute({ sql: "insert or ignore into oferta_productos (oferta_id, producto_id, cantidad) values (?, ?, ?)", args: [id, p.producto_id, p.cantidad] });
    }
  });
}

export async function cambiarEstadoDeOferta(id: number, estado: EstadoOferta): Promise<void> {
  await ejecutar("update ofertas set estado = ? where id = ?", [estado, id]);
}

export async function eliminarOferta(id: number): Promise<boolean> {
  return transaccion(async (tx) => {
    await tx.execute({ sql: "delete from oferta_productos where oferta_id = ?", args: [id] });
    const r = await tx.execute({ sql: "delete from ofertas where id = ?", args: [id] });
    return r.rowsAffected > 0;
  });
}
