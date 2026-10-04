import { negocio } from "@/config/negocio";
import { buscarCliente } from "@/lib/clientes";
import { listarVentasDeCliente } from "@/lib/ventas";
import { leerTasa } from "@/lib/ajustes";
import { aplicarPagos } from "@/lib/cuentas";
import { conVencimiento } from "@/lib/credito";
import { direccionDeCuenta } from "@/lib/enlace-cuenta";
import { anotarRecordatorio } from "@/lib/recordatorios";
import { enlaceWhatsappA, mensajeRecordatorio } from "@/lib/whatsapp";
import { hoy } from "@/lib/dinero";
import { haySesion } from "@/lib/sesion";

/**
 * GET /admin/recordar/7 abre WhatsApp con el recordatorio de deuda del
 * cliente 7 (sus notas pendientes, sus plazos y su enlace de cuenta) y deja
 * anotado que se le recordó hoy. Solo con sesión.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  if (!cliente) return new Response("No existe.", { status: 404 });
  if (cliente.saldo_usd <= 0) return new Response("Este cliente no debe nada.", { status: 409 });

  const [ventas, tasa] = await Promise.all([listarVentasDeCliente(cliente.id), leerTasa()]);
  const pendientes = conVencimiento(aplicarPagos(ventas, cliente.total_pagado_usd), cliente.dias_credito, hoy())
    .filter((c) => c.pendiente_usd > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const enlace = enlaceWhatsappA(
    cliente.telefono,
    mensajeRecordatorio({
      negocio: negocio.nombre,
      cliente: cliente.nombre,
      saldo_usd: cliente.saldo_usd,
      pendientes,
      tasa: tasa?.valor,
      enlace: cliente.enlace ? direccionDeCuenta(cliente.enlace) : null,
    }),
  );
  if (!enlace) return new Response("Este cliente no tiene un teléfono venezolano completo.", { status: 409 });

  await anotarRecordatorio(cliente.id, cliente.saldo_usd);
  return Response.redirect(enlace, 302);
}
