import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { precioDeVenta, type Unidad } from "./dinero";
import { normalizarFotoDeProducto } from "./foto-producto";
import type { EstadoProducto } from "./catalogo";

export type { Unidad };

/**
 * El negocio vende al mayor: cada producto tiene su precio de mayor, que
 * sale del costo más el margen del dueño, o se escribe a mano; y puede
 * tener también uno al detal. Cada producto tiene una familia principal y
 * puede salir en otras (`familias.ts`), y está en borrador, en la web u
 * oculto.
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
  /** Precio al detal en dólares, si también se vende suelto. null: no se vende al detal. */
  precio_detal_usd: number | null;
  /** Ventajas del producto, una por línea. La web las enseña como lista. */
  descripcion: string;
  activo: number;
  /** Un borrador no se publica ni se vende hasta que el dueño lo completa y lo activa. */
  borrador: number;
  familia_id: number | null;
  /** La marca, si es una sola; si tiene varias, son sus variantes. */
  marca: string;
  /** «Bolsa», «Caja», «Galón». */
  presentacion: string;
  /** «2,5 kg», «12 unidades». */
  contenido: string;
  destacado: number;
  en_oferta: number;
  creado_en: string;
  /** Cuándo se puso la foto principal, o null si no tiene (entonces va el dibujo). */
  foto_version: string | null;
};

export type PreciosProducto = Pick<Producto, "costo_usd" | "margen_pct" | "precio_usd">;

export type DatosProducto = PreciosProducto & {
  nombre: string;
  unidad: Unidad;
  descripcion: string;
  familia_id: number | null;
  marca: string;
  presentacion: string;
  contenido: string;
  precio_detal_usd: number | null;
  destacado: boolean;
  en_oferta: boolean;
};

const CONSULTA = `
  select p.*, f.actualizado_en as foto_version
  from productos p
  left join fotos_productos f on f.producto_id = p.id
`;

/**
 * De la fila de la base solo se toma lo que se usa: las columnas del precio
 * al detal de antes (`precio_mayor_usd`, `margen_mayor_pct`) se quedan en
 * la tabla, pero fuera del producto.
 */
function completar(p: Producto): Producto {
  return {
    id: p.id,
    nombre: p.nombre,
    unidad: p.unidad,
    costo_usd: p.costo_usd ?? null,
    margen_pct: p.margen_pct ?? null,
    precio_usd: p.precio_usd ?? null,
    precio_detal_usd: p.precio_detal_usd ?? null,
    descripcion: p.descripcion ?? "",
    activo: Number(p.activo),
    borrador: Number(p.borrador ?? 0),
    familia_id: p.familia_id ?? null,
    marca: p.marca ?? "",
    presentacion: p.presentacion ?? "",
    contenido: p.contenido ?? "",
    destacado: Number(p.destacado ?? 0),
    en_oferta: Number(p.en_oferta ?? 0),
    creado_en: p.creado_en,
    foto_version: p.foto_version ?? null,
  };
}

/** Los activos son los publicados en la web; los borradores y los ocultos no lo están. */
export async function listarProductos(soloActivos = false): Promise<Producto[]> {
  const filtro = soloActivos ? "where p.activo = 1" : "";
  return (await filas<Producto>(`${CONSULTA} ${filtro} order by p.id`)).map(completar);
}

export async function buscarProducto(id: number): Promise<Producto | null> {
  const p = await fila<Producto>(`${CONSULTA} where p.id = ?`, [id]);
  return p ? completar(p) : null;
}

/**
 * El precio de venta sale del costo y el margen cuando están los dos; si
 * no, se acepta el precio escrito a mano (o ninguno).
 */
export function resolverPrecio(d: PreciosProducto): number | null {
  return precioDeVenta(d.costo_usd, d.margen_pct) ?? d.precio_usd;
}

function columnasDeEstado(estado: EstadoProducto): { activo: number; borrador: number } {
  return { activo: estado === "activo" ? 1 : 0, borrador: estado === "borrador" ? 1 : 0 };
}

