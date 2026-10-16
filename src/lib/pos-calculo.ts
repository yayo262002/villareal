import { redondear, usd, type MetodoPago, type Unidad } from "./dinero.ts";

/**
 * Las cuentas de la venta en la caja (el punto de venta): el subtotal de
 * las líneas, el descuento, el total en dólares y en bolívares a la tasa
 * del día, cómo queda la cuenta del cliente según lo que pague ahora, y la
 * revisión de los pagos antes de guardar. Cálculo puro, con pruebas; lo que
 * toca la base está en `pos.ts`.
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
  /** Las piezas, si se anotan (solo lo que va por kilo). Solo informan. */
  piezas?: number | null;
};

export type PagoDelPos = {
  metodo: MetodoPago;
  /** Lo que paga por esta vía, en dólares; en bolívares se convierte a la tasa del día al guardar. */
  monto_usd: number;
  referencia?: string;
};

/** Cómo se cierra la venta: paga todo ahora, paga una parte (el resto queda en su cuenta) o queda pendiente entera. */
export type ModoDePago = "ahora" | "parte" | "credito";

export const NOMBRE_MODO: Record<ModoDePago, string> = {
  ahora: "Paga todo ahora",
  parte: "Paga una parte",
  credito: "Queda pendiente",
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

export function pagadoDe(pagos: Pick<PagoDelPos, "monto_usd">[]): number {
  return redondear(pagos.reduce((s, p) => s + (Number(p.monto_usd) || 0), 0));
}

/** Cuánto falta por cubrir con los pagos (negativo si se pasan). */
export function faltaPorPagar(total: number, pagos: Pick<PagoDelPos, "monto_usd">[]): number {
  return redondear(total - pagadoDe(pagos));
}

/** El cambio que se le devuelve al cliente cuando paga en efectivo con más de lo que es. */
export function cambioDe(recibido: number, total: number): number {
  return redondear(Math.max(0, (Number(recibido) || 0) - total));
}

export type CuentaDespues = {
  /** Lo que debía antes de esta venta (positivo: debe; negativo: a favor). */
  saldoAnterior: number;
  pagado: number;
  /** Lo que queda de esta venta en su cuenta. */
  pendiente: number;
  saldoNuevo: number;
};

/**
 * Cómo queda la cuenta del cliente: con la convención de siempre (el saldo
 * es lo comprado menos lo abonado; positivo, debe). La venta suma; lo que
 * paga ahora resta.
 */
export function cuentaDespues(saldoAnterior: number, total: number, pagos: Pick<PagoDelPos, "monto_usd">[]): CuentaDespues {
  const pagado = Math.min(pagadoDe(pagos), total);
  const pendiente = redondear(total - pagado);
  return { saldoAnterior, pagado, pendiente, saldoNuevo: redondear(saldoAnterior + pendiente) };
}

export type TonoDeSaldo = "debe" | "al_dia" | "a_favor";

/** Cómo se dice un saldo: «Debe USD 235,40», «Al día» o «A favor USD 20,00». */
export function describirSaldo(saldo: number): { texto: string; tono: TonoDeSaldo } {
  if (saldo > 0.009) return { texto: `Debe ${usd(saldo)}`, tono: "debe" };
  if (saldo < -0.009) return { texto: `A favor ${usd(-saldo)}`, tono: "a_favor" };
  return { texto: "Al día", tono: "al_dia" };
}

/** Lo que no deja guardar la venta: cada frase es un motivo. Vacío, está bien. */
export function revisarVentaPos(datos: {
  lineas: LineaDelPos[];
  descuento_usd: number;
  pagos: PagoDelPos[];
  modo: ModoDePago;
  /** El cliente de mostrador no tiene cuenta: con él se paga todo en el momento. */
  esMostrador: boolean;
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

  const pagos = datos.modo === "credito" ? [] : datos.pagos;
  for (const p of pagos) {
    if (!(Number(p.monto_usd) > 0)) motivos.push("Cada pago tiene que ser mayor que cero.");
    if (datos.metodosEnBolivares.includes(p.metodo) && !datos.tasa) motivos.push("Para cobrar en bolívares hace falta la tasa del día: ponla en Productos.");
  }
  const falta = faltaPorPagar(total, pagos);
  if (datos.modo === "ahora") {
    if (pagos.length === 0) motivos.push("Falta decir cómo pagó.");
    else if (falta > 0.01) motivos.push(`Los pagos no cubren el total: faltan ${usd(falta)}. Si paga solo una parte, elige «Paga una parte».`);
    else if (falta < -0.01) motivos.push(`Los pagos se pasan del total por ${usd(-falta)}. Si es el efectivo que entregó, pon lo recibido aparte: el pago es por el total.`);
  } else if (datos.modo === "parte") {
    if (datos.esMostrador) motivos.push("Una venta de mostrador se paga en el momento: para dejar una parte pendiente, elige al cliente.");
    if (pagos.length === 0 || pagadoDe(pagos) <= 0) motivos.push("Escribe lo que paga ahora; si no paga nada, elige «Queda pendiente».");
    else if (falta <= 0.01) motivos.push("Lo que paga cubre el total: elige «Paga todo ahora».");
  } else if (datos.esMostrador) {
    motivos.push("Una venta de mostrador se paga en el momento: para dejarla pendiente, elige al cliente.");
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
