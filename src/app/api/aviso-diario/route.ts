import { haySesion } from "@/lib/sesion";
import { vieneDelCron } from "@/lib/cron";
import { mandarAvisoDeLaManana } from "@/lib/avisos";

/**
 * El aviso de cada mañana (cron en `vercel.json`, a las 7 de Venezuela,
 * después de que la tarea de las 6 trajo la tasa): crea los avisos del
 * día en la campanita y manda el resumen a los teléfonos con los avisos
 * activados. Llega con `Authorization: Bearer CRON_SECRET`; también vale
 * con la sesión del panel.
 */
export async function GET(request: Request): Promise<Response> {
  if (!vieneDelCron(request) && !(await haySesion())) return new Response("No autorizado.", { status: 401 });
  try {
    const resultado = await mandarAvisoDeLaManana();
    return Response.json({ ok: true, ...resultado });
  } catch (error) {
    return Response.json({ ok: false, motivo: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
