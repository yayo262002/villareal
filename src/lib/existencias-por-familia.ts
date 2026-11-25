import { claveDe, presentacionDe } from "./catalogo.ts";
import { ajustePorRecuento, type Existencia } from "./stock.ts";
import type { FamiliaDeMisPrecios, ProductoDeMisPrecios, VarianteDeMisPrecios } from "./mis-precios.ts";

/**
 * El inventario ordenado como el catálogo: por familias y, dentro, por tipo y
 * artículo. Lo usan el recuento general del panel (`/admin/inventario/contar`,
 * con lo que no está en la web pero tiene existencia o se ha vendido) y lo que
 * ve la vendedora con su enlace (`/existencias/…`, solo lo publicado). El dueño,
 * 25/11/2026: «necesito perfeccionar mucho lo del inventario, que [la vendedora] lo
 * pueda ver desde su teléfono también». Puro, con pruebas.
 */

export type FilaDeExistencias = {
  /** La clave del inventario y de la caja: «3» o «3-7». */
  clave: string;
  /** El tipo: «Jamón de espalda». */
  tipo: string;
  /** El artículo o la presentación: «El Drago espalda cocida»; vacío si no hay nada que decir. */
  detalle: string;
  unidad: string;
  /** Si sale en la web (tipo publicado y artículo visible). */
  publicado: boolean;
  existencia: Existencia;
};

export type GrupoDeExistencias = { familia: string; filas: FilaDeExistencias[] };

/** El grupo del final, con lo que tiene existencia o ventas pero no sale en la web. */
export const FUERA_DE_LA_WEB = "Fuera de la web";

export function existenciasPorFamilia(
  productos: ProductoDeMisPrecios[],
  variantes: VarianteDeMisPrecios[],
  familias: FamiliaDeMisPrecios[],
  existencias: Map<string, Existencia>,
  opciones: { conEscondidos: boolean },
): GrupoDeExistencias[] {
  const porFamilia = new Map<number | null, FilaDeExistencias[]>();
  const escondidos: FilaDeExistencias[] = [];
  for (const p of productos) {
    // Los combos del detal son de la charcutería: no tienen existencia propia.
    if (p.combo_detal !== null) continue;
    const tipoPublicado = p.activo === 1 && p.borrador !== 1;
    const suyos = variantes.filter((v) => v.producto_id === p.id && v.activo === 1);
    const filas = suyos.length
      ? suyos.map((v) => ({ clave: claveDe(p.id, v.id), detalle: v.nombre }))
      : [{ clave: claveDe(p.id, null), detalle: [p.marca.trim(), presentacionDe(p)].filter(Boolean).join(" · ") }];
    for (const f of filas) {
      // Sin existencia calculada es que no se puede vender (el tipo está apagado).
      const existencia = existencias.get(f.clave);
      if (!existencia) continue;
      const fila: FilaDeExistencias = { clave: f.clave, tipo: p.nombre, detalle: f.detalle, unidad: p.unidad, publicado: tipoPublicado, existencia };
      if (tipoPublicado) porFamilia.set(p.familia_id, [...(porFamilia.get(p.familia_id) ?? []), fila]);
      else if (opciones.conEscondidos && (existencia.seguido || existencia.vendido > 0)) escondidos.push(fila);
    }
  }
  const ordenar = (filas: FilaDeExistencias[]) =>
    [...filas].sort((a, b) => a.tipo.localeCompare(b.tipo, "es") || a.detalle.localeCompare(b.detalle, "es", { numeric: true }));
  const grupos = [...familias]
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .filter((f) => porFamilia.has(f.id))
    .map((f) => ({ familia: f.nombre, filas: ordenar(porFamilia.get(f.id)!) }));
  const sueltos = [...porFamilia.entries()].filter(([id]) => id === null || !familias.some((f) => f.id === id)).flatMap(([, filas]) => filas);
  if (sueltos.length) grupos.push({ familia: "Otros", filas: ordenar(sueltos) });
  if (escondidos.length) grupos.push({ familia: FUERA_DE_LA_WEB, filas: ordenar(escondidos) });
  return grupos;
}

export type EstadoParaVendedora = "hay" | "poco" | "agotado" | "sin_contar";

/** Lo que la vendedora necesita saber de un artículo: si hay, si queda poco, si se acabó o si todavía no se ha contado. */
export function estadoParaVendedora(e: Existencia): EstadoParaVendedora {
  if (!e.seguido) return "sin_contar";
  if (e.existencia <= 0) return "agotado";
  return e.estado === "poco" ? "poco" : "hay";
}

export type CambioDeRecuento = {
  clave: string;
  producto_id: number;
  variante_id: number | null;
  nombre: string;
  unidad: string;
  /** Lo que había según el sistema. */
  antes: number;
  contado: number;
  /** Lo que se anota: lo contado menos lo que había (puede ser cero: queda anotado que se contó). */
  cambio: number;
};

/** Más que esto no cabe en la cava: casi siempre es un error al teclear. */
export const CONTADO_MAXIMO = 10000;

/** «12,5», «12.5» o «12»: la cantidad escrita en el recuento; null si no es un número. */
export function leerCantidadContada(escrito: string): number | null {
  const limpio = escrito.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * El recuento general: de cada casilla rellena, lo contado y el cambio que
 * deja contra lo que dice el sistema. Las vacías no se tocan. Lo que no se
 * entiende va en `errores`, con su nombre, y no impide guardar lo demás (con
 * cuarenta casillas, volver a escribirlas todas por una mal puesta sería
 * peor).
 */
export function leerRecuento(entradas: [clave: string, escrito: string][], existencias: Map<string, Existencia>): { cambios: CambioDeRecuento[]; errores: string[] } {
  const cambios: CambioDeRecuento[] = [];
  const errores: string[] = [];
  for (const [clave, escrito] of entradas) {
    if (escrito.trim() === "") continue;
    const e = existencias.get(clave);
    if (!e) continue;
    const contado = leerCantidadContada(escrito);
    if (contado === null || contado > CONTADO_MAXIMO) {
      errores.push(`${e.nombre} («${escrito.trim().slice(0, 20)}»)`);
      continue;
    }
    cambios.push({
      clave,
      producto_id: e.producto_id,
      variante_id: e.variante_id,
      nombre: e.nombre,
      unidad: e.unidad,
      antes: e.existencia,
      contado,
      cambio: ajustePorRecuento(e.existencia, contado),
    });
  }
  return { cambios, errores };
}

const NUMERO = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

/** «23,5 kg», «1 unidad», «12 unidades», «3 cartones»: lo que hay, como se dice. */
export function cantidadLegible(n: number, unidad: string): string {
  const num = NUMERO.format(n);
  if (unidad === "kg") return `${num} kg`;
  const una = Math.abs(n) === 1;
  if (unidad === "carton") return `${num} ${una ? "cartón" : "cartones"}`;
  if (unidad === "unidad") return `${num} ${una ? "unidad" : "unidades"}`;
  return `${num} ${unidad}`;
}
