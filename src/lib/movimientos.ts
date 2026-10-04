import { ROTULO_DEL_CLIENTE } from "./rotulo.ts";
import type { Movimientos } from "./exportar.ts";

/**
 * Todo lo que se movió entre dos fechas: ventas con sus productos, abonos
 * de los clientes, compras y pagos a proveedores. Las consultas viven aquí,
 * sin base concreta: la web las corre con su conexión y el guion de las
 * copias con la suya (`consultar` es quien ejecuta el SQL). Así el Excel
 * que baja el panel y el que deja el guion cada noche salen iguales.
 */

/** Quien ejecuta una consulta y devuelve sus filas como objetos. */
export type Consulta = <T>(sql: string, args?: (string | number | null)[]) => Promise<T[]>;

/** Las líneas de venta con el nombre de su producto y, si la tiene, de su marca. */
export const CONSULTA_LINEAS = `
  select l.*, vr.nombre as variante_nombre, p.unidad,
         case when vr.nombre is null then p.nombre else p.nombre || ' ' || vr.nombre end as producto_nombre
  from venta_lineas l
  join productos p on p.id = l.producto_id
  left join variantes vr on vr.id = l.variante_id
`;

export type LineaMovida = {
  id: number;
  venta_id: number;
  producto_id: number;
  variante_id: number | null;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  piezas: number | null;
  producto_nombre: string;
  variante_nombre: string | null;
  unidad: string;
};

export type VentaMovida = Omit<Movimientos["ventas"][number], "lineas"> & { cliente_id: number; lineas: LineaMovida[] };
export type AbonoMovido = Movimientos["abonos"][number] & { cliente_id: number };

/** Los movimientos con todo lo que hace falta para las estadísticas, además de para el Excel. */
export type MovimientosCompletos = Omit<Movimientos, "ventas" | "abonos"> & { ventas: VentaMovida[]; abonos: AbonoMovido[] };

/** Cuántas ventas se piden de una vez al buscar sus líneas: la base no admite listas sin fin. */
const VENTAS_POR_CONSULTA = 400;

/** Las líneas de varias ventas, agrupadas por venta. */
export async function lineasDeVentasCon(consultar: Consulta, ventaIds: number[]): Promise<Map<number, LineaMovida[]>> {
  const porVenta = new Map<number, LineaMovida[]>();
  for (let i = 0; i < ventaIds.length; i += VENTAS_POR_CONSULTA) {
    const tanda = ventaIds.slice(i, i + VENTAS_POR_CONSULTA);
    const huecos = tanda.map(() => "?").join(", ");
    const lineas = await consultar<LineaMovida>(`${CONSULTA_LINEAS} where l.venta_id in (${huecos}) order by l.id`, tanda);
    for (const l of lineas) {
      const lista = porVenta.get(l.venta_id) ?? [];
      lista.push(l);
      porVenta.set(l.venta_id, lista);
    }
  }
  return porVenta;
}

/**
 * Entre dos fechas, las dos incluidas. Sin fecha por un lado, no hay
 * límite por ese lado.
 */
export async function movimientosEntreCon(consultar: Consulta, desde: string | null, hasta: string | null): Promise<MovimientosCompletos> {
  const periodo = [desde ?? "0000-01-01", hasta ?? "9999-12-31"];
  const [ventas, abonos, compras, pagos] = await Promise.all([
    consultar<Omit<VentaMovida, "lineas">>(
      `select v.id, v.cliente_id, v.fecha, v.total_usd, v.nota, ${ROTULO_DEL_CLIENTE} as cliente_nombre
       from ventas v join clientes c on c.id = v.cliente_id
       where v.fecha between ? and ? order by v.fecha, v.id`,
      periodo,
    ),
    consultar<AbonoMovido>(
      `select p.id, p.cliente_id, p.fecha, p.metodo, p.moneda, p.monto, p.tasa, p.monto_usd, p.referencia, p.nota, ${ROTULO_DEL_CLIENTE} as cliente_nombre
       from pagos p join clientes c on c.id = p.cliente_id
       where p.fecha between ? and ? order by p.fecha, p.id`,
      periodo,
    ),
    consultar<MovimientosCompletos["compras"][number]>(
      `select c.id, c.fecha, c.descripcion, c.total_usd, c.nota, p.nombre as proveedor_nombre
       from compras c join proveedores p on p.id = c.proveedor_id
       where c.fecha between ? and ? order by c.fecha, c.id`,
      periodo,
    ),
    consultar<MovimientosCompletos["pagos"][number]>(
      `select g.id, g.fecha, g.metodo, g.moneda, g.monto, g.tasa, g.monto_usd, g.referencia, g.nota, p.nombre as proveedor_nombre
       from pagos_proveedores g join proveedores p on p.id = g.proveedor_id
       where g.fecha between ? and ? order by g.fecha, g.id`,
      periodo,
    ),
  ]);
  const lineas = await lineasDeVentasCon(consultar, ventas.map((v) => v.id));
  return { ventas: ventas.map((v) => ({ ...v, lineas: lineas.get(v.id) ?? [] })), abonos, compras, pagos };
}
