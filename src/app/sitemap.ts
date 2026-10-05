import type { MetadataRoute } from "next";
import { direccionCompleta } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { agruparPorProducto, listarVariantes } from "@/lib/variantes";
import { rutaProducto, rutaVariante } from "@/lib/enlaces";

/** Se rehace cada hora: así una marca o un producto nuevos llegan a los buscadores sin esperar a publicar otra versión. */
export const revalidate = 3600;

/** El mapa del sitio para los buscadores: la portada, la página de cada producto publicado y la de cada una de sus marcas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productos, variantes] = await Promise.all([listarProductos(true), listarVariantes()]);
  const variantesDe = agruparPorProducto(variantes);
  const ahora = new Date();
  const pagina = (ruta: string, prioridad: number) => ({
    url: direccionCompleta(ruta),
    lastModified: ahora,
    changeFrequency: "daily" as const,
    priority: prioridad,
  });
  return [
    { url: direccionCompleta("/"), lastModified: ahora, changeFrequency: "daily", priority: 1 },
    ...productos.flatMap((p) => [
      pagina(rutaProducto(p), 0.8),
      ...(variantesDe.get(p.id) ?? []).filter((v) => v.activo).map((v) => pagina(rutaVariante(p, v), 0.7)),
    ]),
  ];
}
