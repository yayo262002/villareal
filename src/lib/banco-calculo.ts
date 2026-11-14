import { normalizar } from "./buscar.ts";
import { telefonoLegible, numeroWhatsapp } from "./whatsapp.ts";

/**
 * El pago móvil que entra al banco, leído del aviso del BDV. El teléfono del
 * negocio que tiene el BDVapp reenvía cada notificación (o cada SMS) a la web
 * (`/api/banco`), y aquí se lee qué dice: cuánto entró, de qué teléfono o de
 * quién, la referencia y cuándo. Lo que no es un pago recibido (un pago que
 * hizo el negocio, una clave, una promoción) no se lee ni se guarda. Las
 * reglas para saber de quién es cada pago también están aquí. Cálculo puro,
 * con pruebas.
 *
 * Los avisos del BDV que se conocen:
 * - «Recibiste un PagomovilBDV por Bs.57.158,84 del 0424-5550199 Ref: 012345678094 en fecha 14-11-26 hora: 08:30.»
 * - «Recibiste un PagomovilBDV de PEDRO ANTONIO GOMEZ RIVAS por Bs.2.500,00 bajo el numero de operacion 008000123554»
 */

export type MetodoDelBanco = "pago_movil" | "transferencia";

export type MovimientoLeido = {
  banco: "BDV";
  metodo: MetodoDelBanco;
  monto_bs: number;
  /** «0424-5550199», o vacío si el aviso no lo dice. */
  telefono: string;
  /** El nombre de quien pagó, como lo escribe el banco, o vacío. */
  titular: string;
  /** Solo cifras, o vacío. */
  referencia: string;
  /** AAAA-MM-DD, o null si el aviso no trae la fecha (entonces vale la de cuando llegó). */
  fecha: string | null;
  /** «08:30», o null. */
  hora: string | null;
};

export type LecturaDelBanco = { leido: true; movimiento: MovimientoLeido } | { leido: false; motivo: string };

/**
 * Un monto escrito por el banco: «57.158,84», «2.500,00», «2500,00», y por si
 * acaso «2,500.00» o «2500.00». Devuelve null si no es un monto.
 */
