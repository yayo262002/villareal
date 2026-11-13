import "server-only";
import { ejecutar, fila, filas } from "./db";
import { listarArticulosDetal } from "./detal";
import { reglasDelDetal } from "./ajustes";
import { precioDetalUsd } from "./detal-calculo";
import { COMBOS_DEL_DETAL, claveDeNombreDetal, faltanParaElCombo, precioDelCombo, skuDelCombo, type ComboDelDetal } from "./combos-detal";

/**
 * Los combos del detal en la caja. Cada combo es un producto del catálogo
 * marcado con su clave (`productos.combo_detal`), oculto en la web (no es
 * mercancía al mayor) y con el precio del detal de hoy, que se calcula al
 * abrir la caja: así cuesta lo mismo en el mayor que en la charcutería. La
 * venta es una venta normal, con su nota, su factura y sus estadísticas.
 * Los artículos se crean solos la primera vez que hacen falta, como el
 * cliente de mostrador, y se ponen al día si cambia el nombre o el número.
 */

export type ComboEnLaCaja = {
  combo: ComboDelDetal;
  producto_id: number;
  /** El precio del detal de hoy; null si a algún producto le falta (se escribe a mano en la caja). */
  precio_usd: number | null;
  /** Los productos del combo que no están en la lista del detal o no tienen precio. */
  faltan: string[];
  codigo_barras: string;
};

type FilaDeCombo = { id: number; nombre: string; descripcion: string; sku: string; combo_detal: string; borrador: number; codigo_barras: string };

export async function combosEnLaCaja(): Promise<ComboEnLaCaja[]> {
  const [existentes, articulos, reglas] = await Promise.all([
    filas<FilaDeCombo>("select id, nombre, descripcion, sku, combo_detal, borrador, codigo_barras from productos where combo_detal is not null"),
    listarArticulosDetal(),
    reglasDelDetal(),
  ]);
  const precioPorNombre = new Map(articulos.map((a) => [claveDeNombreDetal(a.nombre), precioDetalUsd(a, reglas)]));
  const precioDe = (nombre: string) => precioPorNombre.get(claveDeNombreDetal(nombre)) ?? null;
  const porClave = new Map(existentes.map((p) => [p.combo_detal, p]));

  const resultado: ComboEnLaCaja[] = [];
  for (const combo of COMBOS_DEL_DETAL) {
    const sku = skuDelCombo(combo);
    let producto = porClave.get(combo.clave);
    if (!producto) {
      // Oculto en la web (activo = 0) y listo para vender (no es borrador). Si otra pantalla se adelantó, se usa el suyo.
      await ejecutar("insert or ignore into productos (nombre, unidad, descripcion, activo, borrador, sku, combo_detal) values (?, 'unidad', ?, 0, 0, ?, ?)", [
        combo.nombre,
        combo.detalle,
        sku,
        combo.clave,
      ]);
      producto = (await fila<FilaDeCombo>("select id, nombre, descripcion, sku, combo_detal, borrador, codigo_barras from productos where combo_detal = ?", [combo.clave])) ?? undefined;
      if (!producto) continue;
    } else if (producto.nombre !== combo.nombre || producto.descripcion !== combo.detalle || producto.sku !== sku) {
      await ejecutar("update productos set nombre = ?, descripcion = ?, sku = ? where id = ?", [combo.nombre, combo.detalle, sku, producto.id]);
    }
    // Un combo que el dueño pasó a borrador no se vende.
    if (Number(producto.borrador) === 1) continue;
    resultado.push({
      combo,
      producto_id: Number(producto.id),
      precio_usd: precioDelCombo(combo, precioDe),
      faltan: faltanParaElCombo(combo, precioDe),
      codigo_barras: producto.codigo_barras ?? "",
    });
  }
  return resultado;
}
