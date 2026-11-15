import { ivaDeLosMeses } from "@/lib/facturas";
import { haySesion } from "@/lib/sesion";
import { aCsv, numeroParaExcel } from "@/lib/exportar";
import { mesLegible } from "@/lib/dinero";

/**
 * GET /admin/facturas/iva descarga el IVA mes a mes para el contador: por cada mes con facturas, lo facturado y el IVA
 * de las ventas (débito fiscal), lo comprado y el IVA de las compras (crédito fiscal), el excedente que venía del mes
 * anterior y lo que queda: a pagar o el excedente que pasa al siguiente. Todo en bolívares.
 */
export async function GET(): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });
  const { meses, ventas, compras } = await ivaDeLosMeses();
  const csv = aCsv(
    [
      "Mes",
      "Facturas de venta",
      "Ventas: base imponible Bs",
      "Ventas: exento Bs",
      "IVA de las ventas (débito) Bs",
      "Facturas de compra",
      "Compras: base imponible Bs",
      "Compras: exento Bs",
      "IVA de las compras (crédito) Bs",
      "Excedente del mes anterior Bs",
      "IVA a pagar Bs",
      "Excedente para el mes siguiente Bs",
      "Facturas de venta sin tasa (no cuentan)",
    ],
    meses.map((m) => {
      const v = ventas.get(m.mes);
      const c = compras.get(m.mes);
      return [
        mesLegible(m.mes),
        v?.documentos ?? 0,
        numeroParaExcel(v?.base_bs ?? 0),
        numeroParaExcel(v?.exento_bs ?? 0),
        numeroParaExcel(m.debito_bs),
        c?.documentos ?? 0,
        numeroParaExcel(c?.base_bs ?? 0),
        numeroParaExcel(c?.exento_bs ?? 0),
        numeroParaExcel(m.credito_bs),
        numeroParaExcel(m.excedente_anterior_bs),
        numeroParaExcel(m.a_pagar_bs),
        numeroParaExcel(m.excedente_siguiente_bs),
        v?.sin_tasa ?? 0,
      ];
    }),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="iva-mes-a-mes.csv"',
      "cache-control": "no-store",
    },
  });
}
