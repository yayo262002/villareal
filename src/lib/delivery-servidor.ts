import "server-only";
import { negocio } from "@/config/negocio";
import { ajustesDelDelivery } from "./ajustes";
import { enLaZona, kmEntre, precioDelDelivery, puntoDeLaTienda } from "./delivery";
import { describirUbicacion, leerDireccion } from "./direcciones";
import { buscarEnElMapa } from "./mapa";
import { puntoDeCuadricula, type Punto } from "./plano";

/**
 * El delivery calculado para un sitio: el GPS del teléfono o una dirección escrita. Una dirección por calle y carrera
 * se sitúa en el plano; otra (una urbanización, un centro comercial), se busca en el mapa libre. Lo usan el carrito
 * (`/api/delivery`) y «Probar una dirección» del panel. Las cuentas, en `delivery.ts`.
 */

export type DeliveryCalculado =
  | {
      ok: true;
      /** En línea recta desde la tienda. */
      km: number;
      en_zona: boolean;
      /** «Tu ubicación», «carrera 19 con calle 25» o lo que diga el mapa del sitio. */
      lugar: string;
      punto: Punto;
      /** Por la distancia, sin el «gratis desde» (lo aplica el carrito con lo que suma la compra); null: por confirmar. */
      precio_usd: number | null;
      gratis_desde_usd: number | null;
    }
  | { ok: false; motivo: string };

type Hallado = { punto: Punto; lugar: string };

/** Lo que ya se buscó en el mapa, para no preguntarle otra vez por la misma dirección (el mapa libre pide moderación). */
const yaBuscado = new Map<string, Hallado | null>();
const BUSCADOS_COMO_MUCHO = 300;

async function situarDireccion(direccion: string): Promise<Hallado | null> {
  const lectura = leerDireccion(direccion);
  if (lectura.ubicada) return { punto: puntoDeCuadricula(lectura.ubicacion), lugar: describirUbicacion(lectura.ubicacion) };
  const clave = direccion.toLowerCase().replace(/\s+/g, " ").trim();
  if (yaBuscado.has(clave)) return yaBuscado.get(clave) ?? null;
  const sitio = await buscarEnElMapa(direccion);
  const hallado = sitio ? { punto: { lat: sitio.lat, lon: sitio.lon }, lugar: sitio.sitio } : null;
  if (yaBuscado.size >= BUSCADOS_COMO_MUCHO) yaBuscado.clear();
  yaBuscado.set(clave, hallado);
  return hallado;
}

export const NO_SE_ENCUENTRA =
  "No encontramos esa dirección en el mapa. Escríbela con calle y carrera («Calle 30 entre carreras 20 y 21») o usa «Usar mi ubicación».";

export async function calcularDelivery(consulta: { punto: Punto } | { direccion: string }): Promise<DeliveryCalculado> {
  const tienda = puntoDeLaTienda(negocio.direccion);
  if (!tienda) return { ok: false, motivo: "No se pudo calcular el delivery. Pregúntanos por WhatsApp." };
  let hallado: Hallado | null;
  if ("punto" in consulta) hallado = { punto: consulta.punto, lugar: "Tu ubicación" };
  else {
    const direccion = consulta.direccion.trim().slice(0, 200);
    if (direccion.length < 4) return { ok: false, motivo: "Escribe tu dirección: calle y carrera, o la urbanización o el sector." };
    hallado = await situarDireccion(direccion);
    if (!hallado) return { ok: false, motivo: NO_SE_ENCUENTRA };
  }
  const km = kmEntre(tienda, hallado.punto);
  const zona = enLaZona(hallado.punto);
  const ajustes = await ajustesDelDelivery();
  return {
    ok: true,
    km,
    en_zona: zona,
    lugar: hallado.lugar,
    punto: { lat: Math.round(hallado.punto.lat * 1e6) / 1e6, lon: Math.round(hallado.punto.lon * 1e6) / 1e6 },
    precio_usd: zona ? precioDelDelivery(km, { ...ajustes, gratis_desde_usd: null }) : null,
    gratis_desde_usd: zona ? ajustes.gratis_desde_usd : null,
  };
}
