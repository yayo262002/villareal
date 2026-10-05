import { negocio } from "@/config/negocio";
import { TAMANO_IMAGEN, imagenSocial } from "@/lib/imagen-social";

/** La vista previa de la portada al compartir el enlace de la web. */
export const alt = `${negocio.nombre}: ${negocio.lema.toLowerCase()} en ${negocio.localidad}`;
export const size = TAMANO_IMAGEN;
export const contentType = "image/png";

export default function Imagen() {
  return imagenSocial({
    antetitulo: negocio.localidad,
    titulo: "Insumos al mayor para tu negocio",
    detalle: "Precios del día, a tasa BCV",
  });
}
