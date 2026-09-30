import { negocio } from "@/config/negocio";

/**
 * El panel como aplicación del teléfono: su propio manifiesto, distinto del
 * de la web pública, para que al ponerlo en la pantalla de inicio se llame
 * «Panel» y abra directamente en el panel, sin barra del navegador.
 *
 * No exige sesión (el proxy lo deja pasar): el navegador lo pide sin
 * cookies y no tiene nada privado.
 */
export function GET(): Response {
  const manifiesto = {
    name: `Panel ${negocio.nombreCorto}`,
    short_name: "Panel",
    description: `El panel de ${negocio.nombre}: clientes, ventas, abonos, despacho y cierre del día.`,
    lang: "es-VE",
    id: "/admin",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffdf7",
    theme_color: "#163f28",
    icons: [
      { src: "/marca/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/marca/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/marca/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Anotar una venta", short_name: "Venta", url: "/admin/ventas" },
      { name: "Registrar un abono", short_name: "Abono", url: "/admin/pagos" },
      { name: "Ruta de despacho", short_name: "Despacho", url: "/admin/despacho" },
      { name: "Cierre del día", short_name: "Cierre", url: "/admin/caja" },
    ],
  };
  return Response.json(manifiesto, {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" },
  });
}
