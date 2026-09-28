import { fechaCorta, usd } from "./dinero.ts";

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
}): string {
  const lineas = [`Hola ${datos.cliente}, le saluda ${datos.negocio}.`];
  lineas.push(`Tiene pendiente ${usd(datos.saldo_usd)}:`);
  for (const p of datos.pendientes) {
    const parte = p.pendiente_usd < p.total_usd ? ` (quedan ${usd(p.pendiente_usd)})` : "";
    lineas.push(`• Nota del ${fechaCorta(p.fecha)}: ${usd(p.total_usd)}${parte}`);
  }
  lineas.push("Puede pagar en dólares o en bolívares a la tasa del día. ¡Gracias!");
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
}): string {
  const lineas = [`${datos.negocio} · Nota del ${fechaCorta(datos.fecha)}`, `Cliente: ${datos.cliente}`, ""];
  for (const l of datos.lineas) {
    lineas.push(`${formatearCantidad(l.cantidad)} ${l.unidad} ${l.producto_nombre} × ${usd(l.precio_unitario_usd)} = ${usd(l.subtotal_usd)}`);
  }
  lineas.push("", `Total: ${usd(datos.total_usd)}`);
  if (datos.saldo_usd > 0) lineas.push(`Saldo pendiente: ${usd(datos.saldo_usd)}`);
  else if (datos.saldo_usd < 0) lineas.push(`Saldo a su favor: ${usd(-datos.saldo_usd)}`);
  else lineas.push("Cuenta al día. ¡Gracias!");
  return lineas.join("\n");
}

function formatearCantidad(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
}
