import "server-only";
import { db } from "./db";

export type Unidad = "kg" | "unidad";

export type Producto = {
  id: number;
  nombre: string;
  unidad: Unidad;
  /** null significa «precio pendiente»: la web no lo muestra y el panel lo avisa. */
  precio_usd: number | null;
  activo: number;
  creado_en: string;
};

export function listarProductos(soloActivos = false): Producto[] {
  const filtro = soloActivos ? "where activo = 1" : "";
  return db()
    .prepare(`select * from productos ${filtro} order by nombre collate nocase`)
    .all() as Producto[];
}

export function buscarProducto(id: number): Producto | null {
  return (db().prepare("select * from productos where id = ?").get(id) as Producto | undefined) ?? null;
}

export function crearProducto(nombre: string, unidad: Unidad, precio_usd: number | null): number {
  const resultado = db()
    .prepare("insert into productos (nombre, unidad, precio_usd) values (?, ?, ?)")
    .run(nombre, unidad, precio_usd);
  return Number(resultado.lastInsertRowid);
}

export function actualizarPrecio(id: number, precio_usd: number | null): void {
  db().prepare("update productos set precio_usd = ? where id = ?").run(precio_usd, id);
}

export function cambiarActivo(id: number, activo: boolean): void {
  db().prepare("update productos set activo = ? where id = ?").run(activo ? 1 : 0, id);
}
