import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { ejemplosPara, type DatosResena } from "./resenas-texto";

/**
 * Las reseñas de cada producto, en la base. Una reseña tiene tres marcas:
 *
 * - `con_permiso`: el cliente dijo que se puede publicar con su nombre. Sin
 *   permiso no sale en la web, aunque esté marcada como publicada.
 * - `publicada`: el dueño la puede esconder sin borrarla.
 * - `de_ejemplo`: la puso el botón «Poner reseñas de ejemplo» para ver cómo
 *   queda la página. Esas nunca se enseñan al público.
 */

export type Resena = DatosResena & {
  id: number;
  producto_id: number;
  producto_nombre: string;
  de_ejemplo: number;
  con_permiso: number;
  publicada: number;
  creado_en: string;
};

const CONSULTA_RESENAS = `
  select r.*, p.nombre as producto_nombre
  from resenas r
  join productos p on p.id = r.producto_id
`;

/** Todas, para el panel: por producto y, dentro, de la más nueva a la más vieja. */
export async function listarResenas(): Promise<Resena[]> {
  return filas<Resena>(`${CONSULTA_RESENAS} order by r.producto_id, r.id desc`);
}

/**
 * Las que enseña la página de un producto. Al público, las del dueño que
 * están publicadas y tienen el permiso del cliente. Al dueño con la sesión
 * abierta, además, las de ejemplo.
 */
export async function resenasDeProducto(productoId: number, conLasDeEjemplo: boolean): Promise<Resena[]> {
  const deEjemplo = conLasDeEjemplo ? "or r.de_ejemplo = 1" : "";
  return filas<Resena>(
    `${CONSULTA_RESENAS}
     where r.producto_id = ? and r.publicada = 1
       and ((r.de_ejemplo = 0 and r.con_permiso = 1) ${deEjemplo})
     order by r.de_ejemplo, r.id desc`,
    [productoId],
  );
}

export async function buscarResena(id: number): Promise<Resena | null> {
  return fila<Resena>(`${CONSULTA_RESENAS} where r.id = ?`, [id]);
}

/** Con permiso se publica en el momento; sin él se guarda escondida hasta tenerlo. */
export async function crearResena(productoId: number, datos: DatosResena, conPermiso: boolean): Promise<number> {
  const r = await ejecutar(
    "insert into resenas (producto_id, autor, detalle, texto, con_permiso, publicada) values (?, ?, ?, ?, ?, ?)",
    [productoId, datos.autor, datos.detalle, datos.texto, conPermiso ? 1 : 0, conPermiso ? 1 : 0],
  );
  return r.ultimoId;
}

/** Publica una reseña. Publicar es decir que el cliente dio su permiso: queda anotado. */
export async function publicarResena(id: number): Promise<boolean> {
  const r = await ejecutar("update resenas set publicada = 1, con_permiso = 1 where id = ? and de_ejemplo = 0", [id]);
  return r.cambios > 0;
}

/** La quita de la web sin borrarla. El permiso que hubiera se conserva. */
export async function esconderResena(id: number): Promise<boolean> {
  const r = await ejecutar("update resenas set publicada = 0 where id = ?", [id]);
  return r.cambios > 0;
}

export async function eliminarResena(id: number): Promise<boolean> {
  const r = await ejecutar("delete from resenas where id = ?", [id]);
  return r.cambios > 0;
}

export async function contarResenasDeEjemplo(): Promise<number> {
  const f = await fila<{ n: number }>("select count(*) as n from resenas where de_ejemplo = 1");
  return Number(f?.n ?? 0);
}

/**
 * Pone las reseñas de ejemplo de cada producto publicado. Primero quita las
 * que hubiera, así pulsar el botón dos veces no las duplica. Devuelve
 * cuántas puso.
 */
export async function ponerResenasDeEjemplo(): Promise<number> {
  const productos = await filas<{ id: number; nombre: string }>("select id, nombre from productos where activo = 1 order by id");
  return transaccion(async (tx) => {
    await tx.execute("delete from resenas where de_ejemplo = 1");
    let puestas = 0;
    for (const producto of productos) {
      for (const ejemplo of ejemplosPara(producto.nombre)) {
        await tx.execute({
          sql: "insert into resenas (producto_id, autor, detalle, texto, de_ejemplo) values (?, ?, ?, ?, 1)",
          args: [producto.id, ejemplo.autor, ejemplo.detalle, ejemplo.texto],
        });
        puestas++;
      }
    }
    return puestas;
  });
}

/** Quita todas las de ejemplo. Las del dueño no se tocan. */
export async function quitarResenasDeEjemplo(): Promise<number> {
  const r = await ejecutar("delete from resenas where de_ejemplo = 1");
  return r.cambios;
}
