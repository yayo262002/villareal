import "server-only";
import { ejecutar, filas } from "./db";
import { leerDocumento, type Documento } from "./documento";
import { rotuloDe } from "./rotulo";

/**
 * Quien compra con factura: su cédula o RIF y su nombre. Los del mostrador
 * se guardan aquí al facturarles (tabla `compradores`), y los clientes de la
 * cartera que tienen la cédula o el RIF en su ficha también cuentan: la caja
 * reconoce a cualquiera de los dos con solo escribir el número.
 */

export type CompradorConocido = {
  /** Letra y número sin el dígito del RIF: la cédula y el RIF de la misma persona dan la misma clave. */
  clave: string;
  /** Como va en la factura: «V-12345678», «J-40806430-8». */
  documento: string;
  nombre: string;
};

/** Todos los que la caja puede reconocer por su cédula o su RIF: lo último que se escribió en una factura manda. */
export async function compradoresConocidos(): Promise<CompradorConocido[]> {
  const [compradores, clientes] = await Promise.all([
    filas<CompradorConocido>("select clave, documento, nombre from compradores"),
    filas<{ nombre: string; razon_social: string; telefono: string; cedula_rif: string }>(
      "select nombre, razon_social, telefono, cedula_rif from clientes where trim(cedula_rif) <> ''",
    ),
  ]);
  const porClave = new Map<string, CompradorConocido>();
  for (const c of clientes) {
    const documento = leerDocumento(c.cedula_rif);
    const nombre = rotuloDe(c);
    if (documento && nombre) porClave.set(documento.clave, { clave: documento.clave, documento: documento.texto, nombre });
  }
  for (const c of compradores) porClave.set(c.clave, { clave: c.clave, documento: c.documento, nombre: c.nombre });
  return [...porClave.values()];
}

/** Guarda (o pone al día) a quien compró con factura, para reconocerlo la próxima vez. */
export async function guardarComprador(documento: Documento, nombre: string): Promise<void> {
  await ejecutar(
    `insert into compradores (clave, documento, nombre) values (?, ?, ?)
     on conflict(clave) do update set documento = excluded.documento, nombre = excluded.nombre, actualizado_en = datetime('now')`,
    [documento.clave, documento.texto, nombre],
  );
}

/** El nombre de quien compra, como se escribe en la factura: sin espacios de más, hasta 120 letras. */
export function limpiarNombreDeComprador(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim().slice(0, 120);
}
