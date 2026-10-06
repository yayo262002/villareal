import "server-only";
import { categoriasDeTodos, direccionDeFotoDeProducto, listarProductos, seccionesDeTodos, type Producto } from "./productos";
import { agruparPorProducto, fotoDeAlgunaVariante, listarVariantes, type Variante } from "./variantes";
import { colecciones, familiasDeProductos, listarFamilias, type Familia } from "./familias";
import { claveDe, precioPublicado, type PrecioPublicado } from "./catalogo";
import { leerTasa, type Tasa } from "./ajustes";
import { textoCoincide } from "./buscar";
import { rutaProducto } from "./enlaces";
import { imagenDeProducto, type ImagenDeProducto } from "./fotos-referenciales";
import { agruparEnSecciones, slugDeMarca } from "./marcas-texto";

/**
 * Lo que enseña la web pública: los tipos de producto publicados con su
 * precio, sus artículos publicados (cada marca y presentación), sus
 * marcas, su foto, las familias en que salen y su sección en cada una, y
 * las familias activas que tienen algo publicado. Una sola consulta de cada
 * cosa, para la portada, la lista de productos y cada categoría. El cliente
 * busca primero el tipo y después filtra por marca.
 */

/** Una marca en un filtro: su nombre y el de su dirección. */
export type MarcaDeVitrina = { slug: string; nombre: string };

export type ProductoDeVitrina = {
  producto: Producto;
  publicado: PrecioPublicado;
  /** Sus marcas publicadas. */
  variantes: Variante[];
  /** Su foto: la que subió el dueño o, mientras no la haya, una de referencia; null: fondo neutro. */
  imagen: ImagenDeProducto;
  /** Su familia y las otras en que sale. */
  familias: number[];
  /** Lo que añade «Agregar»: el producto, o su única marca. Con dos o más marcas, null: se elige en su página. */
  clave: string | null;
  /** Las marcas en que se vende (las de sus artículos, o la suya si se vende de una sola), sin repetir. */
  marcas: MarcaDeVitrina[];
  /** La sección en que sale en cada otra familia (id → sección), si el dueño la puso. */
  secciones: Map<number, string>;
};

export type Vitrina = {
  productos: ProductoDeVitrina[];
  /** Las familias activas con algún producto publicado, en su orden (también las colecciones). */
  familias: Familia[];
  /** Todas las activas, aunque no tengan productos todavía. */
  todasLasFamilias: Familia[];
  /** Las colecciones activas por tipo de negocio (Burger, Pizzería). */
  colecciones: Familia[];
  /** Las familias activas de productos (Quesos, Embutidos…), sin las colecciones. */
  familiasDeProductos: Familia[];
  tasa: Tasa | null;
};

export async function vitrina(): Promise<Vitrina> {
  const [productos, variantes, familias, categorias, secciones, tasa] = await Promise.all([
    listarProductos(true),
    listarVariantes(),
    listarFamilias(true),
    categoriasDeTodos(),
    seccionesDeTodos(),
    leerTasa(),
  ]);
  const variantesDe = agruparPorProducto(variantes);
  const lista: ProductoDeVitrina[] = productos.map((p) =>
    armar(p, (variantesDe.get(p.id) ?? []).filter((v) => v.activo === 1), [...(p.familia_id ? [p.familia_id] : []), ...(categorias.get(p.id) ?? [])], secciones.get(p.id) ?? new Map()),
  );
  return {
    productos: lista,
    familias: familias.filter((f) => lista.some((p) => p.familias.includes(f.id))),
    todasLasFamilias: familias,
    colecciones: colecciones(familias),
    familiasDeProductos: familiasDeProductos(familias),
    tasa,
  };
}

