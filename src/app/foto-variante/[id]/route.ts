import { buscarProducto } from "@/lib/productos";
import { buscarFotoDeVariante, buscarVariante } from "@/lib/variantes";
import { haySesion } from "@/lib/sesion";

/**
 * GET /foto-variante/[id] devuelve la foto de una marca o presentación de
 * un producto. Es pública porque la página del producto lo es, pero solo
 * mientras la variante y el producto estén publicados; escondidos, solo
 * con la sesión del panel.
 *
 * La dirección lleva `?v=` con la fecha de la foto: cambia al cambiarla,
 * así se puede guardar en caché mucho tiempo sin enseñar una vieja.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const variante = await buscarVariante(Number(id));
  if (!variante) return new Response("No existe.", { status: 404 });

  const producto = await buscarProducto(variante.producto_id);
  const visible = variante.activo === 1 && producto?.activo === 1;
  if (!visible && !(await haySesion())) return new Response("No existe.", { status: 404 });

  const foto = await buscarFotoDeVariante(variante.id);
  if (!foto) return new Response("No existe.", { status: 404 });

  return new Response(foto.datos, {
    headers: {
      "content-type": foto.tipo,
      "content-length": String(foto.tamano),
      "cache-control": visible ? "public, max-age=86400" : "private, no-store",
    },
  });
}
