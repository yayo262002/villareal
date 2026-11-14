import { calcularDelivery } from "@/lib/delivery-servidor";

/**
 * GET /api/delivery?lat=10.06&lon=-69.32 (el GPS del teléfono) o ?direccion=Calle 30 entre carreras 20 y 21 dice a
 * cuántos kilómetros de la tienda está el cliente (en línea recta), si está donde se reparte (Barquisimeto y Cabudare)
 * y el precio del delivery con las tarifas del panel (null: por confirmar; con «gratis desde», el carrito lo aplica con
 * lo que suma la compra). Pública, para el carrito; no guarda nada. Las cuentas, en `src/lib/delivery-servidor.ts`.
 */
export async function GET(peticion: Request): Promise<Response> {
  const p = new URL(peticion.url).searchParams;
  let resultado;
  if (p.has("lat") || p.has("lon")) {
    const lat = Number(p.get("lat"));
    const lon = Number(p.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return Response.json({ ok: false, motivo: "La ubicación no se entiende." }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    resultado = await calcularDelivery({ punto: { lat, lon } });
  } else {
    resultado = await calcularDelivery({ direccion: p.get("direccion") ?? "" });
  }
  return Response.json(resultado, { headers: { "cache-control": "no-store" } });
}
