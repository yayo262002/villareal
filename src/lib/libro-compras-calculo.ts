import { fechaCorta, redondear } from "./dinero.ts";
import { numeroParaExcel } from "./exportar.ts";
import type { LineaDeFactura } from "./detal-calculo.ts";

/**
 * El libro de compras: una fila por factura de compra (Drago, Cecosesola,
 * Granos de Oro…), con lo exento, la base imponible y el IVA en bolívares,
 * como vienen impresos. Con el libro de ventas, es lo que la licenciada
 * necesita para declarar el IVA de cada mes: el IVA pagado en las compras
 * (crédito fiscal) se descuenta del cobrado en las ventas. Las cuentas,
 * puras y con pruebas.
 */

export type FacturaDeCompra = {
  id: number;
  fecha: string;
  proveedor: string;
  /** El RIF del proveedor, como va en el libro. */
  rif: string;
  numero: string;
  numero_control: string;
  exento_bs: number;
  base_bs: number;
  iva_pct: number;
  iva_bs: number;
  total_bs: number;
  /** La tasa BCV del día de la factura, para ver lo mismo en dólares. */
  tasa: number | null;
  /** De dónde salió: anotada a mano, o al cargar una factura en la lista del detal. */
  origen: "a_mano" | "detal";
  nota: string;
};

export type DatosFacturaDeCompra = Omit<FacturaDeCompra, "id">;

/** Lo que suma una factura del detal, por sus líneas (cantidad × costo sin IVA): lo exento, la base, el IVA y el total. */
export function totalesDeLineas(lineas: LineaDeFactura[], ivaPct: number): Pick<FacturaDeCompra, "exento_bs" | "base_bs" | "iva_bs" | "total_bs"> {
  let exento = 0;
  let base = 0;
  for (const l of lineas) {
    const importe = l.cantidad * l.costo_bs;
    if (l.iva === "exento") exento += importe;
    else base += importe;
  }
  const exento_bs = redondear(exento);
  const base_bs = redondear(base);
  const iva_bs = redondear((base_bs * ivaPct) / 100);
  return { exento_bs, base_bs, iva_bs, total_bs: redondear(exento_bs + base_bs + iva_bs) };
}

/** Lo que no deja anotar una factura de compra, dicho para el panel. Vacío si está bien. */
export function revisarFacturaDeCompra(d: Pick<DatosFacturaDeCompra, "fecha" | "proveedor" | "numero" | "exento_bs" | "base_bs" | "iva_bs" | "total_bs">, hoy: string): string[] {
  const motivos: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) motivos.push("Escribe la fecha de la factura.");
  else if (d.fecha > hoy) motivos.push("La fecha de la factura no puede ser de mañana.");
  if (!d.proveedor.trim()) motivos.push("Escribe el proveedor.");
  if (!d.numero.trim()) motivos.push("Escribe el número de la factura.");
  for (const [nombre, valor] of [
    ["exento", d.exento_bs],
    ["la base imponible", d.base_bs],
    ["el IVA", d.iva_bs],
    ["el total", d.total_bs],
  ] as const) {
    if (!Number.isFinite(valor) || valor < 0) motivos.push(`Revisa ${nombre}: no puede ser negativo.`);
  }
  if (d.total_bs <= 0) motivos.push("Escribe el total de la factura.");
  // Lo exento, la base y el IVA tienen que sumar el total (se deja un bolívar por los redondeos de la factura).
  else if (Math.abs(redondear(d.exento_bs + d.base_bs + d.iva_bs) - d.total_bs) > 1) {
    motivos.push(
      `Lo exento (${bsSinSimbolo(d.exento_bs)}), la base (${bsSinSimbolo(d.base_bs)}) y el IVA (${bsSinSimbolo(d.iva_bs)}) suman ${bsSinSimbolo(redondear(d.exento_bs + d.base_bs + d.iva_bs))}, y el total dice ${bsSinSimbolo(d.total_bs)}: revisa lo escrito.`,
    );
  }
  return motivos;
}

function bsSinSimbolo(n: number): string {
  return n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const CABECERA_DEL_LIBRO_DE_COMPRAS = [
  "Fecha",
  "Proveedor",
  "RIF",
  "N.º de factura",
  "N.º de control",
  "Total Bs",
  "Exento Bs",
  "Base imponible Bs",
  "Alícuota %",
  "IVA Bs (crédito fiscal)",
  "Tasa BCV",
  "Total USD",
  "Nota",
];

/** Una fila por factura, en el orden de su fecha. */
export function filasDelLibroDeCompras(facturas: FacturaDeCompra[]): (string | number)[][] {
  return [...facturas]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
    .map((f) => [
      fechaCorta(f.fecha),
      f.proveedor,
      f.rif,
      f.numero,
      f.numero_control,
      numeroParaExcel(f.total_bs),
      numeroParaExcel(f.exento_bs),
      numeroParaExcel(f.base_bs),
      numeroParaExcel(f.iva_pct, 0),
      numeroParaExcel(f.iva_bs),
      f.tasa ? numeroParaExcel(f.tasa, 4) : "",
      f.tasa ? numeroParaExcel(redondear(f.total_bs / f.tasa)) : "",
      f.nota,
    ]);
}

/** Lo que suma el libro de compras de un mes, en bolívares. */
export function totalesDelLibroDeCompras(facturas: FacturaDeCompra[]): { facturas: number; exento_bs: number; base_bs: number; iva_bs: number; total_bs: number } {
  return {
    facturas: facturas.length,
    exento_bs: redondear(facturas.reduce((s, f) => s + f.exento_bs, 0)),
    base_bs: redondear(facturas.reduce((s, f) => s + f.base_bs, 0)),
    iva_bs: redondear(facturas.reduce((s, f) => s + f.iva_bs, 0)),
    total_bs: redondear(facturas.reduce((s, f) => s + f.total_bs, 0)),
  };
}
