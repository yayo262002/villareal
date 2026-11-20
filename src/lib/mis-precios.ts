import { aBolivares, redondear } from "./dinero.ts";
import { presentacionDe } from "./catalogo.ts";

/**
 * «Mis precios»: la lista personal del dueño (el dueño, 20/11/2026: «necesito
 * una lista personal para ver todos los precios del burger y productos»), con
 * lo que está en la web de Villa Real: cada artículo con su costo, su precio
 * al mayor (en dólares y en bolívares a la tasa de hoy) y lo que deja. Solo lo
 * publicado (ni borradores, ni escondidos, ni los combos del detal, que son de
 * la charcutería). Un tipo con artículos da una fila por artículo; sin ellos,
 * la fila es el tipo. Puro, con pruebas; la página está en src/app/precios/.
 */

export type ProductoDeMisPrecios = {
  id: number;
  nombre: string;
  unidad: string;
  costo_usd: number | null;
  precio_usd: number | null;
  activo: number;
  borrador: number;
  familia_id: number | null;
  marca: string;
  presentacion: string;
  contenido: string;
  combo_detal: string | null;
};

export type VarianteDeMisPrecios = {
  id: number;
  producto_id: number;
  nombre: string;
  costo_usd: number | null;
  precio_usd: number | null;
  activo: number;
};

export type FamiliaDeMisPrecios = { id: number; nombre: string; orden: number };

export type FilaDeMisPrecios = {
  clave: string;
  /** El tipo: «Carne para hamburguesa». */
  tipo: string;
  /** El artículo o la presentación: «Minco paquete de 5 × 56 g»; vacío si no hay nada que decir. */
  detalle: string;
  porKilo: boolean;
  costo: number | null;
  precio: number | null;
  /** El precio en bolívares a la tasa de hoy, al céntimo (como la web); null sin tasa o sin precio. */
  bs: number | null;
  /** Lo que deja: precio menos costo, y en % sobre el costo. null si falta alguno. */
  deja: number | null;
  margenPct: number | null;
};

export type GrupoDeMisPrecios = { familia: string; filas: FilaDeMisPrecios[] };

export function filasDeMisPrecios(
  productos: ProductoDeMisPrecios[],
  variantes: VarianteDeMisPrecios[],
  familias: FamiliaDeMisPrecios[],
  tasa: number | null,
): GrupoDeMisPrecios[] {
  const fila = (clave: string, tipo: string, detalle: string, unidad: string, costo: number | null, precio: number | null): FilaDeMisPrecios => {
    const deja = costo !== null && precio !== null ? redondear(precio - costo) : null;
    return {
      clave,
      tipo,
      detalle,
      porKilo: unidad === "kg",
      costo,
      precio,
      bs: precio === null ? null : aBolivares(precio, tasa),
      deja,
      margenPct: deja !== null && costo !== null && costo > 0 ? Math.round(((precio! - costo) / costo) * 1000) / 10 : null,
    };
  };
  const porFamilia = new Map<number | null, FilaDeMisPrecios[]>();
  for (const p of productos) {
    if (p.activo !== 1 || p.borrador === 1 || p.combo_detal !== null) continue;
    const suyos = variantes.filter((v) => v.producto_id === p.id && v.activo === 1);
    const filas = suyos.length
      ? suyos.map((v) => fila(`v${v.id}`, p.nombre, v.nombre, p.unidad, v.costo_usd, v.precio_usd))
      : [fila(`p${p.id}`, p.nombre, [p.marca.trim(), presentacionDe(p)].filter(Boolean).join(" · "), p.unidad, p.costo_usd, p.precio_usd)];
    porFamilia.set(p.familia_id, [...(porFamilia.get(p.familia_id) ?? []), ...filas]);
  }
  const ordenar = (filas: FilaDeMisPrecios[]) =>
    [...filas].sort((a, b) => a.tipo.localeCompare(b.tipo, "es") || a.detalle.localeCompare(b.detalle, "es", { numeric: true }));
  const grupos = [...familias]
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .filter((f) => porFamilia.has(f.id))
    .map((f) => ({ familia: f.nombre, filas: ordenar(porFamilia.get(f.id)!) }));
  const sueltos = [...porFamilia.entries()].filter(([id]) => id === null || !familias.some((f) => f.id === id)).flatMap(([, filas]) => filas);
  return sueltos.length ? [...grupos, { familia: "Otros", filas: ordenar(sueltos) }] : grupos;
}
