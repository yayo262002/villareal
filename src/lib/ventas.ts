import "server-only";
import { fila, filas, transaccion } from "./db";
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
  /** La tasa del día cuando se anotó, o null en las ventas anteriores a guardarla. */
  tasa: number | null;
  creado_en: string;
};

export type VentaConLineas = Venta & { lineas: LineaVentaGuardada[] };

const CONSULTA_VENTAS = `
  select v.*, c.nombre as cliente_nombre
  from ventas v
  join clientes c on c.id = v.cliente_id
`;

export async function listarVentas(limite = 100): Promise<Venta[]> {
  return filas<Venta>(`${CONSULTA_VENTAS} order by v.fecha desc, v.id desc limit ?`, [limite]);
}

export async function listarVentasDeCliente(clienteId: number): Promise<Venta[]> {
  return filas<Venta>(`${CONSULTA_VENTAS} where v.cliente_id = ? order by v.fecha desc, v.id desc`, [clienteId]);
}

export async function lineasDeVenta(ventaId: number): Promise<LineaVentaGuardada[]> {
  return filas<LineaVentaGuardada>(
    `select l.*, p.nombre as producto_nombre, p.unidad
     from venta_lineas l
     join productos p on p.id = l.producto_id
     where l.venta_id = ?
     order by l.id`,
    [ventaId],
  );
}

/** Las líneas de varias ventas en una sola consulta, agrupadas por venta. */
export async function lineasDeVentas(ventaIds: number[]): Promise<Map<number, LineaVentaGuardada[]>> {
  const porVenta = new Map<number, LineaVentaGuardada[]>();
  if (ventaIds.length === 0) return porVenta;
  const huecos = ventaIds.map(() => "?").join(", ");
  const lineas = await filas<LineaVentaGuardada>(
    `select l.*, p.nombre as producto_nombre, p.unidad
     from venta_lineas l
     join productos p on p.id = l.producto_id
     where l.venta_id in (${huecos})
     order by l.id`,
    ventaIds,
  );
  for (const l of lineas) {
    const lista = porVenta.get(l.venta_id) ?? [];
    lista.push(l);
    porVenta.set(l.venta_id, lista);
  }
  return porVenta;
}

export async function conLineas(ventas: Venta[]): Promise<VentaConLineas[]> {
  const lineas = await lineasDeVentas(ventas.map((v) => v.id));
  return ventas.map((v) => ({ ...v, lineas: lineas.get(v.id) ?? [] }));
}

export async function buscarVenta(id: number): Promise<VentaConLineas | null> {
  const venta = await fila<Venta>(`${CONSULTA_VENTAS} where v.id = ?`, [id]);
  if (!venta) return null;
  return { ...venta, lineas: await lineasDeVenta(id) };
}

/**
 * Una venta y sus líneas se guardan en una sola transacción: o entra todo
 * o no entra nada. El total se calcula aquí, no se acepta del formulario,
 * para que nunca haya una venta cuyo total no cuadre con sus líneas.
 */
export async function crearVenta(
  clienteId: number,
  fecha: string,
  lineas: LineaVenta[],
  nota: string,
  tasa: number | null = null,
): Promise<number> {
  if (lineas.length === 0) throw new Error("Una venta necesita al menos un producto.");
  for (const l of lineas) {
    if (!(l.cantidad > 0)) throw new Error("La cantidad tiene que ser mayor que cero.");
    if (!(l.precio_unitario_usd >= 0)) throw new Error("El precio no puede ser negativo.");
  }

  const total = redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario_usd, 0));

  return transaccion(async (tx) => {
    const venta = await tx.execute({
      sql: "insert into ventas (cliente_id, fecha, total_usd, nota, tasa) values (?, ?, ?, ?, ?) returning id",
      args: [clienteId, fecha, total, nota, tasa && tasa > 0 ? tasa : null],
    });
    const ventaId = Number(venta.rows[0].id);
    for (const l of lineas) {
      await tx.execute({
        sql: `insert into venta_lineas (venta_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
              values (?, ?, ?, ?, ?)`,
        args: [ventaId, l.producto_id, l.cantidad, l.precio_unitario_usd, redondear(l.cantidad * l.precio_unitario_usd)],
      });
    }
    return ventaId;
  });
}

