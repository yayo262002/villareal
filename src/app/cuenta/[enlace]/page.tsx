import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { enlaceWhatsapp } from "@/config/negocio";
import { buscarClientePorEnlace } from "@/lib/clientes";
import { conLineas, listarVentasDeCliente } from "@/lib/ventas";
import { listarPagosDeCliente } from "@/lib/pagos";
import { leerTasa } from "@/lib/ajustes";
import { aplicarPagos, movimientosDeCuenta } from "@/lib/cuentas";
import { conVencimiento, describirVencimiento, diasEntre } from "@/lib/credito";
import { numeroDeNota, piezasDe } from "@/lib/entregas";
import { METODOS_PAGO, aBolivares, bs, cantidad, fechaCorta, hoy, usd } from "@/lib/dinero";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { CabeceraPublica, LineaTasa, PiePublico } from "@/components/publico";
import estilos from "./cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string }> };

/** «Lleva 12 días pendiente», «Lleva 1 día pendiente», «Es de hoy». */
function diasPendiente(desde: string, hoy: string): string {
  const dias = diasEntre(desde, hoy);
  if (dias <= 0) return "Es de hoy";
  return `Lleva ${dias} ${dias === 1 ? "día" : "días"} pendiente`;
}

/** Es la cuenta privada de un cliente: los buscadores no la indexan y no sale en el mapa del sitio. */
export const metadata: Metadata = { title: "Su cuenta", robots: { index: false, follow: false } };

/**
 * La cuenta de un cliente, para él: abre el enlace personal que le mandó
 * el dueño y ve, sin clave, lo que tiene pendiente, cada nota por pagar
 * con su plazo, sus abonos y todos sus movimientos. Solo lo suyo. Pensada
 * para el teléfono y para leerse en diez segundos.
 */
