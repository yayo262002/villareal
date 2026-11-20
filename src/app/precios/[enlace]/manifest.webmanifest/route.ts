import { negocio } from "@/config/negocio";
import { enlaceDeMisPrecios } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";

/**
 * «Mis precios» como aplicación del teléfono del dueño, igual que la lista de
 * la familia: su propio manifiesto, para que en la pantalla de inicio se llame
 * «Mis precios» y abra directamente en la lista. Solo con el enlace vigente.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ enlace: string }> }): Promise<Response> {
  const { enlace } = await ctx.params;
  if (!esEnlaceValido(enlace) || enlace !== (await enlaceDeMisPrecios())) return new Response("No encontrado", { status: 404 });
  const lista = `/precios/${enlace}`;
  const manifiesto = {
    name: `Mis precios ${negocio.nombreCorto}`,
    short_name: "Mis precios",
    description: "Lo que hay en la web, con su costo, su precio al mayor y lo que deja.",
    lang: "es-VE",
    id: lista,
    start_url: lista,
    scope: lista,
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
