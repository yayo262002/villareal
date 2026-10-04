import "server-only";
import { ejecutar, fila, filas } from "./db";
import { movimientosEntre } from "./caja";
import { CABECERA_DE_MOVIMIENTOS, aCsv, filasDeMovimientos } from "./exportar";

/**
 * La exportación diaria: cada mañana la tarea de Vercel guarda en la base
 * el Excel (CSV) con todos los movimientos del día anterior, para que el
 * dueño lo baje cuando quiera aunque su ordenador estuviera apagado. Se
 * conservan los últimos 90 días; el archivo entero se baja desde
 * Estadísticas en cualquier momento.
 */

export const EXPORTACIONES_A_CONSERVAR = 90;

export type Exportacion = { fecha: string; movimientos: number; tamano: number; creado_en: string };

/** Guarda (o rehace) la exportación de un día. Un día sin movimientos no se guarda. */
export async function guardarExportacionDelDia(fecha: string): Promise<Exportacion | null> {
  const movimientos = await movimientosEntre(fecha, fecha);
  const cuantos = movimientos.ventas.length + movimientos.abonos.length + movimientos.compras.length + movimientos.pagos.length;
  if (cuantos === 0) {
    await ejecutar("delete from exportaciones where fecha = ?", [fecha]);
    return null;
  }
  const csv = aCsv(CABECERA_DE_MOVIMIENTOS, filasDeMovimientos(movimientos));
  const tamano = Buffer.byteLength(csv, "utf8");
  await ejecutar(
    `insert into exportaciones (fecha, csv, movimientos, tamano, creado_en) values (?, ?, ?, ?, datetime('now'))
     on conflict (fecha) do update set csv = excluded.csv, movimientos = excluded.movimientos, tamano = excluded.tamano, creado_en = datetime('now')`,
    [fecha, csv, cuantos, tamano],
  );
  return { fecha, movimientos: cuantos, tamano, creado_en: new Date().toISOString() };
}

/** Las exportaciones de varios días seguidos, los dos incluidos. Devuelve cuántos días quedaron guardados y cuántos movimientos suman. */
export async function guardarExportacionesEntre(desde: string, hasta: string): Promise<{ dias: number; movimientos: number }> {
  let dias = 0;
  let movimientos = 0;
  for (let fecha = desde; fecha <= hasta; fecha = siguienteDia(fecha)) {
    const e = await guardarExportacionDelDia(fecha);
    if (e) {
      dias += 1;
      movimientos += e.movimientos;
    }
  }
  return { dias, movimientos };
}

function siguienteDia(fecha: string): string {
  return new Date(new Date(fecha + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Las últimas, de la más reciente a la más antigua. */
export async function listarExportaciones(limite = 30): Promise<Exportacion[]> {
  return filas<Exportacion>("select fecha, movimientos, tamano, creado_en from exportaciones order by fecha desc limit ?", [limite]);
}

export async function buscarExportacion(fecha: string): Promise<{ fecha: string; csv: string } | null> {
  return fila<{ fecha: string; csv: string }>("select fecha, csv from exportaciones where fecha = ?", [fecha]);
}

/** Borra las más viejas pasando de `conservar`. Devuelve cuántas borró. */
export async function podarExportaciones(conservar = EXPORTACIONES_A_CONSERVAR): Promise<number> {
  const r = await ejecutar("delete from exportaciones where fecha not in (select fecha from exportaciones order by fecha desc limit ?)", [conservar]);
  return r.cambios;
}
