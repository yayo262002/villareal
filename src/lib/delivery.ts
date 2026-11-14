import { leerDireccion } from "./direcciones.ts";
import { estaEnLosAlrededores, metrosEntre, puntoDeCuadricula, type Punto } from "./plano.ts";

/**
 * El delivery de la web: a Barquisimeto y Cabudare, con el precio según la distancia en línea recta desde la tienda.
 * El cliente dice dónde está en el carrito (el GPS del teléfono o su dirección escrita) y la web le dice a cuántos
 * kilómetros está y cuánto cuesta el delivery, con las tarifas que el dueño pone en el panel (`/admin/delivery`):
 * «hasta 3 km, 1 $; hasta 6 km, 2 $…». Sin tarifas, o más allá de la última, «por confirmar». Fuera de Barquisimeto y
 * Cabudare (los alrededores del plano), se confirma por WhatsApp. Cálculo puro, con pruebas.
 */

/** Una tarifa: hasta tantos kilómetros, tantos dólares. */
export type TarifaDeDelivery = { hasta_km: number; precio_usd: number };

export type AjustesDeDelivery = {
  /** De la más cerca a la más lejos. */
  tarifas: TarifaDeDelivery[];
  /** Con una compra desde este monto (en dólares), el delivery no se cobra. null: siempre se cobra. */
  gratis_desde_usd: number | null;
};

export const SIN_TARIFAS: AjustesDeDelivery = { tarifas: [], gratis_desde_usd: null };

/** Cuántas tarifas caben en el formulario del panel. */
export const TARIFAS_MAXIMAS = 8;

/** Dónde se reparte: lo dice la web al cliente. */
export const ZONA_DE_DELIVERY = "Barquisimeto y Cabudare";

/** Dónde está la tienda en el mapa: su dirección («Calle 38 entre carreras 30 y 31») puesta en el plano. */
export function puntoDeLaTienda(direccion: string): Punto | null {
  const lectura = leerDireccion(direccion);
  return lectura.ubicada ? puntoDeCuadricula(lectura.ubicacion) : null;
}

/** Los kilómetros en línea recta entre dos puntos, con un decimal. */
export function kmEntre(a: Punto, b: Punto): number {
  return Math.round(metrosEntre(a, b) / 100) / 10;
}

/** Si un punto está donde se reparte: Barquisimeto y Cabudare (los alrededores del plano). */
export function enLaZona(p: Punto): boolean {
  return estaEnLosAlrededores(p);
}

/**
 * Lo que cuesta llevar el pedido a tantos kilómetros: la primera tarifa que llega hasta ahí. Más allá de la última, o
 * sin tarifas, null (por confirmar). Con una compra desde «gratis desde», 0.
 */
export function precioDelDelivery(km: number, ajustes: AjustesDeDelivery, compraUsd = 0): number | null {
  const tarifa = ajustes.tarifas.find((t) => km <= t.hasta_km);
  if (!tarifa) return null;
  if (ajustes.gratis_desde_usd !== null && compraUsd >= ajustes.gratis_desde_usd) return 0;
  return tarifa.precio_usd;
}

/** Los ajustes guardados (JSON en `ajustes.delivery`), revisados: lo que no tiene sentido no cuenta. */
export function leerAjustesDeDelivery(texto: string | null | undefined): AjustesDeDelivery {
  if (!texto) return SIN_TARIFAS;
  try {
    const crudo = JSON.parse(texto) as { tarifas?: unknown; gratis_desde_usd?: unknown };
    const tarifas = Array.isArray(crudo.tarifas)
      ? crudo.tarifas
          .map((t) => ({ hasta_km: Number((t as TarifaDeDelivery)?.hasta_km), precio_usd: Number((t as TarifaDeDelivery)?.precio_usd) }))
          .filter((t) => Number.isFinite(t.hasta_km) && t.hasta_km > 0 && Number.isFinite(t.precio_usd) && t.precio_usd >= 0)
          .sort((a, b) => a.hasta_km - b.hasta_km)
      : [];
    const gratis = Number(crudo.gratis_desde_usd);
    return { tarifas, gratis_desde_usd: crudo.gratis_desde_usd !== null && Number.isFinite(gratis) && gratis > 0 ? gratis : null };
  } catch {
    return SIN_TARIFAS;
  }
}

/** Un número escrito como venga: «2,5», «2.5», «$2». */
function numeroEscrito(texto: string): number | null {
  const limpio = texto.trim().replace(/[$\s]/g, "").replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Las tarifas del formulario del panel: cada fila, «hasta tantos km» y «tantos $». Una fila vacía no cuenta; una a medias
 * o con números que no pueden ser, es un error. Dos con los mismos kilómetros, también.
 */
export function ajustesDelFormulario(filas: { hasta_km: string; precio_usd: string }[], gratisDesde: string): { ajustes: AjustesDeDelivery } | { error: string } {
  const tarifas: TarifaDeDelivery[] = [];
  for (const [i, f] of filas.entries()) {
    const km = numeroEscrito(f.hasta_km);
    const precio = numeroEscrito(f.precio_usd);
    if (km === null && precio === null) continue;
    if (km === null || precio === null) return { error: `En la fila ${i + 1} falta ${km === null ? "hasta cuántos kilómetros" : "el precio"}.` };
    if (Number.isNaN(km) || km <= 0 || km > 100) return { error: `En la fila ${i + 1}, los kilómetros tienen que ser un número entre 0 y 100.` };
    if (Number.isNaN(precio) || precio < 0 || precio > 100) return { error: `En la fila ${i + 1}, el precio tiene que ser un número de dólares entre 0 y 100.` };
    tarifas.push({ hasta_km: Math.round(km * 10) / 10, precio_usd: Math.round(precio * 100) / 100 });
  }
  tarifas.sort((a, b) => a.hasta_km - b.hasta_km);
  if (tarifas.some((t, i) => i > 0 && t.hasta_km === tarifas[i - 1].hasta_km)) return { error: "Hay dos tarifas con los mismos kilómetros." };
  const gratis = numeroEscrito(gratisDesde);
  if (gratis !== null && (Number.isNaN(gratis) || gratis <= 0)) return { error: "El monto para el delivery gratis tiene que ser un número de dólares mayor que 0, o quedar vacío." };
  return { ajustes: { tarifas, gratis_desde_usd: gratis } };
}

/** El enlace a Google Maps con un punto: lo que va en el pedido por WhatsApp para que el repartidor llegue. */
export function enlaceDeUbicacion(p: Punto): string {
  return `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
}

/** «3,2 km». */
export function textoKm(km: number): string {
  return `${new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 }).format(km)} km`;
}
