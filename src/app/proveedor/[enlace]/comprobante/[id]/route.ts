import { buscarProveedorPorEnlace } from "@/lib/proveedores";
import { buscarAdjuntoDeProveedor } from "@/lib/adjuntos";
import { esEnlaceValido } from "@/lib/enlace-cuenta";

/**
 * GET /proveedor/[enlace]/comprobante/[id] devuelve la captura de un pago
 * al proveedor dueño del enlace. Solo las suyas y solo las que van unidas
 * a un pago.
 */
export async function GET(_: Request, { params }: { params: Promise<{ enlace: string; id: string }> }): Promise<Response> {
  const { enlace, id } = await params;
  const proveedor = esEnlaceValido(enlace) ? await buscarProveedorPorEnlace(enlace) : null;
  if (!proveedor) return new Response("No existe.", { status: 404 });

  const adjunto = await buscarAdjuntoDeProveedor(Number(id));
  if (!adjunto || adjunto.proveedor_id !== proveedor.id || !adjunto.pago_proveedor_id) return new Response("No existe.", { status: 404 });

  return new Response(adjunto.datos, {
    headers: {
      "content-type": adjunto.tipo,
      "content-length": String(adjunto.tamano),
      "cache-control": "private, no-store",
    },
  });
}
