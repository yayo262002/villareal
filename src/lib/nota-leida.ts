import { fechaCorta, redondear, usd } from "./dinero.ts";

/**
 * Lo que se lee en la foto de una nota de papel, y en qué no cuadra con lo
 * anotado. Leer la foto es cosa de `lector-de-notas.ts`; aquí solo se
 * interpreta lo leído y se dicen los reparos. Ninguno decide por el dueño:
 * son avisos que él revisa, corrige o confirma.
 */

export type LineaLeida = {
  descripcion: string;
  /** El precio unitario que dice la nota, si se lee. */
  precio: number | null;
  /** El importe de la línea que dice la nota, si se lee. */
  importe: number | null;
};

export type NotaLeida = {
  /** Si la foto es una nota de entrega (la hoja del talonario) y no otra cosa. */
  esNota: boolean;
  /** La fecha que lleva, AAAA-MM-DD, si se lee. */
  fecha: string | null;
  lineas: LineaLeida[];
  /** El total que dice la nota, si se lee. */
  total: number | null;
  /** Si se ve la firma del cliente. Null si no se distingue. */
  firmada: boolean | null;
};

/** Con lo que se compara: la fecha de despacho y el total de lo anotado. */
export type VentaAnotada = { fecha: string; total: number };

/** La diferencia que se pasa por alto: un centavo de redondeo. */
const CENTAVO = 0.011;

/** Un número como lo devuelve el lector: número, o texto con coma o punto. Lo demás es null. */
function numeroLeido(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpio);
  return limpio !== "" && Number.isFinite(n) ? n : null;
}

function fechaLeida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const fecha = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(new Date(fecha + "T00:00:00Z").getTime()) ? null : fecha;
}

function booleanoLeido(valor: unknown): boolean | null {
  return typeof valor === "boolean" ? valor : null;
}

/**
 * Interpreta lo que contesta el lector: un JSON, a veces envuelto en
 * texto o en una valla de código. Lo que no encaje se deja en null; si ni
 * siquiera es un JSON con la forma esperada, null del todo.
 */
export function interpretarLectura(texto: string): NotaLeida | null {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    return null;
  }
  if (!crudo || typeof crudo !== "object") return null;
  const o = crudo as Record<string, unknown>;
  const esNota = booleanoLeido(o.es_nota ?? o.esNota);
  if (esNota === null) return null;
  const lineas: LineaLeida[] = Array.isArray(o.lineas)
    ? o.lineas
        .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
        .map((l) => ({
          descripcion: typeof l.descripcion === "string" ? l.descripcion.trim() : "",
          precio: numeroLeido(l.precio ?? l.precio_unitario),
          importe: numeroLeido(l.importe),
        }))
    : [];
  return { esNota, fecha: fechaLeida(o.fecha), lineas, total: numeroLeido(o.total), firmada: booleanoLeido(o.firmada) };
}

/**
 * En qué no cuadra la nota con lo anotado. Si no es una nota, solo eso: lo
 * demás no tiene sentido. Después, la fecha, la suma de la propia nota, el
 * total contra lo anotado y la firma.
 */
export function compararNota(nota: NotaLeida, venta: VentaAnotada): string[] {
  if (!nota.esNota) {
    return ["Esa foto no parece una nota de entrega: no se ve la hoja del talonario con la fecha, lo entregado y los importes."];
  }
  const avisos: string[] = [];

  if (nota.fecha === null) avisos.push("En la foto no se lee la fecha de la nota.");
  else if (nota.fecha !== venta.fecha) {
    avisos.push(`La nota dice ${fechaCorta(nota.fecha)} y la fecha de despacho anotada es ${fechaCorta(venta.fecha)}.`);
  }

  const importes = nota.lineas.map((l) => l.importe).filter((i): i is number => i !== null);
  const suma = importes.length > 0 ? redondear(importes.reduce((s, i) => s + i, 0)) : null;
  if (suma !== null && nota.total !== null && Math.abs(suma - nota.total) > CENTAVO) {
    avisos.push(`En la nota las líneas suman ${usd(suma)} y el total dice ${usd(nota.total)}: revisa la suma.`);
  }
  // Sin total escrito, lo que suman las líneas hace de total.
  const totalDeLaNota = nota.total ?? suma;
  if (totalDeLaNota !== null && Math.abs(totalDeLaNota - venta.total) > CENTAVO) {
    avisos.push(`La nota dice un total de ${usd(totalDeLaNota)} y lo anotado suma ${usd(venta.total)}.`);
  }

  if (nota.firmada === false) avisos.push("No se ve la firma del cliente en la nota.");
  return avisos;
}
