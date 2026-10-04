import "server-only";
import { buscarProveedorPorEnlace, listarComprasDeProveedor, listarPagosDeProveedor, type Compra, type PagoProveedor, type ProveedorConSaldo } from "./proveedores";
import { listarAdjuntosDeProveedor } from "./adjuntos";
import { leerTasa, type Tasa } from "./ajustes";
import { aplicarPagos, type CuentaDeVenta } from "./cuentas";
import { conVencimiento, type ConVencimiento } from "./credito";
import { esEnlaceValido } from "./enlace-cuenta";
import { hoy } from "./dinero";

/**
 * Lo que un proveedor ve con su enlace personal: lo que el negocio le debe,
 * cada compra con lo pagado y lo pendiente (y su plazo), y cada pago que se
 * le hizo con su comprobante. Es el espejo de la cuenta del cliente
 * (`cuenta-cliente.ts`). Solo lo suyo: el enlace manda.
 */

export type CompraDelProveedor = ConVencimiento<CuentaDeVenta<Compra>>;

export type CuentaDelProveedor = {
  proveedor: ProveedorConSaldo;
  /** Hoy, en Venezuela. */
  fecha: string;
  tasa: Tasa | null;
  /** Todas sus compras, de la más nueva a la más vieja, con lo pagado y lo pendiente de cada una. */
  compras: CompraDelProveedor[];
  /** Las que tienen algo por pagar, de la más antigua a la más nueva. */
  pendientes: CompraDelProveedor[];
  /** Los pagos que se le han hecho, del más nuevo al más viejo. */
  pagos: PagoProveedor[];
  /** La captura de cada pago, si la tiene: id del pago → id de la captura. */
  comprobantes: Map<number, number>;
};

export async function cuentaDelProveedor(enlace: string): Promise<CuentaDelProveedor | null> {
  const proveedor = esEnlaceValido(enlace) ? await buscarProveedorPorEnlace(enlace) : null;
  if (!proveedor) return null;
  const [compras, pagos, adjuntos, tasa] = await Promise.all([
    listarComprasDeProveedor(proveedor.id),
    listarPagosDeProveedor(proveedor.id),
    listarAdjuntosDeProveedor(proveedor.id),
    leerTasa(),
  ]);
  const fecha = hoy();
  const conEstado = conVencimiento(aplicarPagos(compras, proveedor.total_pagado_usd), proveedor.dias_credito, fecha);
  const pendientes = conEstado.filter((c) => c.pendiente_usd > 0).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const comprobantes = new Map<number, number>();
  for (const a of adjuntos) if (a.pago_proveedor_id) comprobantes.set(a.pago_proveedor_id, a.id);
  return { proveedor, fecha, tasa, compras: conEstado, pendientes, pagos, comprobantes };
}
