import type { TipoIva } from "./factura-calculo.ts";

/**
 * Las cuentas de la lista de precios del detal (la charcutería): de lo que
 * costó un producto en la factura del proveedor al precio que se le pone al
 * cliente, en dólares y en bolívares a la tasa del día. Cálculo puro, con
 * pruebas.
 *
 * - El costo de la factura viene en bolívares y sin IVA: si el producto es
 *   gravado («(G)» en la factura) se le suma el IVA; si es exento («(E)»), no.
 * - Se pasa a dólares con la tasa del día de la compra.
 * - El precio es ese costo más el margen (20 % en los víveres), subido al
 *   centavo: nunca se redondea en contra del negocio.
 * - En bolívares, el precio en dólares por la tasa de hoy, subido de 5 en 5:
 *   si da 723, se cobra 725.
 */

export const MARGEN_DETAL_POR_DEFECTO = 20;
export const REDONDEO_BS_POR_DEFECTO = 5;

export const CATEGORIAS_DETAL = {
  viveres: "Víveres",
  limpieza: "Limpieza y cuidado personal",
  charcuteria: "Charcutería",
} as const;
export type CategoriaDetal = keyof typeof CATEGORIAS_DETAL;

export function esCategoriaDetal(valor: string): valor is CategoriaDetal {
  return valor in CATEGORIAS_DETAL;
}

export const UNIDADES_DETAL = { unidad: "unidad", kg: "kg" } as const;
export type UnidadDetal = keyof typeof UNIDADES_DETAL;

export function esUnidadDetal(valor: string): valor is UnidadDetal {
  return valor in UNIDADES_DETAL;
}

export type ReglasDelDetal = {
  /** Lo que se le suma al costo para el precio al detal, en %. */
  margen_pct: number;
  /** El margen del precio al mayor; sin él no hay precio al mayor (salvo el escrito a mano). */
  margen_mayor_pct: number | null;
  /** La alícuota del IVA de los productos gravados. */
  iva_pct: number;
  /** De cuántos en cuántos bolívares se sube el precio. */
  redondeo_bs: number;
};

/** Lo que hace falta de un producto para ponerle precio. */
export type ArticuloParaPrecio = {
  costo_bs: number | null;
  iva: TipoIva;
  tasa_compra: number | null;
  /** El margen de este producto; sin él, el de las reglas. */
  margen_pct: number | null;
  /** Un precio al detal escrito a mano en dólares: manda sobre el costo. */
  precio_usd: number | null;
  /** Un precio al mayor escrito a mano en dólares. */
  precio_mayor_usd: number | null;
};

/** Sube `n` al múltiplo de `paso` que le sigue (o lo deja si ya lo es), sin que el ruido de los decimales sume un paso de más. */
export function subirA(n: number, paso: number): number {
  const veces = Math.ceil(Math.round((n / paso) * 1e6) / 1e6);
  return Math.round(veces * paso * 100) / 100;
}

/** El costo de una unidad con su IVA, en bolívares. */
export function costoConIva(costoBs: number, iva: TipoIva, ivaPct: number): number {
  return iva === "exento" ? costoBs : costoBs * (1 + ivaPct / 100);
}

/** Lo que costó una unidad en dólares, con el IVA, a la tasa del día de la compra; null si falta el costo o la tasa. */
export function costoEnDolares(a: Pick<ArticuloParaPrecio, "costo_bs" | "iva" | "tasa_compra">, ivaPct: number): number | null {
  if (a.costo_bs === null || !(a.costo_bs > 0) || a.tasa_compra === null || !(a.tasa_compra > 0)) return null;
  return costoConIva(a.costo_bs, a.iva, ivaPct) / a.tasa_compra;
}

/** El precio al detal en dólares: el escrito a mano o el costo más el margen, subido al centavo. */
export function precioDetalUsd(a: ArticuloParaPrecio, reglas: ReglasDelDetal): number | null {
  if (a.precio_usd !== null && a.precio_usd > 0) return a.precio_usd;
  const costo = costoEnDolares(a, reglas.iva_pct);
  if (costo === null) return null;
  return subirA(costo * (1 + (a.margen_pct ?? reglas.margen_pct) / 100), 0.01);
}

/** El precio al mayor en dólares: el escrito a mano, o el costo más el margen del mayor si está puesto. */
export function precioMayorUsd(a: ArticuloParaPrecio, reglas: ReglasDelDetal): number | null {
  if (a.precio_mayor_usd !== null && a.precio_mayor_usd > 0) return a.precio_mayor_usd;
  if (reglas.margen_mayor_pct === null) return null;
  const costo = costoEnDolares(a, reglas.iva_pct);
  if (costo === null) return null;
  return subirA(costo * (1 + reglas.margen_mayor_pct / 100), 0.01);
}

