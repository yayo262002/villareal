import { notFound } from "next/navigation";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import { cuentaDelProveedor, type CompraDelProveedor } from "@/lib/cuenta-proveedor";
import { describirVencimiento } from "@/lib/credito";
import { METODOS_PAGO, aBolivares, bs, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import { CabeceraPublica, LineaTasa, PiePublico } from "@/components/publico";
import { EstadoDeNota } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string }> };

export const metadata = { title: "Nuestra cuenta" };

/**
 * La cuenta de un proveedor, para él: abre su enlace personal y ve, sin
 * clave, lo que el negocio le debe, cada compra con lo pagado y su plazo,
 * y cada pago que se le hizo con su comprobante. Es el espejo de la cuenta
 * del cliente, en una sola página y pensada para el teléfono.
 */
export default async function PaginaProveedor({ params }: Parametros) {
  const { enlace } = await params;
  const cuenta = await cuentaDelProveedor(enlace);
  if (!cuenta) notFound();
  const { proveedor, tasa, compras, pendientes, pagos, comprobantes, fecha } = cuenta;
  const saldoBs = proveedor.saldo_usd > 0 ? aBolivares(proveedor.saldo_usd, tasa?.valor ?? null) : null;
  const vencidas = pendientes.filter((c) => c.vencida).length;
  const pagadas = compras.filter((c) => c.pendiente_usd <= 0);
  const escribir = enlaceWhatsapp(`Hola, soy ${proveedor.nombre}. Sobre nuestra cuenta: `);

  return (
    <>
      <CabeceraPublica />
      <main id="contenido" className={estilos.contenido}>
        <section className={estilos.seccion}>
          <p className={estilos.antetitulo}>Cuenta de {negocio.nombre} con</p>
          <h1 className={estilos.titulo}>{proveedor.nombre}</h1>
          <p className={estilos.fecha}>Al {fechaCorta(fecha)}</p>

          <div className={`${estilos.saldo} ${proveedor.saldo_usd > 0 ? "" : estilos.saldoAlDia}`}>
            {proveedor.saldo_usd > 0 ? (
              <>
                <span className={estilos.saldoRotulo}>Le debemos</span>
                <strong className={estilos.saldoCifra}>{usd(proveedor.saldo_usd)}</strong>
                {saldoBs !== null && tasa && <span className={estilos.saldoBs}>{bs(saldoBs)} a la tasa de hoy</span>}
                <span className={estilos.saldoBs}>
                  {pendientes.length === 1 ? "1 compra por pagar" : `${pendientes.length} compras por pagar`}
                  {vencidas > 0 ? ` · ${vencidas === 1 ? "1 vencida" : `${vencidas} vencidas`}` : ""}
                </span>
              </>
            ) : proveedor.saldo_usd < 0 ? (
              <>
                <span className={estilos.saldoRotulo}>A nuestro favor</span>
                <strong className={estilos.saldoCifra}>{usd(-proveedor.saldo_usd)}</strong>
              </>
            ) : (
              <>
                <span className={estilos.saldoRotulo}>Estamos al día</span>
                <strong className={estilos.saldoCifra}>Nada pendiente</strong>
              </>
            )}
          </div>
          <LineaTasa tasa={tasa} className={estilos.tasa} />

          <h2 className={estilos.subtitulo}>
            {pendientes.length === 0 ? "Compras por pagar" : pendientes.length === 1 ? "1 compra por pagar" : `${pendientes.length} compras por pagar`}
          </h2>
          {pendientes.length === 0 ? (
            <p className={estilos.vacio}>{compras.length === 0 ? "Todavía no hay compras registradas." : "No hay ninguna compra pendiente de pago."}</p>
          ) : (
            <ul className={estilos.notas}>
              {pendientes.map((c) => (
                <TarjetaDeCompra key={c.id} compra={c} />
              ))}
            </ul>
          )}

          <h2 className={estilos.subtitulo}>
            {pagos.length === 1 ? "1 pago" : `${pagos.length} pagos`} · {usd(proveedor.total_pagado_usd)} en total
          </h2>
          {pagos.length === 0 ? (
            <p className={estilos.vacio}>Todavía no hay pagos registrados.</p>
          ) : (
            <ul className={estilos.abonos}>
              {pagos.map((p) => (
                <li key={p.id} className={estilos.abono}>
                  <div className={estilos.abonoCabecera}>
                    <strong>{fechaCorta(p.fecha)}</strong>
                    <span className={estilos.abonoCifra}>{usd(p.monto_usd)}</span>
                  </div>
                  <p className={estilos.abonoDato}>
                    {METODOS_PAGO[p.metodo]}
                    {p.moneda === "VES" ? ` · ${formatearMonto(p.monto, p.moneda)}${p.tasa ? ` a ${bs(p.tasa)} por dólar` : ""}` : ""}
                    {p.referencia ? ` · ref. ${p.referencia}` : ""}
                  </p>
                  {comprobantes.has(p.id) && (
                    <a href={`/proveedor/${enlace}/comprobante/${comprobantes.get(p.id)}`} target="_blank" rel="noopener" className={estilos.enlaceTarjeta}>
                      Ver el comprobante →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pagadas.length > 0 && (
            <details>
              <summary className={estilos.subtitulo}>{pagadas.length === 1 ? "1 compra ya pagada" : `${pagadas.length} compras ya pagadas`}</summary>
              <ul className={estilos.notas}>
                {pagadas.map((c) => (
                  <TarjetaDeCompra key={c.id} compra={c} />
                ))}
              </ul>
            </details>
          )}

          {escribir && (
            <div className={estilos.acciones}>
              <a className="boton boton--acento" href={escribir} target="_blank" rel="noopener">
                Escribirnos por WhatsApp
              </a>
            </div>
          )}
          <p className={estilos.pie}>
            Este enlace es solo suyo: con él ve nuestra cuenta con usted sin clave. No lo comparta. Si algo no le cuadra, escríbanos y lo revisamos.
          </p>
        </section>
      </main>
      <PiePublico />
    </>
  );
}

/** Una compra en la lista: fecha, estado, qué fue, lo pagado y lo que queda, y su plazo. */
function TarjetaDeCompra({ compra }: { compra: CompraDelProveedor }) {
  const total = Number(compra.total_usd);
  const parte = total > 0 ? Math.round((compra.pagado_usd / total) * 100) : 100;
  return (
    <li className={estilos.nota}>
      <div className={estilos.notaCabecera}>
        <strong>Compra del {fechaCorta(compra.fecha)}</strong>
        <EstadoDeNota estado={compra.estado} />
      </div>
      {compra.descripcion && <p className={estilos.abonoDato}>{compra.descripcion}</p>}
      <p className={estilos.notaImporte}>
        {compra.pendiente_usd > 0 && compra.pagado_usd > 0 ? `${usd(total)} · pagado ${usd(compra.pagado_usd)} · quedan ` : compra.pendiente_usd > 0 ? "" : `${usd(total)} · `}
        <strong>{compra.pendiente_usd > 0 ? usd(compra.pendiente_usd) : "pagada"}</strong>
      </p>
      <span className={estilos.barra} role="img" aria-label={`Pagado el ${parte} %`}>
        <span className={estilos.barraRelleno} style={{ width: `${Math.min(100, parte)}%` }} />
      </span>
      {compra.pendiente_usd > 0 && compra.vence && (
        <p className={compra.vencida ? estilos.vencida : estilos.plazo}>
          {`${describirVencimiento(compra.atraso)}${compra.vencida ? "" : ` (${fechaCorta(compra.vence)})`}`}
        </p>
      )}
    </li>
  );
}
