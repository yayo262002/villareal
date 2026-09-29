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
