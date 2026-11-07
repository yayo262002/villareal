import { negocio } from "@/config/negocio";
import { enlaceDeLaLista } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";

/**
 * La lista de precios como aplicación del teléfono de la familia: su propio
 * manifiesto, distinto del de la web pública, para que al ponerla en la
 * pantalla de inicio se llame «Precios», abra directamente en la lista (no en
 * la portada de la web) y no salga de ella. Solo con el enlace vigente: al
 * renovarlo, el de antes da 404 como la lista.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ enlace: string }> }): Promise<Response> {
  const { enlace } = await ctx.params;
  if (!esEnlaceValido(enlace) || enlace !== (await enlaceDeLaLista())) return new Response("No encontrado", { status: 404 });
  const lista = `/lista/${enlace}`;
  const manifiesto = {
    name: `Precios ${negocio.nombreCorto}`,
    short_name: "Precios",
    description: "La lista de precios del día, en bolívares a la tasa BCV y en dólares.",
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
