import { cantidad as cantidadLegible, fechaCorta, redondear, usd } from "./dinero.ts";

/**
 * Lo que se lee en la foto de una nota de papel, y en qué no cuadra con lo
 * anotado en el pedido: línea a línea (producto, kilos, precio, importe),
 * la fecha, la suma y la firma. Leer la foto es cosa de `lector-de-notas.ts`;
 * aquí solo se interpreta lo leído y se dicen los reparos. Ninguno decide
 * por el dueño: son avisos que él revisa, corrige o confirma. Si todo
 * cuadra, no hay avisos y la venta se guarda sin más.
 */

export type LineaLeida = {
  descripcion: string;
  /** Qué producto del catálogo es, según el lector: la clave de su fila de venta («2», «1-3»), o null si no encaja con ninguno. */
  clave: string | null;
  /** Las piezas que dice la nota, si las dice. */
  piezas: number | null;
  /** Los kilos (o cartones, unidades) por los que se cobra, si se leen. */
  cantidad: number | null;
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

/** Una línea de lo anotado en el pedido, para cotejarla con la nota. */
export type LineaAnotada = {
  /** La clave de su fila de venta: «2», «1-3». */
  clave: string;
  /** «Queso amarillo Kemmental». */
  nombre: string;
  unidad: string;
  piezas?: number | null;
  cantidad: number;
  precio: number;
  importe: number;
};

/** Con lo que se compara: la fecha de despacho, el total y, si se dan, las líneas de lo anotado. */
export type VentaAnotada = { fecha: string; total: number; lineas?: LineaAnotada[] };

/** La diferencia que se pasa por alto: un centavo de redondeo. */
const CENTAVO = 0.011;
/** En las cantidades, un gramo. */
const GRAMO = 0.0011;

/** Un número como lo devuelve el lector: número, o texto con coma o punto. Lo demás es null. */
export function numeroLeido(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpio);
  return limpio !== "" && Number.isFinite(n) ? n : null;
}

export function fechaLeida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const fecha = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(new Date(fecha + "T00:00:00Z").getTime()) ? null : fecha;
}

function booleanoLeido(valor: unknown): boolean | null {
  return typeof valor === "boolean" ? valor : null;
}

function claveLeida(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const clave = String(valor).trim();
  return /^\d+(-\d+)?$/.test(clave) ? clave : null;
}

/** El JSON que viene en la respuesta del lector, aunque venga envuelto en texto; null si no hay uno. */
export function objetoLeido(texto: string): Record<string, unknown> | null {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    return null;
  }
  return crudo && typeof crudo === "object" ? (crudo as Record<string, unknown>) : null;
}

/**
 * Interpreta lo que contesta el lector: un JSON, a veces envuelto en
 * texto o en una valla de código. Lo que no encaje se deja en null; si ni
 * siquiera es un JSON con la forma esperada, null del todo.
 */
export function interpretarLectura(texto: string): NotaLeida | null {
  const o = objetoLeido(texto);
  if (!o) return null;
  const esNota = booleanoLeido(o.es_nota ?? o.esNota);
  if (esNota === null) return null;
  const lineas: LineaLeida[] = Array.isArray(o.lineas)
    ? o.lineas
        .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
        .map((l) => ({
          descripcion: typeof l.descripcion === "string" ? l.descripcion.trim() : "",
          clave: claveLeida(l.clave),
          piezas: numeroLeido(l.piezas),
          cantidad: numeroLeido(l.cantidad ?? l.kilos),
          precio: numeroLeido(l.precio ?? l.precio_unitario),
          importe: numeroLeido(l.importe),
        }))
    : [];
  return { esNota, fecha: fechaLeida(o.fecha), lineas, total: numeroLeido(o.total), firmada: booleanoLeido(o.firmada) };
}

/** Sin tildes, en minúsculas y sin letras repetidas: «Mozzarella» y «mozarela» quedan iguales. */
function simplificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(.)\1+/g, "$1");
}

const PALABRAS_GENERICAS = new Set(["queso", "quesos"]);

/**
 * Si lo que dice la nota nombra el producto: alguna palabra distintiva del
 * nombre («mozzarella», «amarillo», «huevos», «sortilegio») aparece en la
 * descripción, aunque esté mal escrita o recortada.
 */
