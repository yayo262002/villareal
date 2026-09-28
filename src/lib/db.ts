import "server-only";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";
import { ESQUEMA, PRODUCTOS_INICIALES } from "./esquema";

/**
 * Conexión a la base de datos con el cliente de libsql, que habla el mismo
 * SQLite en dos sitios:
 *
 * - Sin configurar nada: un archivo en `datos/villareal.db`. Para el local
 *   o un servidor propio.
 * - Con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`: una base en Turso, que
 *   es lo que hace falta en Vercel porque allí no hay disco que persista.
 *
 * Todas las funciones son asíncronas por eso: contra Turso cada consulta
 * viaja por la red.
 */

export type { InValue, Transaction };

function esRemota(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function urlBaseDeDatos(): string {
  if (esRemota()) return process.env.TURSO_DATABASE_URL!;
  const ruta = process.env.RUTA_BASE_DATOS ?? path.join(process.cwd(), "datos", "villareal.db");
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  return "file:" + ruta.replace(/\\/g, "/");
}

async function abrir(): Promise<Client> {
  const cliente = createClient({
    url: urlBaseDeDatos(),
    authToken: esRemota() ? process.env.TURSO_AUTH_TOKEN : undefined,
  });
  if (!esRemota()) {
    await cliente.execute("pragma journal_mode = wal");
    await cliente.execute("pragma foreign_keys = on");
  }
  await cliente.executeMultiple(ESQUEMA);

  const hay = await cliente.execute("select count(*) as n from productos");
  if (Number(hay.rows[0].n) === 0) {
    for (const p of PRODUCTOS_INICIALES) {
      await cliente.execute({ sql: "insert into productos (nombre, unidad) values (?, ?)", args: [p.nombre, p.unidad] });
    }
  }
  return cliente;
}

// En desarrollo Next recarga los módulos a cada cambio; guardar la conexión
// en globalThis evita abrir decenas de conexiones a la misma base.
const global = globalThis as unknown as { __dbVillareal?: Promise<Client> };

export function db(): Promise<Client> {
  if (!global.__dbVillareal) {
    global.__dbVillareal = abrir().catch((error) => {
      global.__dbVillareal = undefined;
      throw error;
    });
  }
  return global.__dbVillareal;
}

/** Todas las filas de una consulta, como objetos con el nombre de cada columna. */
export async function filas<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const resultado = await (await db()).execute({ sql, args });
  return resultado.rows as unknown as T[];
}

/** La primera fila, o null si no hay ninguna. */
export async function fila<T>(sql: string, args: InValue[] = []): Promise<T | null> {
  const [primera] = await filas<T>(sql, args);
  return primera ?? null;
}

/** Un insert, update o delete. Devuelve cuántas filas tocó y el último id insertado. */
export async function ejecutar(sql: string, args: InValue[] = []): Promise<{ cambios: number; ultimoId: number }> {
  const resultado = await (await db()).execute({ sql, args });
  return { cambios: resultado.rowsAffected, ultimoId: Number(resultado.lastInsertRowid ?? 0) };
}

/** Varias escrituras que entran todas o ninguna. */
export async function transaccion<T>(cuerpo: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await (await db()).transaction("write");
  try {
    const valor = await cuerpo(tx);
    await tx.commit();
    return valor;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
