import { aBolivares, cantidad, fechaCorta, redondear } from "./dinero.ts";
import { numeroParaExcel } from "./exportar.ts";

/**
 * Las cuentas de una factura: qué parte de la venta está exenta de IVA,
 * cuál es la base imponible, cuánto es el IVA y el total, en dólares y en
 * bolívares a la tasa del día. Cálculo puro, con pruebas; lo que toca la
 * base está en `facturas.ts`.
 *
 * Los precios del negocio llevan el IVA incluido: lo que dice la lista es
 * lo que paga el cliente, y la factura lo desglosa (la base es el precio
 * entre 1,16). Así el total de la factura es el de la nota y el de la
 * cuenta del cliente, y nada cambia en la caja. Lo exento (los huevos, por
 * ejemplo) va marcado con «(E)», como pide el SENIAT.
 */

/** Si un producto lleva IVA o está exento (art. 18 de la Ley del IVA: huevos, queso blanco duro, pan, harina…). */
export type TipoIva = "general" | "exento";

export const NOMBRE_IVA: Record<TipoIva, string> = {
  general: "Gravado (IVA general)",
  exento: "Exento (E)",
};

export function esTipoIva(valor: string): valor is TipoIva {
  return valor === "general" || valor === "exento";
}

/** La alícuota general del IVA si el dueño no ha puesto otra. */
export const IVA_GENERAL_POR_DEFECTO = 16;

export type TipoDeDocumento = "factura" | "nota_credito";

export const NOMBRE_DOCUMENTO: Record<TipoDeDocumento, string> = {
  factura: "Factura",
  nota_credito: "Nota de crédito",
};

/** «000012»: el número correlativo, con seis cifras como las notas. */
export function numeroDeFactura(numero: number): string {
  return String(numero).padStart(6, "0");
}

export type LineaParaFacturar = {
  descripcion: string;
  cantidad: number;
  unidad: string;
  /** El precio que se cobró, como en la nota: con el IVA incluido si está gravado. */
  precio_unitario_usd: number;
  /** Cantidad por precio, como en la nota. */
  importe_usd: number;
  iva: TipoIva;
};

export type LineaFacturada = LineaParaFacturar & {
  /** Lo que queda de la línea después de repartirle el descuento, con el IVA incluido. */
  neto_usd: number;
  /** Sin IVA: lo que va en la columna de importe de la factura (igual al neto si es exenta). */
  base_usd: number;
  iva_usd: number;
  /** El precio unitario sin IVA, para la columna de precio. */
  precio_sin_iva_usd: number;
};

export type CuentasDeFactura = {
  lineas: LineaFacturada[];
  /** La suma de los importes, con IVA incluido, antes del descuento. */
  subtotal_usd: number;
  descuento_usd: number;
  /** Lo exento, después del descuento. */
  exento_usd: number;
  base_imponible_usd: number;
  iva_pct: number;
  iva_usd: number;
  /** Lo que paga el cliente: exento + base + IVA. Es el total de la nota. */
  total_usd: number;
  tasa: number | null;
  exento_bs: number | null;
  base_imponible_bs: number | null;
  iva_bs: number | null;
  total_bs: number | null;
};

/**
 * Reparte el descuento entre las líneas en proporción a su importe (el
 * último céntimo va a la última línea, para que cuadre) y saca de cada una
 * su base y su IVA. Lo exento no lleva IVA.
 */
export function calcularFactura(datos: { lineas: LineaParaFacturar[]; descuento_usd: number; iva_pct: number; tasa: number | null }): CuentasDeFactura {
  const ivaPct = Math.max(0, Number(datos.iva_pct) || 0);
  const factor = 1 + ivaPct / 100;
  const subtotal = redondear(datos.lineas.reduce((s, l) => s + Number(l.importe_usd), 0));
  const descuento = redondear(Math.min(Math.max(0, Number(datos.descuento_usd) || 0), subtotal));

  let repartido = 0;
  const lineas: LineaFacturada[] = datos.lineas.map((l, i) => {
    const importe = redondear(Number(l.importe_usd));
    const ultima = i === datos.lineas.length - 1;
    const suParte = ultima ? redondear(descuento - repartido) : subtotal > 0 ? redondear((descuento * importe) / subtotal) : 0;
    repartido = redondear(repartido + suParte);
    const neto = redondear(importe - suParte);
    const base = l.iva === "exento" ? neto : redondear(neto / factor);
    return {
      ...l,
      importe_usd: importe,
      neto_usd: neto,
      base_usd: base,
      iva_usd: redondear(neto - base),
      precio_sin_iva_usd: l.iva === "exento" ? redondear(Number(l.precio_unitario_usd)) : redondear(Number(l.precio_unitario_usd) / factor),
    };
  });

  const exento = redondear(lineas.filter((l) => l.iva === "exento").reduce((s, l) => s + l.base_usd, 0));
  const base = redondear(lineas.filter((l) => l.iva !== "exento").reduce((s, l) => s + l.base_usd, 0));
  const iva = redondear(lineas.reduce((s, l) => s + l.iva_usd, 0));
  const total = redondear(exento + base + iva);

  const tasa = datos.tasa && datos.tasa > 0 ? datos.tasa : null;
  const totalBs = aBolivares(total, tasa);
  const exentoBs = aBolivares(exento, tasa);
  const baseBs = aBolivares(base, tasa);
  // El IVA en bolívares sale por diferencia, para que las tres partes sumen el total exacto.
  const ivaBs = totalBs === null || exentoBs === null || baseBs === null ? null : redondear(totalBs - exentoBs - baseBs);

  return {
    lineas,
    subtotal_usd: subtotal,
    descuento_usd: descuento,
    exento_usd: exento,
    base_imponible_usd: base,
    iva_pct: ivaPct,
    iva_usd: iva,
    total_usd: total,
    tasa,
    exento_bs: exentoBs,
    base_imponible_bs: baseBs,
    iva_bs: ivaBs,
    total_bs: totalBs,
  };
}

