import "server-only";
import { ejecutar, fila, filas } from "./db";
import { CANTIDAD_MAXIMA, CLAVE_VALIDA, type LineaDelCarrito } from "./carrito";

/**
 * Los pedidos que se mandan desde el carrito de la web. El pedido va por WhatsApp (el cliente lo envía desde su
 * teléfono), pero un mensaje se pierde entre otros chats: por eso, al pulsar «Enviar pedido por WhatsApp», el carrito
 * deja también aquí una copia, y el panel la enseña en «Pedidos de la web» (nuevos, atendidos, descartados) y avisa al
 * teléfono del dueño. No es una venta: la venta se anota en la caja cuando se confirma. Es público, así que todo se
 * recorta y se frena (`peticionPermitida`), y no se cree nada de lo que manda el navegador salvo como texto.
 */

export type EstadoDelPedido = "nuevo" | "atendido" | "descartado";

export type PedidoWeb = {
  id: number;
  nombre: string;
  negocio: string;
  nota: string;
  /** El mensaje tal como se mandó por WhatsApp: productos, cantidades, precios estimados, entrega. */
  mensaje: string;
  /** Cuántos productos lleva. */
  productos: number;
  /** El total estimado que vio el cliente, en dólares (lo que se mande, como referencia). */
  total_usd: number | null;
  estado: EstadoDelPedido;
  creado_en: string;
  atendido_en: string | null;
  /** La venta que se anotó con él en la caja, si se pasó a la caja. */
  venta_id: number | null;
};

/** Un pedido con lo que lleva, para pasarlo a la caja. */
export type PedidoConLineas = PedidoWeb & { lineas: LineaDelCarrito[] };

export type PedidoQueLlega = { lineas: LineaDelCarrito[]; nombre: string; negocio: string; nota: string; mensaje: string; total_usd: number | null };

const recortar = (valor: unknown, largo: number) => (typeof valor === "string" ? valor.replace(/\u0000/g, "").trim().slice(0, largo) : "");

/** Lo que manda el carrito, limpio: claves y cantidades válidas, textos recortados. Null si no trae nada pedible. */
export function leerPedido(crudo: unknown): PedidoQueLlega | null {
  if (!crudo || typeof crudo !== "object") return null;
  const c = crudo as Record<string, unknown>;
  const lineas = (Array.isArray(c.lineas) ? c.lineas : [])
    .filter((l): l is { clave: unknown; cantidad: unknown } => Boolean(l) && typeof l === "object")
    .map((l) => ({ clave: String(l.clave ?? ""), cantidad: Number(l.cantidad) }))
    .filter((l) => CLAVE_VALIDA.test(l.clave) && Number.isFinite(l.cantidad) && l.cantidad > 0 && l.cantidad <= CANTIDAD_MAXIMA)
    .slice(0, 100);
  const mensaje = recortar(c.mensaje, 4000);
  if (lineas.length === 0 || !mensaje) return null;
  const total = Number(c.total_usd);
  return {
    lineas,
    nombre: recortar(c.nombre, 60),
    negocio: recortar(c.negocio, 60),
    nota: recortar(c.nota, 200),
    mensaje,
    total_usd: Number.isFinite(total) && total >= 0 && total < 1_000_000 ? Math.round(total * 100) / 100 : null,
  };
}

export async function guardarPedido(p: PedidoQueLlega): Promise<number> {
  const r = await ejecutar(
    "insert into pedidos_web (nombre, negocio, nota, mensaje, lineas, productos, total_usd) values (?, ?, ?, ?, ?, ?, ?)",
    [p.nombre, p.negocio, p.nota, p.mensaje, JSON.stringify(p.lineas), p.lineas.length, p.total_usd],
  );
  return r.ultimoId;
}

export async function listarPedidos(limite = 100): Promise<PedidoWeb[]> {
  return filas<PedidoWeb>(
    "select id, nombre, negocio, nota, mensaje, productos, total_usd, estado, creado_en, atendido_en, venta_id from pedidos_web order by id desc limit ?",
    [limite],
  );
}

export async function buscarPedido(id: number): Promise<PedidoConLineas | null> {
  const f = await fila<PedidoWeb & { lineas: string }>(
    "select id, nombre, negocio, nota, mensaje, productos, total_usd, estado, creado_en, atendido_en, venta_id, lineas from pedidos_web where id = ?",
    [id],
  );
  if (!f) return null;
  let lineas: LineaDelCarrito[] = [];
  try {
    // Se guardó ya limpio (`leerPedido`), pero se vuelve a filtrar: es lo que mandó un navegador.
    lineas = leerPedido({ lineas: JSON.parse(f.lineas), mensaje: "-" })?.lineas ?? [];
  } catch {
    lineas = [];
  }
  return { ...f, venta_id: f.venta_id === null || f.venta_id === undefined ? null : Number(f.venta_id), lineas };
}

/** El pedido pasado a la caja, ya vendido: queda atendido y unido a su venta. */
export async function atenderPedidoConVenta(id: number, ventaId: number): Promise<void> {
  await ejecutar("update pedidos_web set estado = 'atendido', atendido_en = coalesce(atendido_en, datetime('now')), venta_id = ? where id = ?", [ventaId, id]);
}

export async function contarPedidosNuevos(): Promise<number> {
  const f = await fila<{ n: number }>("select count(*) as n from pedidos_web where estado = 'nuevo'");
  return Number(f?.n ?? 0);
}

export async function cambiarEstadoDelPedido(id: number, estado: EstadoDelPedido): Promise<boolean> {
  const r = await ejecutar(
    `update pedidos_web set estado = ?, atendido_en = ${estado === "nuevo" ? "null" : "datetime('now')"} where id = ?`,
    [estado, id],
  );
  return r.cambios > 0;
}

export function esEstadoDePedido(valor: string): valor is EstadoDelPedido {
  return valor === "nuevo" || valor === "atendido" || valor === "descartado";
}

/** El mismo pedido mandado hace poco (el botón pulsado dos veces): no se guarda otra vez. */
export async function pedidoIgualReciente(mensaje: string): Promise<boolean> {
  const f = await fila<{ n: number }>("select count(*) as n from pedidos_web where mensaje = ? and creado_en > datetime('now', '-10 minutes')", [mensaje]);
  return Number(f?.n ?? 0) > 0;
}
