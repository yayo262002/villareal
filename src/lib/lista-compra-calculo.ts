/**
 * La lista de compra (el dueño, 18/11/2026: «hazme la lista que pueda abrir en el teléfono»): lo que hay que comprar,
 * dónde sale más barato y a cuánto, para ir tachando en el panel. Aquí, lo que no toca la base: los tipos, cómo se
 * agrupa (por tipo o por proveedor) y cuánto falta.
 */

/** Los tipos de la lista, en el orden en que salen. Lo que no es de ninguno va en «Otros». */
export const TIPOS_DE_COMPRA = [
  ["hamburguesas", "Hamburguesas"],
  ["perros", "Perros calientes"],
  ["pizza", "Pizza"],
  ["papas", "Papas y congelados"],
  ["bebidas", "Refrescos y bebidas"],
  ["desechables", "Desechables y empaques"],
  ["charcuteria", "Embutidos y charcutería"],
  ["huevos", "Huevos"],
  ["viveres", "Víveres de la charcutería"],
  ["otros", "Otros"],
] as const;

export type TipoDeCompra = (typeof TIPOS_DE_COMPRA)[number][0];

/** Los proveedores en el orden de la compra; los demás, después, y lo que no dice dónde, al final. */
export const ORDEN_DE_PROVEEDORES = ["Lusi", "PRODISA", "Tío Víctor", "La Sabrosita", "AMGB", "Chargon", "Drago", "San Andrés", "Donde siempre"];
export const SIN_PROVEEDOR = "Sin proveedor todavía";

export type ArticuloDeCompra = {
  id: number;
  nombre: string;
  categoria: string;
  donde: string;
  precio_usd: number | null;
  nota: string;
  listo: boolean;
  orden: number;
};

export type GrupoDeCompra = { clave: string; titulo: string; faltan: number; articulos: ArticuloDeCompra[] };

const NOMBRES = new Map<string, string>(TIPOS_DE_COMPRA);

export function esTipoDeCompra(valor: string): valor is TipoDeCompra {
  return NOMBRES.has(valor);
}

export function nombreDelTipo(categoria: string): string {
  return NOMBRES.get(categoria) ?? "Otros";
}

/**
 * Los grupos de la pantalla: por tipo (en el orden de `TIPOS_DE_COMPRA`) o por proveedor (los de siempre primero, lo que
 * no dice dónde al final). Cada grupo dice cuánto le falta; con `soloFaltan`, sin lo tachado y sin los grupos completos.
 */
export function agruparCompra(articulos: ArticuloDeCompra[], modo: "tipo" | "proveedor", soloFaltan: boolean): GrupoDeCompra[] {
  const grupos = new Map<string, ArticuloDeCompra[]>();
  for (const a of articulos) {
    const clave = modo === "tipo" ? (esTipoDeCompra(a.categoria) ? a.categoria : "otros") : a.donde.trim() || SIN_PROVEEDOR;
    grupos.set(clave, [...(grupos.get(clave) ?? []), a]);
  }
  const peso = (clave: string) => {
    if (modo === "tipo") return TIPOS_DE_COMPRA.findIndex(([k]) => k === clave);
    if (clave === SIN_PROVEEDOR) return 1000;
    const i = ORDEN_DE_PROVEEDORES.indexOf(clave);
    return i < 0 ? 999 : i;
  };
  return [...grupos.entries()]
    .sort(([a], [b]) => peso(a) - peso(b) || a.localeCompare(b, "es"))
    .map(([clave, lista]) => {
      const ordenados = [...lista].sort((a, b) => a.orden - b.orden || a.id - b.id);
      return {
        clave,
        titulo: modo === "tipo" ? nombreDelTipo(clave) : clave,
        faltan: ordenados.filter((a) => !a.listo).length,
        articulos: soloFaltan ? ordenados.filter((a) => !a.listo) : ordenados,
      };
    })
    .filter((g) => g.articulos.length > 0);
}

/** Cuánto hay en la lista y cuánto falta por comprar. */
export function cuentaDeCompra(articulos: ArticuloDeCompra[]): { total: number; faltan: number } {
  return { total: articulos.length, faltan: articulos.filter((a) => !a.listo).length };
}
