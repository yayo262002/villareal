import { redondear } from "./dinero.ts";

/**
 * Cuentas por pagar y cuentas pagadas.
 *
 * Los pagos se registran contra el cliente, no contra una venta concreta:
 * el cliente abona lo que puede y el negocio lleva un saldo. Para saber qué
 * notas están pagadas, los pagos se aplican a las ventas de la más antigua a
 * la más nueva. Con eso cada venta queda pagada, parcial o por pagar, y la
 * suma de lo pendiente coincide siempre con el saldo del cliente.
 *
 * Es cálculo puro, sin base de datos, para poder probarlo.
 */

export type EstadoCuenta = "pagada" | "parcial" | "por_pagar";

export const NOMBRE_ESTADO: Record<EstadoCuenta, string> = {
  pagada: "Pagada",
  parcial: "Abonada",
  por_pagar: "Por pagar",
};

export type CuentaDeVenta<V> = V & {
  estado: EstadoCuenta;
  pagado_usd: number;
  pendiente_usd: number;
};

type VentaMinima = { id: number; fecha: string; total_usd: number };

/**
 * Reparte `totalPagado` entre las ventas por orden de fecha (y de id si la
 * fecha coincide). Devuelve las ventas en el mismo orden en que llegaron.
 */
export function aplicarPagos<V extends VentaMinima>(ventas: V[], totalPagado: number): CuentaDeVenta<V>[] {
  const orden = [...ventas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  let restante = Math.max(0, totalPagado);
  const porId = new Map<number, CuentaDeVenta<V>>();

  for (const venta of orden) {
    const total = Number(venta.total_usd);
    const pagado = redondear(Math.min(total, restante));
    restante = redondear(restante - pagado);
    const pendiente = redondear(total - pagado);
    const estado: EstadoCuenta = pendiente <= 0 ? "pagada" : pagado > 0 ? "parcial" : "por_pagar";
    porId.set(venta.id, { ...venta, estado, pagado_usd: pagado, pendiente_usd: pendiente });
  }

  return ventas.map((v) => porId.get(v.id)!);
}

/**
 * El estado de cuenta: cada venta y cada abono en el orden en que pasaron,
 * con el saldo que dejó cada uno. El último saldo es el del cliente.
 */
export type Movimiento = {
  tipo: "venta" | "abono";
  id: number;
  fecha: string;
  /** Lo que el movimiento suma a la deuda: el total de una venta. */
  cargo_usd: number;
  /** Lo que resta: el monto de un abono, ya en dólares. */
  abono_usd: number;
  /** Lo que debe el cliente después de este movimiento. Negativo si queda a su favor. */
  saldo_usd: number;
};

type AbonoMinimo = { id: number; fecha: string; monto_usd: number };

/**
 * Ordena por fecha. El mismo día van primero las ventas y después los
 * abonos: lo normal es comprar y pagar, no pagar y comprar.
 */
export function movimientosDeCuenta(ventas: VentaMinima[], abonos: AbonoMinimo[]): Movimiento[] {
  const movimientos = [
    ...ventas.map((v) => ({ tipo: "venta" as const, id: v.id, fecha: v.fecha, cargo_usd: redondear(Number(v.total_usd)), abono_usd: 0 })),
    ...abonos.map((a) => ({ tipo: "abono" as const, id: a.id, fecha: a.fecha, cargo_usd: 0, abono_usd: redondear(Number(a.monto_usd)) })),
  ].sort(
    (a, b) =>
      a.fecha.slice(0, 10).localeCompare(b.fecha.slice(0, 10)) ||
      (a.tipo === b.tipo ? a.id - b.id : a.tipo === "venta" ? -1 : 1),
  );

  let saldo = 0;
  return movimientos.map((m) => {
    saldo = redondear(saldo + m.cargo_usd - m.abono_usd);
    return { ...m, saldo_usd: saldo };
  });
}
