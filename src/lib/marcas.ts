import "server-only";
import { ejecutar, fila, filas, transaccion, type Transaction } from "./db";
import { limpiarTexto, mismaMarca, nombreDeArticulo, slugDeMarca } from "./marcas-texto";

/**
 * Las marcas del catálogo: Guaralact, Kemmental, El Legado… Una marca es
 * información de un artículo, nunca el tipo de producto: el cliente busca
 * primero «Suero» y después elige la marca. Se crean solas al escribirlas
 * por primera vez en un artículo; en el panel se renombran, se unen dos que
 * son la misma (por una errata) y se borra una que ya no tiene artículos.
 */

export type Marca = {
  id: number;
  nombre: string;
  slug: string;
  creado_en: string;
};

export type MarcaConCuentas = Marca & {
  /** Cuántos artículos la llevan (marcas y presentaciones de algún tipo). */
  articulos: number;
  /** Cuántos productos se venden de esta marca sin separar artículos. */
  productos: number;
  /** Los tipos de producto en que sale, por su nombre. */
  tipos: string[];
};

function completar(m: Omit<Marca, "slug">): Marca {
  return { id: Number(m.id), nombre: m.nombre, slug: slugDeMarca(m.nombre), creado_en: m.creado_en };
}

/** Todas, por su nombre. */
export async function listarMarcas(): Promise<Marca[]> {
  return (await filas<Omit<Marca, "slug">>("select id, nombre, creado_en from marcas order by nombre collate nocase")).map(completar);
}

export async function listarMarcasConCuentas(): Promise<MarcaConCuentas[]> {
  const [marcas, usos] = await Promise.all([
    listarMarcas(),
    filas<{ marca_id: number; tipo: string; articulo: number }>(
      `select v.marca_id, p.nombre as tipo, 1 as articulo from variantes v join productos p on p.id = v.producto_id where v.marca_id is not null
       union all
       select p.marca_id, p.nombre as tipo, 0 as articulo from productos p where p.marca_id is not null`,
    ),
  ]);
  return marcas.map((m) => {
    const suyos = usos.filter((u) => Number(u.marca_id) === m.id);
    return {
      ...m,
      articulos: suyos.filter((u) => Number(u.articulo) === 1).length,
      productos: suyos.filter((u) => Number(u.articulo) === 0).length,
      tipos: [...new Set(suyos.map((u) => u.tipo))],
    };
  });
}

export async function buscarMarca(id: number): Promise<Marca | null> {
  const m = await fila<Omit<Marca, "slug">>("select id, nombre, creado_en from marcas where id = ?", [id]);
  return m ? completar(m) : null;
}

/** La marca con ese nombre, escrito como sea (sin mirar tildes, mayúsculas ni espacios de más). */
export async function buscarMarcaPorNombre(nombre: string): Promise<Marca | null> {
  return (await listarMarcas()).find((m) => mismaMarca(m.nombre, nombre)) ?? null;
}

/**
 * La marca de un artículo por lo que escribió el dueño: la que ya existe
 * con ese nombre (aunque lo escriba distinto) o una nueva. Vacío: sin marca.
 */
export async function marcaPorNombre(nombre: string): Promise<{ marca: Marca | null; nueva: boolean }> {
  const limpio = limpiarTexto(nombre);
  if (!limpio) return { marca: null, nueva: false };
  const ya = await buscarMarcaPorNombre(limpio);
  if (ya) return { marca: ya, nueva: false };
  await ejecutar("insert or ignore into marcas (nombre) values (?)", [limpio]);
  return { marca: await buscarMarcaPorNombre(limpio), nueva: true };
}

/** Rehace el nombre de los artículos de una marca y la marca escrita de sus productos, tras renombrarla o unirla. */
async function rehacerNombres(tx: Transaction, marcaId: number, nombre: string): Promise<void> {
  const articulos = await tx.execute({ sql: "select id, presentacion, contenido from variantes where marca_id = ?", args: [marcaId] });
  for (const a of articulos.rows) {
    const etiqueta = nombreDeArticulo({ marca: nombre, presentacion: String(a.presentacion ?? ""), contenido: String(a.contenido ?? "") });
    await tx.execute({ sql: "update variantes set nombre = ? where id = ?", args: [etiqueta, a.id] });
  }
  await tx.execute({ sql: "update productos set marca = ? where marca_id = ?", args: [nombre, marcaId] });
}

/** Cambia el nombre de una marca (una errata): sus artículos y sus productos pasan a decirlo así. */
export async function renombrarMarca(id: number, nombre: string): Promise<"renombrada" | "ya_existe" | "vacio"> {
  const limpio = limpiarTexto(nombre);
  if (!limpio) return "vacio";
  const otra = await buscarMarcaPorNombre(limpio);
  if (otra && otra.id !== id) return "ya_existe";
  await transaccion(async (tx) => {
    await tx.execute({ sql: "update marcas set nombre = ? where id = ?", args: [limpio, id] });
    await rehacerNombres(tx, id, limpio);
  });
  return "renombrada";
}

/** Une dos marcas que son la misma: los artículos y productos de `origen` pasan a `destino`, y `origen` se borra. */
export async function unirMarcas(origen: number, destino: number): Promise<"unidas" | "misma" | "no_existe"> {
  if (origen === destino) return "misma";
  const [a, b] = await Promise.all([buscarMarca(origen), buscarMarca(destino)]);
  if (!a || !b) return "no_existe";
  await transaccion(async (tx) => {
    await tx.execute({ sql: "update variantes set marca_id = ? where marca_id = ?", args: [destino, origen] });
    await tx.execute({ sql: "update productos set marca_id = ? where marca_id = ?", args: [destino, origen] });
    await rehacerNombres(tx, destino, b.nombre);
    await tx.execute({ sql: "delete from marcas where id = ?", args: [origen] });
  });
  return "unidas";
}

/** Borra una marca que ya no lleva ningún artículo ni producto. */
export async function eliminarMarca(id: number): Promise<"borrada" | "en_uso" | "no_existe"> {
  if (!(await buscarMarca(id))) return "no_existe";
  const uso = await fila<{ n: number }>(
    "select (select count(*) from variantes where marca_id = ?) + (select count(*) from productos where marca_id = ?) as n",
    [id, id],
  );
  if (Number(uso?.n ?? 0) > 0) return "en_uso";
  await ejecutar("delete from marcas where id = ?", [id]);
  return "borrada";
}

/** Las presentaciones ya escritas («Bolsa», «Bloque», «Cartón de 30»), para proponerlas al escribir una. */
export async function presentacionesUsadas(): Promise<string[]> {
  const lista = await filas<{ presentacion: string }>(
    `select presentacion from variantes where trim(presentacion) != ''
     union select presentacion from productos where trim(presentacion) != ''
     order by 1 collate nocase`,
  );
  return [...new Set(lista.map((p) => limpiarTexto(p.presentacion)))];
}
