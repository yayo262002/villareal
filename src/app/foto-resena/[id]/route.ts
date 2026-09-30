import { buscarFotoDeResena, buscarResena } from "@/lib/resenas";
import { haySesion } from "@/lib/sesion";

/**
 * GET /foto-resena/[id] devuelve la foto de una reseña. Es pública porque
 * la página del producto lo es, pero solo de las reseñas que se ven: las
 * escondidas y las de ejemplo solo con la sesión del panel.
 *
 * La dirección lleva `?v=` con la fecha de la foto: cambia al cambiarla,
 * así se puede guardar en caché mucho tiempo sin enseñar una vieja.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const resena = await buscarResena(Number(id));
  if (!resena) return new Response("No existe.", { status: 404 });

  const visible = resena.publicada === 1 && resena.con_permiso === 1 && resena.de_ejemplo === 0;
  if (!visible && !(await haySesion())) return new Response("No existe.", { status: 404 });

  const foto = await buscarFotoDeResena(resena.id);
  if (!foto) return new Response("No existe.", { status: 404 });

  return new Response(foto.datos, {
    headers: {
      "content-type": foto.tipo,
      "content-length": String(foto.tamano),
      "cache-control": visible ? "public, max-age=604800" : "private, no-store",
    },
  });
}
