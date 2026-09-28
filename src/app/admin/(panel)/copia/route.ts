import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { exportarBaseDeDatos, nombreDeCopia } from "@/lib/copias";
import { haySesion } from "@/lib/sesion";

/**
 * GET /admin/copia descarga una copia de la base de datos. Es el botón
 * «Descargar copia» del resumen: desde el teléfono, la copia acaba en las
 * descargas y de ahí a Drive, WhatsApp o donde sea.
 *
 * Un `route.ts` no pasa por el layout del panel, así que comprueba la
 * sesión aquí. El proxy solo mira que la cookie exista.
 */
export async function GET(): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const nombre = nombreDeCopia(new Date());
  const carpetaTemporal = await fs.mkdtemp(path.join(os.tmpdir(), "villareal-"));
  try {
    const temporal = await exportarBaseDeDatos(await db(), path.join(carpetaTemporal, nombre));
    const contenido = await fs.readFile(temporal);
    return new Response(contenido, {
      headers: {
        "content-type": "application/vnd.sqlite3",
        "content-disposition": `attachment; filename="${nombre}"`,
        "content-length": String(contenido.byteLength),
        "cache-control": "no-store",
      },
    });
  } finally {
    await fs.rm(carpetaTemporal, { recursive: true, force: true });
  }
}
