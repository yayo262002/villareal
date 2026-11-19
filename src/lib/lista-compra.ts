import "server-only";
import { ejecutar, filas } from "./db";
import type { ArticuloDeCompra, TipoDeCompra } from "./lista-compra-calculo";

/** La lista de compra desde la base (tabla `lista_compra`); las cuentas, en `lista-compra-calculo.ts`. */

type Fila = Omit<ArticuloDeCompra, "listo"> & { listo: number };

export async function listarCompra(): Promise<ArticuloDeCompra[]> {
  const lista = await filas<Fila>("select id, nombre, categoria, donde, precio_usd, nota, listo, orden from lista_compra order by orden, id");
  return lista.map((f) => ({
    id: Number(f.id),
    nombre: String(f.nombre),
    categoria: String(f.categoria),
    donde: String(f.donde),
    precio_usd: f.precio_usd === null ? null : Number(f.precio_usd),
    nota: String(f.nota),
    listo: Number(f.listo) === 1,
    orden: Number(f.orden),
  }));
}

/** Lo nuevo va al final de su tipo. */
export async function agregarACompra(a: { nombre: string; categoria: TipoDeCompra; donde: string; precio_usd: number | null; nota: string }): Promise<number> {
  const r = await ejecutar(
    "insert into lista_compra (nombre, categoria, donde, precio_usd, nota, orden) values (?, ?, ?, ?, ?, (select coalesce(max(orden), 0) + 1 from lista_compra))",
    [a.nombre, a.categoria, a.donde, a.precio_usd, a.nota],
  );
  return r.ultimoId;
}

/** Tacha lo que falta o destacha lo tachado. Devuelve cómo quedó, o null si ya no está. */
export async function alternarEnCompra(id: number): Promise<boolean | null> {
  const r = await ejecutar("update lista_compra set listo = 1 - listo where id = ?", [id]);
  if (r.cambios === 0) return null;
  const [f] = await filas<{ listo: number }>("select listo from lista_compra where id = ?", [id]);
  return f ? Number(f.listo) === 1 : null;
}

export async function quitarDeCompra(id: number): Promise<boolean> {
  return (await ejecutar("delete from lista_compra where id = ?", [id])).cambios > 0;
}

/** Todo como nuevo, para la próxima compra. Devuelve cuántos había tachados. */
export async function destacharCompra(): Promise<number> {
  return (await ejecutar("update lista_compra set listo = 0 where listo = 1")).cambios;
}
