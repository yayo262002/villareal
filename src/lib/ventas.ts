import "server-only";
import { db } from "./db";
import { redondear } from "./dinero";

export type LineaVenta = {
  producto_id: number;
  cantidad: number;
  precio_unitario_usd: number;
};

export type LineaVentaGuardada = LineaVenta & {
  id: number;
  venta_id: number;
  subtotal_usd: number;
  producto_nombre: string;
  unidad: string;
};

export type Venta = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  fecha: string;
  total_usd: number;
  nota: string;
  creado_en: string;
};

export type VentaConLineas = Venta & { lineas: LineaVentaGuardada[] };

const CONSULTA_VENTAS = `
  select v.*, c.nombre as cliente_nombre
  from ventas v
  join clientes c on c.id = v.cliente_id
`;

export function listarVentas(limite = 100): Venta[] {
  return db()
    .prepare(`${CONSULTA_VENTAS} order by v.fecha desc, v.id desc limit ?`)
    .all(limite) as Venta[];
}

export function listarVentasDeCliente(clienteId: number): Venta[] {
  return db()
    .prepare(`${CONSULTA_VENTAS} where v.cliente_id = ? order by v.fecha desc, v.id desc`)
    .all(clienteId) as Venta[];
}

export function lineasDeVenta(ventaId: number): LineaVentaGuardada[] {
  return db()
    .prepare(
      `select l.*, p.nombre as producto_nombre, p.unidad
       from venta_lineas l
       join productos p on p.id = l.producto_id
       where l.venta_id = ?
       order by l.id`,
    )
    .all(ventaId) as LineaVentaGuardada[];
}

export function buscarVenta(id: number): VentaConLineas | null {
  const venta = db().prepare(`${CONSULTA_VENTAS} where v.id = ?`).get(id) as Venta | undefined;
  if (!venta) return null;
  return { ...venta, lineas: lineasDeVenta(id) };
}

/**
 * Una venta y sus líneas se guardan en una sola transacción: o entra todo
 * o no entra nada. El total se calcula aquí, no se acepta del formulario,
 * para que nunca haya una venta cuyo total no cuadre con sus líneas.
 */
export function crearVenta(
  clienteId: number,
  fecha: string,
  lineas: LineaVenta[],
  nota: string,
): number {
  if (lineas.length === 0) throw new Error("Una venta necesita al menos un producto.");
  for (const l of lineas) {
    if (!(l.cantidad > 0)) throw new Error("La cantidad tiene que ser mayor que cero.");
    if (!(l.precio_unitario_usd >= 0)) throw new Error("El precio no puede ser negativo.");
  }

  const total = redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario_usd, 0));
  const conexion = db();

  conexion.exec("begin");
  try {
    const venta = conexion
      .prepare("insert into ventas (cliente_id, fecha, total_usd, nota) values (?, ?, ?, ?)")
      .run(clienteId, fecha, total, nota);
    const ventaId = Number(venta.lastInsertRowid);

    const insertarLinea = conexion.prepare(
      `insert into venta_lineas (venta_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
       values (?, ?, ?, ?, ?)`,
    );
    for (const l of lineas) {
      insertarLinea.run(
        ventaId,
        l.producto_id,
        l.cantidad,
        l.precio_unitario_usd,
        redondear(l.cantidad * l.precio_unitario_usd),
      );
    }
    conexion.exec("commit");
    return ventaId;
  } catch (error) {
    conexion.exec("rollback");
    throw error;
  }
}

export function totalVendidoUsd(): number {
  const fila = db().prepare("select coalesce(sum(total_usd), 0) as t from ventas").get() as { t: number };
  return redondear(fila.t);
}
