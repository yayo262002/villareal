import type { MetadataRoute } from "next";
import { negocio } from "@/config/negocio";

/** Qué pueden leer los buscadores: la web pública sí; el panel y las tareas, no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${negocio.web}/sitemap.xml`,
  };
}