/**
 * Borra una venta con sus líneas. Las líneas se borran a mano y no por la
 * clave foránea en cascada, porque en Turso no se puede dar por hecho que
 * las claves foráneas estén activas. Devuelve false si no existía.
 */
export async function eliminarVenta(id: number): Promise<boolean> {
  return transaccion(async (tx) => {
    await tx.execute({ sql: "update adjuntos set venta_id = null where venta_id = ?", args: [id] });
    await tx.execute({ sql: "delete from venta_lineas where venta_id = ?", args: [id] });
    const r = await tx.execute({ sql: "delete from ventas where id = ?", args: [id] });
    return r.rowsAffected > 0;
  });
}

export async function totalVendidoUsd(): Promise<number> {
  const f = await fila<{ t: number }>("select coalesce(sum(total_usd), 0) as t from ventas");
  return redondear(Number(f?.t ?? 0));
}

// Lo que sigue son las consultas del estudio de ventas.

export type VentasPorMes = { mes: string; ventas: number; vendido_usd: number; cobrado_usd: number };
export type VentasPorProducto = { producto: string; unidad: string; cantidad: number; vendido_usd: number };
export type VentasPorCliente = { cliente_id: number; cliente: string; ventas: number; vendido_usd: number };

/** Vendido y cobrado por mes (YYYY-MM), del más reciente al más antiguo. */
export async function ventasPorMes(): Promise<VentasPorMes[]> {
  return filas<VentasPorMes>(`
    with meses as (
      select substr(fecha, 1, 7) as mes from ventas
      union
      select substr(fecha, 1, 7) as mes from pagos
    )
    select
      m.mes,
      (select count(*) from ventas v where substr(v.fecha, 1, 7) = m.mes) as ventas,
      coalesce((select sum(total_usd) from ventas v where substr(v.fecha, 1, 7) = m.mes), 0) as vendido_usd,
      coalesce((select sum(monto_usd) from pagos p where substr(p.fecha, 1, 7) = m.mes), 0) as cobrado_usd
    from meses m
    order by m.mes desc
  `);
}

/** Cuánto se ha vendido de cada producto, en cantidad y en dólares. */
export async function ventasPorProducto(desde?: string): Promise<VentasPorProducto[]> {
  const filtro = desde ? "where v.fecha >= ?" : "";
  return filas<VentasPorProducto>(
    `select p.nombre as producto, p.unidad,
            coalesce(sum(l.cantidad), 0) as cantidad,
            coalesce(sum(l.subtotal_usd), 0) as vendido_usd
     from venta_lineas l
     join productos p on p.id = l.producto_id
     join ventas v on v.id = l.venta_id
     ${filtro}
     group by p.id
     order by vendido_usd desc`,
    desde ? [desde] : [],
  );
}

export type VentasPorTipo = { tipo: "detal" | "mayor"; ventas: number; vendido_usd: number };

/** Cuánto se vende a clientes al detal y cuánto a mayoristas. */
export async function ventasPorTipo(desde?: string): Promise<VentasPorTipo[]> {
  const filtro = desde ? "where v.fecha >= ?" : "";
  return filas<VentasPorTipo>(
    `select c.tipo as tipo, count(*) as ventas, coalesce(sum(v.total_usd), 0) as vendido_usd
     from ventas v
     join clientes c on c.id = v.cliente_id
     ${filtro}
     group by c.tipo
     order by c.tipo`,
    desde ? [desde] : [],
  );
}

/** Los clientes que más compran. */
export async function ventasPorCliente(limite = 10, desde?: string): Promise<VentasPorCliente[]> {
  const filtro = desde ? "where v.fecha >= ?" : "";
  return filas<VentasPorCliente>(
    `select c.id as cliente_id, c.nombre as cliente,
            count(*) as ventas, coalesce(sum(v.total_usd), 0) as vendido_usd
     from ventas v
     join clientes c on c.id = v.cliente_id
     ${filtro}
     group by c.id
     order by vendido_usd desc
     limit ?`,
    desde ? [desde, limite] : [limite],
  );
}
