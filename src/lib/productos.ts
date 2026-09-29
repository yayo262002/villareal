import "server-only";
import { ejecutar, fila, filas } from "./db";
import { precioDeVenta, type Unidad } from "./dinero";

export type { Unidad };

export type Producto = {
  id: number;
  nombre: string;
  unidad: Unidad;
  /** Lo que le cuesta al negocio, en dólares. null si no se ha puesto. */
  costo_usd: number | null;
  /** El porcentaje que le suma el dueño. null si no se ha puesto. */
  margen_pct: number | null;
  /** Precio de venta en dólares. null significa «precio pendiente»: la web no lo muestra. */
  precio_usd: number | null;
  /** Ventajas del producto, una por línea. La web las enseña como lista. */
  descripcion: string;
  activo: number;
  creado_en: string;
};

export type DatosProducto = {
  nombre: string;
  unidad: Unidad;
  costo_usd: number | null;
  margen_pct: number | null;
  precio_usd: number | null;
  descripcion: string;
};

export async function listarProductos(soloActivos = false): Promise<Producto[]> {
  const filtro = soloActivos ? "where activo = 1" : "";
  return filas<Producto>(`select * from productos ${filtro} order by id`);
}

export async function buscarProducto(id: number): Promise<Producto | null> {
  return fila<Producto>("select * from productos where id = ?", [id]);
}

/**
 * El precio de venta sale del costo y el margen cuando están los dos; si
 * no, se acepta el precio escrito a mano (o ninguno).
 */
function resolverPrecio(d: Pick<DatosProducto, "costo_usd" | "margen_pct" | "precio_usd">): number | null {
  return precioDeVenta(d.costo_usd, d.margen_pct) ?? d.precio_usd;
}

export async function crearProducto(datos: DatosProducto): Promise<number> {
  const r = await ejecutar(
    `insert into productos (nombre, unidad, costo_usd, margen_pct, precio_usd, descripcion)
     values (?, ?, ?, ?, ?, ?)`,
    [datos.nombre, datos.unidad, datos.costo_usd, datos.margen_pct, resolverPrecio(datos), datos.descripcion],
  );
  return r.ultimoId;
}

export async function actualizarProducto(id: number, datos: DatosProducto): Promise<void> {
  await ejecutar(
    `update productos
     set nombre = ?, unidad = ?, costo_usd = ?, margen_pct = ?, precio_usd = ?, descripcion = ?
     where id = ?`,
    [datos.nombre, datos.unidad, datos.costo_usd, datos.margen_pct, resolverPrecio(datos), datos.descripcion, id],
  );
}


export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await ejecutar("update productos set activo = ? where id = ?", [activo ? 1 : 0, id]);
}
