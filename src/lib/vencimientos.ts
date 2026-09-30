import "server-only";
import { listarClientes, type ClienteConSaldo } from "./clientes";
import { listarProveedores, listarCompras, type ProveedorConSaldo } from "./proveedores";
import { listarVentas, type Venta } from "./ventas";
import { aplicarPagos } from "./cuentas";
import { resumenDeVencimiento, type ResumenDeVencimiento } from "./credito";
import { hoy } from "./dinero";

/**
 * Quién debe y desde cuándo: a cada cliente (y a cada proveedor) se le
 * aplican sus pagos a sus notas más antiguas, y de lo que queda se mira
 * qué pasó ya de sus días de crédito. Lee toda la base: el negocio es
 * pequeño y así el cálculo es el mismo en todas las pantallas.
 */

export type ClienteConVencimiento = ClienteConSaldo & ResumenDeVencimiento;
export type ProveedorConVencimiento = ProveedorConSaldo & ResumenDeVencimiento;

function porDueno<V extends { id: number; fecha: string; total_usd: number }>(
  notas: V[],
  duenoDe: (nota: V) => number,
): Map<number, V[]> {
  const grupos = new Map<number, V[]>();
  for (const nota of notas) {
    const lista = grupos.get(duenoDe(nota)) ?? [];
    lista.push(nota);
    grupos.set(duenoDe(nota), lista);
  }
  return grupos;
}

export async function clientesConVencimiento(fecha = hoy()): Promise<ClienteConVencimiento[]> {
  const [clientes, ventas] = await Promise.all([listarClientes(), listarVentas(100000)]);
  const suyas = porDueno<Venta>(ventas, (v) => v.cliente_id);
  return clientes.map((c) => ({
    ...c,
    ...resumenDeVencimiento(aplicarPagos(suyas.get(c.id) ?? [], c.total_pagado_usd), c.dias_credito, fecha),
  }));
}

export async function proveedoresConVencimiento(fecha = hoy()): Promise<ProveedorConVencimiento[]> {
  const [proveedores, compras] = await Promise.all([listarProveedores(), listarCompras(100000)]);
  const suyas = porDueno(compras, (c) => c.proveedor_id);
  return proveedores.map((p) => ({
    ...p,
    ...resumenDeVencimiento(aplicarPagos(suyas.get(p.id) ?? [], p.total_pagado_usd), p.dias_credito, fecha),
  }));
}
