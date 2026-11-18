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
  /** El precio se escribe a mano cada vez en la caja: lo que lleva varía (los recortes, según lo que se esté rebanando). */
  precioAMano?: boolean;
  /** Los especiales (del solidario en adelante) van aparte de los de todos los días, como en las hojas. */
  especial?: boolean;
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
    especial: true,
    nombre: "Combo solidario",
    detalle: "1 suero San Pedro de 800 ml, 6 huevos y 250 g de mortadela",
    componentes: [{ detal: "Suero San Pedro bolsa 800 ml", cantidad: 1 }, { detal: "Huevos (cartón de 30)", cantidad: 6 / 30 }, { detal: "Mortadela especial Alibal 1 kg", cantidad: 0.25 }],
  },
  {
    n: 11,
    clave: "perrero",
    especial: true,
    nombre: "Combo perrero",
    detalle: "100 g de queso amarillo tipo cheddar, 100 g de jamón de espalda y 6 salchichas",
    componentes: [{ detal: "Queso amarillo El Legado", cantidad: 0.1 }, { detal: "Jamón de espalda Drago", cantidad: 0.1 }, { detal: "Salchichas calibre 17 (paquete de 20)", cantidad: 6 / 20 }],
  },
  { n: 12, clave: "navideno", especial: true, nombre: "Combo navideño", detalle: "200 g de tocineta y 200 g de jamón ahumado", componentes: [{ detal: "Tocineta Drago", cantidad: g200 }, { detal: "Espalda ahumada Drago", cantidad: g200 }] },
  {
    n: 13,
    clave: "pizzero",
    especial: true,
    nombre: "Combo pizzero",
    detalle: "100 g de tocineta, 200 g de jamón de espalda y 200 g de mozzarella",
    componentes: [{ detal: "Tocineta Drago", cantidad: 0.1 }, { detal: "Jamón de espalda Drago", cantidad: g200 }, { detal: "Mozzarella", cantidad: g200 }],
  },
  {
    n: 14,
    clave: "sandwichero",
    especial: true,
    nombre: "Combo sandwichero",
    detalle: "1 pan de sándwich, 200 g de queso paisa y 200 g de pechuga de pavo ahumada",
    componentes: [{ detal: "Pan blanco enriquecido Viva Mejor 500 g", cantidad: 1 }, { detal: "Queso paisa", cantidad: g200 }, { detal: "Pechuga de pavo ahumada Drago", cantidad: g200 }],
  },
  // Los recortes de las piezas que se rebanan, surtidos. Ni peso ni precio fijos: lo que lleva varía con lo que se esté
  // rebanando (el dueño), así que en la caja el precio se escribe a mano cada vez.
  {
    n: 15,
    clave: "recortes",
    especial: true,
    nombre: "Combo de recortes",
    detalle: "Bandeja de recortes surtidos",
    componentes: [],
    precioAMano: true,
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
  if (combo.precioAMano || combo.componentes.length === 0) return null;
  let suma = 0;
  for (const c of combo.componentes) {
    const precio = precioDe(c.detal);
    if (precio === null) return null;
    suma += precio * c.cantidad;
  }
  return alCentavo(suma);
}

/**
 * Lo que le cuesta un combo al negocio: lo que suman sus productos al costo de la lista del detal (con su IVA si es
 * gravado), sin redondear. null si va a mano (lo que lleva varía) o si a alguno le falta el costo: no se estima.
 */
export function costoDelCombo(combo: ComboDelDetal, costoDe: (nombreDetal: string) => number | null): number | null {
  if (combo.precioAMano || combo.componentes.length === 0) return null;
  let suma = 0;
  for (const c of combo.componentes) {
    const costo = costoDe(c.detal);
    if (costo === null) return null;
    suma += costo * c.cantidad;
  }
  return suma;
}

/** El SKU del combo en la caja: su número, como en la hoja («COMBO-3»). Al escanear o buscar «combo 3», sale. */
export function skuDelCombo(combo: Pick<ComboDelDetal, "n">): string {
  return `COMBO-${combo.n}`;
}

