import { describirFuenteDeTasa, tasaEnFecha } from "@/lib/ajustes";
import { haySesion } from "@/lib/sesion";

/**
 * GET /admin/tasas/2026-10-02 dice la tasa que había ese día (bolívares por
 * dólar) y de dónde sale. La usa el formulario de abonos para proponerla
 * cuando se registra un pago de días atrás. Solo con sesión.
 */
export async function GET(_: Request, { params }: { params: Promise<{ fecha: string }> }): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return Response.json(null, { status: 400 });
  const tasa = await tasaEnFecha(fecha);
  return Response.json(tasa ? { ...tasa, descripcion: describirFuenteDeTasa(tasa) } : null, { headers: { "cache-control": "no-store" } });
}
