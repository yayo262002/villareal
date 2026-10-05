import "server-only";
import { filas, transaccion } from "./db";
import { BORRADORES, OFERTAS_INICIALES, mismoNombre } from "./catalogo-inicial";

/**
 * Prepara el catálogo que pidió el dueño: crea en borrador los productos
 * de `catalogo-inicial.ts` que falten (sin precio, sin marca, sin publicar)
 * con su familia y las otras en que salen, y los combos de ofertas, también
 * en borrador y sin precio. Lo que ya existe, con ese nombre o casi (sin
 * tildes ni mayúsculas), no se toca ni se duplica: pulsarlo dos veces no
 * hace nada la segunda.
 */
export async function prepararCatalogoInicial(): Promise<{ productos: number; ofertas: number }> {
  const [familias, productos, ofertas] = await Promise.all([
    filas<{ id: number; slug: string }>("select id, slug from familias"),
    filas<{ id: number; nombre: string }>("select id, nombre from productos"),
    filas<{ nombre: string }>("select nombre from ofertas"),
  ]);
  const familia = new Map(familias.map((f) => [f.slug, Number(f.id)]));
  const faltan = BORRADORES.filter((b) => !productos.some((p) => mismoNombre(p.nombre, b.nombre)) && familia.has(b.familia));
  const combos = OFERTAS_INICIALES.filter((o) => !ofertas.some((x) => mismoNombre(x.nombre, o.nombre)));

  return transaccion(async (tx) => {
    const creados = [...productos.map((p) => ({ id: Number(p.id), nombre: p.nombre }))];
    for (const b of faltan) {
      const r = await tx.execute({
        sql: "insert into productos (nombre, unidad, descripcion, familia_id, activo, borrador, seccion) values (?, ?, '', ?, 0, 1, ?) returning id",
        args: [b.nombre, b.unidad, familia.get(b.familia)!, b.seccion ?? ""],
      });
      const id = Number(r.rows[0].id);
      creados.push({ id, nombre: b.nombre });
      for (const slug of b.relacionadas) {
        const otra = familia.get(slug);
        if (otra) {
          await tx.execute({
            sql: "insert or ignore into producto_categorias (producto_id, familia_id, seccion) values (?, ?, ?)",
            args: [id, otra, b.secciones?.[slug] ?? ""],
          });
        }
      }
    }
    for (const [i, o] of combos.entries()) {
      const r = await tx.execute({
        sql: "insert into ofertas (nombre, descripcion, estado, orden) values (?, ?, 'borrador', ?) returning id",
        args: [o.nombre, o.descripcion, i + 1],
      });
      const id = Number(r.rows[0].id);
      for (const nombre of o.productos) {
        const producto = creados.find((p) => mismoNombre(p.nombre, nombre));
        if (producto) await tx.execute({ sql: "insert or ignore into oferta_productos (oferta_id, producto_id) values (?, ?)", args: [id, producto.id] });
      }
    }
    return { productos: faltan.length, ofertas: combos.length };
  });
}

/** Cuántos productos y combos del catálogo inicial faltan por preparar. */
export async function faltanPorPreparar(): Promise<{ productos: number; ofertas: number }> {
  const [productos, ofertas] = await Promise.all([filas<{ nombre: string }>("select nombre from productos"), filas<{ nombre: string }>("select nombre from ofertas")]);
  return {
    productos: BORRADORES.filter((b) => !productos.some((p) => mismoNombre(p.nombre, b.nombre))).length,
    ofertas: OFERTAS_INICIALES.filter((o) => !ofertas.some((x) => mismoNombre(x.nombre, o.nombre))).length,
  };
}
