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
  /** El porcentaje que le suma el dueño al detal. null si no se ha puesto. */
  margen_pct: number | null;
  /** Precio de venta al detal en dólares. null significa «precio pendiente»: la web no lo muestra. */
  precio_usd: number | null;
  /** El porcentaje que le suma el dueño al mayor. */
  margen_mayor_pct: number | null;
  /** Precio de venta al mayor en dólares. null si el producto no tiene precio al mayor. */
  precio_mayor_usd: number | null;
  /** Ventajas del producto, una por línea. La web las enseña como lista. */
  descripcion: string;
  activo: number;
  creado_en: string;
};

export type PreciosProducto = Pick<
  Producto,
  "costo_usd" | "margen_pct" | "precio_usd" | "margen_mayor_pct" | "precio_mayor_usd"
>;

export type DatosProducto = PreciosProducto & {
  nombre: string;
  unidad: Unidad;
  descripcion: string;
};

/** Las filas de una base recién migrada pueden no traer las columnas nuevas: se leen como null. */
function completar(p: Producto): Producto {
  return {
    ...p,
    margen_mayor_pct: p.margen_mayor_pct ?? null,
    precio_mayor_usd: p.precio_mayor_usd ?? null,
    descripcion: p.descripcion ?? "",
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
 * Cada precio de venta sale del costo y su margen cuando están los dos; si
 * no, se acepta el precio escrito a mano (o ninguno).
 */
function resolver(d: PreciosProducto): { detal: number | null; mayor: number | null } {
  return {
    detal: precioDeVenta(d.costo_usd, d.margen_pct) ?? d.precio_usd,
    mayor: precioDeVenta(d.costo_usd, d.margen_mayor_pct) ?? d.precio_mayor_usd,
  };
}

export async function crearProducto(datos: DatosProducto): Promise<number> {
  const precios = resolver(datos);
  const r = await ejecutar(
    `insert into productos
       (nombre, unidad, costo_usd, margen_pct, precio_usd, margen_mayor_pct, precio_mayor_usd, descripcion)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre,
      datos.unidad,
      datos.costo_usd,
      datos.margen_pct,
      precios.detal,
      datos.margen_mayor_pct,
      precios.mayor,
      datos.descripcion,
    ],
  );
  return r.ultimoId;
}

export async function actualizarProducto(id: number, datos: DatosProducto): Promise<void> {
  const precios = resolver(datos);
  await ejecutar(
    `update productos
     set nombre = ?, unidad = ?, costo_usd = ?, margen_pct = ?, precio_usd = ?,
         margen_mayor_pct = ?, precio_mayor_usd = ?, descripcion = ?
     where id = ?`,
    [
      datos.nombre,
      datos.unidad,
      datos.costo_usd,
      datos.margen_pct,
      precios.detal,
      datos.margen_mayor_pct,
      precios.mayor,
      datos.descripcion,
      id,
    ],
  );
}

export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await ejecutar("update productos set activo = ? where id = ?", [activo ? 1 : 0, id]);
}
