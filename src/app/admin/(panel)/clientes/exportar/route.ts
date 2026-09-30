import { listarClientes } from "@/lib/clientes";
import { haySesion } from "@/lib/sesion";
import { fechaIso } from "@/lib/dinero";

/**
 * GET /admin/clientes/exportar descarga todos los clientes en CSV, para
 * abrirlo en Excel o cargarlo en una lista de difusión de WhatsApp. Va con
 * punto y coma y BOM, que es lo que entiende Excel en castellano.
 */
function celda(valor: string | number | null): string {
  const texto = valor === null ? "" : String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export async function GET(): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const clientes = await listarClientes();
  const cabecera = [
    "Nombre", "Teléfono", "Cédula o RIF", "Dirección", "Tipo", "Nota", "Días de crédito",
    "Comprado USD", "Pagado USD", "Saldo USD", "Última compra", "Cliente desde",
  ];
  const lineas = clientes.map((c) =>
    [
      c.nombre, c.telefono, c.cedula_rif, c.direccion, c.tipo === "mayor" ? "Mayor" : "Detal", c.nota, c.dias_credito,
      c.total_comprado_usd, c.total_pagado_usd, c.saldo_usd, c.ultima_compra, c.creado_en.slice(0, 10),
    ]
      .map(celda)
      .join(";"),
  );
  const csv = "﻿" + [cabecera.join(";"), ...lineas].join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clientes-${fechaIso(new Date())}.csv"`,
      "cache-control": "no-store",
    },
  });
}
