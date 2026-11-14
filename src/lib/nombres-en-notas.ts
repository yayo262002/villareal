import "server-only";
import { ejecutar, filas } from "./db";
import { claveDeNombre, type NombreAprendido } from "./cliente-de-la-nota";

/**
 * Cómo se escribe a cada cliente en las notas de papel. Cada venta guardada
 * con la foto de su nota leída enseña lo que dice la nota en «Señor(es)»:
 * si «Nelson» fue la Pizzería NEL's, la próxima nota con «Nelson» ya sabe
 * de quién es (la caja lo propone y lo pregunta; `cliente-de-la-nota.ts`).
 */

export async function nombresAprendidos(): Promise<NombreAprendido[]> {
  return filas<NombreAprendido>(
    `select n.nombre, n.cliente_id, n.veces from nombres_en_notas n join clientes c on c.id = n.cliente_id
      order by n.veces desc, n.ultima_vez desc limit 2000`,
  );
}

/** Lo aprendido de un cliente, para cotejar con él la nota al guardar. */
export async function nombresAprendidosDe(clienteId: number): Promise<NombreAprendido[]> {
  return filas<NombreAprendido>("select nombre, cliente_id, veces from nombres_en_notas where cliente_id = ?", [clienteId]);
}

/** Lo que decía la nota de una venta ya guardada es de su cliente. Nunca frena la venta: si falla, no pasa nada. */
export async function aprenderNombreDeNota(escrito: string | null | undefined, clienteId: number): Promise<void> {
  const nombre = claveDeNombre(escrito ?? "");
  if (!nombre || !clienteId) return;
  try {
    await ejecutar(
      `insert into nombres_en_notas (nombre, cliente_id) values (?, ?)
       on conflict (nombre, cliente_id) do update set veces = veces + 1, ultima_vez = datetime('now')`,
      [nombre, clienteId],
    );
  } catch (error) {
    console.error("No se pudo aprender el nombre de la nota:", error instanceof Error ? error.message : error);
  }
}
