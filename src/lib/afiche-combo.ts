/**
 * El afiche de un combo, como el volante de la tienda (el dueño, 24/11/2026: «los combos de perros, ponle unos
 * detalles así»): fondo rojo, los productos que lleva y la etiqueta amarilla del precio. Cada producto va con su
 * foto si la tiene de verdad y no hay duda de qué marca es; si no, con su cantidad en grande y su nombre.
 * Nada de fotos de otra marca: con varias marcas a la venta, no se sabe cuál lleva el combo.
 */
export type PiezaDeCombo = { producto_id: number; nombre: string; cantidad: string; foto: string | null };

/** La foto de un producto del combo: la suya; si no, la de su única marca a la venta; con varias, ninguna. */
export function fotoParaElCombo(fotoPropia: string | null, fotosDeSusMarcas: (string | null)[]): string | null {
  if (fotoPropia) return fotoPropia;
  if (fotosDeSusMarcas.length === 1) return fotosDeSusMarcas[0];
  return null;
}

/** Las que van con foto (cuatro como mucho, en el orden del combo) y las que van con letra. */
export function piezasDelAfiche(piezas: PiezaDeCombo[]): { fotos: PiezaDeCombo[]; letras: PiezaDeCombo[] } {
  const fotos = piezas.filter((p) => p.foto).slice(0, 4);
  return { fotos, letras: piezas.filter((p) => !fotos.includes(p)) };
}

const formato = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** El número de la etiqueta del precio, en dólares: «7,05». Sin precio, ninguno (el combo dice «consulta el precio»). */
export function precioDeLaEtiqueta(precioUsd: number | null): string | null {
  if (precioUsd === null || !Number.isFinite(precioUsd) || precioUsd <= 0) return null;
  return formato.format(precioUsd);
}
