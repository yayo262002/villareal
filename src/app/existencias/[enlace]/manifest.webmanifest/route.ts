import { negocio } from "@/config/negocio";
import { enlaceDeExistencias } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";

/**
 * Lo que hay, como aplicación del teléfono de la vendedora, igual que la lista
 * de la familia: su propio manifiesto, para que en la pantalla de inicio se
 * llame «Lo que hay» y abra directamente ahí. Solo con el enlace vigente.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ enlace: string }> }): Promise<Response> {
  const { enlace } = await ctx.params;
  if (!esEnlaceValido(enlace) || enlace !== (await enlaceDeExistencias())) return new Response("No encontrado", { status: 404 });
  const pagina = `/existencias/${enlace}`;
  const manifiesto = {
    name: `Lo que hay · ${negocio.nombreCorto}`,
    short_name: "Lo que hay",
    description: "Lo que hay en la tienda ahora, al día con las ventas.",
    lang: "es-VE",
    id: pagina,
    start_url: pagina,
    scope: pagina,
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffdf7",
    theme_color: "#0e2c1b",
    icons: [
      { src: "/marca/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/marca/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/marca/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifiesto, {
    headers: { "content-type": "application/manifest+json", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
