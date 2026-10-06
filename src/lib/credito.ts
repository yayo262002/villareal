import { redondear } from "./dinero.ts";
import type { CuentaDeVenta } from "./cuentas.ts";

/**
 * Los días de crédito: cuánto tiempo tiene un cliente para pagar una nota, o
 * el negocio para pagarle a un proveedor. Pasado ese plazo, lo que queda
 * por pagar de esa nota está vencido. Cálculo puro, con pruebas.
 */

export const DIAS_DE_CREDITO_POR_DEFECTO = 7;
export const DIAS_DE_CREDITO_MAXIMO = 365;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Los días de crédito que se aceptan de un formulario: entero de 0 a 365; si no, el de siempre. */
export function leerDiasDeCredito(valor: number | null | undefined): number {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return DIAS_DE_CREDITO_POR_DEFECTO;
  const dias = Math.round(valor);
  return dias < 0 || dias > DIAS_DE_CREDITO_MAXIMO ? DIAS_DE_CREDITO_POR_DEFECTO : dias;
}

/** Una fecha YYYY-MM-DD más `dias` días. */
export function sumarDias(fecha: string, dias: number): string {
  const instante = new Date(fecha.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(instante.getTime())) return fecha;
  return new Date(instante.getTime() + dias * UN_DIA_MS).toISOString().slice(0, 10);
}

/** Cuántos días hay de `desde` a `hasta` (negativo si `hasta` es antes). */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde.slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(hasta.slice(0, 10) + "T00:00:00Z").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / UN_DIA_MS);
}

export type ConVencimiento<V> = V & {
  /** El día en que hay que tener pagada la nota. */
  vence: string;
  /** Días pasados desde el vencimiento (negativos: los que faltan). */
  atraso: number;
  /** Queda algo por pagar y ya pasó el plazo. */
  vencida: boolean;
};

/** A cada cuenta, su vencimiento, contado desde la fecha de la nota. */
export function conVencimiento<V extends { fecha: string; pendiente_usd: number }>(
  cuentas: V[],
  diasDeCredito: number,
  hoy: string,
): ConVencimiento<V>[] {
  return cuentas.map((cuenta) => {
    const vence = sumarDias(cuenta.fecha, diasDeCredito);
    const atraso = diasEntre(vence, hoy);
    return { ...cuenta, vence, atraso, vencida: cuenta.pendiente_usd > 0 && atraso > 0 };
  });
}

export type ResumenDeVencimiento = {
  /** Lo que queda por pagar de las notas ya vencidas. */
  vencido_usd: number;
  /** Lo que queda por pagar de las notas que todavía están en plazo. */
  en_plazo_usd: number;
  /** El mayor atraso entre las vencidas, en días. 0 si no hay ninguna. */
  mayor_atraso: number;
  /** El próximo vencimiento de lo que está en plazo, o null si no hay nada en plazo. */
  proximo_vencimiento: string | null;
  /**
   * Cuánto apremia cobrarle: el atraso de la nota pendiente que vence antes.
   * Positivo, los días que lleva vencida; 0, vence hoy; negativo, los días
   * que faltan. Null si no debe nada. A más urgencia, más arriba en las listas.
   */
  urgencia: number | null;
};

/** Cuánto está vencido y cuánto en plazo de lo que debe un cliente (o el negocio a un proveedor). */
export function resumenDeVencimiento(
  cuentas: Pick<CuentaDeVenta<{ id: number; fecha: string; total_usd: number }>, "fecha" | "pendiente_usd">[],
  diasDeCredito: number,
  hoy: string,
): ResumenDeVencimiento {
  const pendientes = conVencimiento(cuentas, diasDeCredito, hoy).filter((c) => c.pendiente_usd > 0);
  const vencidas = pendientes.filter((c) => c.vencida);
  const enPlazo = pendientes.filter((c) => !c.vencida);
  return {
    vencido_usd: redondear(vencidas.reduce((s, c) => s + c.pendiente_usd, 0)),
    en_plazo_usd: redondear(enPlazo.reduce((s, c) => s + c.pendiente_usd, 0)),
    mayor_atraso: vencidas.reduce((m, c) => Math.max(m, c.atraso), 0),
    proximo_vencimiento: enPlazo.map((c) => c.vence).sort()[0] ?? null,
    urgencia: pendientes.length > 0 ? Math.max(...pendientes.map((c) => c.atraso)) : null,
  };
}

/**
 * El orden de quien debe: mientras menos tiempo le quede para pagar, más
 * arriba. Primero el más atrasado, después el que vence hoy, mañana, en
 * dos días…; a igual plazo, el que más debe. Quien no debe nada, al final.
 */
export function porUrgencia<V extends { urgencia: number | null; saldo_usd: number }>(a: V, b: V): number {
  if (a.urgencia === null || b.urgencia === null) return Number(a.urgencia === null) - Number(b.urgencia === null);
  return b.urgencia - a.urgencia || b.saldo_usd - a.saldo_usd;
}

/** El vencimiento más cercano, dicho en palabras, de quien debe; nada si no debe. */
export function describirUrgencia(urgencia: number | null): string {
  return urgencia === null ? "" : describirVencimiento(urgencia);
}

/** «Vencida hace 3 días», «Vence hoy», «Vence mañana», «Vence en 5 días». */
export function describirVencimiento(atraso: number): string {
  if (atraso > 1) return `Vencida hace ${atraso} días`;
  if (atraso === 1) return "Vencida desde ayer";
  if (atraso === 0) return "Vence hoy";
  if (atraso === -1) return "Vence mañana";
  return `Vence en ${-atraso} días`;
}
