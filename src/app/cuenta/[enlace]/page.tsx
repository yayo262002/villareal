import Link from "next/link";
import { notFound } from "next/navigation";
import { enlaceWhatsapp } from "@/config/negocio";
import { cuentaDelCliente } from "@/lib/cuenta-cliente";
import { METODOS_PAGO, bs, fechaCorta, usd } from "@/lib/dinero";
import { MarcoDeCuenta, TarjetaDeNota } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string }> };

export const metadata = { title: "Mi cuenta" };

/**
 * El resumen de la cuenta de un cliente, para él: abre su enlace personal
 * y ve, sin clave, lo que tiene pendiente, cada nota por pagar con lo que
 * llevaba y su plazo, su último abono y los botones para avisar un pago o
 * pedir. Lo demás está en las pestañas: todas sus notas, sus abonos con
 * recibo y sus movimientos. Pensada para el teléfono y para leerse en
 * diez segundos.
 */
export default async function PaginaCuenta({ params }: Parametros) {
  const { enlace } = await params;
  const cuenta = await cuentaDelCliente(enlace);
  if (!cuenta) notFound();
  const { cliente, pendientes, pagos, fecha } = cuenta;
  const ultimoAbono = pagos[0];
  const avisarPago = enlaceWhatsapp(`Hola, soy ${cliente.rotulo}. Ya hice un pago de mi cuenta; le mando el comprobante.`);
  const pedir = enlaceWhatsapp(`Hola, soy ${cliente.rotulo}. Quiero hacer un pedido.`);

  return (
    <MarcoDeCuenta enlace={enlace} actual="resumen" cuenta={cuenta}>
      {pendientes.length > 0 ? (
        <>
          <h2 className={estilos.subtitulo}>{pendientes.length === 1 ? "Nota por pagar" : `${pendientes.length} notas por pagar`}</h2>
          <ul className={estilos.notas}>
            {pendientes.map((n) => (
              <TarjetaDeNota key={n.id} enlace={enlace} nota={n} fecha={fecha} />
            ))}
          </ul>
        </>
      ) : (
        <p className={estilos.vacio}>{cuenta.notas.length === 0 ? "Todavía no tienes notas con nosotros." : "No tienes ninguna nota por pagar. ¡Gracias!"}</p>
      )}

      {ultimoAbono && (
        <p className={estilos.ayuda}>
          Tu último abono: <strong>{usd(ultimoAbono.monto_usd)}</strong> el {fechaCorta(ultimoAbono.fecha)} por {METODOS_PAGO[ultimoAbono.metodo]}
          {ultimoAbono.moneda === "VES" ? ` (${bs(ultimoAbono.monto)})` : ""}.{" "}
          <Link href={`/cuenta/${enlace}/abono/${ultimoAbono.id}`}>Ver el recibo</Link>.
        </p>
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
    </MarcoDeCuenta>
  );
}
