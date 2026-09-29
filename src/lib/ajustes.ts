import "server-only";
import { ejecutar, filas } from "./db";

/**
 * Ajustes sueltos del negocio, guardados como clave y valor. La tasa del
 * día (bolívares por dólar) es el principal: con ella la web publica los
 * precios en bolívares y el formulario de pagos la propone.
 */

/** De dónde salió la tasa vigente: la escribió el dueño o se trajo sola del BCV. */
export type OrigenTasa = "manual" | "bcv";

export type Tasa = { valor: number; actualizada_en: string; origen: OrigenTasa };

type Ajuste = { clave: string; valor: string; actualizado_en: string };

async function leer(...claves: string[]): Promise<Map<string, Ajuste>> {
  const huecos = claves.map(() => "?").join(", ");
  const lista = await filas<Ajuste>(`select clave, valor, actualizado_en from ajustes where clave in (${huecos})`, claves);
  return new Map(lista.map((a) => [a.clave, a]));
}

async function guardar(clave: string, valor: string): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))
     on conflict(clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [clave, valor],
  );
}

async function quitar(clave: string): Promise<void> {
  await ejecutar("delete from ajustes where clave = ?", [clave]);
}

export async function leerTasa(): Promise<Tasa | null> {
  const ajustes = await leer("tasa_bs", "tasa_origen");
  const tasa = ajustes.get("tasa_bs");
  if (!tasa) return null;
  const valor = Number(tasa.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return {
    valor,
    actualizada_en: tasa.actualizado_en,
    origen: ajustes.get("tasa_origen")?.valor === "bcv" ? "bcv" : "manual",
  };
}

export async function guardarTasa(valor: number, origen: OrigenTasa = "manual"): Promise<void> {
  if (!(valor > 0)) throw new Error("La tasa tiene que ser mayor que cero.");
  await guardar("tasa_bs", String(valor));
  await guardar("tasa_origen", origen);
}

/**
 * Si la tasa se trae sola del BCV cada mañana. Encendido mientras el dueño
 * no lo apague: el negocio cobra a tasa BCV, y una tasa de ayer publica
 * precios en bolívares que ya no son.
 */
export async function tasaAutomatica(): Promise<boolean> {
  return (await leer("tasa_automatica")).get("tasa_automatica")?.valor !== "0";
}

export async function ponerTasaAutomatica(encendida: boolean): Promise<void> {
  await guardar("tasa_automatica", encendida ? "1" : "0");
}

/** Lo último que falló al traer la tasa, para enseñarlo en el panel. */
export async function leerAvisoTasa(): Promise<{ mensaje: string; momento: string } | null> {
  const aviso = (await leer("tasa_aviso")).get("tasa_aviso");
  return aviso ? { mensaje: aviso.valor, momento: aviso.actualizado_en } : null;
}

export async function ponerAvisoTasa(mensaje: string | null): Promise<void> {
  if (mensaje === null) await quitar("tasa_aviso");
  else await guardar("tasa_aviso", mensaje);
}

/**
 * Marca de que los precios publicados son de ejemplo y no los del dueño.
 * Mientras esté puesta, el panel lo avisa arriba de Productos. La quita el
 * dueño cuando ya ha puesto los suyos.
 */
export async function hayPreciosDeEjemplo(): Promise<boolean> {
  return (await leer("precios_de_ejemplo")).get("precios_de_ejemplo")?.valor === "1";
}

export async function quitarPreciosDeEjemplo(): Promise<void> {
  await quitar("precios_de_ejemplo");
}
