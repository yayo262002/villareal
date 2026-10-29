import { createClient, type Client, type InStatement, type ResultSet, type Value } from "@libsql/client";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { ESQUEMA, TABLAS } from "./esquema.ts";

/**
 * Copias de seguridad. Una copia es un archivo SQLite normal con todas las
 * tablas, se saque de donde se saque: del archivo local o de Turso. Así la
 * misma copia sirve para restaurar en un servidor propio o para abrirla
 * con cualquier programa que lea SQLite.
 *
 * Las tablas de datos se leen dentro de una transacción de lectura para
 * que la copia sea consistente aunque el panel esté escribiendo en ese
 * momento; las de fotos, que pesan decenas de megas, van después y por
 * tandas pequeñas (ver `copiarTabla`).
 *
 * Este módulo no lleva `server-only` porque también lo usa el script de
 * línea de comandos, fuera de Next.
 */

const PREFIJO = "villareal-";
const EXTENSION = ".db";
const PATRON_COPIA = /^villareal-\d{4}-\d{2}-\d{2}-\d{4}\.db$/;

/** Cuántas copias guarda `npm run copia` antes de borrar las más viejas. */
export const COPIAS_A_CONSERVAR = 30;

/** Las tablas que guardan fotos: pesan decenas de megas y se bajan aparte, por tandas pequeñas. */
function esTablaDeFotos(tabla: string): boolean {
  return tabla.startsWith("fotos_") || tabla.startsWith("adjuntos");
}

/**
 * Copia una tabla por tandas, en el orden del rowid. Las de fotos se piden
 * de 5 en 5 y fuera de la transacción de lectura: Turso corta una
 * transacción cuyo flujo pasa unos segundos sin peticiones, y bajar una
 * tanda de fotos tarda más que eso; y una respuesta de muchos megas la
 * cerraba a medias («terminated»). Las demás, de 200 en 200.
 */
async function copiarTabla(origen: { execute(consulta: InStatement): Promise<ResultSet> }, salida: DatabaseSync, tabla: string): Promise<void> {
  const tanda = esTablaDeFotos(tabla) ? 5 : 200;
  let insertar: StatementSync | null = null;
  salida.exec("begin");
  try {
    for (let desde = 0; ; desde += tanda) {
      const resultado = await origen.execute({ sql: `select * from ${tabla} order by rowid limit ? offset ?`, args: [tanda, desde] });
      if (resultado.rows.length === 0) break;
      const columnas = resultado.columns;
      insertar ??= salida.prepare(`insert into ${tabla} (${columnas.join(", ")}) values (${columnas.map(() => "?").join(", ")})`);
      for (const fila of resultado.rows) {
        insertar.run(...columnas.map((c) => valorParaSqlite(fila[c])));
      }
      if (resultado.rows.length < tanda) break;
    }
    salida.exec("commit");
  } catch (error) {
    salida.exec("rollback");
    throw error;
  }
}

function dosCifras(n: number): string {
  return String(n).padStart(2, "0");
}

/** `villareal-2026-09-28-1030.db`: se ordena por nombre igual que por fecha. */
export function nombreDeCopia(ahora: Date): string {
  const fecha = `${ahora.getFullYear()}-${dosCifras(ahora.getMonth() + 1)}-${dosCifras(ahora.getDate())}`;
  const hora = `${dosCifras(ahora.getHours())}${dosCifras(ahora.getMinutes())}`;
  return `${PREFIJO}${fecha}-${hora}${EXTENSION}`;
}

export function esNombreDeCopia(nombre: string): boolean {
  return PATRON_COPIA.test(nombre);
}

/** Los valores de libsql al formato que acepta node:sqlite. */
function valorParaSqlite(v: Value): null | number | bigint | string | Uint8Array {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (v === null || typeof v === "number" || typeof v === "bigint" || typeof v === "string") return v;
  return String(v);
}

/**
 * Escribe en `destino` un archivo SQLite nuevo con todas las tablas de
 * `origen`. Si `destino` ya existe se sobrescribe (dos copias en el mismo
 * minuto son la misma copia). Se escribe aparte y solo se pone en su sitio
 * si termina bien: una copia a medias no puede pasar por buena.
 */
export async function exportarBaseDeDatos(origen: Client, destino: string): Promise<string> {
  // Se importa aquí y no arriba para que el resto de la web no dependa de
  // que el servidor tenga node:sqlite (Node 22.5 o más).
  const { DatabaseSync } = await import("node:sqlite");

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const parcial = `${destino}.parcial`;
  fs.rmSync(parcial, { force: true });

  const salida = new DatabaseSync(parcial);
  try {
    salida.exec(ESQUEMA);
    // Solo las tablas que tiene la base: una que aún no se puso al día no tiene las nuevas.
    const existentes = new Set((await origen.execute("select name from sqlite_master where type = 'table'")).rows.map((f) => String(f.name)));
    const tablas = TABLAS.filter((t) => existentes.has(t));
    // Primero las de datos, todas en una transacción de lectura: la foto es consistente. Las de fotos, después y fuera de ella.
    const lectura = await origen.transaction("read");
    try {
      for (const tabla of tablas) if (!esTablaDeFotos(tabla)) await copiarTabla(lectura, salida, tabla);
    } finally {
      lectura.close();
    }
    for (const tabla of tablas) if (esTablaDeFotos(tabla)) await copiarTabla(origen, salida, tabla);
  } catch (error) {
    salida.close();
    fs.rmSync(parcial, { force: true });
    throw error;
  }
  salida.close();
  fs.rmSync(destino, { force: true });
  fs.renameSync(parcial, destino);
  return destino;
}

/** Abre un archivo local, lo exporta y cierra. Para el script y las pruebas. */
export async function copiarArchivo(rutaOrigen: string, destino: string): Promise<string> {
  if (!fs.existsSync(rutaOrigen)) {
    throw new Error(`No existe la base de datos en ${rutaOrigen}.`);
  }
  const origen = createClient({ url: "file:" + rutaOrigen.replace(/\\/g, "/") });
  try {
    return await exportarBaseDeDatos(origen, destino);
  } finally {
    origen.close();
  }
}

/** Lista las copias de una carpeta, de la más vieja a la más nueva. */
export function listarCopias(carpeta: string): string[] {
  if (!fs.existsSync(carpeta)) return [];
  return fs
    .readdirSync(carpeta)
    .filter(esNombreDeCopia)
    .sort()
    .map((nombre) => path.join(carpeta, nombre));
}

/**
 * Borra las copias más viejas dejando solo `conservar`. Solo toca archivos
 * con nombre de copia: cualquier otra cosa que haya en la carpeta se queda.
 * Devuelve las rutas borradas.
 */
export function podarCopias(carpeta: string, conservar: number): string[] {
  if (!Number.isInteger(conservar) || conservar < 1) {
    throw new Error("Hay que conservar al menos una copia.");
  }
  const copias = listarCopias(carpeta);
  const sobrantes = copias.slice(0, Math.max(0, copias.length - conservar));
  for (const ruta of sobrantes) fs.rmSync(ruta);
  return sobrantes;
}