export function leerMontoBs(escrito: string): number | null {
  const s = escrito.trim().replace(/[.,]$/, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  let numero: string;
  if (coma > punto) {
    // La coma decimal de aquí: «57.158,84».
    numero = s.replace(/\./g, "").replace(",", ".");
  } else if (punto > coma && /\.\d{1,2}$/.test(s) && (coma >= 0 || (s.match(/\./g) ?? []).length === 1)) {
    // El punto decimal: «2,500.00» o «2500.00». «2.500» (sin decimales) son dos mil quinientos.
    numero = s.replace(/,/g, "");
  } else {
    numero = s.replace(/[.,]/g, "");
  }
  const valor = Number(numero);
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
}

/** «14-11-26» o «14/11/2026» → «2026-11-14». Null si no es una fecha que exista. */
function leerFecha(dia: string, mes: string, anio: string): string | null {
  const a = anio.length === 2 ? 2000 + Number(anio) : Number(anio);
  const m = Number(mes);
  const d = Number(dia);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Lee el aviso del banco. Solo vale un pago recibido, con su monto. */
export function leerAvisoDelBanco(texto: string): LecturaDelBanco {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const n = normalizar(limpio);
  if (!limpio) return { leido: false, motivo: "Llegó vacío." };
  if (!/recibi(ste|do|da)|te (enviaron|transfirieron|pagaron)/.test(n)) {
    return { leido: false, motivo: "No es un pago recibido (o no se entiende)." };
  }
  // Lo que dice el propio aviso («Recibiste una transferencia…»), antes que lo que se vea detrás en la captura: el
  // título del aviso siguiente («PagomóvilBDV recibido») hacía pasar una transferencia por pago móvil.
  const delAviso = n.match(/recibi(?:ste|do|da)\s+(?:un|una)?\s*(pago\s*movil|transferencia)/)?.[1];
  const metodo: MetodoDelBanco | null = delAviso
    ? delAviso.startsWith("transf")
      ? "transferencia"
      : "pago_movil"
    : /pago\s*movil/.test(n)
      ? "pago_movil"
      : /transferencia/.test(n)
        ? "transferencia"
        : null;
  if (!metodo) return { leido: false, motivo: "No dice que sea un pago móvil ni una transferencia." };

  const conMonto = limpio.match(/Bs\.?\s*S?\.?\s*(\d[\d.,]*\d)/i);
  const monto = conMonto ? leerMontoBs(conMonto[1]) : null;
  if (!monto) return { leido: false, motivo: "No se encuentra el monto en bolívares." };

  // El teléfono de quien pagó: «del 0424-5550199» (o «del 04245550199», «del 58424…»).
  const conTelefono = limpio.match(/\bdel?\s*(?:tel[eé]fono\s*)?(\+?[\d][\d\s-]{8,15}\d)/i);
  const telefono = conTelefono && numeroWhatsapp(conTelefono[1]) ? telefonoLegible(conTelefono[1]) : "";

  // Quien pagó, por su nombre: «de PEDRO ANTONIO GOMEZ RIVAS por Bs.».
  const conTitular = limpio.match(/\bde\s+([\p{L}][\p{L}' .]{2,80}?)\s+por\s+Bs/iu);
  const titular = conTitular && !/pago\s*m[oó]vil|transferencia|bdv/i.test(conTitular[1]) ? conTitular[1].trim().replace(/\s+/g, " ") : "";

  const conReferencia =
    limpio.match(/\bRef(?:erencia)?\.?\s*(?:N[°º.o]*\s*)?:?\s*(\d{4,20})/i) ??
    limpio.match(/n[uú]mero de operaci[oó]n:?\s*(\d{4,20})/i) ??
    limpio.match(/\boperaci[oó]n:?\s*(?:N[°º.o]*\s*)?(\d{4,20})/i);
  const referencia = conReferencia ? conReferencia[1] : "";

  // Solo la fecha del propio aviso, «en fecha 14-11-26»: una captura de pantalla trae también lo que hay detrás (el
  // historial del panel, «Nota N.° 000088 20/10/2026»), y tomar esa fecha pasaba el pago a dólares con la tasa de otro
  // día (el 14/11/2026, una transferencia de hoy entró con fecha 20/10 y dejó 5,83 $ a favor que no existían). El
  // aviso sin fecha vale el día en que llegó.
  const conFecha = limpio.match(/\bfecha:?\s*(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})\b/i);
  const fecha = conFecha ? leerFecha(conFecha[1], conFecha[2], conFecha[3]) : null;
  const conHora = limpio.match(/\bhora:?\s*(\d{1,2}):(\d{2})/i) ?? limpio.match(/\b(\d{1,2}):(\d{2})\s*(?:[ap]\.?\s*m\.?)?(?:\D|$)/i);
  const hora = conHora && Number(conHora[1]) < 24 && Number(conHora[2]) < 60 ? `${conHora[1].padStart(2, "0")}:${conHora[2]}` : null;

  return { leido: true, movimiento: { banco: "BDV", metodo, monto_bs: monto, telefono, titular, referencia, fecha, hora } };
}

/**
 * Si dos referencias son la misma: la que se escribió a mano suele ser solo
 * las últimas cifras («8094»), así que basta que una termine en la otra, con
 * al menos cuatro cifras. Vacías, nunca.
 */
export function mismaReferencia(a: string, b: string): boolean {
  const ca = a.replace(/\D/g, "");
  const cb = b.replace(/\D/g, "");
  if (ca.length < 4 || cb.length < 4) return false;
  return ca.length >= cb.length ? ca.endsWith(cb) : cb.endsWith(ca);
}

/** Si una referencia escrita tiene cifras suficientes para buscarla. */
export function referenciaUtil(referencia: string): boolean {
  return referencia.replace(/\D/g, "").length >= 4;
}

/** Si dos montos en bolívares son el mismo, con un margen relativo (0,005 es medio por ciento). */
export function montosParecidos(a: number, b: number, margen = 0): boolean {
  return Math.abs(a - b) <= Math.max(0.011, Math.max(a, b) * margen);
}

/** Cómo se supo de quién era un pago que entró al banco. */
export type ComoSeSupo = "anotado" | "aviso" | "conocido" | "telefono" | "a_mano";

export const COMO_SE_SUPO: Record<ComoSeSupo, string> = {
  anotado: "ya estaba anotado",
  aviso: "lo avisó el cliente",
  conocido: "ya había pagado desde ahí",
  telefono: "por su teléfono",
  a_mano: "lo elegiste tú",
};

/** Las claves con que se recuerda a quien paga: su teléfono y su nombre en el banco. */
export function clavesDelPagador(m: { telefono: string; titular: string }): string[] {
  const claves: string[] = [];
  const numero = m.telefono ? numeroWhatsapp(m.telefono) : null;
  if (numero) claves.push(`tel:${numero}`);
  const nombre = normalizar(m.titular).replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  if (nombre.split(" ").length >= 2) claves.push(`nombre:${nombre}`);
  return claves;
}

/**
 * Un cliente cuyo nombre se parece al de quien pagó: todas las palabras de su
 * nombre (o de su razón social) están en el del banco, y son al menos dos
 * («Pedro Gómez» y «PEDRO ANTONIO GOMEZ RIVAS»). Solo para proponerlo: el
 * dueño confirma.
 */
export function nombreParecido(titular: string, nombres: string[]): boolean {
  const delBanco = new Set(normalizar(titular).split(/[^a-z]+/).filter((p) => p.length >= 3));
  if (delBanco.size < 2) return false;
  return nombres.some((nombre) => {
    const palabras = normalizar(nombre)
      .split(/[^a-z]+/)
      .filter((p) => p.length >= 3 && !["del", "los", "las", "c.a", "panaderia", "pizzeria", "comercial", "inversiones"].includes(p));
    return palabras.length >= 2 && palabras.every((p) => delBanco.has(p));
  });
}

/**
 * Un cliente al que el monto le cuadra: lo que debe, o lo que queda de una de
 * sus notas, pasado a bolívares, casi igual a lo que entró (un 1 % de margen:
 * pudo pagar con la tasa de otro día). Solo para proponerlo.
 */
export function montoCuadra(montoUsd: number, deudas: number[]): boolean {
  return deudas.some((d) => d > 0 && Math.abs(d - montoUsd) <= Math.max(0.05, d * 0.01));
}