/** Las marcas de unos artículos (o la del producto), sin repetir y por su nombre. */
function marcasDe(producto: Producto, suyas: Variante[]): MarcaDeVitrina[] {
  const nombres = suyas.length > 0 ? suyas.map((v) => v.marca) : [producto.marca];
  const unicas = new Map<string, MarcaDeVitrina>();
  for (const nombre of nombres) if (nombre.trim() && !unicas.has(slugDeMarca(nombre))) unicas.set(slugDeMarca(nombre), { slug: slugDeMarca(nombre), nombre });
  return [...unicas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Un tipo de producto en la vitrina, con los artículos que se le pasan. */
function armar(p: Producto, suyas: Variante[], familias: number[], secciones: Map<number, string>): ProductoDeVitrina {
  return {
    producto: p,
    publicado: precioPublicado(p, suyas),
    variantes: suyas,
    imagen: imagenDeProducto(direccionDeFotoDeProducto(p), p.nombre, fotoDeAlgunaVariante(suyas)),
    familias,
    clave: suyas.length === 0 ? claveDe(p.id, null) : suyas.length === 1 ? claveDe(p.id, suyas[0].id) : null,
    marcas: marcasDe(p, suyas),
    secciones,
  };
}

/**
 * Lo de unas marcas (`?marca=guaralact`): el tipo solo con sus artículos de
 * esas marcas, con su precio «desde» entre ellos; null si no vende ninguna.
 * Sin marcas elegidas, el tipo tal cual.
 */
export function deLasMarcas(item: ProductoDeVitrina, marcas: string[]): ProductoDeVitrina | null {
  if (marcas.length === 0) return item;
  if (item.variantes.length === 0) return item.marcas.some((m) => marcas.includes(m.slug)) ? item : null;
  const suyas = item.variantes.filter((v) => v.marca && marcas.includes(slugDeMarca(v.marca)));
  return suyas.length > 0 ? armar(item.producto, suyas, item.familias, item.secciones) : null;
}

/** Las marcas de una lista de tipos, sin repetir y por su nombre: las del filtro. */
export function marcasDeLaLista(items: ProductoDeVitrina[]): MarcaDeVitrina[] {
  const unicas = new Map<string, MarcaDeVitrina>();
  for (const i of items) for (const m of i.marcas) if (!unicas.has(m.slug)) unicas.set(m.slug, m);
  return [...unicas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Los tipos de una familia por secciones. Los de otra familia van en la
 * suya («Quesos», «Embutidos») o en la que puso el dueño para esta («la
 * tocineta, en Burger, en Proteínas»); los propios, en su sección, después
 * de los demás, o sin título si no tienen. Las secciones salen en el orden
 * de las familias.
 */
export function porSecciones(items: ProductoDeVitrina[], familia: Familia, familias: Familia[]): { titulo: string; items: ProductoDeVitrina[] }[] {
  const de = new Map(familias.map((f) => [f.id, f]));
  return agruparEnSecciones(
    items.map((item) => {
      const propio = item.producto.familia_id === familia.id;
      const principal = item.producto.familia_id ? de.get(item.producto.familia_id) : undefined;
      const seccion = propio ? item.producto.seccion : item.secciones.get(familia.id) || principal?.nombre || "";
      return { item, seccion, orden: propio ? 1000 : (principal?.orden ?? 500) };
    }),
  );
}

/** Los de una familia: los suyos y los que también salen en ella; los destacados primero. */
export function deLaFamilia(productos: ProductoDeVitrina[], familiaId: number): ProductoDeVitrina[] {
  return productos.filter((p) => p.familias.includes(familiaId)).sort((a, b) => b.producto.destacado - a.producto.destacado);
}

/** Lo que responde a una búsqueda: por su nombre, sus marcas, su presentación, su descripción o sus familias. */
export function buscarEnLaVitrina(v: Pick<Vitrina, "productos" | "todasLasFamilias">, busqueda: string): ProductoDeVitrina[] {
  const nombreDe = new Map(v.todasLasFamilias.map((f) => [f.id, f.nombre]));
  return v.productos.filter((p) =>
    textoCoincide(
      [
        p.producto.nombre,
        p.producto.marca,
        p.producto.presentacion,
        p.producto.contenido,
        p.producto.descripcion,
        ...p.variantes.flatMap((m) => [m.nombre, m.marca, m.presentacion, m.descripcion]),
        ...p.familias.map((id) => nombreDe.get(id)),
      ],
      busqueda,
    ),
  );
}

/** La página de cada producto publicado, por su número: para enlazar lo que lleva un combo. */
export function rutasPublicas(productos: ProductoDeVitrina[]): Map<number, string> {
  return new Map(productos.map((p) => [p.producto.id, rutaProducto(p.producto)]));
}

/** Los destacados; si el dueño no ha destacado ninguno, todos. */
export function destacados(productos: ProductoDeVitrina[]): ProductoDeVitrina[] {
  const marcados = productos.filter((p) => p.producto.destacado);
  return marcados.length > 0 ? marcados : productos;
}
