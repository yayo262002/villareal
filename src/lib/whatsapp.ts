import { aBolivares, bs, fechaCorta, nombreUnidad, usd } from "./dinero.ts";

/** «USD 18,00 (Bs 657,00)» si hay tasa; solo dólares si no. */
function dolaresYBolivares(monto: number, tasa: number | null | undefined): string {
  const enBs = aBolivares(monto, tasa ?? null);
  return enBs === null ? usd(monto) : `${usd(monto)} (${bs(enBs)})`;
}

/**
 * Mensajes de WhatsApp al cliente: recordar lo que debe y mandarle la nota
 * de una venta. Solo arma el enlace `wa.me`; el dueño lo revisa y lo envía
 * desde su teléfono. Cálculo puro, con pruebas.
 */

/**
 * De un teléfono escrito a la venezolana («0412-123.45.67», «412 1234567»,
 * «+58 412 1234567») a los dígitos que espera wa.me («584121234567»).
 * Devuelve null si no parece un número venezolano completo.
 */
export function numeroWhatsapp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 12 && digitos.startsWith("58")) return digitos;
  if (digitos.length === 11 && digitos.startsWith("0")) return "58" + digitos.slice(1);
  // Sin el cero: «4121234567». Un número de 10 cifras que empieza por 0 está incompleto.
  if (digitos.length === 10 && !digitos.startsWith("0")) return "58" + digitos;
  return null;
}

/**
 * El teléfono como se escribe en Venezuela, «0412-1234567», para guardarlo
 * siempre igual. Si no es un número venezolano completo se deja como vino,
 * sin espacios de más: no se inventan cifras.
 */
export function telefonoLegible(telefono: string): string {
  const numero = numeroWhatsapp(telefono);
  if (!numero) return telefono.trim().replace(/\s+/g, " ");
  return `0${numero.slice(2, 5)}-${numero.slice(5)}`;
}

/** Dos teléfonos son el mismo si tienen las mismas cifras, se escriban como se escriban. */
export function mismoTelefono(a: string, b: string): boolean {
  const cifras = (t: string) => numeroWhatsapp(t) ?? t.replace(/\D/g, "");
  const ca = cifras(a);
  return ca.length >= 7 && ca === cifras(b);
}

/**
 * Un cliente registrado solo con su teléfono lleva el teléfono como nombre.
 * A ese no se le saluda por el nombre: «Hola 0412-1234567» no es un saludo.
 */
export function esSoloUnTelefono(nombre: string): boolean {
  return !/\p{L}/u.test(nombre);
}

function saludo(cliente: string): string {
  return esSoloUnTelefono(cliente) ? "Hola" : `Hola ${cliente}`;
}

