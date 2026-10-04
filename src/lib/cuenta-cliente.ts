import "server-only";
import { buscarClientePorEnlace, type ClienteConSaldo } from "./clientes";
import { conLineas, listarVentasDeCliente, type VentaConLineas } from "./ventas";
import { listarPagosDeCliente, type Pago } from "./pagos";
import { listarAdjuntosDeCliente } from "./adjuntos";
import { leerTasa, type Tasa } from "./ajustes";
import { aplicarPagos, movimientosDeCuenta, type CuentaDeVenta, type Movimiento } from "./cuentas";
import { conVencimiento, diasEntre } from "./credito";
import { esEnlaceValido } from "./enlace-cuenta";
import { hoy } from "./dinero";

/**
 * Lo que un cliente ve de su cuenta con su enlace personal: sus notas con
 * lo pagado y lo pendiente de cada una, sus abonos con su comprobante, y
 * todos sus movimientos. Lo mismo para la página de resumen, la de notas,
 * la de abonos y la de cada nota o abono. Solo lo suyo: el enlace manda.
 */

export type NotaDelCliente = ReturnType<typeof conVencimiento<CuentaDeVenta<VentaConLineas>>>[number];

export type CuentaDelCliente = {
  cliente: ClienteConSaldo;
  /** Hoy, en Venezuela. */
  fecha: string;
  tasa: Tasa | null;
  /** Todas sus notas, de la más nueva a la más vieja, con lo pagado y lo pendiente de cada una. */
  notas: NotaDelCliente[];
  /** Las que tienen algo por pagar, de la más antigua a la más nueva. */
  pendientes: NotaDelCliente[];
  /** Sus abonos, del más nuevo al más viejo. */
  pagos: Pago[];
  /** El comprobante de cada abono, si lo tiene: id del abono → id de la foto. */
  comprobantes: Map<number, number>;
  movimientos: Movimiento[];
};

export async function cuentaDelCliente(enlace: string): Promise<CuentaDelCliente | null> {
  const cliente = esEnlaceValido(enlace) ? await buscarClientePorEnlace(enlace) : null;
  if (!cliente) return null;
  const [ventas, pagos, adjuntos, tasa] = await Promise.all([
    listarVentasDeCliente(cliente.id).then(conLineas),
    listarPagosDeCliente(cliente.id),
    listarAdjuntosDeCliente(cliente.id),
    leerTasa(),
  ]);
  const fecha = hoy();
  const notas = conVencimiento(aplicarPagos(ventas, cliente.total_pagado_usd), cliente.dias_credito, fecha);
  const pendientes = notas.filter((n) => n.pendiente_usd > 0).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const comprobantes = new Map<number, number>();
  for (const a of adjuntos) if (a.pago_id) comprobantes.set(a.pago_id, a.id);
  return { cliente, fecha, tasa, notas, pendientes, pagos, comprobantes, movimientos: movimientosDeCuenta(ventas, pagos) };
}

/** «Lleva 12 días pendiente», «Lleva 1 día pendiente», «Es de hoy». */
export function diasPendiente(desde: string, hoy: string): string {
  const dias = diasEntre(desde, hoy);
  if (dias <= 0) return "Es de hoy";
  return `Lleva ${dias} ${dias === 1 ? "día" : "días"} pendiente`;
}
