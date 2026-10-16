import { redondear, type MetodoPago, type Unidad } from "./dinero.ts";

/**
 * Las cuentas de la caja (el punto de venta): el subtotal de las líneas, el
 * descuento, el total en dólares y en bolívares a la tasa del día, y la
 * revisión de un cobro antes de guardarlo (que las líneas tengan sentido y
 * que los pagos sumen el total). Cálculo puro, con pruebas; lo que toca la
 * base está en `pos.ts`.
 */

export type LineaDelPos = {
  /** «3» o «3-7»: el producto, o el producto y su marca. */
  clave: string;
  producto_id: number;
  variante_id: number | null;
  nombre: string;
  unidad: Unidad;
  cantidad: number;
  precio_usd: number;
};

export type PagoDelPos = {
  metodo: MetodoPago;
  /** Lo que paga por esta vía, en dólares; en bolívares se convierte a la tasa del día al guardar. */
  monto_usd: number;
  referencia?: string;
};

export type TotalesDelPos = { subtotal: number; descuento: number; total: number; totalBs: number | null };

export function subtotalDe(lineas: Pick<LineaDelPos, "cantidad" | "precio_usd">[]): number {
  return redondear(lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_usd), 0));
}

export function totalesDe(lineas: Pick<LineaDelPos, "cantidad" | "precio_usd">[], descuentoUsd: number, tasa: number | null): TotalesDelPos {
  const subtotal = subtotalDe(lineas);
  const descuento = redondear(Math.min(Math.max(0, Number(descuentoUsd) || 0), subtotal));
  const total = redondear(subtotal - descuento);
  return { subtotal, descuento, total, totalBs: tasa ? redondear(total * tasa) : null };
}

/** Cuánto falta por cubrir con los pagos (negativo si se pasan). */
export function faltaPorPagar(total: number, pagos: Pick<PagoDelPos, "monto_usd">[]): number {
  return redondear(total - pagos.reduce((s, p) => s + (Number(p.monto_usd) || 0), 0));
}

/** Lo que no deja cobrar: cada frase es un motivo. Vacío, el cobro está bien. */
export function revisarCobro(datos: {
  lineas: LineaDelPos[];
  descuento_usd: number;
  pagos: PagoDelPos[];
  tasa: number | null;
  metodosEnBolivares: MetodoPago[];
}): string[] {
  const motivos: string[] = [];
  if (datos.lineas.length === 0) motivos.push("No hay ningún producto en la venta.");
  for (const l of datos.lineas) {
    if (!(Number(l.cantidad) > 0)) motivos.push(`${l.nombre}: la cantidad tiene que ser mayor que cero.`);
    if (!(Number(l.precio_usd) >= 0)) motivos.push(`${l.nombre}: el precio no puede ser negativo.`);
    if (l.unidad !== "kg" && !Number.isInteger(Number(l.cantidad))) motivos.push(`${l.nombre}: se vende por ${l.unidad === "carton" ? "cartón" : "unidad"}; la cantidad va sin decimales.`);
  }
  const { subtotal, total } = totalesDe(datos.lineas, datos.descuento_usd, datos.tasa);
  if (Number(datos.descuento_usd) < 0) motivos.push("El descuento no puede ser negativo.");
  if (Number(datos.descuento_usd) > subtotal) motivos.push("El descuento no puede ser mayor que el subtotal.");
  if (datos.pagos.length === 0) motivos.push("Falta decir cómo pagó.");
  for (const p of datos.pagos) {
    if (!(Number(p.monto_usd) > 0)) motivos.push("Cada pago tiene que ser mayor que cero.");
    if (datos.metodosEnBolivares.includes(p.metodo) && !datos.tasa) motivos.push("Para cobrar en bolívares hace falta la tasa del día: ponla en Productos.");
  }
  const falta = faltaPorPagar(total, datos.pagos);
  if (datos.pagos.length > 0 && Math.abs(falta) > 0.01) {
    motivos.push(falta > 0 ? `Los pagos no cubren el total: faltan USD ${falta.toFixed(2)}.` : `Los pagos se pasan del total por USD ${(-falta).toFixed(2)}.`);
  }
  return motivos;
}

/** Sin tildes, en mayúsculas y solo letras y números. */
function abreviar(texto: string, largo: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, largo);
}

/**
 * Una propuesta de SKU a partir del tipo, la marca y el contenido:
 * «Mozzarella» + «Kemmental» + «2,5 kg» → «MOZ-KEM-25KG». Es solo una
 * sugerencia: el dueño puede escribir el que quiera.
 */
export function skuPropuesto(tipo: string, marca: string, contenido: string): string {
  const partes = [abreviar(tipo, 3), abreviar(marca, 3), abreviar(contenido.replace(/[.,]/g, ""), 6)].filter(Boolean);
  return partes.join("-");
}
