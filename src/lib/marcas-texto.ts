import { normalizar } from "./buscar.ts";
import { aSlug } from "./enlaces.ts";

/**
 * Las cuentas de las marcas y los artículos, sin base de datos. Un tipo de
 * producto (Mozzarella) se vende en artículos, cada uno con su marca
 * (Guaralact), su presentación («Bloque») y su contenido («1 kg»): la
 * marca nunca hace de tipo. Aquí se compone el nombre de un artículo, se
 * separa la marca del tamaño en los nombres de antes y se comparan marcas
 * como se escriben. Cálculo puro, con pruebas.
 */

/** Lo que dice un artículo de sí mismo. */
export type PiezasDeArticulo = { marca: string; presentacion: string; contenido: string };

/** Sin espacios de más: «  El   Legado » → «El Legado». */
export function limpiarTexto(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** «Bloque de 1 kg», «Bolsa», «500 g» o nada: la presentación y el contenido en una frase. */
export function presentacionYContenido(p: Pick<PiezasDeArticulo, "presentacion" | "contenido">): string {
  const presentacion = limpiarTexto(p.presentacion);
  const contenido = limpiarTexto(p.contenido);
  if (presentacion && contenido) return `${presentacion} de ${contenido}`;
  return presentacion || contenido;
}

/**
 * El nombre de un artículo, como lo dicen las notas detrás del tipo:
 * «Sortilegio 500 g», «Guaralact bolsa de 1 kg», «Kemmental». Sin marca,
 * la presentación sola: «Bloque cuadrado».
 */
export function nombreDeArticulo(p: PiezasDeArticulo): string {
  const marca = limpiarTexto(p.marca);
  const resto = presentacionYContenido(p);
  if (!marca) return resto;
  if (!resto) return marca;
  // Tras la marca, la presentación va en minúscula («Guaralact bolsa…»); el contenido, como se escribió («Sortilegio 500 g»).
  return `${marca} ${resto.charAt(0).toLowerCase()}${resto.slice(1)}`;
}

/** El tamaño al final de un nombre de antes: «500 g», «1 kg», «2,5 kg», «1 L», «12 unidades». */
const TAMANO_AL_FINAL = /^(.*?)\s+(\d+(?:[.,]\d+)?\s*(?:g|gr|grs|kg|kgs|ml|l|lt|lts|cc|oz|lb|lbs|und|unid|unidades|u))$/i;

/**
 * Para los artículos de antes, que tenían marca y tamaño en un solo nombre
 * («Sortilegio 500 g»): la marca y el contenido por separado. Un nombre sin
 * tamaño es todo marca («Kemmental»).
 */
export function separarMarcaYContenido(nombre: string): { marca: string; contenido: string } {
  const limpio = limpiarTexto(nombre);
  const partes = limpio.match(TAMANO_AL_FINAL);
  if (partes && partes[1]) return { marca: partes[1], contenido: partes[2] };
  return { marca: limpio, contenido: "" };
}

/** Si dos nombres son la misma marca, se escriban como se escriban: «guaralact» y «GuaraLact». */
export function mismaMarca(a: string, b: string): boolean {
  return normalizar(limpiarTexto(a)) === normalizar(limpiarTexto(b));
}

/** La marca en una dirección de filtro: «El Legado» → «el-legado». */
export function slugDeMarca(nombre: string): string {
  return aSlug(nombre);
}

/** Las marcas elegidas en un filtro (`?marca=guaralact&marca=kemmental`), limpias y sin repetir. */
export function marcasDelFiltro(valor: string | string[] | undefined): string[] {
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return [...new Set(lista.map((v) => aSlug(v)).filter(Boolean))].slice(0, 20);
}

/**
 * Las secciones de una página de familia: cada producto en la suya, con el
 * título de la sección y su orden; las secciones salen en el orden del
 * primero de sus productos, y dentro de cada una, los productos en el orden
 * en que llegan. La sección sin título (los productos propios de la familia
 * sin sección) va primero.
 */
export function agruparEnSecciones<T>(items: { item: T; seccion: string; orden: number }[]): { titulo: string; items: T[] }[] {
  const grupos = new Map<string, { titulo: string; orden: number; items: T[] }>();
  for (const { item, seccion, orden } of items) {
    const titulo = limpiarTexto(seccion);
    const clave = normalizar(titulo);
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.items.push(item);
      grupo.orden = Math.min(grupo.orden, orden);
    } else {
      grupos.set(clave, { titulo, orden: titulo ? orden : -Infinity, items: [item] });
    }
  }
  return [...grupos.values()].sort((a, b) => a.orden - b.orden).map(({ titulo, items: lista }) => ({ titulo, items: lista }));
}
