/**
 * Los combos del detal (las bandejas de la charcutería: 200 g de jamón y
 * 200 g de queso, los especiales), para venderlos en la caja al mismo
 * precio que en la charcutería: cada combo cuesta lo que suman sus
 * productos al precio del detal de hoy, subido al centavo. Es la misma
 * cuenta del guion que hace el flier y la lista de combos. Sin `server-only`:
 * puro, con pruebas.
 *
 * Cada producto del combo se busca en la lista del detal por su nombre (sin
 * mirar tildes ni mayúsculas). Si alguno falta (el queso paisa, mientras no
 * se compre) o no tiene precio, el combo queda sin precio y en la caja se
 * escribe a mano. El orden y los números son los de las hojas y el cartel
 * (publicidad/combos-datos.js): primero los de todos los días, cada uno junto
 * a los de su mismo producto, y al final los especiales. La `clave` no cambia
 * aunque cambie el número: es la que une el combo con su artículo de la caja.
 */

export type ComponenteDelCombo = {
  /** El nombre del producto en la lista del detal. */
  detal: string;
  /** Cuánto lleva, en la unidad del detal: kilos, o la fracción de la unidad (6 huevos de un cartón de 30 = 6/30). */
  cantidad: number;
};

export type ComboDelDetal = {
  n: number;
  clave: string;
  /** El nombre del artículo en la caja, en la nota y en la factura. */
  nombre: string;
  /** Lo que lleva, como en la hoja del combo. */
  detalle: string;
  componentes: ComponenteDelCombo[];
};

const DE_CADA_UNO = "200 g de cada producto";
const g200 = 0.2;

