import path from "node:path";
import { COPIAS_A_CONSERVAR, exportarBaseDeDatos, nombreDeCopia, podarCopias } from "../src/lib/copias.ts";
import { crearClienteDesdeEntorno, esBaseRemota, rutaArchivoLocal } from "../src/lib/conexion.ts";

/**
 * `npm run copia`: guarda una copia de la base de datos en `copias/` con la
 * fecha y la hora en el nombre, y borra las más viejas pasando de
 * COPIAS_A_CONSERVAR. Sirve para lanzarlo a mano o desde el programador de
 * tareas de Windows cada día.
 *
 * Si `.env.local` apunta a Turso, la copia se baja de allí; si no, sale del
 * archivo local. En los dos casos el resultado es un archivo SQLite normal.
 *
 * Variables opcionales (en `.env.local`):
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN   la base en Turso (Vercel)
 *   RUTA_BASE_DATOS   dónde está el archivo local (por defecto datos/villareal.db)
 *   CARPETA_COPIAS    dónde dejar las copias (por defecto copias/). Ponla en
 *                     una carpeta que se sincronice con la nube o en otro disco.
 */

const carpeta = process.env.CARPETA_COPIAS ?? path.join(process.cwd(), "copias");
const cliente = crearClienteDesdeEntorno();

try {
  const origen = esBaseRemota() ? "Turso" : rutaArchivoLocal();
  const destino = await exportarBaseDeDatos(cliente, path.join(carpeta, nombreDeCopia(new Date())));
  console.log(`Copia de ${origen} guardada en ${destino}`);
  const borradas = podarCopias(carpeta, COPIAS_A_CONSERVAR);
  if (borradas.length > 0) {
    console.log(`Borradas ${borradas.length} copias antiguas (se conservan ${COPIAS_A_CONSERVAR}).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  cliente.close();
}
