import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio } from "@/config/negocio";
import { buscarCliente } from "@/lib/clientes";
import { conLineas, listarVentasDeCliente } from "@/lib/ventas";
import { listarPagosDeCliente } from "@/lib/pagos";
import { leerTasa } from "@/lib/ajustes";
import { aplicarPagos, movimientosDeCuenta } from "@/lib/cuentas";
import { conVencimiento } from "@/lib/credito";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { METODOS_PAGO, aBolivares, bs, fechaCorta, hoy, usd } from "@/lib/dinero";
import { enlaceWhatsappA, mensajeRecordatorio } from "@/lib/whatsapp";
import { BotonImprimir } from "@/components/boton-imprimir";
import { DatosDelCliente, Membrete } from "../../../membrete";
import estilos from "../../../panel.module.css";

type Parametros = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Parametros) {
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  return { title: cliente ? `Estado de cuenta de ${cliente.rotulo}` : "Estado de cuenta" };
}

/**
 * El estado de cuenta de un cliente: todo lo que ha comprado y todo lo que
 * ha abonado, en orden, con el saldo que deja cada movimiento. Para
 * imprimirlo, guardarlo como PDF o enseñárselo al cliente cuando pregunta
 * de dónde sale lo que debe.
 *
 * En el teléfono cada movimiento es una ficha; en pantalla ancha y en
 * papel, una fila con sus columnas. Es la misma lista, colocada con CSS.
 */
export default async function PaginaEstadoDeCuenta({ params }: Parametros) {
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  if (!cliente) notFound();

  const [ventas, pagos, tasa] = await Promise.all([
    listarVentasDeCliente(cliente.id).then(conLineas),
    listarPagosDeCliente(cliente.id),
    leerTasa(),
  ]);
  const movimientos = movimientosDeCuenta(ventas, pagos);
  const venta = new Map(ventas.map((v) => [v.id, v]));
  const pago = new Map(pagos.map((p) => [p.id, p]));

  const saldoEnBs = cliente.saldo_usd > 0 ? aBolivares(cliente.saldo_usd, tasa?.valor ?? null) : null;
  const pendientes = conVencimiento(aplicarPagos(ventas, cliente.total_pagado_usd), cliente.dias_credito, hoy())
    .filter((c) => c.pendiente_usd > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const recordar =
    cliente.saldo_usd > 0
      ? enlaceWhatsappA(
          cliente.telefono,
          mensajeRecordatorio({
            negocio: negocio.nombre,
            cliente: cliente.nombre,
            saldo_usd: cliente.saldo_usd,
            pendientes,
            tasa: tasa?.valor,
          }),
        )
      : null;

  return (
    <>
      <div className={estilos.noImprimir}>
        <p>
          <Link href={`/admin/clientes/${cliente.id}`}>← {cliente.rotulo}</Link>
        </p>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
          <BotonImprimir className="boton">Imprimir o guardar PDF</BotonImprimir>
          {recordar && (
            <a href={recordar} target="_blank" rel="noopener" className="boton boton--acento">
              Recordar deuda por WhatsApp
            </a>
          )}
          <Link href={`/admin/clientes/${cliente.id}#abono`} className="boton boton--secundario">
            Registrar abono
          </Link>
        </div>
      </div>

      <article className={estilos.nota}>
        <Membrete titulo="Estado de cuenta" fecha={`Al ${fechaCorta(hoy())}`} />
        <DatosDelCliente cliente={cliente} />

        {movimientos.length === 0 ? (
          <p className="vacio">Este cliente todavía no tiene ventas ni abonos.</p>
        ) : (
          <ol className={estilos.movimientos}>
            <li className={estilos.movimientosTitulos} aria-hidden="true">
              <span>Fecha</span>
              <span>Concepto</span>
              <span>Compra</span>
              <span>Abono</span>
              <span>Saldo</span>
            </li>
            {movimientos.map((m) => {
              const v = m.tipo === "venta" ? venta.get(m.id) : undefined;
              const p = m.tipo === "abono" ? pago.get(m.id) : undefined;
              return (
                <li key={`${m.tipo}-${m.id}`} className={estilos.movimiento}>
                  <span className={estilos.movimientoFecha}>{fechaCorta(m.fecha)}</span>
                  <span className={estilos.movimientoConcepto}>
                    {v && (
                      <>
                        <Link href={`/admin/ventas/${v.id}/nota`}>Nota {numeroDeNota(v.id)}</Link>
                        {v.lineas.length > 0 && ` · ${resumenDeLineas(v.lineas)}`}
                      </>
                    )}
                    {p && (
                      <>
                        Abono · {METODOS_PAGO[p.metodo]}
                        {p.moneda === "VES" && p.tasa ? ` · ${bs(p.monto)} a ${bs(p.tasa)} por dólar` : ""}
                        {p.referencia ? ` · ref. ${p.referencia}` : ""}
                      </>
                    )}
                  </span>
                  <span className={m.tipo === "venta" ? estilos.movimientoCompra : estilos.movimientoAbono}>
                    <span className={estilos.movimientoRotulo}>{m.tipo === "venta" ? "Compra " : "Abono "}</span>
                    {usd(m.tipo === "venta" ? m.cargo_usd : m.abono_usd)}
                  </span>
                  <span className={estilos.movimientoSaldo}>
                    <span className={estilos.movimientoRotulo}>Saldo </span>
                    {m.saldo_usd < 0 ? `${usd(-m.saldo_usd)} a favor` : usd(m.saldo_usd)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <dl className={estilos.notaTotales}>
          <div>
            <dt>Comprado</dt>
            <dd>{usd(cliente.total_comprado_usd)}</dd>
          </div>
          <div>
            <dt>Abonado</dt>
            <dd>{usd(cliente.total_pagado_usd)}</dd>
          </div>
          <div className={estilos.notaTotal}>
            <dt>{cliente.saldo_usd < 0 ? "Saldo a favor del cliente" : "Saldo por pagar"}</dt>
            <dd>{usd(Math.abs(cliente.saldo_usd))}</dd>
          </div>
          {saldoEnBs !== null && tasa && (
            <div>
              <dt>En bolívares, a {bs(tasa.valor)} por dólar</dt>
              <dd>{bs(saldoEnBs)}</dd>
            </div>
          )}
        </dl>

        <p className={estilos.notaPie}>
          Las cuentas se llevan en dólares. Un abono en bolívares se convierte con la tasa del día en que se hizo.
        </p>
      </article>
    </>
  );
}
