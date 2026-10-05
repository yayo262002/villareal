/**
 * Reglas para aceptar una tasa que llega de fuera. La web publica precios
 * con ella, así que un número raro no puede entrar solo: si la tasa nueva
 * se aleja demasiado de la anterior, se deja la que había y se avisa al
 * dueño. Cálculo puro, con pruebas.
 */

/** Lo más que puede moverse la tasa oficial de un día para otro sin levantar sospecha. */
export const SALTO_MAXIMO_POR_DIA = 0.15;

export type RevisionTasa = { aceptada: true; valor: number } | { aceptada: false; motivo: string };

/** La tasa del BCV trae cuatro decimales: 857,8876. */
export function redondearTasa(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

/**
 * Decide si una tasa recibida se puede usar.
 *
 * @param anterior La tasa vigente, o null si no hay ninguna.
 * @param recibida Lo que devolvió la fuente, sin fiarse de su tipo.
 * @param diasDesdeLaAnterior Días que tiene la tasa vigente. Cuantos más
 *   días, más puede haberse movido: el margen crece con ellos.
 */
export function revisarTasa(anterior: number | null, recibida: unknown, diasDesdeLaAnterior = 1): RevisionTasa {
  const valor = typeof recibida === "string" ? Number(recibida.replace(",", ".")) : recibida;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return { aceptada: false, motivo: "la fuente no devolvió un número válido" };
  }
  const nueva = redondearTasa(valor);
  if (anterior === null || !(anterior > 0)) return { aceptada: true, valor: nueva };

  const dias = Math.max(1, Math.ceil(diasDesdeLaAnterior));
  const cambio = Math.abs(nueva - anterior) / anterior;
  if (cambio > SALTO_MAXIMO_POR_DIA * dias) {
    const porcentaje = Math.round(cambio * 100);
    return {
      aceptada: false,
      motivo: `la tasa recibida (${nueva}) cambia un ${porcentaje} % respecto a la vigente (${anterior})`,
    };
  }
  return { aceptada: true, valor: nueva };
}

// ---------- Los fines de semana, la del lunes ----------
//
// Los comercios cobran el sábado y el domingo con la tasa del lunes, que el
// BCV publica el viernes por la tarde: así no pierden con la que sube el
// lunes. El negocio hace lo mismo.

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function diaDeLaSemanaDe(fecha: string): number {
  return new Date(`${fecha.slice(0, 10)}T12:00:00Z`).getUTCDay();
}

function sumarDiasA(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`) + dias * UN_DIA_MS).toISOString().slice(0, 10);
}

/** Sábado o domingo. La fecha ya es la de Venezuela. */
export function esFinDeSemana(fecha: string): boolean {
  const dia = diaDeLaSemanaDe(fecha);
  return dia === 0 || dia === 6;
}

/** El lunes que sigue a un sábado o a un domingo. */
export function lunesDespuesDe(fecha: string): string {
  return sumarDiasA(fecha, (8 - diaDeLaSemanaDe(fecha)) % 7 || 7);
}

/** El sábado del fin de semana de esa fecha (la propia fecha si es sábado). */
export function sabadoDe(fecha: string): string {
  return diaDeLaSemanaDe(fecha) === 0 ? sumarDiasA(fecha, -1) : fecha;
}

/** Una tasa tal como la publica el BCV: el valor y el día desde el que vale («fecha valor»). */
export type TasaPublicada = { valor: number; fechaValor: string };

/**
 * La tasa del dólar y su fecha valor, sacadas de la página del BCV
 * (`www.bcv.org.ve`), que las enseña así: «871,36890000» y «Fecha Valor:
 * Lunes, 05 Octubre 2026». null si la página no trae lo esperado: entonces
 * no se adivina nada.
 */
export function leerTasaDelBcv(html: string): TasaPublicada | null {
  const bloque = html.match(/id="dolar"[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>[\s\S]*?Fecha Valor:\s*<span[^>]*content="(\d{4}-\d{2}-\d{2})/);
  if (!bloque) return null;
  // «1.234,56780000»: el punto separa los miles y la coma, los decimales.
  const valor = Number(bloque[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { valor: redondearTasa(valor), fechaValor: bloque[2] };
}

/**
 * Si una tasa publicada es la que vale este fin de semana: la del próximo
 * día hábil, que es el lunes (o el martes, si el lunes es feriado). La del
 * viernes no lo es: con ella el BCV todavía no ha publicado la del lunes.
 */
export function esLaDelLunes(fechaValor: string, hoy: string): boolean {
  if (!esFinDeSemana(hoy) || !(fechaValor > hoy)) return false;
  return (Date.parse(`${fechaValor}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / UN_DIA_MS <= 3;
}
