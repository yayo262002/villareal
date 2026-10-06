import { aSlug } from "./enlaces.ts";

/**
 * Con lo que arranca el catálogo por familias: las familias iniciales, a
 * cuál va cada producto que ya había, los productos que el dueño pidió
 * preparar y los combos de ofertas. Los productos y los combos nacen en
 * borrador: sin precio, sin marca, sin presentación y sin publicar, hasta
 * que el dueño los complete y los active. Nada de esto inventa precios,
 * marcas ni existencias. Datos puros, con pruebas.
 */

export type FamiliaInicial = { nombre: string; slug: string; descripcion: string; icono: string; orden: number };

export const FAMILIAS_INICIALES: FamiliaInicial[] = [
  { nombre: "Burger", slug: "burger", descripcion: "Para hamburgueserías: lo que necesitas para tus hamburguesas.", icono: "burger", orden: 1 },
  { nombre: "Pizzería", slug: "pizzeria", descripcion: "Para pizzerías: lo que necesitas para tus pizzas.", icono: "pizza", orden: 2 },
  { nombre: "Quesos", slug: "quesos", descripcion: "Quesos al mayor para cocinas y negocios de comida.", icono: "queso", orden: 3 },
  { nombre: "Lácteos", slug: "lacteos", descripcion: "Sueros y cremas de leche al mayor.", icono: "lacteos", orden: 4 },
  { nombre: "Huevos", slug: "huevos", descripcion: "Huevos al mayor.", icono: "huevo", orden: 5 },
  { nombre: "Embutidos", slug: "embutidos", descripcion: "Embutidos al mayor.", icono: "embutido", orden: 6 },
  { nombre: "Salsas y aderezos", slug: "salsas-y-aderezos", descripcion: "Salsas y aderezos al mayor.", icono: "salsa", orden: 7 },
  { nombre: "Papas y congelados", slug: "papas-y-congelados", descripcion: "Papas y congelados al mayor.", icono: "papas", orden: 8 },
  { nombre: "Bebidas", slug: "bebidas", descripcion: "Bebidas al mayor para tu negocio.", icono: "bebida", orden: 9 },
  { nombre: "Complementos gastronómicos", slug: "complementos-gastronomicos", descripcion: "Complementos para la cocina de tu negocio.", icono: "complementos", orden: 10 },
  { nombre: "Otros productos", slug: "otros-productos", descripcion: "Otros productos al mayor.", icono: "otros", orden: 11 },
];

/**
 * A qué familia va un producto que ya había, por su nombre, y en qué otras
 * sale. Solo se usa una vez, al crear las familias, con los productos que
 * no tenían ninguna; después las elige el dueño.
 */
export function familiasPorNombre(nombre: string): { principal: string; relacionadas: string[] } {
  const n = aSlug(nombre);
  if (n.includes("huevo")) return { principal: "huevos", relacionadas: [] };
  if (n.includes("suero") || n.includes("crema-de-leche")) return { principal: "lacteos", relacionadas: [] };
  // La mozzarella sale también en Burger, en sus quesos; el pecorino y el parmesano, solo en Pizzería.
  if (n.includes("mozzarella") || n.includes("mozarela")) return { principal: "quesos", relacionadas: ["pizzeria", "burger"] };
  if (n.includes("pecorino") || n.includes("parmesano")) return { principal: "quesos", relacionadas: ["pizzeria"] };
  if (n.includes("queso")) return { principal: "quesos", relacionadas: ["burger"] };
  return { principal: "otros-productos", relacionadas: [] };
}

export type BorradorInicial = {
  nombre: string;
  /** El slug de su familia principal. */
  familia: string;
  /** Las otras familias en que sale. */
  relacionadas: string[];
  unidad: "kg" | "unidad" | "carton";
  /** La sección en que sale en su familia, si no es la de siempre: la carne de hamburguesa, en «Proteínas». */
  seccion?: string;
  /** La sección en que sale en cada otra familia, si no es la de su familia principal: la tocineta, en Burger, en «Proteínas». */
  secciones?: Record<string, string>;
};

const b = (
  nombre: string,
  familia: string,
  relacionadas: string[],
  unidad: BorradorInicial["unidad"] = "unidad",
  extra: Pick<BorradorInicial, "seccion" | "secciones"> = {},
): BorradorInicial => ({ nombre, familia, relacionadas, unidad, ...extra });

/** En Pizzería, las salsas y los complementos van juntos. */
const SALSAS_Y_COMPLEMENTOS = { pizzeria: "Salsas y complementos" };

/**
 * Los TIPOS de producto que el dueño pidió preparar, una sola vez cada uno
 * aunque su lista los nombrara en varias familias (la tocineta va en
 * Embutidos y sale también en Burger y en Pizzería). Una presentación no es
 * un tipo: la mozzarella rallada, el queso en lonchas, los huevos por caja
 * o los refrescos familiares se añaden como artículos del suyo (Mozzarella,
 * Queso amarillo / Cheddar, Huevos, Refrescos), con su marca y su precio. No
 * están los que ya existen con otro nombre: «Huevos por cartón» es
 * «Huevos», «Queso pecorino» es «Queso pecorino rallado», y el queso
 * amarillo, la mozzarella y el suero ya están. Los de kilo van por kilo; lo
 * demás, por unidad.
 */