/** Un precio en dólares pasado a bolívares con la tasa de hoy y subido de `paso` en `paso`; null sin precio o sin tasa. */
export function enBolivares(usd: number | null, tasa: number | null, paso: number): number | null {
  if (usd === null || tasa === null || !(tasa > 0)) return null;
  return subirA(usd * tasa, paso);
}

// ---------- Leer las líneas de una factura ----------

export type LineaDeFactura = { cantidad: number; costo_bs: number; nombre: string; iva: TipoIva };

/**
 * Un monto como se escribe aquí: «1.378,88», «447,59», «12.519,00» o con
 * punto decimal, «447.59». Un punto seguido de tres cifras sin coma es de
 * miles («1.450» son mil cuatrocientos cincuenta).
 */
export function leerMonto(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  let limpio: string;
  if (t.includes(",")) limpio = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) limpio = t.replace(/\./g, "");
  else limpio = t;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

const CANTIDAD_Y_PRECIO = /^(\d+)\s*[x×]\s*(?:bs\.?\s*)?(\d[\d.,]*)/i;
const TOTAL_AL_FINAL = /\s+(?:bs\.?\s*)?(\d[\d.,]*\d)\s*$/i;
const IVA_ENTRE_PARENTESIS = /\(\s*(E|G)\s*\)/;
const IVA_AL_FINAL = /\s(E|G)$/;

/**
 * Lee las líneas de una factura de compra, una por producto: «12 x 447,59
 * Jugo Natulac Pera 200 ml (G)». Sirve también como sale en el papel, con
 * la cantidad y el precio en su propia línea encima del nombre, y el
 * importe al final («Galleta Soda 250gr (G) Bs 1.112,07», que sin cantidad
 * es una sola unidad). Cada producto tiene que decir si es exento (E) o
 * gravado (G). Lo que no entiende lo devuelve aparte, sin adivinar.
 */
export function leerLineasDeFactura(texto: string): { lineas: LineaDeFactura[]; sinEntender: string[] } {
  const lineas: LineaDeFactura[] = [];
  const sinEntender: string[] = [];
  let pendiente: { cantidad: number; costo_bs: number; texto: string } | null = null;

  for (const original of texto.split(/\r?\n/)) {
    let resto = original.replace(/\s+/g, " ").trim();
    if (!resto) continue;

    let cantidad: number | null = null;
    let precio: number | null = null;
    const delante = resto.match(CANTIDAD_Y_PRECIO);
    if (delante) {
      cantidad = Number(delante[1]);
      precio = leerMonto(delante[2]);
      resto = resto.slice(delante[0].length).trim();
      if (!resto) {
        // La cantidad y el precio solos: el nombre viene en la línea siguiente.
        if (pendiente) sinEntender.push(pendiente.texto);
        pendiente = precio !== null && cantidad > 0 ? { cantidad, costo_bs: precio, texto: original.trim() } : null;
        if (!pendiente) sinEntender.push(original.trim());
        continue;
      }
    }

    let total: number | null = null;
    const alFinal = resto.match(TOTAL_AL_FINAL);
    if (alFinal && /[a-záéíóúñ)]/i.test(resto.slice(0, alFinal.index))) {
      const monto = leerMonto(alFinal[1]);
      // «Aceite 800 ml» no es un importe: solo cuenta lo que lleva decimales o va después de la marca de IVA.
      if (monto !== null && (/[.,]\d{2}$/.test(alFinal[1]) || IVA_ENTRE_PARENTESIS.test(resto.slice(0, alFinal.index)))) {
        total = monto;
        resto = resto.slice(0, alFinal.index).trim();
      }
    }

    let iva: TipoIva | null = null;
    const marca = resto.match(IVA_ENTRE_PARENTESIS) ?? resto.match(IVA_AL_FINAL);
    if (marca) {
      iva = marca[1] === "E" ? "exento" : "general";
      resto = (resto.slice(0, marca.index) + resto.slice((marca.index ?? 0) + marca[0].length)).replace(/\s+/g, " ").trim();
    }

    if (cantidad === null && pendiente) {
      cantidad = pendiente.cantidad;
      precio = pendiente.costo_bs;
      pendiente = null;
    } else if (pendiente) {
      sinEntender.push(pendiente.texto);
      pendiente = null;
    }
    if (cantidad === null && total !== null) {
      cantidad = 1;
      precio = total;
    }

    const nombre = resto.replace(/^[-–·:\s]+|[-–·:\s]+$/g, "");
    if (cantidad === null || !(cantidad > 0) || precio === null || !(precio > 0) || iva === null || !/[a-záéíóúñ]/i.test(nombre)) {
      sinEntender.push(original.trim());
      continue;
    }
    lineas.push({ cantidad, costo_bs: precio, nombre, iva });
  }
  if (pendiente) sinEntender.push(pendiente.texto);
  return { lineas, sinEntender };
}
