import { fechaCorta, redondear, usd, type Unidad } from "./dinero.ts";
import { nombraElProducto, type LineaLeida, type NotaLeida } from "./nota-leida.ts";

/**
 * De la foto de la nota a la venta en la caja (el dueño, 14/11/2026: «que
 * yo le tome foto a la nota y él rellene todo»). Lo leído (`nota-leida.ts`)
 * se vuelve el carrito: cada línea con su producto, sus kilos y piezas y el
 * precio que dice la nota (que es lo que se cobró), la fecha de la nota y si
 * va firmada. Lo que no se sabe de qué producto es queda aparte, con los que
 * se le parecen, para que el dueño lo elija; lo que no cuadra, como aviso.
 * De quién es la nota lo dice `cliente-de-la-nota.ts`. Nada se guarda
 * desde aquí: la caja lo enseña y el dueño confirma. Puro, con pruebas.
 */

export type ArticuloDeLaNota = { clave: string; nombre: string; unidad: Unidad };

/** Lo que contesta el servidor al leer la nota desde la caja: la foto queda guardada (`fotoId`) para ser la de la venta. */
export type LecturaParaLaCaja = { ok: true; fotoId: number; nota: NotaLeida } | { ok: false; error: string; fotoId?: number };

/** Una línea que va al carrito. */
export type LineaDeLaNota = {
  clave: string;
  /** Kilos, cartones o unidades. 0 si la nota no deja saberlo: hay que escribirlo. */
  cantidad: number;
  piezas: number | null;
  /** El precio de la nota; null si no lo dice y no sale del importe: va el de la caja. */
  precio: number | null;
  /** Lo que decía la nota en ese renglón, para enseñarlo. */
  descripcion: string;
  importe: number | null;
};

/** Un renglón de la nota que no se sabe a qué producto corresponde. */
export type LineaSinProducto = {
  /** Su número entre los renglones de la nota, para elegirle el producto. */
  renglon: number;
  descripcion: string;
  cantidad: number | null;
  piezas: number | null;
  precio: number | null;
  importe: number | null;
  /** Los productos que se le parecen por el nombre, el más parecido primero (claves). */
  parecidos: string[];
};

export type VentaDeLaNota = {
  esNota: boolean;
  /** La fecha de la nota, si se lee y no es de mañana. */
  fecha: string | null;
  lineas: LineaDeLaNota[];
  sinProducto: LineaSinProducto[];
  /** El total que dice la nota, o lo que suman sus renglones si no lo dice. */
  total: number | null;
  /** Va firmada: entonces ya se entregó, y la foto es la de la nota firmada. */
  firmada: boolean | null;
  avisos: string[];
};

const MAXIMO_DE_PARECIDOS = 3;

const tresDecimales = (n: number) => Math.round(n * 1000) / 1000;

/** Cuánto lleva un renglón: lo que dice, o el importe entre el precio, o, en lo que no va por kilo, las piezas. */
function cantidadDe(l: LineaLeida, unidad: Unidad | null): number | null {
  if (l.cantidad !== null && l.cantidad > 0) return tresDecimales(l.cantidad);
  if (l.importe !== null && l.importe > 0 && l.precio !== null && l.precio > 0) return tresDecimales(l.importe / l.precio);
  if (unidad !== "kg" && l.piezas !== null && l.piezas > 0) return Math.round(l.piezas);
  return null;
}

/** A cuánto va: lo que dice, o el importe entre la cantidad. */
function precioDe(l: LineaLeida, cantidad: number | null): number | null {
  if (l.precio !== null && l.precio > 0) return redondear(l.precio);
  if (l.importe !== null && l.importe > 0 && cantidad) return redondear(l.importe / cantidad);
  return null;
}

/** Los productos que nombra un renglón sin clave («tocineta ahumada» → Tocineta ahumada), por sus palabras. */
function parecidosA(descripcion: string, catalogo: ArticuloDeLaNota[]): string[] {
  if (!descripcion.trim()) return [];
  return catalogo.filter((a) => nombraElProducto(a.nombre, descripcion)).slice(0, MAXIMO_DE_PARECIDOS).map((a) => a.clave);
}

