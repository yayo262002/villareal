import { METODOS_PAGO, bs, fechaCorta, redondear, usd } from "./dinero.ts";
import { fechaLeida, numeroLeido, objetoLeido } from "./nota-leida.ts";

/**
 * Lo que se lee en la captura de un pago (pago móvil, transferencia,
 * Zelle) y lo que se hace con ello: rellenar el abono si el dueño dejó el
 * monto vacío, o avisar si lo que escribió no cuadra con la captura. Leer
 * la imagen es cosa de `lector-de-notas.ts`; aquí no hay nada que decida
 * por el dueño: él revisa y guarda.
 */

export type MetodoLeido = "pago_movil" | "transferencia" | "zelle" | "binance" | "otro";

export type CapturaLeida = {
  /** Si la imagen es el comprobante de un pago y no otra cosa. */
  esComprobante: boolean;
  metodo: MetodoLeido | null;
  moneda: "VES" | "USD" | null;
  monto: number | null;
  /** AAAA-MM-DD, si se lee. */
  fecha: string | null;
  /** El número de referencia u operación, como texto. */
  referencia: string | null;
  banco: string | null;
};

const METODOS_LEIDOS: readonly MetodoLeido[] = ["pago_movil", "transferencia", "zelle", "binance", "otro"];

function booleano(valor: unknown): boolean | null {
  return typeof valor === "boolean" ? valor : null;
}

/** Interpreta lo que contesta el lector. Lo que no encaje queda en null; sin `es_comprobante`, null del todo. */
export function interpretarCaptura(texto: string): CapturaLeida | null {
  const o = objetoLeido(texto);
  if (!o) return null;
  const esComprobante = booleano(o.es_comprobante ?? o.esComprobante);
  if (esComprobante === null) return null;
  const metodoCrudo = String(o.metodo ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const monedaCruda = String(o.moneda ?? "").trim().toUpperCase();
  const referencia = typeof o.referencia === "string" || typeof o.referencia === "number" ? String(o.referencia).trim() : "";
  const banco = typeof o.banco === "string" ? o.banco.trim() : "";
  return {
    esComprobante,
    metodo: METODOS_LEIDOS.find((m) => m === metodoCrudo) ?? null,
    moneda: monedaCruda === "VES" || monedaCruda === "BS" ? "VES" : monedaCruda === "USD" ? "USD" : null,
    monto: numeroLeido(o.monto),
    fecha: fechaLeida(o.fecha),
    referencia: referencia || null,
    banco: banco || null,
  };
}

/** Lo que el formulario del abono debería llevar según la captura, a la tasa de hoy. */
export type PropuestaDeAbono = {
  metodo: MetodoLeido;
  moneda: "VES" | "USD";
  monto: number;
  fecha: string;
  referencia: string;
  /** La tasa con la que se pasa a dólares, solo en bolívares. */
  tasa: number | null;
  /** El equivalente en dólares, o null si está en bolívares y no hay tasa. */
  monto_usd: number | null;
};

/**
 * Rellena el abono con la captura: el método y la moneda se cuadran entre
 * sí (un pago móvil es en bolívares), la fecha es la de la captura si no es
 * de mañana, y el monto en bolívares se pasa a dólares con la tasa de hoy.
 * Sin monto no hay propuesta.
 */
export function propuestaDesdeCaptura(captura: CapturaLeida, tasa: number | null, hoy: string): PropuestaDeAbono | null {
  if (!captura.esComprobante || captura.monto === null || !(captura.monto > 0)) return null;
  const moneda = captura.moneda ?? (captura.metodo === "zelle" || captura.metodo === "binance" ? "USD" : "VES");
  let metodo: MetodoLeido = captura.metodo ?? (moneda === "USD" ? "otro" : "pago_movil");
  if (moneda === "VES" && (metodo === "zelle" || metodo === "binance" || metodo === "otro")) metodo = "transferencia";
  if (moneda === "USD" && (metodo === "pago_movil" || metodo === "transferencia")) metodo = "otro";
  const monto = redondear(captura.monto);
  const conTasa = tasa !== null && tasa > 0 ? tasa : null;
  return {
    metodo,
    moneda,
    monto,
    fecha: captura.fecha && captura.fecha <= hoy ? captura.fecha : hoy,
    referencia: captura.referencia ?? "",
    tasa: moneda === "VES" ? conTasa : null,
    monto_usd: moneda === "USD" ? monto : conTasa ? redondear(monto / conTasa) : null,
  };
}

const NOMBRE_DEL_METODO: Record<MetodoLeido, string> = {
  pago_movil: "pago móvil",
  transferencia: "transferencia",
  zelle: "Zelle",
  binance: "Binance",
  otro: "otro método",
};

/** «Leí la captura: Bs 3.650,00 por pago móvil del 21/09/2026, ref. 004512 (Banesco). A la tasa de hoy (Bs 36,50 por dólar) son USD 100,00.» */
export function describirCaptura(captura: CapturaLeida, propuesta: PropuestaDeAbono): string {
  const monto = propuesta.moneda === "VES" ? bs(propuesta.monto) : usd(propuesta.monto);
  let texto = `Leí la captura: ${monto} por ${NOMBRE_DEL_METODO[propuesta.metodo]} del ${fechaCorta(propuesta.fecha)}`;
  if (propuesta.referencia) texto += `, ref. ${propuesta.referencia}`;
  if (captura.banco) texto += ` (${captura.banco})`;
  texto += ".";
  if (propuesta.moneda === "VES") {
    texto +=
      propuesta.monto_usd !== null && propuesta.tasa
        ? ` A la tasa de hoy (${bs(propuesta.tasa)} por dólar) son ${usd(propuesta.monto_usd)}.`
        : " Falta la tasa del día para pasarlo a dólares.";
  }
  return texto;
}

/** En qué no cuadra la captura con lo que se escribió. Si no es un comprobante, solo eso. */
export function compararCaptura(
  captura: CapturaLeida,
  abono: { monto: number; moneda: "VES" | "USD"; fecha: string; metodo?: keyof typeof METODOS_PAGO },
): string[] {
  if (!captura.esComprobante) return ["Esa foto no parece el comprobante de un pago (la captura del pago móvil o de la transferencia)."];
  const avisos: string[] = [];
  // El método: un pago móvil no es una transferencia, ni un Zelle un Binance. «Otro» no dice nada.
  if (captura.metodo && captura.metodo !== "otro" && abono.metodo && abono.metodo !== "otro" && captura.metodo !== abono.metodo) {
    avisos.push(`La captura parece un pago por ${NOMBRE_DEL_METODO[captura.metodo]} y elegiste ${METODOS_PAGO[abono.metodo]}.`);
  }
  if (captura.moneda && captura.moneda !== abono.moneda) {
    avisos.push(
      captura.moneda === "VES"
        ? "La captura está en bolívares y el método elegido es en dólares."
        : "La captura está en dólares y el método elegido es en bolívares.",
    );
  } else if (captura.monto !== null && Math.abs(captura.monto - abono.monto) > 0.011) {
    const cifra = abono.moneda === "VES" ? bs : usd;
    avisos.push(`La captura dice ${cifra(captura.monto)} y escribiste ${cifra(abono.monto)}.`);
  }
  if (captura.fecha && captura.fecha !== abono.fecha) {
    avisos.push(`La captura es del ${fechaCorta(captura.fecha)} y la fecha anotada es ${fechaCorta(abono.fecha)}.`);
  }
  return avisos;
}
