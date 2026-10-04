import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio } from "@/config/negocio";
import { cuentaDelCliente } from "@/lib/cuenta-cliente";
import { METODOS_PAGO, bs, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import { MarcoDeCuenta } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string; id: string }> };

export const metadata = { title: "Recibo de abono" };

/**
 * El recibo de un abono, para el cliente: cuándo, cómo, cuánto (en su
 * moneda y en dólares), la referencia, el comprobante que mandó y cómo
 * quedó su cuenta después de ese abono. Solo los suyos: otro abono da 404.
 */
export default async function PaginaAbonoDelCliente({ params }: Parametros) {
  const { enlace, id } = await params;
  const cuenta = await cuentaDelCliente(enlace);
  const abono = cuenta?.pagos.find((p) => p.id === Number(id));
  if (!cuenta || !abono) notFound();
  const comprobante = cuenta.comprobantes.get(abono.id);
  const saldoDespues = cuenta.movimientos.find((m) => m.tipo === "abono" && m.id === abono.id)?.saldo_usd;

  return (
    <MarcoDeCuenta enlace={enlace} actual="abonos" cuenta={cuenta}>
      <p className={estilos.volver}>
        <Link href={`/cuenta/${enlace}/abonos`}>← Mis abonos</Link>
      </p>
      <article className={estilos.detalle}>
        <h2 className={estilos.detalleTitulo}>Recibo de abono</h2>
        <p className={estilos.ayuda}>
          {negocio.nombre} recibió su abono del {fechaCorta(abono.fecha)}.
        </p>
        <dl className={estilos.totales}>
          <div className={estilos.totalGrande}>
            <dt>Monto</dt>
            <dd>{formatearMonto(abono.monto, abono.moneda)}</dd>
          </div>
          {abono.moneda === "VES" && abono.tasa && (
            <div>
              <dt>A {bs(abono.tasa)} por dólar</dt>
              <dd>{usd(abono.monto_usd)}</dd>
            </div>
          )}
          <div>
            <dt>Método</dt>
            <dd>{METODOS_PAGO[abono.metodo]}</dd>
          </div>
          {abono.referencia && (
            <div>
              <dt>Referencia</dt>
              <dd>{abono.referencia}</dd>
            </div>
          )}
          {saldoDespues !== undefined && (
            <div>
              <dt>Tu cuenta después de este abono</dt>
              <dd>{saldoDespues <= 0 ? (saldoDespues < 0 ? `${usd(-saldoDespues)} a tu favor` : "Al día") : `${usd(saldoDespues)} pendientes`}</dd>
            </div>
          )}
        </dl>
        {comprobante ? (
          <>
            <p className={estilos.ayuda}>El comprobante que nos mandaste:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/cuenta/${enlace}/comprobante/${comprobante}`} alt="Comprobante del pago" className={estilos.comprobante} loading="lazy" />
          </>
        ) : (
          <p className={estilos.ayuda}>Este abono no tiene comprobante guardado.</p>
        )}
      </article>
    </MarcoDeCuenta>
  );
}
