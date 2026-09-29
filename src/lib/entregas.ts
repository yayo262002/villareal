import { cantidad } from "./dinero.ts";

/**
 * Los pedidos por entregar: qué lleva cada cliente y qué hay que cargar
 * antes de salir a despachar. Cálculo puro, con pruebas.
 */

export type LineaDePedido = {
  producto_id: number;
  producto_nombre: string;
  unidad: string;
  cantidad: number;
};

export type Pedido = {
  id: number;
  cliente_id: number;
  fecha: string;
  lineas: LineaDePedido[];
};

export type Carga = {
  producto_id: number;
  producto: string;
  unidad: string;
  cantidad: number;
};

/** Las cantidades se guardan con tres decimales (gramos): sumar no debe inventar más. */
function redondearCantidad(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Lo que hay que cargar: la suma de cada producto en todos los pedidos, en
 * el orden en que los productos están en el panel.
 */
export function cargaDe(pedidos: Pedido[]): Carga[] {
  const porProducto = new Map<number, Carga>();
  for (const pedido of pedidos) {
    for (const l of pedido.lineas) {
      const carga = porProducto.get(l.producto_id);
      if (carga) carga.cantidad = redondearCantidad(carga.cantidad + Number(l.cantidad));
      else {
        porProducto.set(l.producto_id, {
          producto_id: l.producto_id,
          producto: l.producto_nombre,
          unidad: l.unidad,
          cantidad: redondearCantidad(Number(l.cantidad)),
        });
      }
    }
  }
  return [...porProducto.values()].sort((a, b) => a.producto_id - b.producto_id);
}

/** Los pedidos de cada cliente, del más antiguo al más nuevo. */
export function pedidosPorCliente<P extends Pedido>(pedidos: P[]): Map<number, P[]> {
  const orden = [...pedidos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const porCliente = new Map<number, P[]>();
  for (const pedido of orden) {
    const lista = porCliente.get(pedido.cliente_id) ?? [];
    lista.push(pedido);
    porCliente.set(pedido.cliente_id, lista);
  }
  return porCliente;
}

/** «2 kg Queso mozzarella · 1 cartón Huevos»: lo que lleva una venta, en una línea. */
export function resumenDeLineas(lineas: Pick<LineaDePedido, "cantidad" | "unidad" | "producto_nombre">[]): string {
  return lineas.map((l) => `${cantidad(l.cantidad, l.unidad)} ${l.producto_nombre}`).join(" · ");
}

/** «000012»: el número de una nota de entrega es el de su venta, con ceros delante. */
export function numeroDeNota(ventaId: number): string {
  return String(ventaId).padStart(6, "0");
}