export const BORRADORES: BorradorInicial[] = [
  // Quesos
  b("Queso de año", "quesos", ["pizzeria"], "kg"),
  b("Queso parmesano", "quesos", ["pizzeria"], "kg"),
  // Lácteos
  { ...b("Crema de leche", "lacteos", []), seccion: "Cremas de leche" },
  // Embutidos
  b("Tocineta", "embutidos", ["burger", "pizzeria"], "kg", { secciones: { burger: "Proteínas" } }),
  b("Jamón", "embutidos", ["pizzeria"], "kg"),
  b("Pepperoni", "embutidos", ["pizzeria"], "kg"),
  b("Salami", "embutidos", ["pizzeria"], "kg"),
  b("Mortadela", "embutidos", [], "kg"),
  b("Salchichas", "embutidos", []),
  b("Chorizo", "embutidos", [], "kg"),
  // Papas y congelados
  b("Papas fritas congeladas", "papas-y-congelados", ["burger"]),
  b("Hash browns", "papas-y-congelados", ["burger"]),
  b("Nuggets", "papas-y-congelados", ["burger"]),
  b("Aros de cebolla", "papas-y-congelados", ["burger"]),
  // Salsas y aderezos
  b("Ketchup", "salsas-y-aderezos", ["burger"]),
  b("Mayonesa", "salsas-y-aderezos", ["burger"]),
  b("Mostaza", "salsas-y-aderezos", ["burger"]),
  b("Salsa BBQ", "salsas-y-aderezos", ["burger"]),
  b("Salsa de ajo", "salsas-y-aderezos", ["burger"]),
  b("Salsa cheddar", "salsas-y-aderezos", ["burger"]),
  b("Salsa picante", "salsas-y-aderezos", ["burger"]),
  b("Salsa para pizza", "salsas-y-aderezos", ["pizzeria"], "unidad", { secciones: SALSAS_Y_COMPLEMENTOS }),
  // Burger
  b("Pan de hamburguesa", "burger", [], "unidad", { seccion: "Panes" }),
  b("Carne para hamburguesa", "burger", [], "unidad", { seccion: "Proteínas" }),
  b("Pepinillos", "complementos-gastronomicos", ["burger"]),
  b("Cebolla crispy", "complementos-gastronomicos", ["burger"]),
  // Pizzería
  b("Harina para pizza", "pizzeria", [], "unidad", { seccion: "Masa y harinas" }),
  b("Levadura", "pizzeria", [], "unidad", { seccion: "Masa y harinas" }),
  b("Cajas para pizza", "pizzeria", [], "unidad", { seccion: "Empaques" }),
  b("Orégano", "complementos-gastronomicos", ["pizzeria"], "unidad", { secciones: SALSAS_Y_COMPLEMENTOS }),
  b("Champiñones", "complementos-gastronomicos", ["pizzeria"], "unidad", { secciones: SALSAS_Y_COMPLEMENTOS }),
  b("Aceitunas", "complementos-gastronomicos", ["pizzeria"], "unidad", { secciones: SALSAS_Y_COMPLEMENTOS }),
  b("Maíz", "complementos-gastronomicos", ["pizzeria"], "unidad", { secciones: SALSAS_Y_COMPLEMENTOS }),
  b("Piña", "complementos-gastronomicos", ["pizzeria"], "unidad", { secciones: SALSAS_Y_COMPLEMENTOS }),
  // Bebidas
  b("Refrescos", "bebidas", []),
  b("Agua mineral", "bebidas", []),
];

/**
 * Los borradores de antes que eran presentaciones de otro tipo, o el mismo
 * tipo dos veces. Al reorganizar el catálogo se quitan (solo si siguen en
 * borrador y nunca se vendieron): ahora se añaden como artículos del suyo.
 */
export const BORRADORES_RETIRADOS: { nombre: string; ahora: string }[] = [
  { nombre: "Queso cheddar", ahora: "Queso amarillo / Cheddar" },
  { nombre: "Queso amarillo en lonchas", ahora: "una presentación de Queso amarillo / Cheddar" },
  { nombre: "Mozzarella rallada", ahora: "una presentación de la mozzarella" },
  { nombre: "Huevos por caja", ahora: "una presentación de Huevos" },
  { nombre: "Huevos por unidad", ahora: "una presentación de Huevos" },
  { nombre: "Papas ralladas", ahora: "Hash browns" },
  { nombre: "Refrescos individuales", ahora: "una presentación de Refrescos" },
  { nombre: "Refrescos familiares", ahora: "una presentación de Refrescos" },
  { nombre: "Bebidas para restaurantes", ahora: "Refrescos y Agua mineral" },
];

export type OfertaInicial = { nombre: string; descripcion: string; productos: string[] };

/** Los combos que el dueño quiere ofrecer, en borrador y sin precio: él pone después el precio, la vigencia y lo que lleva. */
export const OFERTAS_INICIALES: OfertaInicial[] = [
  {
    nombre: "Pack Burger",
    descripcion: "Queso, tocineta, papas y salsas para tu hamburguesería.",
    productos: ["Queso amarillo", "Tocineta", "Papas fritas congeladas", "Ketchup", "Mayonesa"],
  },
  {
    nombre: "Pack Pizzería",
    descripcion: "Mozzarella, pepperoni, jamón y salsa para pizza.",
    productos: ["Queso mozzarella", "Pepperoni", "Jamón", "Salsa para pizza"],
  },
  {
    nombre: "Pack Emprendedor",
    descripcion: "Queso, tocineta, papas, salsas y bebidas para arrancar tu negocio.",
    productos: ["Queso amarillo", "Tocineta", "Papas fritas congeladas", "Ketchup", "Mayonesa", "Refrescos"],
  },
];

/** Para comparar nombres sin tildes, mayúsculas ni espacios de más: «Jamón» y «jamon» son el mismo. */
export function mismoNombre(a: string, b: string): boolean {
  return aSlug(a) === aSlug(b);
}
