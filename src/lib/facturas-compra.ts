import "server-only";
import { ejecutar, filas } from "./db";
import type { DatosFacturaDeCompra, FacturaDeCompra } from "./libro-compras-calculo";

/**
 * Las facturas de compra desde la base, para el libro de compras. Una
 * factura de un proveedor con el mismo número es la misma: al volver a
 * anotarla (o a cargarla en la lista del detal) se corrige, no se repite.
 * Las cuentas y el libro, en libro-compras-calculo.ts.
 */

function aFactura(f: FacturaDeCompra): FacturaDeCompra {
  return {
    ...f,
    id: Number(f.id),
    exento_bs: Number(f.exento_bs),
    base_bs: Number(f.base_bs),
    iva_pct: Number(f.iva_pct),
    iva_bs: Number(f.iva_bs),
    total_bs: Number(f.total_bs),
    tasa: f.tasa === null || f.tasa === undefined ? null : Number(f.tasa),
    origen: f.origen === "detal" ? "detal" : "a_mano",
    nota: f.nota ?? "",
    rif: f.rif ?? "",
    numero_control: f.numero_control ?? "",
  };
}

/** Las de un mes («2026-11»), en el orden de su fecha. */
export async function listarFacturasDeCompra(mes: string): Promise<FacturaDeCompra[]> {
  return (await filas<FacturaDeCompra>("select * from facturas_compra where fecha like ? order by fecha, id", [`${mes}%`])).map(aFactura);
}

/** Los meses con alguna factura de compra, del más nuevo al más viejo. */
export async function mesesConFacturasDeCompra(): Promise<string[]> {
  return (await filas<{ mes: string }>("select distinct substr(fecha, 1, 7) as mes from facturas_compra order by mes desc")).map((m) => m.mes);
}

/** Anota una factura de compra, o la corrige si ya estaba (el mismo proveedor y el mismo número). Devuelve si era nueva. */
export async function guardarFacturaDeCompra(d: DatosFacturaDeCompra): Promise<{ nueva: boolean }> {
  const r = await ejecutar(
    `insert or ignore into facturas_compra (fecha, proveedor, rif, numero, numero_control, exento_bs, base_bs, iva_pct, iva_bs, total_bs, tasa, origen, nota)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.fecha, d.proveedor.trim(), d.rif.trim(), d.numero.trim(), d.numero_control.trim(), d.exento_bs, d.base_bs, d.iva_pct, d.iva_bs, d.total_bs, d.tasa, d.origen, d.nota.trim()],
  );
  if (r.cambios > 0) return { nueva: true };
  await ejecutar(
    `update facturas_compra set fecha = ?, rif = ?, numero_control = ?, exento_bs = ?, base_bs = ?, iva_pct = ?, iva_bs = ?, total_bs = ?, tasa = ?, origen = ?, nota = ?
     where proveedor = ? collate nocase and numero = ?`,
    [d.fecha, d.rif.trim(), d.numero_control.trim(), d.exento_bs, d.base_bs, d.iva_pct, d.iva_bs, d.total_bs, d.tasa, d.origen, d.nota.trim(), d.proveedor.trim(), d.numero.trim()],
  );
  return { nueva: false };
}

export async function borrarFacturaDeCompra(id: number): Promise<void> {
  await ejecutar("delete from facturas_compra where id = ?", [id]);
}
