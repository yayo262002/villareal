import "server-only";
import { categoriasDeTodos, direccionDeFotoDeProducto, listarProductos, type Producto } from "./productos";
import { agruparPorProducto, listarVariantes, type Variante } from "./variantes";
import { listarFamilias, type Familia } from "./familias";
import { claveDe, precioPublicado, type PrecioPublicado } from "./catalogo";
import { leerTasa, type Tasa } from "./ajustes";
import { textoCoincide } from "./buscar";
import { rutaProducto } from "./enlaces";

/**
 * Lo que enseña la web pública: los productos publicados con su precio,
 * sus marcas publicadas, su foto y las familias en que salen, y las
 * familias activas que tienen algo publicado. Una sola consulta de cada
 * cosa, para la portada, la lista de productos y cada categoría.
 */

export type ProductoDeVitrina = {
  producto: Producto;
  publicado: PrecioPublicado;
  /** Sus marcas publicadas. */
  variantes: Variante[];
  /** La foto principal, o null: entonces va su dibujo. */
  foto: string | null;
  /** Su familia y las otras en que sale. */
  familias: number[];
  /** Lo que añade «Agregar»: el producto, o su única marca. Con dos o más marcas, null: se elige en su página. */
  clave: string | null;
};

export type Vitrina = {
  productos: ProductoDeVitrina[];
  /** Las familias activas con algún producto publicado, en su orden. */
  familias: Familia[];
  /** Todas las activas, aunque no tengan productos todavía. */
  todasLasFamilias: Familia[];
  tasa: Tasa | null;
};

export async function vitrina(): Promise<Vitrina> {
  const [productos, variantes, familias, categorias, tasa] = await Promise.all([
    listarProductos(true),
    listarVariantes(),
    listarFamilias(true),
    categoriasDeTodos(),
    leerTasa(),
  ]);
  const variantesDe = agruparPorProducto(variantes);
  const lista: ProductoDeVitrina[] = productos.map((p) => {
    const suyas = (variantesDe.get(p.id) ?? []).filter((v) => v.activo === 1);
    return {
      producto: p,
      publicado: precioPublicado(p, suyas),
      variantes: suyas,
      foto: direccionDeFotoDeProducto(p),
      familias: [...(p.familia_id ? [p.familia_id] : []), ...(categorias.get(p.id) ?? [])],
      clave: suyas.length === 0 ? claveDe(p.id, null) : suyas.length === 1 ? claveDe(p.id, suyas[0].id) : null,
    };
  });
  return {
    productos: lista,
    familias: familias.filter((f) => lista.some((p) => p.familias.includes(f.id))),
    todasLasFamilias: familias,
    tasa,
  };
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
        ...p.variantes.flatMap((m) => [m.nombre, m.descripcion]),
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
