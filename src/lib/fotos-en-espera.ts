import "server-only";
import { ejecutar, fila, transaccion } from "./db";

/**
 * La foto de la nota firmada mientras el formulario va y vuelve. Se guarda
 * aquí en cuanto llega: si la venta vuelve con un aviso (un precio raro, la
 * fecha que no cuadra con la nota), el formulario la trae por su número y
 * no hay que volver a hacerla. Al guardar la venta pasa a ser un adjunto;
 * las que nadie reclama se limpian pasado un día.
 */

export type FotoEnEspera = {
  id: number;
  tipo: string;
  tamano: number;
  datos: ArrayBuffer;
  /** Lo que el lector leyó de ella, como JSON, para no leerla dos veces. */
  lectura: string | null;
};

export async function aparcarFoto(tipo: string, contenido: Uint8Array): Promise<number> {
  await ejecutar("delete from fotos_en_espera where creado_en < datetime('now', '-1 day')");
  const r = await ejecutar("insert into fotos_en_espera (tipo, tamano, datos) values (?, ?, ?)", [tipo, contenido.byteLength, contenido]);
  return r.ultimoId;
}

export async function buscarFotoEnEspera(id: number): Promise<FotoEnEspera | null> {
  if (!id) return null;
  return fila<FotoEnEspera>("select id, tipo, tamano, datos, lectura from fotos_en_espera where id = ?", [id]);
}

export async function anotarLecturaDeFoto(id: number, lectura: string): Promise<void> {
  await ejecutar("update fotos_en_espera set lectura = ? where id = ?", [lectura, id]);
}

/** La foto pasa a ser un adjunto del cliente, unido a esa venta o a ese abono, y deja de estar en espera. */
export async function pasarFotoAAdjuntos(id: number, clienteId: number, ventaId: number | null, descripcion: string, pagoId: number | null = null): Promise<void> {
  await transaccion(async (tx) => {
    const r = await tx.execute({
      sql: `insert into adjuntos (cliente_id, venta_id, pago_id, descripcion, tipo, tamano, datos)
            select ?, ?, ?, ?, tipo, tamano, datos from fotos_en_espera where id = ?`,
      args: [clienteId, ventaId, pagoId, descripcion, id],
    });
    if (r.rowsAffected === 0) throw new Error("La foto de la nota ya no está: vuelve a hacerla.");
    await tx.execute({ sql: "delete from fotos_en_espera where id = ?", args: [id] });
  });
}

export async function olvidarFotoEnEspera(id: number): Promise<void> {
  await ejecutar("delete from fotos_en_espera where id = ?", [id]);
}
