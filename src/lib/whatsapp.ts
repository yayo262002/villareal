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

type Pendiente = {
  fecha: string;
  total_usd: number;
  pendiente_usd: number;
  /** El día en que había que tener pagada la nota, si se sabe. */
  vence?: string;
  /** Días pasados desde el vencimiento (negativos: los que faltan). */
  atraso?: number;
};

/** «, vencida hace 3 días» / «, vence el 05/10/2026» / nada si no se sabe. */
function plazoDe(p: Pendiente): string {
  if (p.atraso === undefined || !p.vence) return "";
  if (p.atraso > 1) return `, vencida hace ${p.atraso} días`;
  if (p.atraso === 1) return ", vencida desde ayer";
  if (p.atraso === 0) return ", vence hoy";
  return `, vence el ${fechaCorta(p.vence)}`;
}

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
    lineas.push(`• Nota del ${fechaCorta(p.fecha)}: ${usd(p.total_usd)}${parte}${plazoDe(p)}`);
  }
  lineas.push(
    datos.tasa
      ? `Puede pagar en dólares o en bolívares a ${bs(datos.tasa)} por dólar. ¡Gracias!`
      : "Puede pagar en dólares o en bolívares a la tasa del día. ¡Gracias!",
  );
  return lineas.join("\n");
}

type Linea = {
  cantidad: number;
  unidad: string;
  producto_nombre: string;
  precio_unitario_usd: number;
  subtotal_usd: number;
  piezas?: number | null;
};

/** « (2 pzas)», o nada si no se anotaron. */
function piezasDe(l: { piezas?: number | null }): string {
  return l.piezas ? ` (${l.piezas} ${l.piezas === 1 ? "pza" : "pzas"})` : "";
}

/** La nota de una venta, para mandársela al cliente como comprobante. */
export function mensajeNota(datos: {
  negocio: string;
  cliente: string;
  fecha: string;
  /** «000012»: el número de la nota, para que el cliente la tenga a mano. */
  numero?: string;
  lineas: Linea[];
  total_usd: number;
  saldo_usd: number;
  tasa?: number | null;
  /** El día límite para pagarla; se dice solo si queda algo por pagar. */
  vence?: string;
}): string {
  const titulo = datos.numero ? `Nota N.º ${datos.numero} del ${fechaCorta(datos.fecha)}` : `Nota del ${fechaCorta(datos.fecha)}`;
  const lineas = [`${datos.negocio} · ${titulo}`, `Cliente: ${datos.cliente}`, ""];
  for (const l of datos.lineas) {
    lineas.push(`${formatearCantidad(l.cantidad)} ${nombreUnidad(l.unidad)}${piezasDe(l)} ${l.producto_nombre} × ${usd(l.precio_unitario_usd)} = ${usd(l.subtotal_usd)}`);
  }
  lineas.push("", `Total: ${dolaresYBolivares(datos.total_usd, datos.tasa)}`);
  if (datos.saldo_usd > 0) {
    lineas.push(`Saldo pendiente: ${dolaresYBolivares(datos.saldo_usd, datos.tasa)}`);
    if (datos.vence) lineas.push(`Fecha límite de pago de esta nota: ${fechaCorta(datos.vence)}`);
  } else if (datos.saldo_usd < 0) lineas.push(`Saldo a su favor: ${usd(-datos.saldo_usd)}`);
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

/**
 * Pedirle a un cliente su opinión de un producto, y su permiso para
 * publicarla. Sin nombre de cliente vale para cualquiera: el dueño elige
 * el contacto en WhatsApp.
 */
export function mensajePedirResena(datos: {
  negocio: string;
  cliente?: string;
  producto: string;
  /** La página del producto en la web, para que vea dónde saldría. */
  enlace?: string;
}): string {
  const lineas = [
    `${saludo(datos.cliente ?? "")}, le saluda ${datos.negocio}.`,
    `Nos gustaría conocer su opinión sobre este producto: ${datos.producto.toLowerCase()}.`,
    "¿Nos cuenta en un mensaje qué le ha parecido? Con su permiso, publicaremos su comentario en nuestra web con el nombre de su negocio.",
  ];
  if (datos.enlace) lineas.push(`Aquí saldría: ${datos.enlace}`);
  lineas.push("¡Gracias!");
  return lineas.join("\n");
}

/** El aviso de que el pedido va en camino, con lo que se le lleva. */
export function mensajeEnCamino(datos: {
  negocio: string;
  cliente: string;
  lineas: Pick<Linea, "cantidad" | "unidad" | "producto_nombre" | "piezas">[];
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
    lineas.push(`• ${formatearCantidad(l.cantidad)} ${nombreUnidad(l.unidad)}${piezasDe(l)} ${l.producto_nombre}`);
  }
  lineas.push(`Total: ${dolaresYBolivares(datos.total_usd, datos.tasa)}`);
  return lineas.join("\n");
}

function formatearCantidad(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
}
