import type { Vendible } from "./catalogo.ts";
import type { PesoTipico } from "./piezas.ts";

/**
 * El inventario: lo que hay de cada producto y marca. Entra con las compras
 * a los proveedores (sus líneas de producto), sale con cada venta, y se
 * corrige con los recuentos y las mermas que anota el dueño. De ahí sale
 * la existencia, cuántas piezas serían y cuántos días dura al ritmo de los
 * últimos 30. Cálculo puro, con pruebas: la base solo da las sumas.
 */

export type EstadoDeExistencia = "sin_seguir" | "sin" | "poco" | "bien";

export type Existencia = Vendible & {
  comprado: number;
  vendido: number;
  ajustado: number;
  existencia: number;
  /** Cuántas piezas serían, con lo que se sabe del peso por pieza. */
  piezas: number | null;
  pesoPorPieza: PesoTipico | null;
  ultimoCosto: number | null;
  /** Lo vendido en los últimos 30 días. */
  vendidoReciente: number;
  /** A este ritmo, cuántos días dura lo que hay. Null si no se vende o no queda. */
  diasQueDura: number | null;
  /** Si el inventario de este producto se sigue: hubo alguna compra con él o algún recuento. */
  seguido: boolean;
  estado: EstadoDeExistencia;
};

export const DIAS_RECIENTES = 30;
/** Con menos días de existencia que esto, se avisa que queda poco. */
export const DIAS_QUE_AVISAN = 7;

const redondearCantidad = (n: number) => Math.round(n * 1000) / 1000;

export function existenciasDe(
  vendibles: Vendible[],
  comprado: Map<string, number>,
  vendido: Map<string, number>,
  ajustado: Map<string, number>,
  vendidoReciente: Map<string, number>,
  pesos: Map<string, PesoTipico>,
  ultimoCosto: Map<string, number>,
): Existencia[] {
  return vendibles.map((v) => {
    const c = comprado.get(v.clave) ?? 0;
    const s = vendido.get(v.clave) ?? 0;
    const a = ajustado.get(v.clave) ?? 0;
    const existencia = redondearCantidad(c - s + a);
    const reciente = redondearCantidad(vendidoReciente.get(v.clave) ?? 0);
    const peso = pesos.get(v.clave) ?? null;
    const seguido = comprado.has(v.clave) || ajustado.has(v.clave);
    const diasQueDura = reciente > 0 && existencia > 0 ? Math.round(existencia / (reciente / DIAS_RECIENTES)) : null;
    const estado: EstadoDeExistencia = !seguido ? "sin_seguir" : existencia <= 0 ? "sin" : diasQueDura !== null && diasQueDura < DIAS_QUE_AVISAN ? "poco" : "bien";
    return {
      ...v,
      comprado: redondearCantidad(c),
      vendido: redondearCantidad(s),
      ajustado: redondearCantidad(a),
      existencia,
      piezas: peso && v.unidad === "kg" && existencia > 0 ? Math.round(existencia / peso.peso) : null,
      pesoPorPieza: peso,
      ultimoCosto: ultimoCosto.get(v.clave) ?? null,
      vendidoReciente: reciente,
      diasQueDura,
      seguido,
      estado,
    };
  });
}

/** El cambio que deja un recuento: lo contado menos lo que el sistema creía que había. */
export function ajustePorRecuento(existenciaActual: number, contado: number): number {
  return redondearCantidad(contado - existenciaActual);
}