export function enlaceWhatsappA(telefono: string, mensaje: string): string | null {
  const numero = numeroWhatsapp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

type Pendiente = { fecha: string; total_usd: number; pendiente_usd: number };

/** Recordatorio de cobro con el detalle de las notas que quedan por pagar. */
export function mensajeRecordatorio(datos: {
  negocio: string;
  cliente: string;
  saldo_usd: number;
  pendientes: Pendiente[];
  /** Tasa del día; con ella el saldo va también en bolívares. */
  tasa?: number | null;
}): string {
  const lineas = [`${saludo(datos.cliente)}, le saluda ${datos.negocio}.`];
  lineas.push(`Tiene pendiente ${dolaresYBolivares(datos.saldo_usd, datos.tasa)}:`);
  for (const p of datos.pendientes) {
    const parte = p.pendiente_usd < p.total_usd ? ` (quedan ${usd(p.pendiente_usd)})` : "";
    lineas.push(`• Nota del ${fechaCorta(p.fecha)}: ${usd(p.total_usd)}${parte}`);
  }
  lineas.push(
    datos.tasa
      ? `Puede pagar en dólares o en bolívares a ${bs(datos.tasa)} por dólar. ¡Gracias!`
      : "Puede pagar en dólares o en bolívares a la tasa del día. ¡Gracias!",
  );
  return lineas.join("\n");
}

type Linea = { cantidad: number; unidad: string; producto_nombre: string; precio_unitario_usd: number; subtotal_usd: number };

/** La nota de una venta, para mandársela al cliente como comprobante. */
export function mensajeNota(datos: {
  negocio: string;
  cliente: string;
  fecha: string;
  lineas: Linea[];
  total_usd: number;
  saldo_usd: number;
  tasa?: number | null;
}): string {
  const lineas = [`${datos.negocio} · Nota del ${fechaCorta(datos.fecha)}`, `Cliente: ${datos.cliente}`, ""];
  for (const l of datos.lineas) {
    lineas.push(`${formatearCantidad(l.cantidad)} ${nombreUnidad(l.unidad)} ${l.producto_nombre} × ${usd(l.precio_unitario_usd)} = ${usd(l.subtotal_usd)}`);
  }
  lineas.push("", `Total: ${dolaresYBolivares(datos.total_usd, datos.tasa)}`);
  if (datos.saldo_usd > 0) lineas.push(`Saldo pendiente: ${dolaresYBolivares(datos.saldo_usd, datos.tasa)}`);
  else if (datos.saldo_usd < 0) lineas.push(`Saldo a su favor: ${usd(-datos.saldo_usd)}`);
  else lineas.push("Cuenta al día. ¡Gracias!");
  return lineas.join("\n");
}

/** El recibo de un abono: lo que se recibió y cómo queda la cuenta hoy. */
export function mensajeAbono(datos: {
  negocio: string;
  cliente: string;
  fecha: string;
  /** El método como se lee: «Pago móvil», «Zelle». */
  metodo: string;
  monto: number;
  moneda: "USD" | "VES";
  /** La tasa con la que se guardó el abono, si fue en bolívares. */
  tasa: number | null;
  monto_usd: number;
  referencia: string;
  /** El saldo del cliente hoy, con este abono ya contado. */
  saldo_usd: number;
  tasaDelDia?: number | null;
}): string {
  const lineas = [`${saludo(datos.cliente)}, le saluda ${datos.negocio}.`, `Recibimos su abono del ${fechaCorta(datos.fecha)}.`];
  lineas.push(
    datos.moneda === "VES" && datos.tasa
      ? `Monto: ${bs(datos.monto)} (${usd(datos.monto_usd)} a ${bs(datos.tasa)} por dólar)`
      : `Monto: ${usd(datos.monto_usd)}`,
  );
  lineas.push(`Método: ${datos.metodo}`);
  if (datos.referencia) lineas.push(`Referencia: ${datos.referencia}`);
  if (datos.saldo_usd > 0) lineas.push(`Saldo pendiente a hoy: ${dolaresYBolivares(datos.saldo_usd, datos.tasaDelDia)}`);
  else if (datos.saldo_usd < 0) lineas.push(`Queda a su favor: ${usd(-datos.saldo_usd)}`);
  else lineas.push("Su cuenta queda al día.");
  lineas.push("¡Gracias!");
  return lineas.join("\n");
}

/** El aviso de que el pedido va en camino, con lo que se le lleva. */
export function mensajeEnCamino(datos: {
  negocio: string;
  cliente: string;
  lineas: Pick<Linea, "cantidad" | "unidad" | "producto_nombre">[];
  total_usd: number;
  tasa?: number | null;
}): string {
  const lineas = [`${saludo(datos.cliente)}, le saluda ${datos.negocio}.`];
  if (datos.lineas.length === 0) {
    lineas.push("Vamos en camino con su pedido.");
    return lineas.join("\n");
  }
  lineas.push("Vamos en camino con su pedido:");
  for (const l of datos.lineas) {
    lineas.push(`• ${formatearCantidad(l.cantidad)} ${nombreUnidad(l.unidad)} ${l.producto_nombre}`);
  }
  lineas.push(`Total: ${dolaresYBolivares(datos.total_usd, datos.tasa)}`);
  return lineas.join("\n");
}

function formatearCantidad(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
}
