import "server-only";
import { ejecutar, fila, filas } from "./db";
import { hoy } from "./dinero";

/**
 * Cuándo se le recordó la deuda a cada cliente. Se anota al abrir el
 * recordatorio de WhatsApp desde el panel (`/admin/recordar/[id]`), así el
 * Resumen dice «recordado el 2/10» y no se insiste a quien se le acaba de
 * escribir.
 */

export async function anotarRecordatorio(clienteId: number, saldoUsd: number): Promise<void> {
  await ejecutar("insert into recordatorios (cliente_id, fecha, saldo_usd) values (?, ?, ?)", [clienteId, hoy(), saldoUsd]);
}

/** Cuándo se le recordó por última vez a un cliente, o null si nunca. */
export async function ultimoRecordatorioDe(clienteId: number): Promise<string | null> {
  const f = await fila<{ fecha: string | null }>("select max(fecha) as fecha from recordatorios where cliente_id = ?", [clienteId]);
  return f?.fecha ?? null;
}

/** El último recordatorio de cada cliente: id del cliente → fecha. */
export async function ultimosRecordatorios(): Promise<Map<number, string>> {
  const lista = await filas<{ cliente_id: number; fecha: string }>("select cliente_id, max(fecha) as fecha from recordatorios group by cliente_id");
  return new Map(lista.map((r) => [Number(r.cliente_id), r.fecha]));
}