/** «2 kg Mozzarella» o «1 cartón Huevos (E)»: la descripción de una línea, con la marca de exenta si lo es. */
export function descripcionDeLinea(l: Pick<LineaFacturada, "descripcion" | "iva">): string {
  return l.iva === "exento" ? `${l.descripcion} (E)` : l.descripcion;
}

export function cantidadDeLinea(l: Pick<LineaFacturada, "cantidad" | "unidad">): string {
  return cantidad(l.cantidad, l.unidad);
}

// ---------- El libro de ventas ----------

/** Lo que el libro necesita de cada documento (una factura o una nota de crédito). */
export type DocumentoDelLibro = {
  tipo: TipoDeDocumento;
  numero: number;
  numero_control: string;
  fecha: string;
  cliente_nombre: string;
  cliente_rif: string;
  /** El número de la factura que anula, si es una nota de crédito. */
  factura_afectada: number | null;
  venta_id: number | null;
  exento_usd: number;
  base_imponible_usd: number;
  iva_pct: number;
  iva_usd: number;
  total_usd: number;
  tasa: number | null;
  estado: "emitida" | "anulada";
};

export const CABECERA_DEL_LIBRO = [
  "Fecha",
  "Tipo",
  "N.º",
  "N.º de control",
  "Cliente",
  "RIF o cédula",
  "Factura afectada",
  "Total Bs",
  "Exento Bs",
  "Base imponible Bs",
  "Alícuota %",
  "IVA Bs",
  "Tasa BCV",
  "Total USD",
  "Exento USD",
  "Base imponible USD",
  "IVA USD",
  "Estado",
  "Nota de entrega",
];

/**
 * Una fila por documento, en el orden en que se emitieron. Una nota de
 * crédito va en negativo: resta lo que facturó la factura que anula. Los
 * bolívares van a la tasa con que se emitió cada documento.
 */
export function filasDelLibro(documentos: DocumentoDelLibro[]): (string | number)[][] {
  return documentos.map((d) => {
    const signo = d.tipo === "nota_credito" ? -1 : 1;
    const enBs = (usd: number) => (d.tasa ? numeroParaExcel(signo * redondear(usd * d.tasa)) : "");
    return [
      fechaCorta(d.fecha),
      NOMBRE_DOCUMENTO[d.tipo],
      numeroDeFactura(d.numero),
      d.numero_control,
      d.cliente_nombre,
      d.cliente_rif,
      d.factura_afectada === null ? "" : numeroDeFactura(d.factura_afectada),
      enBs(d.total_usd),
      enBs(d.exento_usd),
      enBs(d.base_imponible_usd),
      numeroParaExcel(d.iva_pct, 0),
      enBs(d.iva_usd),
      d.tasa ? numeroParaExcel(d.tasa, 4) : "",
      numeroParaExcel(signo * d.total_usd),
      numeroParaExcel(signo * d.exento_usd),
      numeroParaExcel(signo * d.base_imponible_usd),
      numeroParaExcel(signo * d.iva_usd),
      d.estado === "anulada" ? "Anulada" : "Emitida",
      d.venta_id === null ? "" : String(d.venta_id).padStart(6, "0"),
    ];
  });
}

/** Lo que suma el libro de un mes: lo facturado menos lo anulado con notas de crédito, en dólares. */
export function totalesDelLibro(documentos: DocumentoDelLibro[]): {
  facturas: number;
  notas_credito: number;
  exento_usd: number;
  base_imponible_usd: number;
  iva_usd: number;
  total_usd: number;
} {
  let exento = 0;
  let base = 0;
  let iva = 0;
  let total = 0;
  let facturas = 0;
  let notasCredito = 0;
  for (const d of documentos) {
    const signo = d.tipo === "nota_credito" ? -1 : 1;
    if (d.tipo === "factura") facturas++;
    else notasCredito++;
    exento += signo * d.exento_usd;
    base += signo * d.base_imponible_usd;
    iva += signo * d.iva_usd;
    total += signo * d.total_usd;
  }
  return {
    facturas,
    notas_credito: notasCredito,
    exento_usd: redondear(exento),
    base_imponible_usd: redondear(base),
    iva_usd: redondear(iva),
    total_usd: redondear(total),
  };
}

/** «2026-10», el mes de una fecha «2026-10-28». */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Si una venta de otro mes se factura hoy, el SENIAT pide que la factura salga en el mismo período que la entrega: se avisa. */
export function avisoDePeriodo(fechaDeLaVenta: string, fechaDeHoy: string): string | null {
  if (mesDe(fechaDeLaVenta) === mesDe(fechaDeHoy)) return null;
  return `La nota es del ${fechaCorta(fechaDeLaVenta)} y la factura sale con fecha de hoy: la ley pide facturar en el mismo mes de la entrega. Coméntaselo a tu contador.`;
}