export default async function PaginaCuenta({ params }: Parametros) {
  const { enlace } = await params;
  const cliente = esEnlaceValido(enlace) ? await buscarClientePorEnlace(enlace) : null;
  if (!cliente) notFound();

  const [ventas, pagos, tasa] = await Promise.all([
    listarVentasDeCliente(cliente.id).then(conLineas),
    listarPagosDeCliente(cliente.id),
    leerTasa(),
  ]);
  const fecha = hoy();
  const cuentas = conVencimiento(aplicarPagos(ventas, cliente.total_pagado_usd), cliente.dias_credito, fecha);
  const pendientes = cuentas.filter((c) => c.pendiente_usd > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const movimientos = movimientosDeCuenta(ventas, pagos);
  const pago = new Map(pagos.map((p) => [p.id, p]));
  const saldoBs = cliente.saldo_usd > 0 ? aBolivares(cliente.saldo_usd, tasa?.valor ?? null) : null;
  const avisarPago = enlaceWhatsapp(`Hola, soy ${cliente.rotulo}. Ya hice un pago de mi cuenta; le mando el comprobante.`);
  const pedir = enlaceWhatsapp(`Hola, soy ${cliente.rotulo}. Quiero hacer un pedido.`);

  return (
    <>
      <CabeceraPublica />
      <main id="contenido" className={estilos.contenido}>
        <section className={estilos.seccion}>
          <p className={estilos.antetitulo}>Cuenta de</p>
          <h1 className={estilos.titulo}>{cliente.rotulo}</h1>
          <p className={estilos.fecha}>Al {fechaCorta(fecha)}</p>

          <div className={`${estilos.saldo} ${cliente.saldo_usd > 0 ? "" : estilos.saldoAlDia}`}>
            {cliente.saldo_usd > 0 ? (
              <>
                <span className={estilos.saldoRotulo}>Tienes pendiente</span>
                <strong className={estilos.saldoCifra}>{usd(cliente.saldo_usd)}</strong>
                {saldoBs !== null && tasa && <span className={estilos.saldoBs}>{bs(saldoBs)} a la tasa de hoy</span>}
                {pendientes.length > 0 && <span className={estilos.saldoBs}>{`La nota más antigua ${diasPendiente(pendientes[0].fecha, fecha).toLowerCase()}`}</span>}
              </>
            ) : cliente.saldo_usd < 0 ? (
              <>
                <span className={estilos.saldoRotulo}>Tienes a favor</span>
                <strong className={estilos.saldoCifra}>{usd(-cliente.saldo_usd)}</strong>
              </>
            ) : (
              <>
                <span className={estilos.saldoRotulo}>Estás al día</span>
                <strong className={estilos.saldoCifra}>Nada pendiente</strong>
              </>
            )}
          </div>
          <LineaTasa tasa={tasa} className={estilos.tasa} />

          {pendientes.length > 0 && (
            <>
              <h2 className={estilos.subtitulo}>{pendientes.length === 1 ? "Nota por pagar" : `${pendientes.length} notas por pagar`}</h2>
              <ul className={estilos.notas}>
                {pendientes.map((c) => (
                  <li key={c.id} className={estilos.nota}>
                    <div className={estilos.notaCabecera}>
                      <strong>Nota {numeroDeNota(c.id)}</strong>
                      <span>{fechaCorta(c.fecha)}</span>
                    </div>
                    {c.lineas.length > 0 && (
                      <ul className={estilos.notaLineas}>
                        {c.lineas.map((l) => (
                          <li key={l.id}>{`${cantidad(l.cantidad, l.unidad)}${piezasDe(l)} ${l.producto_nombre} × ${usd(l.precio_unitario_usd)} = ${usd(l.subtotal_usd)}`}</li>
                        ))}
                      </ul>
                    )}
                    <p className={estilos.notaImporte}>
                      {c.pendiente_usd < c.total_usd ? `${usd(c.total_usd)} · abonado ${usd(c.total_usd - c.pendiente_usd)} · quedan ` : ""}
                      <strong>{usd(c.pendiente_usd)}</strong>
                    </p>
                    <p className={c.vencida ? estilos.vencida : estilos.plazo}>
                      {`${diasPendiente(c.fecha, fecha)}${c.vence ? ` · ${describirVencimiento(c.atraso)}${c.vencida ? "" : ` (${fechaCorta(c.vence)})`}` : ""}`}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className={estilos.acciones}>
            {avisarPago && (
              <a className="boton boton--acento" href={avisarPago} target="_blank" rel="noopener">
                Avisar un pago por WhatsApp
              </a>
            )}
            {pedir && (
              <a className="boton boton--secundario" href={pedir} target="_blank" rel="noopener">
                Hacer un pedido
              </a>
            )}
          </div>
          <p className={estilos.ayuda}>
            Puedes pagar en dólares, o en bolívares a la tasa del día por pago móvil, transferencia o efectivo. Un abono en bolívares se convierte con la
            tasa del día en que se hizo.
          </p>

          {movimientos.length > 0 && (
            <details className={estilos.historial}>
              <summary>Todos los movimientos ({movimientos.length})</summary>
              <ol className={estilos.movimientos}>
                {movimientos.map((m) => {
                  const p = m.tipo === "abono" ? pago.get(m.id) : undefined;
                  return (
                    <li key={`${m.tipo}-${m.id}`} className={estilos.movimiento}>
                      <span className={estilos.movimientoFecha}>{fechaCorta(m.fecha)}</span>
                      <span className={estilos.movimientoConcepto}>
                        {m.tipo === "venta" ? `Nota ${numeroDeNota(m.id)}` : `Abono · ${p ? METODOS_PAGO[p.metodo] : ""}`}
                        {p && p.moneda === "VES" && p.tasa ? ` · ${bs(p.monto)} a ${bs(p.tasa)} por dólar` : ""}
                        {p && Number(p.con_comprobante) > 0 ? " · con comprobante ✓" : ""}
                      </span>
                      <span className={m.tipo === "venta" ? estilos.movimientoCompra : estilos.movimientoAbono}>
                        {m.tipo === "venta" ? `+ ${usd(m.cargo_usd)}` : `− ${usd(m.abono_usd)}`}
                      </span>
                      <span className={estilos.movimientoSaldo}>{m.saldo_usd < 0 ? `${usd(-m.saldo_usd)} a favor` : usd(m.saldo_usd)}</span>
                    </li>
                  );
                })}
              </ol>
            </details>
          )}

          <p className={estilos.pie}>
            Este enlace es solo tuyo: con él ves tu cuenta sin clave. No lo compartas. Si algo no te cuadra, escríbenos por WhatsApp y lo revisamos.
          </p>
        </section>
      </main>
      <PiePublico />
    </>
  );
}
