import { revalidatePath } from "next/cache";
import { guardarCopiaNube } from "@/lib/copias-nube";
import { guardarExportacionesEntre, podarExportaciones } from "@/lib/exportaciones";
import { leerFecha } from "@/lib/exportar";
import { hace } from "@/lib/dinero";
import { actualizarTasaOficial } from "@/lib/tasa-oficial";
import { haySesion } from "@/lib/sesion";
import { vieneDelCron } from "@/lib/cron";
import { crearAviso } from "@/lib/avisos";
import { bs, hoy } from "@/lib/dinero";

/**
 * Lo que Vercel hace solo cada mañana, antes de que abra la tienda (cron en
 * `vercel.json`): traer la tasa del BCV, guardar una copia de seguridad y
 * guardar el Excel con los movimientos de ayer (y de anteayer, por si se
 * anotó algo tarde). Llega con la cabecera `Authorization: Bearer
 * CRON_SECRET`; también vale con la sesión del panel. Con `?desde=&hasta=`
 * se rehacen las exportaciones de esos días.
 *
 * Son tres tareas en una sola llamada porque el plan gratuito de Vercel da
 * pocas tareas programadas. Si una falla, las otras se hacen igual.
 */
function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request): Promise<Response> {
  if (!vieneDelCron(request) && !(await haySesion())) {
    return new Response("No autorizado.", { status: 401 });
  }

  const tasa = await actualizarTasaOficial().catch((error) => ({ estado: "error" as const, motivo: mensajeDe(error) }));
  const copia = await guardarCopiaNube()
    .then((c) => ({ estado: "guardada" as const, id: c.id, tamano: c.tamano }))
    .catch((error) => ({ estado: "error" as const, motivo: mensajeDe(error) }));

  const parametros = new URL(request.url).searchParams;
  const desde = leerFecha(parametros.get("desde")) ?? hace(2);
  const hasta = leerFecha(parametros.get("hasta")) ?? hace(1);
  const exportacion = await guardarExportacionesEntre(desde, hasta)
    .then(async (e) => {
      await podarExportaciones();
      return e.dias > 0 ? { estado: "guardada" as const, ...e } : { estado: "sin_movimientos" as const, desde, hasta };
    })
    .catch((error) => ({ estado: "error" as const, motivo: mensajeDe(error) }));

  // La campanita: la tasa de hoy si cambió, y la copia si falló. Un fallo aquí no frena la tarea.
  try {
    if (tasa.estado === "actualizada") {
      await crearAviso({
        clave: `tasa:${hoy()}`,
        tipo: "tasa",
        titulo: `Tasa BCV de hoy: ${bs(tasa.valor)} por dólar`,
        cuerpo: tasa.anterior ? `Ayer: ${bs(tasa.anterior)}.` : "",
        url: "/admin/productos",
      });
    }
    if (copia.estado === "error") {
      await crearAviso({ clave: `copia-fallida:${hoy()}`, tipo: "copia", titulo: "La copia automática de hoy falló", cuerpo: copia.motivo, url: "/admin" });
    }
  } catch {
    // La campanita no es lo importante de la mañana.
  }

  // La portada y las páginas de producto enseñan la tasa: se rehacen.
  revalidatePath("/", "layout");

  const bien = tasa.estado !== "error" && copia.estado !== "error" && exportacion.estado !== "error";
  return Response.json({ ok: bien, tasa, copia, exportacion }, { status: bien ? 200 : 500 });
}
