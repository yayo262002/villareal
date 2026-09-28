import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db, ejecutar, fila, filas } from "./db";
import { exportarBaseDeDatos, nombreDeCopia } from "./copias";

/**
 * Copias automáticas guardadas en la propia base (tabla `copias_automaticas`).
 * Vercel las lanza cada noche (ver `vercel.json` y `/api/copia-automatica`)
 * y el dueño puede hacer una a mano desde el resumen. Protegen de lo más
 * probable, que es borrar o estropear datos por error: se baja la copia de
 * anoche y se restaura. No sustituyen a bajar el archivo de vez en cuando.
 */

export const COPIAS_NUBE_A_CONSERVAR = 14;

export type CopiaNube = { id: number; creado_en: string; tamano: number };

export async function listarCopiasNube(): Promise<CopiaNube[]> {
  return filas<CopiaNube>("select id, creado_en, tamano from copias_automaticas order by id desc");
}

export async function buscarCopiaNube(id: number): Promise<(CopiaNube & { datos: ArrayBuffer }) | null> {
  return fila("select * from copias_automaticas where id = ?", [id]);
}

/** Exporta todas las tablas a un archivo SQLite y lo guarda como una copia más. */
export async function guardarCopiaNube(): Promise<CopiaNube> {
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "villareal-nube-"));
  try {
    const archivo = await exportarBaseDeDatos(await db(), path.join(carpeta, nombreDeCopia(new Date())));
    const contenido = new Uint8Array(await fs.readFile(archivo));
    const r = await ejecutar("insert into copias_automaticas (tamano, datos) values (?, ?)", [
      contenido.byteLength,
      contenido,
    ]);
    await podarCopiasNube(COPIAS_NUBE_A_CONSERVAR);
    return (await fila<CopiaNube>("select id, creado_en, tamano from copias_automaticas where id = ?", [r.ultimoId]))!;
  } finally {
    await fs.rm(carpeta, { recursive: true, force: true });
  }
}

export async function podarCopiasNube(conservar: number): Promise<number> {
  const r = await ejecutar(
    `delete from copias_automaticas
     where id not in (select id from copias_automaticas order by id desc limit ?)`,
    [conservar],
  );
  return r.cambios;
}