/**
 * Lo que aún no está en la lista del detal, con su costo por kilo estimado (el dueño): con él las hojas de los precios,
 * el flier y la lista de la familia dicen un precio, marcado «estimado». La caja no lo usa: allí se escribe a mano hasta
 * que se cargue. Se quita de aquí al cargarlo.
 */
export const COSTOS_ESTIMADOS: Record<string, number> = { "queso paisa": 10 };

/** El precio al detal, por kilo, de lo que aún no está en la lista: su costo estimado entre el divisor de la charcutería. */
export function precioEstimadoDelDetal(nombre: string, divisorCharcuteria: number): number | null {
  const costo = COSTOS_ESTIMADOS[claveDeNombreDetal(nombre)];
  return costo === undefined ? null : alCentavo(costo / divisorCharcuteria);
}

/**
 * Lo que lleva de un producto, como se dice en la charcutería: «200 g», «6 huevos», «1 unidad». `unidad` es la del
 * producto en la lista del detal (vacía si no está).
 */
export function cuantoLleva(nombre: string, unidad: string, cantidad: number): string {
  // Lo que va por kilo, una pieza de 1 kg que se vende entera («Mortadela especial Alibal 1 kg») y lo que aún no está en la
  // lista (el queso paisa), en gramos.
  if (unidad === "kg" || (cantidad < 1 && (/\b1 kg\b/.test(nombre) || unidad === ""))) return `${Math.round(cantidad * 1000)} g`;
  const deCuantos = /de (\d+)\)/.exec(nombre);
  if (deCuantos) return `${Math.round(cantidad * Number(deCuantos[1]))} ${nombre.split(" ")[0].toLowerCase()}`;
  return cantidad === 1 ? "1 unidad" : `${cantidad} unidades`;
}

export type ParteDelCombo = {
  /** Lo que lleva: «200 g», «6 huevos». */
  cuanto: string;
  /** El nombre del producto en la lista del detal. */
  nombre: string;
  /** Su precio al detal de hoy, por kilo o por unidad; null si no lo tiene. */
  precio: number | null;
  porKilo: boolean;
  /** Lo que pone en el combo: el precio por lo que lleva, sin redondear. */
  importe: number | null;
  /** No está en la lista del detal: el precio sale de su costo estimado. */
  estimado: boolean;
};

export type DesgloseDelCombo = {
  combo: ComboDelDetal;
  partes: ParteDelCombo[];
  /** Lo que suman las partes, subido al centavo (con lo estimado, si lo hay); null si a alguna le falta el precio o va a mano. */
  total: number | null;
  /** Lo que no tiene precio ni en la lista ni estimado. */
  faltan: string[];
};

/**
 * Cada combo, producto por producto: cuánto lleva, a cuánto está el kilo o la unidad al detal y lo que pone en el combo;
 * y el total, con la cuenta de la caja (`precioDelCombo`). `enLaLista` dice la unidad y el precio al detal de un producto
 * de la lista (null si no está); lo que no está toma su precio estimado, si lo tiene.
 */
export function desgloseDelCombo(
  combo: ComboDelDetal,
  enLaLista: (nombreDetal: string) => { unidad: string; precio: number | null } | null,
  divisorCharcuteria: number,
): DesgloseDelCombo {
  const partes = combo.componentes.map((c): ParteDelCombo => {
    const articulo = enLaLista(c.detal);
    const estimado = articulo ? null : precioEstimadoDelDetal(c.detal, divisorCharcuteria);
    const precio = articulo ? articulo.precio : estimado;
    return {
      cuanto: cuantoLleva(c.detal, articulo?.unidad ?? "", c.cantidad),
      nombre: c.detal,
      precio,
      // Lo estimado es por kilo (el queso paisa).
      porKilo: articulo ? articulo.unidad === "kg" : estimado !== null,
      importe: precio === null ? null : precio * c.cantidad,
      estimado: estimado !== null,
    };
  });
  const precioDe = (nombre: string) => partes.find((p) => p.nombre === nombre)?.precio ?? null;
  return { combo, partes, total: precioDelCombo(combo, precioDe), faltan: faltanParaElCombo(combo, precioDe) };
}
