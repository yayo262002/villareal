import "server-only";
import { ejecutar, filas } from "./db";
import { partesDelReparto } from "./ajustes";
import { calcularReparto, type AbonoDelReparto, type DescuentoDelReparto, type LineaDelReparto, type RepartoDelMes, type VentaDelReparto } from "./reparto-calculo";

/**
 * El Reparto del mes desde la base: todas las ventas con sus líneas (el
 * costo de cada una, guardado el día de la venta) y todos los abonos, porque
 * un abono de este mes puede pagar una nota de hace meses; lo que se paga
 * antes de repartir; y las partes con sus puntos. Las cuentas, en
 * `reparto-calculo.ts`.
 */

export async function repartoDelMes(mes: string): Promise<RepartoDelMes> {
  const [ventas, lineas, abonos, descuentos, partes] = await Promise.all([
    filas<VentaDelReparto>("select id, cliente_id, fecha, total_usd from ventas"),
    filas<LineaDelReparto>(
      `select l.venta_id, l.cantidad, l.subtotal_usd, l.costo_unitario_usd,
              case when vr.nombre is null then p.nombre else p.nombre || ' ' || vr.nombre end as producto
       from venta_lineas l
       join productos p on p.id = l.producto_id
       left join variantes vr on vr.id = l.variante_id`,
    ),
    filas<AbonoDelReparto>("select id, cliente_id, fecha, monto_usd from pagos"),
    descuentosDelMes(mes),
    partesDelReparto(),
  ]);
  return calcularReparto({ mes, ventas, lineas, abonos, descuentos, partes });
}

/** Lo que se paga de la ganancia de un mes antes de repartirla, en el orden en que se anotó. */
export async function descuentosDelMes(mes: string): Promise<DescuentoDelReparto[]> {
  return filas<DescuentoDelReparto>("select id, concepto, monto_usd from reparto_descuentos where mes = ? order by id", [mes]);
}

export async function anotarDescuentoDelMes(mes: string, concepto: string, montoUsd: number): Promise<void> {
  await ejecutar("insert into reparto_descuentos (mes, concepto, monto_usd) values (?, ?, ?)", [mes, concepto, montoUsd]);
}

export async function quitarDescuentoDelMes(id: number): Promise<boolean> {
  return (await ejecutar("delete from reparto_descuentos where id = ?", [id])).cambios > 0;
}

/** El primer mes con ventas: hasta ahí llega el selector de meses. */
export async function primerMesConVentas(): Promise<string | null> {
  const [f] = await filas<{ mes: string | null }>("select substr(min(fecha), 1, 7) as mes from ventas");
  return f?.mes ?? null;
}
