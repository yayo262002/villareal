import "server-only";
import { filas } from "./db";
import { alicuotaIva } from "./ajustes";
import { costoEnDolares } from "./detal-calculo";
import { COMBOS_DEL_DETAL, claveDeNombreDetal, costoDelCombo } from "./combos-detal";

/**
 * Lo que le cuesta hoy al negocio cada cosa que se vende, para guardarlo con
 * la venta: el costo de la marca; el del tipo, si se vende de una sola forma
 * (el de Productos, que se pone al día solo con cada factura cargada en la
 * lista del detal si está unido a ella); y el de un combo del detal, lo que
 * suman sus productos al costo de la lista. Lo que no tiene costo queda en
 * null: no se inventa, y el Reparto del mes lo dice.
 */

type LineaConArticulo = { producto_id: number; variante_id?: number | null };

/** El costo de cada línea, en su orden, redondeado a cuatro decimales (un kilo de 7,6 $ no es 7,60000001). */
export async function costosDelDia(lineas: LineaConArticulo[]): Promise<(number | null)[]> {
  if (lineas.length === 0) return [];
  const idsProductos = [...new Set(lineas.map((l) => Number(l.producto_id)))];
  const idsVariantes = [...new Set(lineas.map((l) => (l.variante_id ? Number(l.variante_id) : null)).filter((id): id is number => id !== null))];
  const huecos = (n: number) => Array.from({ length: n }, () => "?").join(", ");
  const [productos, variantes] = await Promise.all([
    filas<{ id: number; costo_usd: number | null; combo_detal: string | null }>(`select id, costo_usd, combo_detal from productos where id in (${huecos(idsProductos.length)})`, idsProductos),
    idsVariantes.length
      ? filas<{ id: number; producto_id: number; costo_usd: number | null }>(`select id, producto_id, costo_usd from variantes where id in (${huecos(idsVariantes.length)})`, idsVariantes)
      : Promise.resolve([]),
  ]);
  const producto = new Map(productos.map((p) => [Number(p.id), p]));
  const variante = new Map(variantes.map((v) => [Number(v.id), v]));

  // La lista del detal solo hace falta si se vende un combo.
  let costoDeLaLista: ((nombre: string) => number | null) | null = null;
  if (productos.some((p) => p.combo_detal)) {
    const [articulos, ivaPct] = await Promise.all([
      filas<{ nombre: string; costo_bs: number | null; costo_usd: number | null; iva: "general" | "exento"; tasa_compra: number | null }>(
        "select nombre, costo_bs, costo_usd, iva, tasa_compra from lista_detal",
      ),
      alicuotaIva(),
    ]);
    const porNombre = new Map(articulos.map((a) => [claveDeNombreDetal(a.nombre), costoEnDolares(a, ivaPct)]));
    costoDeLaLista = (nombre) => porNombre.get(claveDeNombreDetal(nombre)) ?? null;
  }

  const valido = (n: number | null | undefined) => (n !== null && n !== undefined && Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n) * 10000) / 10000 : null);
  return lineas.map((l) => {
    const p = producto.get(Number(l.producto_id));
    if (!p) return null;
    // El costo de la marca no se toma del tipo: cada marca cuesta lo suyo.
    if (l.variante_id) {
      const v = variante.get(Number(l.variante_id));
      return v && Number(v.producto_id) === Number(p.id) ? valido(v.costo_usd) : null;
    }
    if (p.combo_detal) {
      const combo = COMBOS_DEL_DETAL.find((c) => c.clave === p.combo_detal);
      return combo && costoDeLaLista ? valido(costoDelCombo(combo, costoDeLaLista)) : null;
    }
    return valido(p.costo_usd);
  });
}