export async function crearProducto(datos: DatosProducto, estado: EstadoProducto = "activo"): Promise<number> {
  const { activo, borrador } = columnasDeEstado(estado);
  const r = await ejecutar(
    `insert into productos (nombre, unidad, costo_usd, margen_pct, precio_usd, descripcion, familia_id, marca, presentacion, contenido,
                            precio_detal_usd, destacado, en_oferta, activo, borrador)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre,
      datos.unidad,
      datos.costo_usd,
      datos.margen_pct,
      resolverPrecio(datos),
      datos.descripcion,
      datos.familia_id,
      datos.marca,
      datos.presentacion,
      datos.contenido,
      datos.precio_detal_usd,
      datos.destacado ? 1 : 0,
      datos.en_oferta ? 1 : 0,
      activo,
      borrador,
    ],
  );
  return r.ultimoId;
}

export async function actualizarProducto(id: number, datos: DatosProducto): Promise<void> {
  await ejecutar(
    `update productos
     set nombre = ?, unidad = ?, costo_usd = ?, margen_pct = ?, precio_usd = ?, descripcion = ?, familia_id = ?, marca = ?,
         presentacion = ?, contenido = ?, precio_detal_usd = ?, destacado = ?, en_oferta = ?
     where id = ?`,
    [
      datos.nombre,
      datos.unidad,
      datos.costo_usd,
      datos.margen_pct,
      resolverPrecio(datos),
      datos.descripcion,
      datos.familia_id,
      datos.marca,
      datos.presentacion,
      datos.contenido,
      datos.precio_detal_usd,
      datos.destacado ? 1 : 0,
      datos.en_oferta ? 1 : 0,
      id,
    ],
  );
}

/** Publicar (o volver a publicar) quita el borrador: un producto en la web ya no es un borrador. */
export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await ejecutar("update productos set activo = ?, borrador = 0 where id = ?", [activo ? 1 : 0, id]);
}

export async function ponerEstado(id: number, estado: EstadoProducto): Promise<void> {
  const { activo, borrador } = columnasDeEstado(estado);
  await ejecutar("update productos set activo = ?, borrador = ? where id = ?", [activo, borrador, id]);
}

// ---------- Las otras familias en que sale ----------

/** Las otras familias en que sale un producto (no la principal). */
export async function categoriasDeProducto(productoId: number): Promise<number[]> {
  const lista = await filas<{ familia_id: number }>("select familia_id from producto_categorias where producto_id = ? order by familia_id", [productoId]);
  return lista.map((f) => Number(f.familia_id));
}

/** Las de todos los productos: id del producto → ids de sus otras familias. */
export async function categoriasDeTodos(): Promise<Map<number, number[]>> {
  const lista = await filas<{ producto_id: number; familia_id: number }>("select producto_id, familia_id from producto_categorias order by producto_id, familia_id");
  const mapa = new Map<number, number[]>();
  for (const f of lista) mapa.set(Number(f.producto_id), [...(mapa.get(Number(f.producto_id)) ?? []), Number(f.familia_id)]);
  return mapa;
}

/** Pone las otras familias de un producto; la principal no se repite entre ellas. */
export async function ponerCategorias(productoId: number, familias: number[], principal: number | null): Promise<void> {
  const sinRepetir = [...new Set(familias)].filter((f) => f > 0 && f !== principal);
  await transaccion(async (tx) => {
    await tx.execute({ sql: "delete from producto_categorias where producto_id = ?", args: [productoId] });
    for (const familia of sinRepetir) {
      await tx.execute({ sql: "insert or ignore into producto_categorias (producto_id, familia_id) values (?, ?)", args: [productoId, familia] });
    }
  });
}

// ---------- La foto principal ----------

export type FotoDeProducto = { producto_id: number; tipo: string; tamano: number; datos: ArrayBuffer; actualizado_en: string };

const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"];
/** El teléfono reduce la foto antes de subirla; esto es por si no pudo. */
const TAMANO_MAXIMO_DE_FOTO = 2 * 1024 * 1024;

export async function buscarFotoDeProducto(productoId: number): Promise<FotoDeProducto | null> {
  return fila<FotoDeProducto>("select * from fotos_productos where producto_id = ?", [productoId]);
}

/** Pone o cambia la foto principal: cuadrada, con el producto llenándola, como la de las marcas (`foto-producto.ts`). */
export async function guardarFotoDeProducto(productoId: number, tipoOriginal: string, original: Uint8Array): Promise<void> {
  if (!TIPOS_DE_FOTO.includes(tipoOriginal)) throw new Error("La foto tiene que ser JPG, PNG o WebP.");
  if (original.byteLength === 0) throw new Error("La foto está vacía.");
  if (original.byteLength > TAMANO_MAXIMO_DE_FOTO) throw new Error("La foto pesa más de 2 MB. Elige una más pequeña.");
  const { datos, tipo } = await normalizarFotoDeProducto(original, tipoOriginal);
  await ejecutar(
    `insert into fotos_productos (producto_id, tipo, tamano, datos, actualizado_en) values (?, ?, ?, ?, datetime('now'))
     on conflict (producto_id) do update set tipo = excluded.tipo, tamano = excluded.tamano, datos = excluded.datos, actualizado_en = datetime('now')`,
    [productoId, tipo, datos.byteLength, datos],
  );
}

export async function quitarFotoDeProducto(productoId: number): Promise<boolean> {
  const r = await ejecutar("delete from fotos_productos where producto_id = ?", [productoId]);
  return r.cambios > 0;
}

/** La dirección pública de la foto principal, o null si no tiene (entonces va el dibujo). */
export function direccionDeFotoDeProducto(producto: Pick<Producto, "id" | "foto_version">): string | null {
  if (!producto.foto_version) return null;
  return `/foto-producto/${producto.id}?v=${encodeURIComponent(producto.foto_version.replace(/\D/g, ""))}`;
}

// ---------- Borrar ----------

/** Lo que cuelga de un producto: para decirlo antes de borrarlo. */
export type LoQueTieneElProducto = {
  ventas: number;
  compras: number;
  ajustes: number;
  resenas: number;
  variantes: number;
  ofertas: number;
};

export async function loQueTieneElProducto(id: number): Promise<LoQueTieneElProducto> {
  const f = await fila<Record<keyof LoQueTieneElProducto, number>>(
    `select
       (select count(*) from venta_lineas where producto_id = ?) as ventas,
       (select count(*) from compra_lineas where producto_id = ?) as compras,
       (select count(*) from inventario_ajustes where producto_id = ?) as ajustes,
       (select count(*) from resenas where producto_id = ? and de_ejemplo = 0) as resenas,
       (select count(*) from variantes where producto_id = ?) as variantes,
       (select count(*) from oferta_productos where producto_id = ?) as ofertas`,
    [id, id, id, id, id, id],
  );
  return {
    ventas: Number(f?.ventas ?? 0),
    compras: Number(f?.compras ?? 0),
    ajustes: Number(f?.ajustes ?? 0),
    resenas: Number(f?.resenas ?? 0),
    variantes: Number(f?.variantes ?? 0),
    ofertas: Number(f?.ofertas ?? 0),
  };
}

/** Si ya se vendió, se compró o se contó, el producto no se borra: las notas y el inventario lo nombran. Se esconde. */
export function sePuedeBorrar(t: LoQueTieneElProducto): boolean {
  return t.ventas === 0 && t.compras === 0 && t.ajustes === 0;
}

/**
 * Borra un producto que nunca se vendió, compró ni contó, con sus marcas,
 * sus fotos, sus reseñas, sus categorías y su sitio en las ofertas. Todo o
 * nada. Las tablas hijas se limpian a mano: en Turso no se puede contar con
 * las claves foráneas en cascada.
 */
export async function eliminarProducto(id: number): Promise<"borrado" | "con_movimientos" | "no_existe"> {
  if (!(await buscarProducto(id))) return "no_existe";
  if (!sePuedeBorrar(await loQueTieneElProducto(id))) return "con_movimientos";
  await transaccion(async (tx) => {
    await tx.execute({ sql: "delete from fotos_variantes where variante_id in (select id from variantes where producto_id = ?)", args: [id] });
    await tx.execute({ sql: "delete from fotos_resenas where resena_id in (select id from resenas where producto_id = ?)", args: [id] });
    for (const tabla of ["resenas", "variantes", "producto_categorias", "oferta_productos", "fotos_productos"]) {
      await tx.execute({ sql: `delete from ${tabla} where producto_id = ?`, args: [id] });
    }
    await tx.execute({ sql: "delete from productos where id = ?", args: [id] });
  });
  return "borrado";
}
