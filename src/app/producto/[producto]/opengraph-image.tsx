import { negocio } from "@/config/negocio";
import { buscarFotoDeProducto, buscarProducto } from "@/lib/productos";
import { buscarFotoDeVariante, variantesDeProducto } from "@/lib/variantes";
import { precioPublicado } from "@/lib/catalogo";
import { unidadEnPalabras, usd } from "@/lib/dinero";
import { idDeRuta } from "@/lib/enlaces";
import { TAMANO_IMAGEN, fotoParaCompartir, imagenSocial } from "@/lib/imagen-social";
import { fotoReferencialDe } from "@/lib/fotos-referenciales";

/**
 * La vista previa de un producto al compartir su enlace: su foto (la suya
 * o la de referencia), el nombre y el precio en dólares. El precio en bolívares no va porque cambia
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

  // Con varias marcas, el precio es «desde» la más barata.
  const marcas = await variantesDeProducto(producto.id, true);
  const publicado = precioPublicado(producto, marcas);
  const precio = publicado.precio_usd;
  // La suya; si no, la de su única marca; si no, la de referencia.
  const propia = (await buscarFotoDeProducto(producto.id)) ?? (marcas.length === 1 ? await buscarFotoDeVariante(marcas[0].id) : null);
  const foto = await fotoParaCompartir(propia ? { datos: propia.datos } : { ruta: fotoReferencialDe(producto.nombre) });
  return imagenSocial({
    antetitulo: "Precio del día",
    titulo: producto.nombre,
    detalle:
      precio !== null
        ? `${publicado.desde ? "Desde " : ""}${usd(precio)} por ${unidadEnPalabras(producto.unidad)} · al mayor, a tasa BCV`
        : "Consulta el precio del día",
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    foto: foto ? <img src={foto} width={340} height={340} style={{ borderRadius: 28 }} /> : undefined,
  });
}