/** La venta que dice la nota: lo que va al carrito, lo que hay que elegir y los avisos. */
export function ventaDeLaNota(nota: NotaLeida, catalogo: ArticuloDeLaNota[], hoy: string): VentaDeLaNota {
  if (!nota.esNota) {
    return {
      esNota: false,
      fecha: null,
      lineas: [],
      sinProducto: [],
      total: null,
      firmada: null,
      avisos: ["Esa foto no parece una nota de entrega: no se ve la hoja del talonario con lo entregado y los importes. Prueba otra foto, con la hoja entera y buena luz."],
    };
  }
  const porClave = new Map(catalogo.map((a) => [a.clave, a]));
  const avisos: string[] = [];

  let fecha: string | null = nota.fecha;
  if (fecha === null) avisos.push("No se lee la fecha de la nota: queda la de hoy. Cámbiala si la nota es de otro día.");
  else if (fecha > hoy) {
    avisos.push(`La nota dice ${fechaCorta(fecha)}, que todavía no ha llegado: queda la de hoy. Revisa la fecha.`);
    fecha = null;
  }

  const lineas: LineaDeLaNota[] = [];
  const sinProducto: LineaSinProducto[] = [];
  const repetidas = new Map<string, number>();
  nota.lineas.forEach((l, renglon) => {
    const articulo = l.clave ? porClave.get(l.clave) : undefined;
    if (!articulo) {
      const cantidad = cantidadDe(l, null);
      sinProducto.push({ renglon, descripcion: l.descripcion, cantidad, piezas: l.piezas, precio: precioDe(l, cantidad), importe: l.importe, parecidos: parecidosA(l.descripcion, catalogo) });
      return;
    }
    const cantidad = cantidadDe(l, articulo.unidad);
    const precio = precioDe(l, cantidad);
    const piezas = articulo.unidad === "kg" && l.piezas !== null && l.piezas > 0 ? Math.round(l.piezas) : null;
    const ya = lineas.find((x) => x.clave === articulo.clave);
    if (ya) {
      // La caja lleva una línea por artículo: los dos renglones van juntos.
      repetidas.set(articulo.clave, (repetidas.get(articulo.clave) ?? 1) + 1);
      if (precio !== null && ya.precio !== null && Math.abs(precio - ya.precio) > 0.005) {
        avisos.push(`${articulo.nombre} sale en la nota a ${usd(ya.precio)} y a ${usd(precio)}: van juntas a ${usd(ya.precio)}. Revisa el precio.`);
      }
      ya.cantidad = tresDecimales(ya.cantidad + (cantidad ?? 0));
      ya.piezas = ya.piezas === null && piezas === null ? null : (ya.piezas ?? 0) + (piezas ?? 0);
      ya.precio = ya.precio ?? precio;
      ya.importe = ya.importe === null && l.importe === null ? null : redondear((ya.importe ?? 0) + (l.importe ?? 0));
      ya.descripcion = `${ya.descripcion} + ${l.descripcion}`.trim();
      return;
    }
    if (cantidad === null) avisos.push(`No se lee cuánto de ${articulo.nombre} dice la nota: escríbelo en el carrito.`);
    lineas.push({ clave: articulo.clave, cantidad: cantidad ?? 0, piezas, precio, descripcion: l.descripcion, importe: l.importe });
  });
  for (const [clave, veces] of repetidas) {
    avisos.push(`${porClave.get(clave)?.nombre ?? "Un producto"} sale ${veces} veces en la nota: va en una sola línea con todo junto.`);
  }

  if (nota.lineas.length === 0) avisos.push("No se leyó ningún producto en la nota: agrégalos a mano.");
  const importes = nota.lineas.map((l) => l.importe).filter((i): i is number => i !== null);
  const suma = importes.length > 0 ? redondear(importes.reduce((s, i) => s + i, 0)) : null;
  if (suma !== null && nota.total !== null && Math.abs(suma - nota.total) > 0.011) {
    avisos.push(`En la nota los renglones suman ${usd(suma)} y el total dice ${usd(nota.total)}: revisa la suma.`);
  }
  if (nota.firmada === false) avisos.push("No se ve la firma del cliente en la nota.");

  return { esNota: true, fecha, lineas, sinProducto, total: nota.total ?? suma, firmada: nota.firmada, avisos };
}
