import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

/**
 * Dónde está la base de datos, leído del entorno. Sin `server-only` porque
 * lo usan tanto Next como el script de copias.
 *
 * - `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`: base remota en Turso (Vercel).
 * - Si no, un archivo: `RUTA_BASE_DATOS` o `datos/villareal.db`.
 */
export function esBaseRemota(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function rutaArchivoLocal(): string {
  return process.env.RUTA_BASE_DATOS ?? path.join(process.cwd(), "datos", "villareal.db");
}

export function urlDeArchivo(ruta: string): string {
  return "file:" + ruta.replace(/\\/g, "/");
}

export function crearClienteDesdeEntorno(): Client {
  if (esBaseRemota()) {
    return createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const ruta = rutaArchivoLocal();
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  return createClient({ url: urlDeArchivo(ruta) });
}
