import "server-only";
import { filas } from "./db";
import { METODOS_PAGO, redondear, type MetodoPago, type Moneda } from "./dinero";
import { movimientosEntreCon, type MovimientosCompletos } from "./movimientos";

/**
 * El cierre del día: lo que se vendió, lo que entró (abonos de clientes,
 * por método y en su moneda) y lo que salió (pagos a proveedores) en una
 * fecha. Para cuadrar la caja al cerrar el local.
 */

export type EntradaPorMetodo = {
  metodo: MetodoPago;
  nombre: string;
  moneda: Moneda;
  /** La suma en la moneda del método: bolívares o dólares. */
  monto: number;
  monto_usd: number;
  cantidad: number;
};

export type CierreDelDia = {
  fecha: string;
  ventas: { cantidad: number; total_usd: number };
  cobrado: { total_usd: number; por_metodo: EntradaPorMetodo[] };
  pagado_a_proveedores: { total_usd: number; por_metodo: EntradaPorMetodo[] };
};

async function porMetodo(tabla: "pagos" | "pagos_proveedores", fecha: string): Promise<EntradaPorMetodo[]> {
  const grupos = await filas<{ metodo: MetodoPago; moneda: Moneda; monto: number; monto_usd: number; cantidad: number }>(
    `select metodo, moneda, sum(monto) as monto, sum(monto_usd) as monto_usd, count(*) as cantidad
     from ${tabla}
     where fecha = ?
     group by metodo, moneda
     order by sum(monto_usd) desc`,
    [fecha],
  );
  return grupos.map((g) => ({
    metodo: g.metodo,
    nombre: METODOS_PAGO[g.metodo] ?? g.metodo,
    moneda: g.moneda,
    monto: redondear(Number(g.monto)),
    monto_usd: redondear(Number(g.monto_usd)),
    cantidad: Number(g.cantidad),
  }));
}

export async function cierreDelDia(fecha: string): Promise<CierreDelDia> {
  const [ventas, cobrado, pagado] = await Promise.all([
    filas<{ cantidad: number; total_usd: number }>(
      "select count(*) as cantidad, coalesce(sum(total_usd), 0) as total_usd from ventas where fecha = ?",
      [fecha],
    ),
    porMetodo("pagos", fecha),
    porMetodo("pagos_proveedores", fecha),
  ]);
  const suma = (lista: EntradaPorMetodo[]) => redondear(lista.reduce((s, e) => s + e.monto_usd, 0));
  return {
    fecha,
    ventas: { cantidad: Number(ventas[0]?.cantidad ?? 0), total_usd: redondear(Number(ventas[0]?.total_usd ?? 0)) },
    cobrado: { total_usd: suma(cobrado), por_metodo: cobrado },
    pagado_a_proveedores: { total_usd: suma(pagado), por_metodo: pagado },
  };
}

/**
 * Todo lo que se movió entre dos fechas, las dos incluidas: ventas con sus
 * productos, abonos de los clientes, compras y pagos a proveedores. Sin
 * fecha por un lado, no hay límite por ese lado. Para el Excel y para las
 * estadísticas. La consulta vive en `movimientos.ts`; aquí se corre con la
 * conexión de la web.
 */
export async function movimientosEntre(desde: string | null, hasta: string | null): Promise<MovimientosCompletos> {
  return movimientosEntreCon(filas, desde, hasta);
}

/** Los días con movimiento (ventas, abonos o pagos), del más reciente al más antiguo. */
export async function diasConMovimiento(limite = 30): Promise<string[]> {
  const dias = await filas<{ fecha: string }>(
    `select fecha from (
       select fecha from ventas
       union select fecha from pagos
       union select fecha from pagos_proveedores
     ) order by fecha desc limit ?`,
    [limite],
  );
  return dias.map((d) => d.fecha);
}
