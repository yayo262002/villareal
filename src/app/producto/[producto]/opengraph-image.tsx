import { negocio } from "@/config/negocio";
import { buscarProducto } from "@/lib/productos";
import { nombreUnidad, usd } from "@/lib/dinero";
import { idDeRuta } from "@/lib/enlaces";
import { TAMANO_IMAGEN, imagenSocial } from "@/lib/imagen-social";
import { dibujoComoDato } from "@/lib/dibujos";

/**
 * La vista previa de un producto al compartir su enlace: el dibujo, el
 * nombre y el precio en dólares. El precio en bolívares no va porque cambia
 * cada día y la imagen se queda guardada en el teléfono de quien la recibe.
 */
export const alt = `Producto de ${negocio.nombre}`;
export const size = TAMANO_IMAGEN;
export const contentType = "image/png";

export default async function Imagen({ params }: { params: Promise<{ producto: string }> }) {
  const { producto: segmento } = await params;
  const id = idDeRuta(segmento);
  const producto = id ? await buscarProducto(id) : null;

  if (!producto || !producto.activo) {
    return imagenSocial({ titulo: negocio.nombre, detalle: negocio.lema });
  }

  const precio = producto.precio_usd ?? producto.precio_mayor_usd;
  return imagenSocial({
    antetitulo: "Precio del día",
    titulo: producto.nombre,
    detalle:
      precio !== null
        ? `${usd(precio)} por ${nombreUnidad(producto.unidad)} · a tasa BCV`
        : "Consulta el precio del día",
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    dibujo: <img src={dibujoComoDato(producto.nombre)} width={340} height={340} />,
  });
}
