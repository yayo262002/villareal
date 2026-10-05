import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { hoy, precioDeVenta } from "./dinero";
import type { Producto } from "./productos";
import { normalizarFotoDeProducto } from "./foto-producto";
import { limpiarTexto, nombreDeArticulo } from "./marcas-texto";

/**
 * Los artículos de un tipo de producto (en la base, «variantes»): cada
 * marca y presentación en que se vende (queso amarillo Kemmental y El
 * Legado; pecorino Sortilegio y Guaralac en bolsa de 500 g). Cada uno tiene
 * su marca (`marcas.ts`), su presentación, su contenido, su costo, su
 * precio al mayor y su foto; la web los enseña en la página del tipo y
 * publica «desde» el más barato (`catalogo.ts`).
 */

export type Variante = {
  id: number;
  producto_id: number;
  /** Como lo dicen las notas detrás del tipo: «Kemmental», «Sortilegio 500 g». Sale de la marca, la presentación y el contenido. */
  nombre: string;
  /** La marca, o null si el artículo no la lleva (una presentación sola). */
  marca_id: number | null;
  /** El nombre de la marca, o "" sin marca. */
  marca: string;
  /** «Bolsa», «Bloque», «Cartón». */
  presentacion: string;
  /** «500 g», «1 kg», «30 unidades». */
  contenido: string;
  /** Una línea: «Tipo Emmental, semiduro, madurado». */
  descripcion: string;
  costo_usd: number | null;
  /** El precio al mayor en dólares. null: sin precio todavía. */
  precio_usd: number | null;
  activo: number;
  creado_en: string;
  /** Cuándo se puso la foto, o null si no tiene. Va en la dirección de la foto para que no se quede una vieja en caché. */
  foto_version: string | null;
};

export type DatosVariante = Pick<Variante, "marca_id" | "marca" | "presentacion" | "contenido" | "descripcion" | "costo_usd" | "precio_usd">;

export type FotoDeVariante = { variante_id: number; tipo: string; tamano: number; datos: ArrayBuffer; actualizado_en: string };

export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
/** El teléfono reduce la foto antes de subirla; esto es por si no pudo. */
export const TAMANO_MAXIMO_DE_FOTO = 2 * 1024 * 1024;

const CONSULTA = `
  select v.id, v.producto_id, v.nombre, v.descripcion, v.costo_usd, v.precio_usd, v.activo, v.creado_en,
         v.marca_id, coalesce(m.nombre, '') as marca, v.presentacion, v.contenido,
         f.actualizado_en as foto_version
  from variantes v
  left join marcas m on m.id = v.marca_id
  left join fotos_variantes f on f.variante_id = v.id
`;

function completar(v: Variante): Variante {
  return { ...v, marca_id: v.marca_id === null || v.marca_id === undefined ? null : Number(v.marca_id), marca: v.marca ?? "", presentacion: v.presentacion ?? "", contenido: v.contenido ?? "" };
}

/** Todas, en el orden del panel: por producto y, dentro, por antigüedad. */
export async function listarVariantes(): Promise<Variante[]> {
  return (await filas<Variante>(`${CONSULTA} order by v.producto_id, v.id`)).map(completar);
}

export async function variantesDeProducto(productoId: number, soloActivas = false): Promise<Variante[]> {
  return (await filas<Variante>(`${CONSULTA} where v.producto_id = ? ${soloActivas ? "and v.activo = 1" : ""} order by v.id`, [productoId])).map(completar);
}

export async function buscarVariante(id: number): Promise<Variante | null> {
  const v = await fila<Variante>(`${CONSULTA} where v.id = ?`, [id]);
  return v ? completar(v) : null;
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
 * El precio de una variante sale de su costo con el margen del producto,
 * igual que el del producto; sin costo, vale el precio escrito.
 */
function resolver(datos: DatosVariante, producto: Producto): number | null {
  return precioDeVenta(datos.costo_usd, producto.margen_pct) ?? datos.precio_usd;
}

/** El nombre del artículo que dicen las notas: «Guaralact bolsa de 1 kg». */
export function etiquetaDe(datos: Pick<DatosVariante, "marca" | "presentacion" | "contenido">): string {
  return nombreDeArticulo({ marca: datos.marca, presentacion: datos.presentacion, contenido: datos.contenido });
}

export async function crearVariante(producto: Producto, datos: DatosVariante): Promise<number> {
  const r = await ejecutar(
    "insert into variantes (producto_id, nombre, marca_id, presentacion, contenido, descripcion, costo_usd, precio_usd) values (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      producto.id,
      etiquetaDe(datos),
      datos.marca_id,
      limpiarTexto(datos.presentacion),
      limpiarTexto(datos.contenido),
      datos.descripcion,
      datos.costo_usd,
      resolver(datos, producto),
    ],
  );
  return r.ultimoId;
}

