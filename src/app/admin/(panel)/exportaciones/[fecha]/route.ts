import { buscarExportacion } from "@/lib/exportaciones";
import { haySesion } from "@/lib/sesion";

/** GET /admin/exportaciones/2026-10-03 baja el Excel que la tarea diaria guardó para ese día. Solo con sesión. */
export async function GET(_: Request, { params }: { params: Promise<{ fecha: string }> }): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const { fecha } = await params;
  const exportacion = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? await buscarExportacion(fecha) : null;
  if (!exportacion) return new Response("No hay exportación de ese día.", { status: 404 });

  return new Response(exportacion.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="movimientos-${fecha}.csv"`,
      "cache-control": "no-store",
    },
  });
}
