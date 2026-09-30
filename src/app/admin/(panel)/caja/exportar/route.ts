import { movimientosEntre } from "@/lib/caja";
import { haySesion } from "@/lib/sesion";
import {
  CABECERA_DE_MOVIMIENTOS,
  CABECERA_POR_DIA,
  aCsv,
  filasDeMovimientos,
  filasPorDia,
  leerPeriodo,
  nombreDelArchivo,
} from "@/lib/exportar";

/**
 * GET /admin/caja/exportar descarga los movimientos para abrirlos en Excel.
 *
 *   ?desde=2026-09-01&hasta=2026-09-30   el periodo; sin fechas, todo
 *   ?forma=dias                          una fila por día en vez de una por movimiento
 *
 * Movimientos son las ventas, los abonos de los clientes, las compras y
 * los pagos a proveedores.
 */
export async function GET(peticion: Request): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const parametros = new URL(peticion.url).searchParams;
  const { desde, hasta } = leerPeriodo(parametros.get("desde"), parametros.get("hasta"));
  const porDia = parametros.get("forma") === "dias";

  const movimientos = await movimientosEntre(desde, hasta);
  const csv = porDia
    ? aCsv(CABECERA_POR_DIA, filasPorDia(movimientos))
    : aCsv(CABECERA_DE_MOVIMIENTOS, filasDeMovimientos(movimientos));
  const nombre = nombreDelArchivo(porDia ? "resumen-por-dia" : "movimientos", desde, hasta);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nombre}"`,
      "cache-control": "no-store",
    },
  });
}
