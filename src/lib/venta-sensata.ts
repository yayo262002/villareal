import { redondear, usd } from "./dinero.ts";
import { revisarPesoPorPieza, type PesoTipico } from "./piezas.ts";

/**
 * Revisa una línea de venta antes de guardarla, como haría el dueño al
 * repasar la nota de papel: si los kilos o el precio no tienen sentido,
 * se dice. Hay dos clases de reparo:
 *
 * - `errores`: lo que no puede ser (sin kilos, precio en cero, 5000 kilos).
 *   No se guarda.
 * - `avisos`: lo que se sale de lo normal pero podría ser (un precio muy
 *   distinto del de la lista). Se guarda solo si el dueño confirma.
 *
 * Cálculo puro, con pruebas.
 */

export const KILOS_MAXIMOS = 1000;
export const PIEZAS_MAXIMAS = 500;
export const PRECIO_MAXIMO = 1000;
/** Un precio a menos de la mitad o a más del doble de la referencia pide confirmación. */
export const PRECIO_MINIMO_RESPECTO = 0.5;
export const PRECIO_MAXIMO_RESPECTO = 2;
/** Una sola línea por encima de esto también pide confirmación. */
export const IMPORTE_QUE_PIDE_CONFIRMAR = 1000;

export type LineaEscrita = {
  producto: string;
  /** Kilos, o cartones si el producto se vende así. */
  cantidad: number | null;
  piezas: number | null;
  precio: number | null;
  /** «kg» o «cartón», para hablar con las palabras del producto. */
  unidad: string;
  /** El precio de la lista que le toca a este cliente, si lo hay. */
  precioDeLista: number | null;
  /** Lo que se le cobró la última vez a este cliente por este producto, si hay. */
  ultimoPrecio: number | null;
  /** Lo que hay en inventario de este producto, si se sigue. */
  existencia?: number | null;
  /** Lo que suele pesar una pieza, si ya se aprendió de las notas. */
  pesoTipico?: PesoTipico | null;
};

export type Revision = { errores: string[]; avisos: string[] };

/** Una línea cuenta si el dueño escribió algo en ella. */
export function lineaRellena(l: Pick<LineaEscrita, "cantidad" | "piezas" | "precio">): boolean {
  return l.cantidad !== null || l.piezas !== null || l.precio !== null;
}

export function revisarLinea(l: LineaEscrita): Revision {
  const errores: string[] = [];
  const avisos: string[] = [];
  const nombre = l.producto;
  const unidades = l.unidad === "kg" ? "kilos" : l.unidad === "carton" ? "cartones" : "unidades";

  if (l.cantidad === null) errores.push(`${nombre}: escribe los ${unidades}.`);
  else if (!(l.cantidad > 0)) errores.push(`${nombre}: los ${unidades} tienen que ser más de cero.`);
  else if (l.cantidad > KILOS_MAXIMOS) errores.push(`${nombre}: ${formatear(l.cantidad)} ${unidades} no puede ser. Revisa la cantidad.`);

  if (l.piezas !== null) {
    if (!Number.isInteger(l.piezas) || l.piezas <= 0) errores.push(`${nombre}: las piezas son un número entero, 1 o más.`);
    else if (l.piezas > PIEZAS_MAXIMAS) errores.push(`${nombre}: ${l.piezas} piezas no puede ser.`);
  }

  if (l.precio === null) errores.push(`${nombre}: escribe el precio en dólares.`);
  else if (!(l.precio > 0)) errores.push(`${nombre}: el precio tiene que ser más de cero.`);
  else if (l.precio > PRECIO_MAXIMO) errores.push(`${nombre}: ${usd(l.precio)} por ${l.unidad === "kg" ? "kilo" : l.unidad} no puede ser.`);

  if (errores.length > 0) return { errores, avisos };

  const cantidad = l.cantidad!;
  const precio = l.precio!;
  const referencia = l.precioDeLista ?? l.ultimoPrecio;
  if (referencia !== null && referencia > 0) {
    if (precio < referencia * PRECIO_MINIMO_RESPECTO || precio > referencia * PRECIO_MAXIMO_RESPECTO) {
      const partes = [];
      if (l.precioDeLista !== null) partes.push(`en la lista está a ${usd(l.precioDeLista)}`);
      if (l.ultimoPrecio !== null) partes.push(`la última vez le cobraste ${usd(l.ultimoPrecio)}`);
      avisos.push(`${nombre} a ${usd(precio)} se sale de lo normal: ${partes.join(" y ")}.`);
    }
  }
  const importe = redondear(cantidad * precio);
  if (importe > IMPORTE_QUE_PIDE_CONFIRMAR) {
    avisos.push(`${nombre}: ${formatear(cantidad)} ${unidades} a ${usd(precio)} son ${usd(importe)}. ¿Es así?`);
  }
  // El inventario puede ir atrasado (una compra sin anotar), así que vender más de lo que hay solo pide confirmar.
  if (l.existencia !== undefined && l.existencia !== null && cantidad > l.existencia) {
    avisos.push(
      l.existencia > 0
        ? `${nombre}: anotaste ${formatear(cantidad)} ${unidades} y en el inventario hay ${formatear(l.existencia)}. Si la venta es así, el inventario queda en negativo: anota la compra que falta o haz un recuento.`
        : `${nombre}: en el inventario no queda nada. Si la venta es así, anota la compra que falta o haz un recuento.`,
    );
  }
  if (l.piezas !== null && l.pesoTipico) {
    const aviso = revisarPesoPorPieza(nombre, l.piezas, cantidad, l.pesoTipico);
    if (aviso) avisos.push(aviso);
  }
  return { errores, avisos };
}

/** Revisa todas las líneas de una nota. Una nota sin ninguna línea rellena es un error. */
export function revisarVenta(lineas: LineaEscrita[]): Revision {
  const rellenas = lineas.filter(lineaRellena);
  if (rellenas.length === 0) return { errores: ["Escribe los kilos y el precio de al menos un producto."], avisos: [] };
  const revisiones = rellenas.map(revisarLinea);
  return {
    errores: revisiones.flatMap((r) => r.errores),
    avisos: revisiones.flatMap((r) => r.avisos),
  };
}

/** La fecha de la nota de papel. Puede ser de días atrás, nunca de mañana. No es el día de entrega. */
export function revisarFecha(fecha: string, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(fecha + "T00:00:00Z").getTime())) {
    return "Falta la fecha de la nota.";
  }
  if (fecha > hoy) return "La fecha de la nota no puede ser de mañana en adelante.";
  return null;
}

function formatear(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
}
