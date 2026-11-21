import { anotarAviso, avisoFirmadoPorMeta, guardarMensajes, palabraDeVerificacion } from "@/lib/whatsapp-api";
import { leerWebhook } from "@/lib/whatsapp-calculo";

/**
 * Donde Meta manda los avisos del WhatsApp del negocio (Meta for Developers → la app «Villa Real Panel» → WhatsApp →
 * Configuración → Webhook).
 *
 * GET: Meta comprueba la dirección con `hub.verify_token` (la palabra que enseña el panel en WhatsApp) y espera de
 * vuelta `hub.challenge`.
 *
 * POST: cada aviso, firmado por Meta con la clave secreta de la app (`X-Hub-Signature-256`). Sin firma buena no se
 * guarda nada (401). Se guardan los mensajes de los clientes, las respuestas que el dueño escribe en el teléfono y el
 * historial; se contesta 200 enseguida, que Meta reintenta si tarda.
 */

const SIN_CACHE = { "cache-control": "no-store" };

export async function GET(peticion: Request): Promise<Response> {
  const p = new URL(peticion.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === (await palabraDeVerificacion())) {
    return new Response(p.get("hub.challenge") ?? "", { headers: { ...SIN_CACHE, "content-type": "text/plain" } });
  }
  return new Response("No.", { status: 403, headers: SIN_CACHE });
}

export async function POST(peticion: Request): Promise<Response> {
  const cuerpo = await peticion.text();
  if (!(await avisoFirmadoPorMeta(cuerpo, peticion.headers.get("x-hub-signature-256")))) {
    return new Response("Firma no válida.", { status: 401, headers: SIN_CACHE });
  }
  let datos: unknown;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: SIN_CACHE });
  }
  const leido = leerWebhook(datos);
  const nuevos = await guardarMensajes(leido.mensajes);
  const resumen = [
    leido.mensajes.length > 0 ? `${leido.mensajes.length} mensajes (${nuevos} nuevos)` : "",
    leido.eventos.length > 0 ? `cuenta: ${leido.eventos.join(", ")}` : "",
    leido.erroresDelHistorial.length > 0 ? `historial: ${leido.erroresDelHistorial.join(", ")}` : "",
  ].filter(Boolean);
  await anotarAviso(resumen.join(" · ") || "aviso sin mensajes", leido.eventos);
  return Response.json({ ok: true, nuevos }, { headers: SIN_CACHE });
}
