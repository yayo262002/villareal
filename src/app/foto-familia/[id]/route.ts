import { buscarFamilia, buscarFotoDeFamilia } from "@/lib/familias";
import { haySesion } from "@/lib/sesion";

/** GET /foto-familia/[id] devuelve la portada de una familia: pública si la familia está activa; si no, solo con sesión. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const numero = Number(id);
  const familia = Number.isSafeInteger(numero) && numero > 0 ? await buscarFamilia(numero) : null;
  if (!familia) return new Response("No existe.", { status: 404 });

  const visible = familia.activa === 1;
  if (!visible && !(await haySesion())) return new Response("No existe.", { status: 404 });

  const foto = await buscarFotoDeFamilia(familia.id);
  if (!foto) return new Response("No existe.", { status: 404 });

  return new Response(foto.datos, {
    headers: {
      "content-type": foto.tipo,
      "content-length": String(foto.tamano),
      "cache-control": visible ? "public, max-age=86400" : "private, no-store",
    },
  });
}
