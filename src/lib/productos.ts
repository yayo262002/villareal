import "server-only";
import { ejecutar, fila, filas } from "./db";

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

export async function listarProductos(soloActivos = false): Promise<Producto[]> {
  const filtro = soloActivos ? "where activo = 1" : "";
  return filas<Producto>(`select * from productos ${filtro} order by nombre collate nocase`);
}

export async function buscarProducto(id: number): Promise<Producto | null> {
  return fila<Producto>("select * from productos where id = ?", [id]);
}

export async function crearProducto(nombre: string, unidad: Unidad, precio_usd: number | null): Promise<number> {
  const r = await ejecutar("insert into productos (nombre, unidad, precio_usd) values (?, ?, ?)", [
    nombre,
    unidad,
    precio_usd,
  ]);
  return r.ultimoId;
}

export async function actualizarPrecio(id: number, precio_usd: number | null): Promise<void> {
  await ejecutar("update productos set precio_usd = ? where id = ?", [precio_usd, id]);
}

export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await ejecutar("update productos set activo = ? where id = ?", [activo ? 1 : 0, id]);
}
