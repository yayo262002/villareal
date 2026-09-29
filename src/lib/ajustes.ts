import "server-only";
import { ejecutar, fila } from "./db";

/**
 * Ajustes sueltos del negocio, guardados como clave y valor. La tasa del
 * día (bolívares por dólar) es el principal: con ella la web publica los
 * precios en bolívares y el formulario de pagos la propone.
 */

export type Tasa = { valor: number; actualizada_en: string };

async function leer(clave: string): Promise<{ valor: string; actualizado_en: string } | null> {
  return fila("select valor, actualizado_en from ajustes where clave = ?", [clave]);
}

async function guardar(clave: string, valor: string): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))
     on conflict(clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [clave, valor],
  );
}

export async function leerTasa(): Promise<Tasa | null> {
  const f = await leer("tasa_bs");
  if (!f) return null;
  const valor = Number(f.valor);
  return Number.isFinite(valor) && valor > 0 ? { valor, actualizada_en: f.actualizado_en } : null;
}

export async function guardarTasa(valor: number): Promise<void> {
  if (!(valor > 0)) throw new Error("La tasa tiene que ser mayor que cero.");
  await guardar("tasa_bs", String(valor));
}

/**
 * Marca de que los precios publicados son de ejemplo y no los del dueño.
 * Mientras esté puesta, el panel lo avisa arriba de Productos. La quita el
 * dueño cuando ya ha puesto los suyos.
 */
export async function hayPreciosDeEjemplo(): Promise<boolean> {
  return (await leer("precios_de_ejemplo"))?.valor === "1";
}

export async function quitarPreciosDeEjemplo(): Promise<void> {
  await ejecutar("delete from ajustes where clave = 'precios_de_ejemplo'");
}
