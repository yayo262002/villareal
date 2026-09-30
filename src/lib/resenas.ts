import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { ejemplosPara, type DatosResena } from "./resenas-texto";

/**
 * Las reseñas de cada producto, en la base. Una reseña tiene dos marcas:
 *
 * - `publicada`: el dueño la puede esconder sin borrarla.
 * - `de_ejemplo`: la puso el botón «Poner reseñas de ejemplo» para ver cómo
 *   queda la página. Esas nunca se enseñan al público, ni publicadas.
 */

export type Resena = DatosResena & {
  id: number;
  producto_id: number;
  producto_nombre: string;
  de_ejemplo: number;
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
 * Las que enseña la página de un producto. Al público, las publicadas que
 * no son de ejemplo. Al dueño con la sesión abierta, también las de ejemplo.
 */
export async function resenasDeProducto(productoId: number, conLasDeEjemplo: boolean): Promise<Resena[]> {
  const filtro = conLasDeEjemplo ? "" : "and r.de_ejemplo = 0";
  return filas<Resena>(
    `${CONSULTA_RESENAS}
     where r.producto_id = ? and r.publicada = 1 ${filtro}
     order by r.de_ejemplo, r.id desc`,
    [productoId],
  );
}

export async function buscarResena(id: number): Promise<Resena | null> {
  return fila<Resena>(`${CONSULTA_RESENAS} where r.id = ?`, [id]);
}

export async function crearResena(productoId: number, datos: DatosResena, publicada = true): Promise<number> {
  const r = await ejecutar(
    "insert into resenas (producto_id, autor, detalle, texto, publicada) values (?, ?, ?, ?, ?)",
    [productoId, datos.autor, datos.detalle, datos.texto, publicada ? 1 : 0],
  );
  return r.ultimoId;
}

export async function cambiarPublicada(id: number, publicada: boolean): Promise<boolean> {
  const r = await ejecutar("update resenas set publicada = ? where id = ?", [publicada ? 1 : 0, id]);
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
