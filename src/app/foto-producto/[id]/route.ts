import { buscarFotoDeProducto, buscarProducto } from "@/lib/productos";
import { haySesion } from "@/lib/sesion";

/**
 * GET /foto-producto/[id] devuelve la foto principal de un producto. Es
 * pública mientras el producto esté en la web; un borrador o uno oculto,
 * solo con la sesión del panel. La dirección lleva `?v=` con la fecha de la
 * foto, así se guarda en caché sin enseñar una vieja.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const numero = Number(id);
  const producto = Number.isSafeInteger(numero) && numero > 0 ? await buscarProducto(numero) : null;
  if (!producto) return new Response("No existe.", { status: 404 });

  const visible = producto.activo === 1;
  if (!visible && !(await haySesion())) return new Response("No existe.", { status: 404 });

  const foto = await buscarFotoDeProducto(producto.id);
  if (!foto) return new Response("No existe.", { status: 404 });

  return new Response(foto.datos, {
    headers: {
      "content-type": foto.tipo,
      "content-length": String(foto.tamano),
      "cache-control": visible ? "public, max-age=86400" : "private, no-store",
    },
  });
}
