import "server-only";
import { db } from "./db";

export type TipoCliente = "detal" | "mayor";

export type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
  cedula_rif: string;
  direccion: string;
  tipo: TipoCliente;
  nota: string;
  creado_en: string;
};

/** Cliente con lo que ha comprado, lo que ha pagado y lo que debe, todo en USD. */
export type ClienteConSaldo = Cliente & {
  total_comprado_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
};

export type DatosCliente = Omit<Cliente, "id" | "creado_en">;

const CONSULTA_CON_SALDO = `
  select
    c.*,
    coalesce((select sum(total_usd) from ventas v where v.cliente_id = c.id), 0) as total_comprado_usd,
    coalesce((select sum(monto_usd) from pagos p where p.cliente_id = c.id), 0) as total_pagado_usd
  from clientes c
`;

function conSaldo(fila: Record<string, unknown>): ClienteConSaldo {
  const comprado = Number(fila.total_comprado_usd);
  const pagado = Number(fila.total_pagado_usd);
  return {
    ...(fila as unknown as Cliente),
    total_comprado_usd: comprado,
    total_pagado_usd: pagado,
    saldo_usd: Math.round((comprado - pagado) * 100) / 100,
  };
}

export function listarClientes(): ClienteConSaldo[] {
  const filas = db()
    .prepare(`${CONSULTA_CON_SALDO} order by c.nombre collate nocase`)
    .all() as Record<string, unknown>[];
  return filas.map(conSaldo);
}

export function buscarCliente(id: number): ClienteConSaldo | null {
  const fila = db()
    .prepare(`${CONSULTA_CON_SALDO} where c.id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return fila ? conSaldo(fila) : null;
}

export function crearCliente(datos: DatosCliente): number {
  const resultado = db()
    .prepare(
      `insert into clientes (nombre, telefono, cedula_rif, direccion, tipo, nota)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.tipo, datos.nota);
  return Number(resultado.lastInsertRowid);
}

export function actualizarCliente(id: number, datos: DatosCliente): void {
  db()
    .prepare(
      `update clientes
       set nombre = ?, telefono = ?, cedula_rif = ?, direccion = ?, tipo = ?, nota = ?
       where id = ?`,
    )
    .run(datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.tipo, datos.nota, id);
}

/** Cuántos clientes deben algo y cuánto suman. Para el resumen del panel. */
export function resumenDeudas(): { clientes_con_deuda: number; total_por_cobrar_usd: number } {
  const clientes = listarClientes().filter((c) => c.saldo_usd > 0);
  return {
    clientes_con_deuda: clientes.length,
    total_por_cobrar_usd: Math.round(clientes.reduce((s, c) => s + c.saldo_usd, 0) * 100) / 100,
  };
}
