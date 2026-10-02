import { listarClientes } from "@/lib/clientes";
import { haySesion } from "@/lib/sesion";
import { fechaCorta, fechaDeLaBase, fechaIso } from "@/lib/dinero";
import { aCsv, numeroParaExcel } from "@/lib/exportar";

/**
 * GET /admin/clientes/exportar descarga todos los clientes en CSV, para
 * abrirlo en Excel o cargarlo en una lista de difusión de WhatsApp. Va con
 * punto y coma, BOM y coma decimal, que es lo que entiende Excel en
 * castellano (`lib/exportar.ts`).
 */

export async function GET(): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const clientes = await listarClientes();
  const cabecera = [
    "Nombre", "Razón social", "Teléfono", "Cédula o RIF", "Dirección", "Nota", "Días de crédito",
    "Comprado USD", "Pagado USD", "Saldo USD", "Última compra", "Cliente desde",
  ];
  const filas = clientes.map((c) => [
    c.nombre, c.razon_social, c.telefono, c.cedula_rif, c.direccion, c.nota, c.dias_credito,
    numeroParaExcel(c.total_comprado_usd), numeroParaExcel(c.total_pagado_usd), numeroParaExcel(c.saldo_usd),
    c.ultima_compra ? fechaCorta(c.ultima_compra) : "", fechaCorta(fechaDeLaBase(c.creado_en)),
  ]);
  const csv = aCsv(cabecera, filas);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clientes-${fechaIso(new Date())}.csv"`,
      "cache-control": "no-store",
    },
  });
}
