import { timingSafeEqual } from "node:crypto";
import { guardarCopiaNube } from "@/lib/copias-nube";
import { haySesion } from "@/lib/sesion";

/**
 * Vercel llama a esta ruta cada noche (cron en `vercel.json`) con la
 * cabecera `Authorization: Bearer CRON_SECRET`. También vale con la sesión
 * del panel, para el botón «Guardar copia ahora».
 */
function vieneDelCron(request: Request): boolean {
  const secreto = process.env.CRON_SECRET ?? "";
  const cabecera = request.headers.get("authorization") ?? "";
  if (!secreto || !cabecera.startsWith("Bearer ")) return false;
  const a = Buffer.from(cabecera.slice(7));
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!vieneDelCron(request) && !(await haySesion())) {
    return new Response("No autorizado.", { status: 401 });
  }
  const copia = await guardarCopiaNube();
  return Response.json({ ok: true, id: copia.id, creado_en: copia.creado_en, tamano: copia.tamano });
}
