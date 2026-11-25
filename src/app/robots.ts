import type { MetadataRoute } from "next";
import { negocio } from "@/config/negocio";

/** Qué pueden leer los buscadores: la web pública sí; el panel, las tareas y las cuentas de los clientes y de los proveedores, la lista del detal, «Mis precios» y lo que ve la vendedora, no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cuenta", "/proveedor", "/lista", "/precios", "/existencias"] },
    sitemap: `${negocio.web}/sitemap.xml`,
  };
}
