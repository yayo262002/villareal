import { documentosDelLibro } from "@/lib/facturas";
import { haySesion } from "@/lib/sesion";
import { hoy } from "@/lib/dinero";
import { aCsv } from "@/lib/exportar";
import { CABECERA_DEL_LIBRO, filasDelLibro, mesDe } from "@/lib/factura-calculo";

/**
 * GET /admin/facturas/libro?mes=2026-10 descarga el libro de ventas de un
 * mes para Excel: una fila por factura y por nota de crédito (en
 * negativo), con lo exento, la base imponible, el IVA y el total en
 * bolívares a la tasa de cada documento y en dólares. Es lo que el
 * contador necesita para declarar el IVA. Sin mes, el de hoy.
 */
export async function GET(peticion: Request): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const pedido = new URL(peticion.url).searchParams.get("mes") ?? "";
  const mes = /^\d{4}-\d{2}$/.test(pedido) ? pedido : mesDe(hoy());
  const csv = aCsv(CABECERA_DEL_LIBRO, filasDelLibro(await documentosDelLibro(mes)));

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="libro-de-ventas-${mes}.csv"`,
      "cache-control": "no-store",
    },
  });
}
