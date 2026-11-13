import { listarFacturasDeCompra } from "@/lib/facturas-compra";
import { haySesion } from "@/lib/sesion";
import { hoy } from "@/lib/dinero";
import { aCsv } from "@/lib/exportar";
import { mesDe } from "@/lib/factura-calculo";
import { CABECERA_DEL_LIBRO_DE_COMPRAS, filasDelLibroDeCompras } from "@/lib/libro-compras-calculo";

/**
 * GET /admin/facturas/compras/libro?mes=2026-11 descarga el libro de
 * compras de un mes para Excel: una fila por factura de compra, con lo
 * exento, la base imponible, el IVA (el crédito fiscal) y el total en
 * bolívares, y el total en dólares a la tasa de su día. Sin mes, el de hoy.
 */
export async function GET(peticion: Request): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const pedido = new URL(peticion.url).searchParams.get("mes") ?? "";
  const mes = /^\d{4}-\d{2}$/.test(pedido) ? pedido : mesDe(hoy());
  const csv = aCsv(CABECERA_DEL_LIBRO_DE_COMPRAS, filasDelLibroDeCompras(await listarFacturasDeCompra(mes)));

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="libro-de-compras-${mes}.csv"`,
      "cache-control": "no-store",
    },
  });
}
