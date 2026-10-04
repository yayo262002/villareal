import Link from "next/link";
import { notFound } from "next/navigation";
import { cuentaDelCliente } from "@/lib/cuenta-cliente";
import { METODOS_PAGO, bs, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import { MarcoDeCuenta } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string }> };

export const metadata = { title: "Mis abonos" };

/** Todos los abonos del cliente, del más nuevo al más viejo, cada uno con su recibo. */
export default async function PaginaAbonos({ params }: Parametros) {
  const { enlace } = await params;
  const cuenta = await cuentaDelCliente(enlace);
  if (!cuenta) notFound();
  const totalAbonado = cuenta.cliente.total_pagado_usd;

  return (
    <MarcoDeCuenta enlace={enlace} actual="abonos" cuenta={cuenta}>
      {cuenta.pagos.length === 0 ? (
        <p className={estilos.vacio}>Todavía no tienes abonos registrados.</p>
      ) : (
        <>
          <h2 className={estilos.subtitulo}>
            {cuenta.pagos.length === 1 ? "1 abono" : `${cuenta.pagos.length} abonos`} · {usd(totalAbonado)} en total
          </h2>
          <ul className={estilos.abonos}>
            {cuenta.pagos.map((p) => (
              <li key={p.id} className={estilos.abono}>
                <div className={estilos.abonoCabecera}>
                  <strong>{fechaCorta(p.fecha)}</strong>
                  <span className={estilos.abonoCifra}>{usd(p.monto_usd)}</span>
                </div>
                <p className={estilos.abonoDato}>
                  {METODOS_PAGO[p.metodo]}
                  {p.moneda === "VES" ? ` · ${formatearMonto(p.monto, p.moneda)}${p.tasa ? ` a ${bs(p.tasa)} por dólar` : ""}` : ""}
                  {p.referencia ? ` · ref. ${p.referencia}` : ""}
                  {cuenta.comprobantes.has(p.id) ? " · con comprobante ✓" : ""}
                </p>
                <Link href={`/cuenta/${enlace}/abono/${p.id}`} className={estilos.enlaceTarjeta}>
                  Ver el recibo →
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </MarcoDeCuenta>
  );
}
