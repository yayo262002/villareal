import fs from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { movimientosEntreCon, type Consulta } from "./movimientos.ts";
import { CABECERA_DE_MOVIMIENTOS, aCsv, filasDeMovimientos } from "./exportar.ts";
import { hace, hoy } from "./dinero.ts";

/**
 * Los Excel que deja el guion de cada noche en el ordenador del dueño
 * (`npm run copia`, programado a las 8 de la noche): los movimientos de
 * hoy, los de ayer (por si se anotó algo tarde) y todos los de siempre en
 * un solo archivo. Van a `exportaciones/`, que está dentro de OneDrive,
 * así quedan también en la nube y se ven desde el teléfono.
 */

export type ArchivoExportado = { ruta: string; movimientos: number };

function consultaDe(cliente: Client): Consulta {
  return async <T>(sql: string, args: (string | number | null)[] = []) => (await cliente.execute({ sql, args })).rows as unknown as T[];
}

async function escribir(consultar: Consulta, carpeta: string, nombre: string, desde: string | null, hasta: string | null): Promise<ArchivoExportado> {
  const movimientos = await movimientosEntreCon(consultar, desde, hasta);
  const ruta = path.join(carpeta, nombre);
  fs.writeFileSync(ruta, aCsv(CABECERA_DE_MOVIMIENTOS, filasDeMovimientos(movimientos)));
  return { ruta, movimientos: movimientos.ventas.length + movimientos.abonos.length + movimientos.compras.length + movimientos.pagos.length };
}

export async function escribirExportaciones(cliente: Client, carpeta: string): Promise<ArchivoExportado[]> {
  fs.mkdirSync(carpeta, { recursive: true });
  const consultar = consultaDe(cliente);
  const dias = [hoy(), hace(1)];
  const archivos: ArchivoExportado[] = [];
  for (const dia of dias) archivos.push(await escribir(consultar, carpeta, `movimientos-${dia}.csv`, dia, dia));
  archivos.push(await escribir(consultar, carpeta, "movimientos-todo.csv", null, null));
  return archivos;
}