export function nombraElProducto(nombre: string, descripcion: string): boolean {
  const dicho = simplificar(descripcion);
  return simplificar(nombre)
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length >= 4 && !PALABRAS_GENERICAS.has(palabra))
    .some((palabra) => dicho.includes(palabra.slice(0, 4)));
}

/**
 * Cada línea anotada contra la de la nota: primero por la clave que dio el
 * lector, si no por el nombre. Lo que falte, sobre o no coincida se dice.
 */
function compararLineas(nota: NotaLeida, anotadas: LineaAnotada[]): string[] {
  const avisos: string[] = [];
  const usadas = new Set<number>();
  const tomar = (cumple: (l: LineaLeida) => boolean): LineaLeida | null => {
    const i = nota.lineas.findIndex((l, i) => !usadas.has(i) && cumple(l));
    if (i < 0) return null;
    usadas.add(i);
    return nota.lineas[i];
  };

  for (const a of anotadas) {
    const l = tomar((l) => l.clave === a.clave) ?? tomar((l) => l.clave === null && nombraElProducto(a.nombre, l.descripcion));
    if (!l) {
      avisos.push(`Anotaste ${cantidadLegible(a.cantidad, a.unidad)} de ${a.nombre} y en la nota no aparece.`);
      continue;
    }
    if (l.piezas !== null && a.piezas != null && l.piezas !== a.piezas) {
      avisos.push(`En la nota ${a.nombre} son ${l.piezas} piezas y anotaste ${a.piezas}.`);
    }
    if (l.cantidad !== null && Math.abs(l.cantidad - a.cantidad) > GRAMO) {
      avisos.push(`En la nota ${a.nombre} son ${cantidadLegible(l.cantidad, a.unidad)} y anotaste ${cantidadLegible(a.cantidad, a.unidad)}.`);
    }
    if (l.precio !== null && Math.abs(l.precio - a.precio) > CENTAVO) {
      avisos.push(`En la nota ${a.nombre} va a ${usd(l.precio)} y anotaste ${usd(a.precio)}.`);
    }
    if (l.importe !== null && Math.abs(l.importe - a.importe) > CENTAVO) {
      avisos.push(`En la nota ${a.nombre} importa ${usd(l.importe)} y lo anotado da ${usd(a.importe)}.`);
    }
  }

  nota.lineas.forEach((l, i) => {
    if (usadas.has(i)) return;
    const que = l.descripcion || "una línea sin descripción";
    avisos.push(`En la nota hay «${que}»${l.importe !== null ? ` por ${usd(l.importe)}` : ""} que no anotaste.`);
  });
  return avisos;
}

/**
 * En qué no cuadra la nota con lo anotado. Si no es una nota, solo eso: lo
 * demás no tiene sentido. Después, la fecha, las líneas (si se dan), la
 * suma de la propia nota, el total contra lo anotado y la firma. Sin
 * reparos, la nota cuadra y se acepta.
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

  // Línea a línea, cuando se sabe qué se anotó y la nota tiene líneas que leer.
  const deLineas = venta.lineas && nota.lineas.length > 0 ? compararLineas(nota, venta.lineas) : [];
  avisos.push(...deLineas);

  const importes = nota.lineas.map((l) => l.importe).filter((i): i is number => i !== null);
  const suma = importes.length > 0 ? redondear(importes.reduce((s, i) => s + i, 0)) : null;
  if (suma !== null && nota.total !== null && Math.abs(suma - nota.total) > CENTAVO) {
    avisos.push(`En la nota las líneas suman ${usd(suma)} y el total dice ${usd(nota.total)}: revisa la suma.`);
  }
  // Sin total escrito, lo que suman las líneas hace de total. Si ya se dijo qué línea no cuadra, el total no se repite.
  const totalDeLaNota = nota.total ?? suma;
  if (deLineas.length === 0 && totalDeLaNota !== null && Math.abs(totalDeLaNota - venta.total) > CENTAVO) {
    avisos.push(`La nota dice un total de ${usd(totalDeLaNota)} y lo anotado suma ${usd(venta.total)}.`);
  }

  if (nota.firmada === false) avisos.push("No se ve la firma del cliente en la nota.");
  return avisos;
}