export async function actualizarVariante(id: number, producto: Producto, datos: DatosVariante): Promise<void> {
  await ejecutar("update variantes set nombre = ?, marca_id = ?, presentacion = ?, contenido = ?, descripcion = ?, costo_usd = ?, precio_usd = ? where id = ?", [
    etiquetaDe(datos),
    datos.marca_id,
    limpiarTexto(datos.presentacion),
    limpiarTexto(datos.contenido),
    datos.descripcion,
    datos.costo_usd,
    resolver(datos, producto),
    id,
  ]);
}

/**
 * Un producto que se vendía sin separar artículos (con su precio, su marca
 * o su presentación propios), al recibir su primera marca, pasa eso a la
 * lista como un artículo más; si no, la web dejaría de enseñarlo y el
 * precio de antes se perdería de vista. Se lleva la foto (copia) y, si el
 * inventario lo seguía, su existencia. Las notas de antes siguen como
 * estaban. Devuelve el artículo creado, o null si no había nada que pasar.
 */
export async function pasarAArticulo(producto: Producto): Promise<number | null> {
  const yaTiene = await fila<{ n: number }>("select count(*) as n from variantes where producto_id = ?", [producto.id]);
  if (Number(yaTiene?.n ?? 0) > 0) return null;
  const tieneAlgo = producto.precio_usd !== null || producto.costo_usd !== null || producto.marca_id !== null || Boolean(producto.presentacion || producto.contenido);
  if (!tieneAlgo) return null;
  const sigue = await fila<{ n: number }>(
    `select (select count(*) from compra_lineas where producto_id = ? and variante_id is null)
          + (select count(*) from inventario_ajustes where producto_id = ? and variante_id is null) as n`,
    [producto.id, producto.id],
  );
  const existencia = await fila<{ n: number }>(
    `select
       (select coalesce(sum(l.cantidad), 0) from compra_lineas l where l.producto_id = ? and l.variante_id is null)
       - (select coalesce(sum(cantidad), 0) from venta_lineas where producto_id = ? and variante_id is null)
       + (select coalesce(sum(cantidad), 0) from inventario_ajustes where producto_id = ? and variante_id is null) as n`,
    [producto.id, producto.id, producto.id],
  );
  const etiqueta = etiquetaDe({ marca: producto.marca, presentacion: producto.presentacion, contenido: producto.contenido }) || "Presentación única";
  return transaccion(async (tx) => {
    const r = await tx.execute({
      sql: `insert into variantes (producto_id, nombre, marca_id, presentacion, contenido, descripcion, costo_usd, precio_usd)
            values (?, ?, ?, ?, ?, '', ?, ?) returning id`,
      args: [producto.id, etiqueta, producto.marca_id, producto.presentacion, producto.contenido, producto.costo_usd, producto.precio_usd],
    });
    const id = Number(r.rows[0].id);
    await tx.execute({
      sql: `insert into fotos_variantes (variante_id, tipo, tamano, datos, actualizado_en)
            select ?, tipo, tamano, datos, actualizado_en from fotos_productos where producto_id = ?`,
      args: [id, producto.id],
    });
    const cantidad = Math.round(Number(existencia?.n ?? 0) * 1000) / 1000;
    if (Number(sigue?.n ?? 0) > 0 && cantidad !== 0) {
      const motivo = `Pasa a «${etiqueta}» al separar sus marcas`;
      await tx.execute({ sql: "insert into inventario_ajustes (fecha, producto_id, variante_id, cantidad, motivo) values (?, ?, null, ?, ?)", args: [hoy(), producto.id, -cantidad, motivo] });
      await tx.execute({ sql: "insert into inventario_ajustes (fecha, producto_id, variante_id, cantidad, motivo) values (?, ?, ?, ?, ?)", args: [hoy(), producto.id, id, cantidad, motivo] });
    }
    await tx.execute({
      sql: "update productos set costo_usd = null, precio_usd = null, marca = '', marca_id = null, presentacion = '', contenido = '' where id = ?",
      args: [producto.id],
    });
    return id;
  });
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

/** Pone o cambia la foto de una variante: se guarda cuadrada, con el producto llenándola (`foto-producto.ts`). */
export async function guardarFotoDeVariante(varianteId: number, tipoOriginal: string, original: Uint8Array): Promise<void> {
  if (!(TIPOS_DE_FOTO as readonly string[]).includes(tipoOriginal)) throw new Error("La foto tiene que ser JPG, PNG o WebP.");
  if (original.byteLength === 0) throw new Error("La foto está vacía.");
  if (original.byteLength > TAMANO_MAXIMO_DE_FOTO) throw new Error("La foto pesa más de 2 MB. Elige una más pequeña.");
  const { datos, tipo } = await normalizarFotoDeProducto(original, tipoOriginal);
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
