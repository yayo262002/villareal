import type { MetadataRoute } from "next";
import { negocio } from "@/config/negocio";

/** Qué pueden leer los buscadores: la web pública sí; el panel, las tareas y las cuentas de los clientes, no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cuenta"] },
    sitemap: `${negocio.web}/sitemap.xml`,
  };
}
