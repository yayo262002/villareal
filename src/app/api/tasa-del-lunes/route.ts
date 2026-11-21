import { revalidatePath } from "next/cache";
import { actualizarTasaOficial } from "@/lib/tasa-oficial";
import { haySesion } from "@/lib/sesion";
import { vieneDeOtraWeb, vieneDelCron } from "@/lib/cron";
import { crearAviso } from "@/lib/avisos";
import { bs, diaDeLaSemana, fechaCorta, hoy } from "@/lib/dinero";

/**
 * El viernes en la noche, la tasa del lunes (cron en `vercel.json`: a las 7 y,
 * por si el BCV la publica tarde, a las 10 de la noche de Venezuela). Desde que
 * se trae, la web, las listas y la caja van con ella, como en los comercios (el
 * dueño, 21/11/2026). Solo la tasa: la copia y los Excel siguen siendo cosa de
 * la tarea de cada mañana. Llega con `Authorization: Bearer CRON_SECRET`;
 * también vale con la sesión del panel.
 */
export async function GET(request: Request): Promise<Response> {
  if (!vieneDelCron(request) && (vieneDeOtraWeb(request) || !(await haySesion()))) {
    return new Response("No autorizado.", { status: 401 });
  }

  const tasa = await actualizarTasaOficial().catch((error) => ({ estado: "error" as const, motivo: error instanceof Error ? error.message : String(error) }));

  if (tasa.estado === "actualizada" && tasa.delLunes) {
    try {
      await crearAviso({
        clave: `tasa-lunes:${tasa.delLunes}`,
        tipo: "tasa",
        titulo: `Tasa BCV del ${diaDeLaSemana(tasa.delLunes)} ${fechaCorta(tasa.delLunes)}: ${bs(tasa.valor)} por dólar`,
        cuerpo: `Desde esta noche los precios en bolívares van con ella.${tasa.anterior ? ` La de hoy (${diaDeLaSemana(hoy())}): ${bs(tasa.anterior)}.` : ""}`,
        url: "/admin/productos",
      });
    } catch {
      // La campanita no es lo importante.
    }
  }

  // La portada y las demás páginas guardadas enseñan la tasa: se rehacen.
  revalidatePath("/", "layout");
  return Response.json({ ok: tasa.estado !== "error", tasa }, { status: tasa.estado === "error" ? 500 : 200 });
}
