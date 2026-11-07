import type { TipoIva } from "./factura-calculo.ts";

/**
 * Las cuentas de la lista de precios del detal (la charcutería): de lo que
 * costó un producto en la factura del proveedor al precio que se le pone al
 * cliente, en dólares y en bolívares a la tasa del día. Cálculo puro, con
 * pruebas.
 *
 * - El costo de la factura viene en bolívares y sin IVA: si el producto es
 *   gravado («(G)» en la factura) se le suma el IVA; si es exento («(E)»), no.
 *   Se pasa a dólares con la tasa del día de la compra. El de la charcutería
 *   viene en dólares, como lo cobra el proveedor: no se le suma nada.
 * - Víveres y lo demás: el precio es ese costo más el margen (20 %).
 * - Charcutería: al detal, el costo entre 0,80 (un 25 % más, que cubre la
 *   merma, las bolsas y el papel); al mayor, el costo más un 10 %.
 * - Los dólares se suben al centavo: nunca se redondea en contra del negocio.
 * - En bolívares, el precio en dólares por la tasa de hoy, subido de 5 en 5:
 *   si da 723, se cobra 725.
 */

export const MARGEN_DETAL_POR_DEFECTO = 20;
export const REDONDEO_BS_POR_DEFECTO = 5;
/** La charcutería al detal: el costo entre 0,80. */
export const DIVISOR_CHARCUTERIA_POR_DEFECTO = 0.8;
/** La charcutería al mayor: el costo más un 10 %. */
export const MAYOR_CHARCUTERIA_POR_DEFECTO = 10;

/** Las categorías de la lista, en el orden en que salen. «Otros víveres» es donde cae lo que no se clasificó. */
export const CATEGORIAS_DETAL = {
  charcuteria: "Charcutería",
  harinas: "Harinas, arroz y granos",
  enlatados: "Enlatados y conservas",
  salsas: "Salsas, aliños y condimentos",
  despensa: "Azúcar, café y bebidas",
  pan: "Pan y tostadas",
  galletas: "Galletas, cereales y compotas",
  lacteos: "Margarinas, untables y aceites",
  viveres: "Otros víveres",
  limpieza: "Limpieza",
  cuidado: "Cuidado personal",
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
  /** Víveres y lo demás: lo que se le suma al costo para el precio al detal, en %. */
  margen_pct: number;
  /** Víveres y lo demás: el margen del precio al mayor; sin él no hay precio al mayor (salvo el escrito a mano). */
  margen_mayor_pct: number | null;
  /** La charcutería al detal: el costo entre este número (0,80). */
  charcuteria_divisor: number;
  /** La charcutería al mayor: lo que se le suma al costo, en % (10); null, sin precio al mayor. */
  charcuteria_mayor_pct: number | null;
  /** La alícuota del IVA de los productos gravados. */
  iva_pct: number;
  /** De cuántos en cuántos bolívares se sube el precio. */
  redondeo_bs: number;
};

/** Las claves de `ajustes` donde se guardan las reglas. */
export const CLAVES_REGLAS_DETAL = ["detal_margen_pct", "detal_margen_mayor_pct", "detal_charcuteria_divisor", "detal_charcuteria_mayor_pct", "detal_redondeo_bs"] as const;

/**
 * Las reglas desde lo guardado en `ajustes` (lo mismo para el panel y para
 * `npm run lista`). Lo que no está, o no es un número que tenga sentido,
 * vale lo de por defecto. El mayor de los víveres no está si no se puso; el
 * de la charcutería es un 10 % mientras no se guarde vacío.
 */
