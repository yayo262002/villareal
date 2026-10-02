import "server-only";
import { ejecutar, fila, filas } from "./db";
import { precioDeVenta } from "./dinero";
import type { Producto } from "./productos";

/**
 * Las variantes de un producto: las marcas o presentaciones en que se
 * vende (queso amarillo Kemmental y El Legado; pecorino Sortilegio y
 * Guaralac en bolsa de 500 g). Cada una tiene su costo, sus precios y su
 * foto; la web las enseña en la página del producto y publica «desde» la
 * más barata (`catalogo.ts`).
 */

export type Variante = {
  id: number;
  producto_id: number;
  /** «Kemmental», «Sortilegio 500 g». */
  nombre: string;
  /** Una línea: «Tipo Emmental, semiduro, madurado». */
  descripcion: string;
  costo_usd: number | null;
  precio_usd: number | null;
  precio_mayor_usd: number | null;
  activo: number;
  creado_en: string;
  /** Cuándo se puso la foto, o null si no tiene. Va en la dirección de la foto para que no se quede una vieja en caché. */
  foto_version: string | null;
};

export type DatosVariante = Pick<Variante, "nombre" | "descripcion" | "costo_usd" | "precio_usd" | "precio_mayor_usd">;

export type FotoDeVariante = { variante_id: number; tipo: string; tamano: number; datos: ArrayBuffer; actualizado_en: string };

export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
/** El teléfono reduce la foto antes de subirla; esto es por si no pudo. */
export const TAMANO_MAXIMO_DE_FOTO = 2 * 1024 * 1024;

const CONSULTA = `
  select v.*, f.actualizado_en as foto_version
  from variantes v
  left join fotos_variantes f on f.variante_id = v.id
`;

/** Todas, en el orden del panel: por producto y, dentro, por antigüedad. */
export async function listarVariantes(): Promise<Variante[]> {
  return filas<Variante>(`${CONSULTA} order by v.producto_id, v.id`);
}

export async function variantesDeProducto(productoId: number, soloActivas = false): Promise<Variante[]> {
  return filas<Variante>(`${CONSULTA} where v.producto_id = ? ${soloActivas ? "and v.activo = 1" : ""} order by v.id`, [productoId]);
}

export async function buscarVariante(id: number): Promise<Variante | null> {
  return fila<Variante>(`${CONSULTA} where v.id = ?`, [id]);
}

/** Las variantes de cada producto, para no consultar una vez por producto. */
export function agruparPorProducto(variantes: Variante[]): Map<number, Variante[]> {
  const porProducto = new Map<number, Variante[]>();
  for (const v of variantes) {
    const lista = porProducto.get(v.producto_id) ?? [];
    lista.push(v);
    porProducto.set(v.producto_id, lista);
  }
  return porProducto;
}

/**
 * Los precios de una variante salen de su costo con los márgenes del
 * producto, igual que los del producto; sin costo, vale el precio escrito.
 */
function resolver(datos: DatosVariante, producto: Producto): { detal: number | null; mayor: number | null } {
  return {
    detal: precioDeVenta(datos.costo_usd, producto.margen_pct) ?? datos.precio_usd,
    mayor: precioDeVenta(datos.costo_usd, producto.margen_mayor_pct) ?? datos.precio_mayor_usd,
  };
}

export async function crearVariante(producto: Producto, datos: DatosVariante): Promise<number> {
  const precios = resolver(datos, producto);
  const r = await ejecutar(
    "insert into variantes (producto_id, nombre, descripcion, costo_usd, precio_usd, precio_mayor_usd) values (?, ?, ?, ?, ?, ?)",
    [producto.id, datos.nombre, datos.descripcion, datos.costo_usd, precios.detal, precios.mayor],
  );
  return r.ultimoId;
}

export async function actualizarVariante(id: number, producto: Producto, datos: DatosVariante): Promise<void> {
  const precios = resolver(datos, producto);
  await ejecutar("update variantes set nombre = ?, descripcion = ?, costo_usd = ?, precio_usd = ?, precio_mayor_usd = ? where id = ?", [
    datos.nombre,
    datos.descripcion,
    datos.costo_usd,
    precios.detal,
    precios.mayor,
    id,
  ]);
}

export async function cambiarActivaVariante(id: number, activa: boolean): Promise<void> {
  await ejecutar("update variantes set activo = ? where id = ?", [activa ? 1 : 0, id]);
}

/**
 * Borra una variante que no se haya vendido nunca. Si tiene ventas, no:
 * las notas la nombran; se esconde en vez de borrarla.
 */
export async function eliminarVariante(id: number): Promise<"borrada" | "con_ventas" | "no_existe"> {
  const ventas = await fila<{ n: number }>("select count(*) as n from venta_lineas where variante_id = ?", [id]);
  if (Number(ventas?.n ?? 0) > 0) return "con_ventas";
  await ejecutar("delete from fotos_variantes where variante_id = ?", [id]);
  const r = await ejecutar("delete from variantes where id = ?", [id]);
  return r.cambios > 0 ? "borrada" : "no_existe";
}

export async function buscarFotoDeVariante(varianteId: number): Promise<FotoDeVariante | null> {
  return fila<FotoDeVariante>("select * from fotos_variantes where variante_id = ?", [varianteId]);
}

/** Pone o cambia la foto de una variante. */
export async function guardarFotoDeVariante(varianteId: number, tipo: string, datos: Uint8Array): Promise<void> {
  if (!(TIPOS_DE_FOTO as readonly string[]).includes(tipo)) throw new Error("La foto tiene que ser JPG, PNG o WebP.");
  if (datos.byteLength === 0) throw new Error("La foto está vacía.");
  if (datos.byteLength > TAMANO_MAXIMO_DE_FOTO) throw new Error("La foto pesa más de 2 MB. Elige una más pequeña.");
  await ejecutar(
    `insert into fotos_variantes (variante_id, tipo, tamano, datos, actualizado_en) values (?, ?, ?, ?, datetime('now'))
     on conflict (variante_id) do update set tipo = excluded.tipo, tamano = excluded.tamano, datos = excluded.datos, actualizado_en = datetime('now')`,
    [varianteId, tipo, datos.byteLength, datos],
  );
}

export async function quitarFotoDeVariante(varianteId: number): Promise<boolean> {
  const r = await ejecutar("delete from fotos_variantes where variante_id = ?", [varianteId]);
  return r.cambios > 0;
}

/** La dirección pública de la foto de una variante, o null si no tiene. */
export function direccionDeFotoDeVariante(variante: Pick<Variante, "id" | "foto_version">): string | null {
  if (!variante.foto_version) return null;
  return `/foto-variante/${variante.id}?v=${encodeURIComponent(variante.foto_version.replace(/\D/g, ""))}`;
}
