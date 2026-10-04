import Link from "next/link";
import { notFound } from "next/navigation";
import { cuentaDelCliente } from "@/lib/cuenta-cliente";
import { numeroDeNota } from "@/lib/entregas";
import { METODOS_PAGO, bs, fechaCorta, usd } from "@/lib/dinero";
import { MarcoDeCuenta } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string }> };

export const metadata = { title: "Mis movimientos" };

/** El estado de cuenta del cliente: cada nota y cada abono en su orden, con el saldo que dejó cada uno. */
export default async function PaginaMovimientos({ params }: Parametros) {
  const { enlace } = await params;
  const cuenta = await cuentaDelCliente(enlace);
  if (!cuenta) notFound();
  const pago = new Map(cuenta.pagos.map((p) => [p.id, p]));

  return (
    <MarcoDeCuenta enlace={enlace} actual="movimientos" cuenta={cuenta}>
      {cuenta.movimientos.length === 0 ? (
        <p className={estilos.vacio}>Todavía no hay movimientos.</p>
      ) : (
        <>
          <h2 className={estilos.subtitulo}>Todos los movimientos ({cuenta.movimientos.length})</h2>
          <p className={estilos.ayuda}>Cada compra suma y cada abono resta; a la derecha, cómo quedaba la cuenta después de cada uno.</p>
          <ol className={estilos.movimientos}>
            {cuenta.movimientos.map((m) => {
              const p = m.tipo === "abono" ? pago.get(m.id) : undefined;
              return (
                <li key={`${m.tipo}-${m.id}`} className={estilos.movimiento}>
                  <span className={estilos.movimientoFecha}>{fechaCorta(m.fecha)}</span>
                  <span className={estilos.movimientoConcepto}>
                    {m.tipo === "venta" ? (
                      <Link href={`/cuenta/${enlace}/nota/${m.id}`}>Nota {numeroDeNota(m.id)}</Link>
                    ) : (
                      <Link href={`/cuenta/${enlace}/abono/${m.id}`}>Abono · {p ? METODOS_PAGO[p.metodo] : ""}</Link>
                    )}
                    {p && p.moneda === "VES" && p.tasa ? ` · ${bs(p.monto)} a ${bs(p.tasa)} por dólar` : ""}
                    {p && cuenta.comprobantes.has(p.id) ? " · con comprobante ✓" : ""}
                  </span>
                  <span className={m.tipo === "venta" ? estilos.movimientoCompra : estilos.movimientoAbono}>
                    {m.tipo === "venta" ? `+ ${usd(m.cargo_usd)}` : `− ${usd(m.abono_usd)}`}
                  </span>
                  <span className={estilos.movimientoSaldo}>{m.saldo_usd < 0 ? `${usd(-m.saldo_usd)} a favor` : usd(m.saldo_usd)}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </MarcoDeCuenta>
  );
}
