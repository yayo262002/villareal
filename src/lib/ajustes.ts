import "server-only";
import { ejecutar, fila } from "./db";

/**
 * Ajustes sueltos del negocio, guardados como clave y valor. Por ahora solo
 * la tasa del día: bolívares por dólar. Con ella la web publica los precios
 * en bolívares y el formulario de pagos la propone.
 */

export type Tasa = { valor: number; actualizada_en: string };

export async function leerTasa(): Promise<Tasa | null> {
  const f = await fila<{ valor: string; actualizado_en: string }>("select valor, actualizado_en from ajustes where clave = 'tasa_bs'");
  if (!f) return null;
  const valor = Number(f.valor);
  return Number.isFinite(valor) && valor > 0 ? { valor, actualizada_en: f.actualizado_en } : null;
}

export async function guardarTasa(valor: number): Promise<void> {
  if (!(valor > 0)) throw new Error("La tasa tiene que ser mayor que cero.");
  await ejecutar(
    `insert into ajustes (clave, valor, actualizado_en) values ('tasa_bs', ?, datetime('now'))
     on conflict(clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [String(valor)],
  );
}
