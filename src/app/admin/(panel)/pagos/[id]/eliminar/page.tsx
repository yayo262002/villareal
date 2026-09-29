import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarPago } from "@/lib/pagos";
import { borrarPago } from "@/lib/acciones";
import { METODOS_PAGO, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar abono" };

/** Confirmación antes de borrar un pago. Ver `ventas/[id]/eliminar`. */
export default async function PaginaEliminarPago({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pago = await buscarPago(Number(id));
  if (!pago) notFound();

  const volver = `/admin/clientes/${pago.cliente_id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {pago.cliente_nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar este abono?</h1>
      </div>

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Cliente</dt>
            <dd>{pago.cliente_nombre}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{fechaCorta(pago.fecha)}</dd>
          </div>
          <div>
            <dt>Método</dt>
            <dd>{METODOS_PAGO[pago.metodo]}</dd>
          </div>
          <div>
            <dt>Monto</dt>
            <dd>
              {formatearMonto(pago.monto, pago.moneda)}
              {pago.tasa ? ` a ${pago.tasa.toFixed(2)} Bs/$` : ""} = {usd(pago.monto_usd)}
            </dd>
          </div>
          {pago.referencia && (
            <div>
              <dt>Referencia</dt>
              <dd>{pago.referencia}</dd>
            </div>
          )}
          {pago.nota && (
            <div>
              <dt>Nota</dt>
              <dd>{pago.nota}</dd>
            </div>
          )}
        </dl>

        <p className={estilos.ayuda}>
          Se quita del historial y el cliente vuelve a deber {usd(pago.monto_usd)} más. No se puede
          deshacer: si te equivocaste de monto o de tasa, bórralo y regístralo de nuevo.
        </p>

        <form action={borrarPago} className={estilos.accionesFila}>
          <input type="hidden" name="id" value={pago.id} />
          <button type="submit" className="boton boton--peligro">
            Sí, eliminar
          </button>
          <Link href={volver} className="boton boton--secundario">
            Cancelar
          </Link>
        </form>
      </section>
    </>
  );
}