export const COMBOS_DEL_DETAL: ComboDelDetal[] = [
  { n: 1, clave: "pierna-amarillo", nombre: "Combo jamón de pierna + queso amarillo", detalle: DE_CADA_UNO, componentes: [{ detal: "Jamón de pierna superior Drago", cantidad: g200 }, { detal: "Queso gouda Vallecito", cantidad: g200 }] },
  { n: 2, clave: "espalda-cheddar", nombre: "Combo jamón de espalda + queso amarillo tipo cheddar", detalle: DE_CADA_UNO, componentes: [{ detal: "Jamón de espalda Drago", cantidad: g200 }, { detal: "Queso amarillo El Legado", cantidad: g200 }] },
  { n: 3, clave: "espalda-mozzarella", nombre: "Combo jamón de espalda + mozzarella", detalle: DE_CADA_UNO, componentes: [{ detal: "Jamón de espalda Drago", cantidad: g200 }, { detal: "Mozzarella", cantidad: g200 }] },
  { n: 4, clave: "ahumado-mozzarella", nombre: "Combo jamón ahumado + mozzarella", detalle: DE_CADA_UNO, componentes: [{ detal: "Espalda ahumada Drago", cantidad: g200 }, { detal: "Mozzarella", cantidad: g200 }] },
  { n: 5, clave: "arepero-mozzarella", nombre: "Combo jamón arepero + mozzarella", detalle: DE_CADA_UNO, componentes: [{ detal: "Jamón arepero Drago", cantidad: g200 }, { detal: "Mozzarella", cantidad: g200 }] },
  { n: 6, clave: "pavo-mozzarella", nombre: "Combo pechuga de pavo + mozzarella", detalle: DE_CADA_UNO, componentes: [{ detal: "Pechuga de pavo Drago", cantidad: g200 }, { detal: "Mozzarella", cantidad: g200 }] },
  { n: 7, clave: "pavo-cheddar", nombre: "Combo pechuga de pavo + queso amarillo tipo cheddar", detalle: DE_CADA_UNO, componentes: [{ detal: "Pechuga de pavo Drago", cantidad: g200 }, { detal: "Queso amarillo El Legado", cantidad: g200 }] },
  { n: 8, clave: "bolona-cheddar", nombre: "Combo boloña de pollo + queso amarillo tipo cheddar", detalle: DE_CADA_UNO, componentes: [{ detal: "Boloña de pollo Alpro", cantidad: g200 }, { detal: "Queso amarillo El Legado", cantidad: g200 }] },
  { n: 9, clave: "mortadela-cheddar", nombre: "Combo mortadela especial + queso amarillo tipo cheddar", detalle: DE_CADA_UNO, componentes: [{ detal: "Mortadela especial Punta de Monte para rebanar", cantidad: g200 }, { detal: "Queso amarillo El Legado", cantidad: g200 }] },
  {
    n: 10,
    clave: "solidario",
    nombre: "Combo solidario",
    detalle: "1 suero San Pedro de 800 ml, 6 huevos y 250 g de mortadela",
    componentes: [{ detal: "Suero San Pedro bolsa 800 ml", cantidad: 1 }, { detal: "Huevos (cartón de 30)", cantidad: 6 / 30 }, { detal: "Mortadela especial Alibal 1 kg", cantidad: 0.25 }],
  },
  {
    n: 11,
    clave: "perrero",
    nombre: "Combo perrero",
    detalle: "100 g de queso amarillo tipo cheddar, 100 g de jamón de espalda y 6 salchichas",
    componentes: [{ detal: "Queso amarillo El Legado", cantidad: 0.1 }, { detal: "Jamón de espalda Drago", cantidad: 0.1 }, { detal: "Salchichas calibre 17 (paquete de 20)", cantidad: 6 / 20 }],
  },
  { n: 12, clave: "navideno", nombre: "Combo navideño", detalle: "200 g de tocineta y 200 g de jamón ahumado", componentes: [{ detal: "Tocineta Drago", cantidad: g200 }, { detal: "Espalda ahumada Drago", cantidad: g200 }] },
  {
    n: 13,
    clave: "pizzero",
    nombre: "Combo pizzero",
    detalle: "100 g de tocineta, 200 g de jamón de espalda y 200 g de mozzarella",
    componentes: [{ detal: "Tocineta Drago", cantidad: 0.1 }, { detal: "Jamón de espalda Drago", cantidad: g200 }, { detal: "Mozzarella", cantidad: g200 }],
  },
  {
    n: 14,
    clave: "sandwichero",
    nombre: "Combo sandwichero",
    detalle: "1 pan de sándwich, 200 g de queso paisa y 200 g de pechuga de pavo ahumada",
    componentes: [{ detal: "Pan blanco enriquecido Viva Mejor 500 g", cantidad: 1 }, { detal: "Queso paisa", cantidad: g200 }, { detal: "Pechuga de pavo ahumada Drago", cantidad: g200 }],
  },
];

/** El nombre de un producto del detal, para buscarlo sin mirar tildes, mayúsculas ni espacios de más. */
export function claveDeNombreDetal(nombre: string): string {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Al centavo, siempre hacia arriba (como la lista del detal): nunca en contra del negocio. */
function alCentavo(n: number): number {
  return Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
}

/** Lo que falta para poner precio a un combo: los productos que no están en la lista del detal o no tienen precio. */
export function faltanParaElCombo(combo: ComboDelDetal, precioDe: (nombreDetal: string) => number | null): string[] {
  return combo.componentes.filter((c) => precioDe(c.detal) === null).map((c) => c.detal);
}

/**
 * El precio del combo: lo que suman sus productos al precio del detal de hoy, subido al centavo. null si a alguno le
 * falta el precio (entonces se escribe a mano en la caja).
 */
export function precioDelCombo(combo: ComboDelDetal, precioDe: (nombreDetal: string) => number | null): number | null {
  let suma = 0;
  for (const c of combo.componentes) {
    const precio = precioDe(c.detal);
    if (precio === null) return null;
    suma += precio * c.cantidad;
  }
  return alCentavo(suma);
}

/** El SKU del combo en la caja: su número, como en la hoja («COMBO-3»). Al escanear o buscar «combo 3», sale. */
export function skuDelCombo(combo: Pick<ComboDelDetal, "n">): string {
  return `COMBO-${combo.n}`;
}
