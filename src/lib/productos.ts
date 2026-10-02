import "server-only";
import { ejecutar, fila, filas } from "./db";
import { precioDeVenta, type Unidad } from "./dinero";

export type { Unidad };

/**
 * El negocio vende solo al mayor, así que cada producto tiene un precio:
 * el de mayor. Sale del costo más el margen del dueño, o se escribe a mano.
 */
export type Producto = {
  id: number;
  nombre: string;
  unidad: Unidad;
  /** Lo que le cuesta al negocio, en dólares. null si no se ha puesto. */
  costo_usd: number | null;
  /** El porcentaje que le suma el dueño. null si no se ha puesto. */
  margen_pct: number | null;
  /** Precio de venta al mayor en dólares. null significa «precio pendiente»: la web no lo muestra. */
  precio_usd: number | null;
  /** Ventajas del producto, una por línea. La web las enseña como lista. */
  descripcion: string;
  activo: number;
  creado_en: string;
};

export type PreciosProducto = Pick<Producto, "costo_usd" | "margen_pct" | "precio_usd">;

export type DatosProducto = PreciosProducto & {
  nombre: string;
  unidad: Unidad;
  descripcion: string;
};

/**
 * De la fila de la base solo se toma lo que se usa: las columnas del precio
 * al detal de antes se quedan en la tabla, pero fuera del producto.
 */
function completar(p: Producto): Producto {
  return {
    id: p.id,
    nombre: p.nombre,
    unidad: p.unidad,
    costo_usd: p.costo_usd ?? null,
    margen_pct: p.margen_pct ?? null,
    precio_usd: p.precio_usd ?? null,
    descripcion: p.descripcion ?? "",
    activo: p.activo,
    creado_en: p.creado_en,
  };
}

export async function listarProductos(soloActivos = false): Promise<Producto[]> {
  const filtro = soloActivos ? "where activo = 1" : "";
  return (await filas<Producto>(`select * from productos ${filtro} order by id`)).map(completar);
}

export async function buscarProducto(id: number): Promise<Producto | null> {
  const p = await fila<Producto>("select * from productos where id = ?", [id]);
  return p ? completar(p) : null;
}

/**
 * El precio de venta sale del costo y el margen cuando están los dos; si
 * no, se acepta el precio escrito a mano (o ninguno).
 */
export function resolverPrecio(d: PreciosProducto): number | null {
  return precioDeVenta(d.costo_usd, d.margen_pct) ?? d.precio_usd;
}

export async function crearProducto(datos: DatosProducto): Promise<number> {
  const r = await ejecutar(
    "insert into productos (nombre, unidad, costo_usd, margen_pct, precio_usd, descripcion) values (?, ?, ?, ?, ?, ?)",
    [datos.nombre, datos.unidad, datos.costo_usd, datos.margen_pct, resolverPrecio(datos), datos.descripcion],
  );
  return r.ultimoId;
}

export async function actualizarProducto(id: number, datos: DatosProducto): Promise<void> {
  await ejecutar(
    "update productos set nombre = ?, unidad = ?, costo_usd = ?, margen_pct = ?, precio_usd = ?, descripcion = ? where id = ?",
    [datos.nombre, datos.unidad, datos.costo_usd, datos.margen_pct, resolverPrecio(datos), datos.descripcion, id],
  );
}

export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await ejecutar("update productos set activo = ? where id = ?", [activo ? 1 : 0, id]);
}
