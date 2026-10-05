import type { MetadataRoute } from "next";
import { negocio } from "@/config/negocio";

/**
 * Permite poner la web en la pantalla de inicio del teléfono como si fuera
 * una aplicación, con el león de icono. Al dueño le sirve para abrir el
 * panel de un toque: manteniendo pulsado el icono sale el acceso directo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: negocio.nombre,
    short_name: negocio.nombreCorto,
    description: negocio.descripcion,
    lang: "es-VE",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf7",
    theme_color: "#0e2c1b",
    icons: [
      { src: "/marca/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/marca/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/marca/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Panel del negocio", short_name: "Panel", url: "/admin" },
      { name: "Anotar una venta", short_name: "Venta", url: "/admin/ventas" },
    ],
  };
}
