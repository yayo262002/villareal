import type { MetadataRoute } from "next";
import { direccionCompleta } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { rutaProducto } from "@/lib/enlaces";

/** El mapa del sitio para los buscadores: la portada y la página de cada producto publicado. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productos = await listarProductos(true);
  const ahora = new Date();
  return [
    { url: direccionCompleta("/"), lastModified: ahora, changeFrequency: "daily", priority: 1 },
    ...productos.map((p) => ({
      url: direccionCompleta(rutaProducto(p)),
      lastModified: ahora,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
