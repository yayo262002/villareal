/**
 * Las direcciones de la página de cada producto: `/producto/2-queso-mozzarella`.
 * El número es lo que cuenta; el nombre va detrás para que el enlace se
 * entienda al compartirlo. Si el dueño cambia el nombre, el enlace viejo
 * sigue llegando al mismo producto.
 */

/** «Queso Mozzarella» → «queso-mozzarella». */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function rutaProducto(producto: { id: number; nombre: string }): string {
  const slug = aSlug(producto.nombre);
  return `/producto/${producto.id}${slug ? `-${slug}` : ""}`;
}

/** El número del producto de una dirección, o null si no empieza por un número. */
export function idDeRuta(segmento: string): number | null {
  const numero = segmento.match(/^(\d+)(?:-|$)/)?.[1];
  if (!numero) return null;
  const id = Number(numero);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
