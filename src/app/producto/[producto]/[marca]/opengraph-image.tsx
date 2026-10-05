import { negocio } from "@/config/negocio";
import { buscarProducto } from "@/lib/productos";
import { buscarVariante } from "@/lib/variantes";
import { nombreDeVenta } from "@/lib/catalogo";
import { unidadEnPalabras, usd } from "@/lib/dinero";
import { idDeRuta } from "@/lib/enlaces";
import { TAMANO_IMAGEN, imagenSocial } from "@/lib/imagen-social";
import { dibujoComoDato } from "@/lib/dibujos";

/**
 * La vista previa de una marca al compartir su enlace: el dibujo de su
 * producto, el nombre con la marca y su precio en dólares. Como la del
 * producto, sin el precio en bolívares, que cambia cada día.
 */
export const alt = `Producto de ${negocio.nombre}`;
export const size = TAMANO_IMAGEN;
export const contentType = "image/png";

export default async function Imagen({ params }: { params: Promise<{ producto: string; marca: string }> }) {
  const { producto: segmentoProducto, marca: segmentoMarca } = await params;
  const idProducto = idDeRuta(segmentoProducto);
  const idMarca = idDeRuta(segmentoMarca);
  const [producto, variante] = await Promise.all([idProducto ? buscarProducto(idProducto) : null, idMarca ? buscarVariante(idMarca) : null]);

  if (!producto || !producto.activo || !variante || !variante.activo || variante.producto_id !== producto.id) {
    return imagenSocial({ titulo: negocio.nombre, detalle: negocio.lema });
  }

  return imagenSocial({
    antetitulo: "Precio del día",
    titulo: nombreDeVenta(producto.nombre, variante.nombre),
    detalle:
      variante.precio_usd !== null
        ? `${usd(variante.precio_usd)} por ${unidadEnPalabras(producto.unidad)} · al mayor, a tasa BCV`
        : "Consulta el precio del día",
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    dibujo: <img src={dibujoComoDato(producto.nombre)} width={340} height={340} />,
  });
}
