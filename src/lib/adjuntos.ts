import "server-only";
import { ejecutar, fila, filas } from "./db";

/**
 * Fotos de las notas de entrega. Por ahora el negocio no factura: la nota
 * en papel es el comprobante, y aquí queda la foto unida al cliente (y a
 * la venta, si se elige) para que no se pierda.
 */

export type Adjunto = {
  id: number;
  cliente_id: number;
  venta_id: number | null;
  /** El abono al que pertenece, si es la captura de un pago. */
  pago_id: number | null;
  descripcion: string;
  tipo: string;
  tamano: number;
  creado_en: string;
};

export type AdjuntoConDatos = Adjunto & { datos: ArrayBuffer };

export const TIPOS_ADJUNTO = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/** Vercel corta las peticiones de más de 4,5 MB; el formulario reduce las fotos antes de subirlas. */
export const TAMANO_MAXIMO_ADJUNTO = 4 * 1024 * 1024;

export function esTipoAdjunto(tipo: string): tipo is (typeof TIPOS_ADJUNTO)[number] {
  return (TIPOS_ADJUNTO as readonly string[]).includes(tipo);
}

const SIN_DATOS = "id, cliente_id, venta_id, pago_id, descripcion, tipo, tamano, creado_en";

export async function listarAdjuntosDeCliente(clienteId: number): Promise<Adjunto[]> {
  return filas<Adjunto>(`select ${SIN_DATOS} from adjuntos where cliente_id = ? order by id desc`, [clienteId]);
}

export async function buscarAdjunto(id: number): Promise<AdjuntoConDatos | null> {
  return fila<AdjuntoConDatos>("select * from adjuntos where id = ?", [id]);
}

export async function guardarAdjunto(datos: {
  cliente_id: number;
  venta_id: number | null;
  descripcion: string;
  tipo: string;
  contenido: Uint8Array;
}): Promise<number> {
  if (!esTipoAdjunto(datos.tipo)) throw new Error("Solo se aceptan fotos (JPG, PNG, WebP) o PDF.");
  if (datos.contenido.byteLength === 0) throw new Error("El archivo está vacío.");
  if (datos.contenido.byteLength > TAMANO_MAXIMO_ADJUNTO) {
    throw new Error("El archivo pesa más de 4 MB. Haz la foto con menos resolución o recórtala.");
  }
  const r = await ejecutar(
    "insert into adjuntos (cliente_id, venta_id, descripcion, tipo, tamano, datos) values (?, ?, ?, ?, ?, ?)",
    [datos.cliente_id, datos.venta_id, datos.descripcion, datos.tipo, datos.contenido.byteLength, datos.contenido],
  );
  return r.ultimoId;
}

export async function eliminarAdjunto(id: number): Promise<boolean> {
  const r = await ejecutar("delete from adjuntos where id = ?", [id]);
  return r.cambios > 0;
}
