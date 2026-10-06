import { normalizar } from "./buscar.ts";

/**
 * Las fotos de referencia: fotos reales de comida con licencia libre
 * (`public/productos/`, créditos en `public/productos/CREDITOS.md`) que la
 * web enseña mientras el dueño no sube la foto de su producto. Se eligen
 * por el nombre, de lo más concreto a lo más general: «Salsa cheddar»
 * antes que «cheddar», «Mozzarella rallada» antes que «mozzarella». La
 * foto que sube el dueño va siempre primero; si no la hay y alguna de sus
 * marcas tiene foto (el suero Guaralact, el queso amarillo Kemmental), va
 * la de la marca, que es el producto de verdad; y sin ninguna, un fondo neutro con el
 * león: nunca un dibujo. Una foto de referencia enseña lo que es el
 * producto como se vende aquí: la mozzarella, en bloque cuadrado, no en
 * bola. Cálculo puro, con pruebas.
 */

/** La foto de un producto tal como la enseña la web: la suya o una de referencia (y entonces se dice). */
export type ImagenDeProducto = { src: string; referencial: boolean } | null;

/** Cada foto con las palabras que la eligen; las frases van sin tildes ni mayúsculas. */
export const FOTOS_REFERENCIALES: { foto: string; palabras: string[] }[] = [
  // Lo que lleva el nombre de otra cosa va primero: la salsa cheddar no es un queso.
  { foto: "salsa-cheddar", palabras: ["salsa cheddar", "salsa de queso", "queso fundido"] },
  { foto: "salsa-pizza", palabras: ["salsa para pizza", "salsa de pizza", "salsa napolitana", "salsa de tomate natural"] },
  { foto: "cajas-pizza", palabras: ["caja para pizza", "cajas para pizza", "caja de pizza", "cajas de pizza"] },
  { foto: "harina", palabras: ["harina"] },
  { foto: "levadura", palabras: ["levadura"] },
  { foto: "pan-hamburguesa", palabras: ["pan de hamburguesa", "pan para hamburguesa", "panes de hamburguesa", "pan brioche"] },
  { foto: "carne-hamburguesa", palabras: ["carne para hamburguesa", "carne de hamburguesa", "carne molida", "medallon"] },
  { foto: "aros-de-cebolla", palabras: ["aros de cebolla", "aro de cebolla"] },
  { foto: "cebolla-crispy", palabras: ["cebolla crispy", "cebolla frita", "cebolla crujiente"] },
  { foto: "hash-browns", palabras: ["hash brown", "hash browns", "papas ralladas", "papa rallada"] },
  { foto: "papas-fritas", palabras: ["papas fritas", "papa frita", "papas congeladas", "papas"] },
  { foto: "salsa-de-ajo", palabras: ["salsa de ajo", "ajo"] },
  { foto: "salsa-bbq", palabras: ["salsa bbq", "bbq", "barbacoa"] },
  { foto: "salsa-picante", palabras: ["salsa picante", "picante"] },
  { foto: "mayonesa", palabras: ["mayonesa"] },
  { foto: "mostaza", palabras: ["mostaza"] },
  { foto: "ketchup", palabras: ["ketchup", "salsa de tomate"] },
  // Quesos
  // Lo rallado, sea mozzarella, pecorino o parmesano, con la foto del queso rallado.
  { foto: "queso-rallado", palabras: ["rallado", "rallada", "queso rallado"] },
  { foto: "parmesano", palabras: ["parmesano", "pecorino", "grana padano"] },
  { foto: "queso-de-ano", palabras: ["queso de ano"] },
  // «Queso amarillo / Cheddar», con el bloque de cheddar; el cheddar a secas, con la tabla de quesos.
  { foto: "queso-amarillo", palabras: ["queso amarillo"] },
  { foto: "queso-cheddar", palabras: ["cheddar"] },
  { foto: "mozzarella", palabras: ["mozzarella", "mozarella", "mozzarela"] },
  { foto: "queso-amarillo", palabras: ["queso amarillo", "gouda", "queso"] },
  // Lácteos y huevos: el suero y la crema, con la foto de un bol de crema.
  { foto: "crema", palabras: ["crema de leche", "suero", "crema", "nata"] },
  { foto: "huevos", palabras: ["huevos", "huevo"] },
  // Embutidos
  { foto: "tocineta", palabras: ["tocineta", "tocino", "bacon", "beicon"] },
  { foto: "pepperoni", palabras: ["pepperoni", "peperoni"] },
  { foto: "salami", palabras: ["salami"] },
  { foto: "mortadela", palabras: ["mortadela"] },
  { foto: "chorizo", palabras: ["chorizo"] },
  { foto: "salchichas", palabras: ["salchicha", "salchichas", "perro caliente"] },
  { foto: "jamon", palabras: ["jamon"] },
  // Congelados y complementos
  { foto: "nuggets", palabras: ["nuggets", "nugget", "tenders"] },
  { foto: "pepinillos", palabras: ["pepinillos", "pepinillo", "encurtidos"] },
  { foto: "oregano", palabras: ["oregano"] },
  { foto: "champinones", palabras: ["champinon", "champinones", "hongos"] },
  { foto: "aceitunas", palabras: ["aceituna", "aceitunas"] },
  { foto: "maiz", palabras: ["maiz", "jojoto"] },
  { foto: "pina", palabras: ["pina"] },
  // Bebidas
  { foto: "agua", palabras: ["agua"] },
  { foto: "refrescos", palabras: ["refresco", "refrescos", "bebida", "bebidas", "gaseosa", "jugo"] },
];

/** Si la frase está en el nombre como palabra entera (o en plural: «aceituna» vale para «Aceitunas»). */
function contiene(nombre: string, frase: string): boolean {
  const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapada}(s|es)?([^a-z0-9]|$)`).test(nombre);
}

/** La dirección de la foto de referencia de un producto por su nombre, o null si ninguna le va. */
export function fotoReferencialDe(nombre: string): string | null {
  const n = normalizar(nombre);
  const elegida = FOTOS_REFERENCIALES.find((f) => f.palabras.some((p) => contiene(n, p)));
  return elegida ? `/productos/${elegida.foto}.webp` : null;
}

/** La foto de un combo: Pack Burger lleva la de las hamburguesas, Pack Pizzería la de la pizza; los demás, la de los ingredientes. */
export function fotoDeCombo(nombre: string): string {
  const n = normalizar(nombre);
  if (/pizz/.test(n)) return "/familias/pizzeria.webp";
  if (/burger|hamburgues/.test(n)) return "/familias/burger.webp";
  return "/productos/ingredientes.webp";
}

/**
 * Lo que enseña la web de un tipo de producto: la foto que subió el dueño;
 * si no, la de una de sus marcas (la primera que tenga foto: es mercancía
 * de verdad, mejor que una foto de referencia); si no, la de referencia;
 * si no, nada (fondo neutro).
 */
export function imagenDeProducto(fotoPropia: string | null, nombre: string, fotoDeUnaMarca: string | null = null): ImagenDeProducto {
  if (fotoPropia) return { src: fotoPropia, referencial: false };
  if (fotoDeUnaMarca) return { src: fotoDeUnaMarca, referencial: false };
  const referencia = fotoReferencialDe(nombre);
  return referencia ? { src: referencia, referencial: true } : null;
}