export function reglasDesdeAjustes(valor: (clave: string) => string | undefined, ivaPct: number): ReglasDelDetal {
  const numero = (clave: string): number | null => {
    const v = valor(clave);
    if (v === undefined || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const margen = numero("detal_margen_pct");
  const mayor = numero("detal_margen_mayor_pct");
  const divisor = numero("detal_charcuteria_divisor");
  const mayorCharcuteria = numero("detal_charcuteria_mayor_pct");
  const redondeo = numero("detal_redondeo_bs");
  return {
    margen_pct: margen !== null && margen >= 0 ? margen : MARGEN_DETAL_POR_DEFECTO,
    margen_mayor_pct: mayor !== null && mayor >= 0 ? mayor : null,
    charcuteria_divisor: divisor !== null && esDivisorValido(divisor) ? divisor : DIVISOR_CHARCUTERIA_POR_DEFECTO,
    charcuteria_mayor_pct:
      valor("detal_charcuteria_mayor_pct") === undefined ? MAYOR_CHARCUTERIA_POR_DEFECTO : mayorCharcuteria !== null && mayorCharcuteria >= 0 ? mayorCharcuteria : null,
    iva_pct: ivaPct,
    redondeo_bs: redondeo !== null && redondeo > 0 ? redondeo : REDONDEO_BS_POR_DEFECTO,
  };
}

/** Un divisor tiene sentido entre 0,5 (el doble del costo) y 1 (el costo pelado). */
export function esDivisorValido(divisor: number): boolean {
  return divisor >= 0.5 && divisor <= 1;
}

/** El divisor como lo escribe el dueño: «0,80», «0.8» o «80» (en %). null si no se entiende o no tiene sentido. */
export function leerDivisor(texto: string): number | null {
  const n = leerMonto(texto);
  if (n === null) return null;
  const divisor = n > 1 && n <= 100 ? n / 100 : n;
  return esDivisorValido(divisor) ? divisor : null;
}

/** Lo que hace falta de un producto para ponerle precio. */
export type ArticuloParaPrecio = {
  /** La charcutería tiene sus reglas; lo demás, las de los víveres. */
  categoria: string;
  costo_bs: number | null;
  /** El costo en dólares, como lo cobra el proveedor (la charcutería): manda sobre el de bolívares. */
  costo_usd: number | null;
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

/** El costo de una unidad con su IVA (en la moneda en que venga). */
export function costoConIva(costo: number, iva: TipoIva, ivaPct: number): number {
  return iva === "exento" ? costo : costo * (1 + ivaPct / 100);
}

/**
 * Lo que costó una unidad en dólares, con el IVA si es gravado: el costo en
 * dólares si lo tiene, o el de bolívares a la tasa del día de la compra;
 * null si falta el costo o la tasa.
 */
export function costoEnDolares(a: Pick<ArticuloParaPrecio, "costo_bs" | "costo_usd" | "iva" | "tasa_compra">, ivaPct: number): number | null {
  if (a.costo_usd !== null && a.costo_usd > 0) return costoConIva(a.costo_usd, a.iva, ivaPct);
  if (a.costo_bs === null || !(a.costo_bs > 0) || a.tasa_compra === null || !(a.tasa_compra > 0)) return null;
  return costoConIva(a.costo_bs, a.iva, ivaPct) / a.tasa_compra;
}

/** Cómo sale el precio al detal de un producto: escrito a mano, el costo más un %, o el costo entre un número (la charcutería). */
export type ReglaDelPrecio = { forma: "a_mano" } | { forma: "margen"; pct: number; propio: boolean } | { forma: "entre"; divisor: number };

export function reglaDelDetal(a: Pick<ArticuloParaPrecio, "categoria" | "margen_pct" | "precio_usd">, reglas: ReglasDelDetal): ReglaDelPrecio {
  if (a.precio_usd !== null && a.precio_usd > 0) return { forma: "a_mano" };
  if (a.margen_pct !== null) return { forma: "margen", pct: a.margen_pct, propio: true };
  if (a.categoria === "charcuteria") return { forma: "entre", divisor: reglas.charcuteria_divisor };
  return { forma: "margen", pct: reglas.margen_pct, propio: false };
}

/**
 * El precio al detal en dólares: el escrito a mano; o, del costo, con el
 * margen propio del producto, el costo entre 0,80 en la charcutería o el
 * costo más el margen en lo demás. Subido al centavo.
 */
export function precioDetalUsd(a: ArticuloParaPrecio, reglas: ReglasDelDetal): number | null {
  const regla = reglaDelDetal(a, reglas);
  if (regla.forma === "a_mano") return a.precio_usd;
  const costo = costoEnDolares(a, reglas.iva_pct);
  if (costo === null) return null;
  return subirA(regla.forma === "entre" ? costo / regla.divisor : costo * (1 + regla.pct / 100), 0.01);
}

/** Lo que se le suma al costo para el precio al mayor: el de la charcutería (10 %) o el de lo demás; null si no hay. */
export function margenDelMayor(categoria: string, reglas: ReglasDelDetal): number | null {
  return categoria === "charcuteria" ? reglas.charcuteria_mayor_pct : reglas.margen_mayor_pct;
}

/** El precio al mayor en dólares: el escrito a mano, o el costo más el margen del mayor si lo hay, subido al centavo. */
export function precioMayorUsd(a: ArticuloParaPrecio, reglas: ReglasDelDetal): number | null {
  if (a.precio_mayor_usd !== null && a.precio_mayor_usd > 0) return a.precio_mayor_usd;
  const margen = margenDelMayor(a.categoria, reglas);
  if (margen === null) return null;
  const costo = costoEnDolares(a, reglas.iva_pct);
  if (costo === null) return null;
  return subirA(costo * (1 + margen / 100), 0.01);
}

/** Un precio en dólares pasado a bolívares con la tasa de hoy y subido de `paso` en `paso`; null sin precio o sin tasa. */
export function enBolivares(usd: number | null, tasa: number | null, paso: number): number | null {
  if (usd === null || tasa === null || !(tasa > 0)) return null;
  return subirA(usd * tasa, paso);
}

// ---------- Una compra nueva o vieja de un producto que ya está ----------

/** A partir de qué cambio del costo (en %) se avisa. */
export const CAMBIO_GRANDE_PCT = 10;

/** Las fechas de las dos últimas compras guardadas de un producto. */
export type ComprasGuardadas = { fecha_compra: string | null; fecha_compra_anterior: string | null };

/**
 * Qué hace la compra de un día con un producto que ya está en la lista. La
 * lista se queda con el costo de la compra más nueva y guarda el de la
 * anterior, para decir cuánto cambió; así una factura vieja cargada tarde
 * no pisa el costo de una más nueva.
 * - «actual»: es la más nueva; la que había pasa a ser la anterior.
 * - «mismo_dia»: es del mismo día que la que había; se corrige el costo.
 * - «anterior»: es más vieja que la última pero más nueva que la anterior guardada; queda de referencia.
 * - «nada»: es más vieja que las dos guardadas.
 */
export function decidirCarga(guardadas: ComprasGuardadas, fecha: string): "actual" | "mismo_dia" | "anterior" | "nada" {
  if (guardadas.fecha_compra === null || fecha > guardadas.fecha_compra) return "actual";
  if (fecha === guardadas.fecha_compra) return "mismo_dia";
  if (guardadas.fecha_compra_anterior === null || fecha >= guardadas.fecha_compra_anterior) return "anterior";
  return "nada";
}

/** Cuánto cambió el costo, en %, con un decimal; null si falta alguno. */
export function variacionPct(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || !(anterior > 0)) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
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

// ---------- Leer una lista de costos en dólares (la charcutería) ----------

export type LineaDeCostos = { nombre: string; costo_usd: number; unidad: UnidadDetal | null; iva: TipoIva };

// El costo al final de la línea: «5,20», «$5.20», «5,20 $», «6 $/kg», «3,10 c/u», «7,30 el kilo».
const COSTO_AL_FINAL =
  /(?<=^|[\s:=–—-])(?:\$|us\$|usd)?\s*(\d+(?:[.,]\d+)?)\s*(?:\$|usd|d[oó]lares)?\s*(?:(?:el|por|x|la|cada|\/)?\s*(kilo|kg|unidad|und|unid|u)\b\.?|(c\/u))?\s*$/i;

/**
 * Lee una lista de costos en dólares, una línea por producto: el nombre y lo
 * que cobra el proveedor, al final («Jamón de espalda 5,20», «Queso amarillo
 * $6,80 el kilo», «Salchichas 1 kg 3,10 c/u»). Ese costo es lo que se paga:
 * no se le suma IVA, salvo que la línea diga (G). «el kilo» o «c/u» dicen
 * cómo se vende; sin decirlo, como diga el formulario. Lo que no entiende
 * lo devuelve aparte, sin adivinar.
 */
export function leerLineasDeCostos(texto: string): { lineas: LineaDeCostos[]; sinEntender: string[] } {
  const lineas: LineaDeCostos[] = [];
  const sinEntender: string[] = [];
  for (const original of texto.split(/\r?\n/)) {
    let resto = original.replace(/\s+/g, " ").trim();
    if (!resto) continue;
    let iva: TipoIva = "exento";
    const marca = resto.match(IVA_ENTRE_PARENTESIS);
    if (marca) {
      iva = marca[1] === "G" ? "general" : "exento";
      resto = (resto.slice(0, marca.index) + resto.slice((marca.index ?? 0) + marca[0].length)).replace(/\s+/g, " ").trim();
    }
    const costo = resto.match(COSTO_AL_FINAL);
    const monto = costo ? leerMonto(costo[1]) : null;
    const nombre = costo ? resto.slice(0, costo.index).replace(/[\s:=–—$-]+$/, "").trim() : "";
    if (!costo || monto === null || !(monto > 0) || monto >= 10000 || !/[a-záéíóúñ]/i.test(nombre)) {
      sinEntender.push(original.trim());
      continue;
    }
    const unidad = costo[3] ? "unidad" : costo[2] ? (/^k/i.test(costo[2]) ? "kg" : "unidad") : null;
    lineas.push({ nombre, costo_usd: monto, unidad, iva });
  }
  return { lineas, sinEntender };
}
