import { buscarClientePorEnlace } from "@/lib/clientes";
import { buscarAdjunto } from "@/lib/adjuntos";
import { esEnlaceValido } from "@/lib/enlace-cuenta";

/**
 * GET /cuenta/[enlace]/comprobante/[id] devuelve el comprobante de un
 * abono al cliente dueño del enlace. Solo los suyos y solo los que son
 * comprobantes de pago: las fotos de las notas no salen por aquí.
 */
export async function GET(_: Request, { params }: { params: Promise<{ enlace: string; id: string }> }): Promise<Response> {
  const { enlace, id } = await params;
  const cliente = esEnlaceValido(enlace) ? await buscarClientePorEnlace(enlace) : null;
  if (!cliente) return new Response("No existe.", { status: 404 });

  const adjunto = await buscarAdjunto(Number(id));
  if (!adjunto || adjunto.cliente_id !== cliente.id || !adjunto.pago_id) return new Response("No existe.", { status: 404 });

  return new Response(adjunto.datos, {
    headers: {
      "content-type": adjunto.tipo,
      "content-length": String(adjunto.tamano),
      "cache-control": "private, no-store",
    },
  });
}
