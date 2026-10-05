import { aSlug } from "./enlaces.ts";

/**
 * Las reseñas: lo que dicen del producto los negocios que lo compran. Las
 * escribe el dueño en el panel con las palabras del cliente. Aquí está lo
 * que no toca la base: dejar limpio lo que se escribe, las iniciales del
 * autor y las reseñas de ejemplo. Cálculo puro, con pruebas.
 */

export const LARGO_MINIMO_DEL_TEXTO = 10;
export const LARGO_MAXIMO_DEL_TEXTO = 400;
export const LARGO_MAXIMO_DEL_NOMBRE = 80;

export type DatosResena = {
  /** Quién lo dice: la persona o el negocio. */
  autor: string;
  /** Qué negocio es o dónde está: «Pizzería en el centro». Puede ir vacío. */
  detalle: string;
  texto: string;
};

export type ResenaLeida = { valida: true; datos: DatosResena } | { valida: false; motivo: string };

/** Espacios de más fuera, y los saltos de línea como un espacio. */
function enUnaLinea(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** La web ya pone las comillas: si el dueño las escribió, se quitan las de los extremos. */
function sinComillas(texto: string): string {
  return texto.replace(/^[«“”"'‘’\s]+/, "").replace(/[»“”"'‘’\s]+$/, "");
}

/**
 * Deja una reseña lista para guardar, o dice por qué no vale. No cambia
 * las palabras del cliente: solo quita espacios y comillas de los extremos.
 */
export function leerResena(escrito: { autor: string; detalle: string; texto: string }): ResenaLeida {
  const autor = enUnaLinea(escrito.autor);
  const detalle = enUnaLinea(escrito.detalle);
  const texto = sinComillas(enUnaLinea(escrito.texto));

  if (!autor) return { valida: false, motivo: "Escribe quién lo dice: el nombre de la persona o del negocio." };
  if (autor.length > LARGO_MAXIMO_DEL_NOMBRE) return { valida: false, motivo: "El nombre es demasiado largo." };
  if (detalle.length > LARGO_MAXIMO_DEL_NOMBRE) return { valida: false, motivo: "El tipo de negocio es demasiado largo." };
  if (texto.length < LARGO_MINIMO_DEL_TEXTO) return { valida: false, motivo: "Escribe el comentario del cliente." };
  if (texto.length > LARGO_MAXIMO_DEL_TEXTO) {
    return {
      valida: false,
      motivo: `El comentario es muy largo (${texto.length} letras). Déjalo en ${LARGO_MAXIMO_DEL_TEXTO} o menos: se lee mejor.`,
    };
  }
  return { valida: true, datos: { autor, detalle, texto } };
}

/** Palabras que no cuentan para las iniciales: «Pizzería de la Esquina» es «PE». */
const SIN_INICIAL = new Set(["de", "del", "la", "las", "el", "los", "y", "e"]);

/** Una o dos letras para el círculo que acompaña al nombre. */
export function iniciales(autor: string): string {
  const palabras = autor
    .split(/[\s,.()-]+/)
    .filter((p) => /^\p{L}/u.test(p) && !SIN_INICIAL.has(p.toLowerCase()));
  const letras = palabras.slice(0, 2).map((p) => p[0].toUpperCase());
  return letras.join("");
}

// ---------- Reseñas de ejemplo ----------
//
// Sirven para que el dueño vea cómo queda la página antes de tener reseñas
// de verdad. Nadie las dijo: por eso el autor se llama «de ejemplo», y la
// web solo las enseña al dueño con la sesión del panel abierta, nunca al
// público. Una opinión inventada no se publica como si fuera de un cliente.

/** Qué clase de producto es, por su nombre: decide qué reseñas de ejemplo le tocan. */
export type TipoDeProducto = "mozzarella" | "curado" | "rallado" | "huevos" | "suero" | "queso" | "generico";

export function tipoDeProducto(nombre: string): TipoDeProducto {
  const n = aSlug(nombre);
  if (n.includes("huevo")) return "huevos";
  if (n.includes("suero")) return "suero";
  if (n.includes("rallado")) return "rallado";
  if (n.includes("mozzarella") || n.includes("mozarela") || n.includes("mozarella")) return "mozzarella";
  if (n.includes("pecorino") || n.includes("parmesano") || n.includes("anejo")) return "curado";
  if (n.includes("queso")) return "queso";
  return "generico";
}

const EJEMPLOS: Record<TipoDeProducto, DatosResena[]> = {
  mozzarella: [
    {
      autor: "Pizzería de ejemplo",
      detalle: "Pizzería · Barquisimeto",
      texto: "Gratina parejo y no se quema. La pizza sale dorada y el queso estira como tiene que ser.",
    },
    {
      autor: "Panadería de ejemplo",
      detalle: "Panadería · Barquisimeto",
      texto: "La rallamos todos los días y no se apelmaza. Al rebanarla tampoco se desborona.",
    },
    {
      autor: "Restaurante de ejemplo",
      detalle: "Restaurante · Barquisimeto",
      texto: "Tiene buen sabor y rinde. Los clientes notaron el cambio.",
    },
  ],
  queso: [
    {
      autor: "Lonchería de ejemplo",
      detalle: "Comida rápida · Barquisimeto",
      texto: "Funde bien en las hamburguesas y en las arepas. Siempre llega fresco.",
    },
    {
      autor: "Bodega de ejemplo",
      detalle: "Bodega · Barquisimeto",
      texto: "Es de lo que más sale en la bodega. Lo pido cada semana.",
    },
  ],
  rallado: [
    {
      autor: "Restaurante de ejemplo",
      detalle: "Restaurante · Barquisimeto",
      texto: "Ya viene rallado y nos ahorra trabajo en la cocina. Le da un sabor fuerte a las pastas.",
    },
    {
      autor: "Pizzería de ejemplo",
      detalle: "Pizzería · Barquisimeto",
      texto: "Lo usamos para terminar las pizzas. Con poco basta.",
    },
  ],
  curado: [
    {
      autor: "Restaurante de ejemplo",
      detalle: "Restaurante · Barquisimeto",
      texto: "Sabor intenso, como tiene que ser un queso curado. Para rallar sobre la pasta va perfecto.",
    },
  ],
  huevos: [
    {
      autor: "Panadería de ejemplo",
      detalle: "Panadería · Barquisimeto",
      texto: "Los cartones llegan completos y los huevos, frescos.",
    },
    {
      autor: "Restaurante de ejemplo",
      detalle: "Restaurante · Barquisimeto",
      texto: "Buen precio al mayor y siempre tienen.",
    },
  ],
  suero: [
    {
      autor: "Lonchería de ejemplo",
      detalle: "Comida rápida · Barquisimeto",
      texto: "Espeso y con buen sabor: con las arepas y los pastelitos es lo que piden.",
    },
    {
      autor: "Bodega de ejemplo",
      detalle: "Bodega · Barquisimeto",
      texto: "Sale todos los días. Llega fresco y bien cerrado.",
    },
  ],
  generico: [
    {
      autor: "Negocio de ejemplo",
      detalle: "Barquisimeto",
      texto: "Buen producto y buena atención. Lo volvemos a pedir.",
    },
  ],
};

/** Las reseñas de ejemplo que le tocan a un producto, según lo que es. */
export function ejemplosPara(nombreDelProducto: string): DatosResena[] {
  return EJEMPLOS[tipoDeProducto(nombreDelProducto)].map((e) => ({ ...e }));
}
