import { buscarAdjunto } from "@/lib/adjuntos";
import { haySesion } from "@/lib/sesion";

/** GET /admin/adjuntos/[id] devuelve la foto o el PDF guardado. Solo con sesión. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const { id } = await params;
  const adjunto = await buscarAdjunto(Number(id));
  if (!adjunto) return new Response("No existe.", { status: 404 });

  return new Response(adjunto.datos, {
    headers: {
      "content-type": adjunto.tipo,
      "content-length": String(adjunto.tamano),
      "cache-control": "private, max-age=3600",
    },
  });
}
