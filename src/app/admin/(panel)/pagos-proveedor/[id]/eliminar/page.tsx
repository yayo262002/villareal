import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarPagoProveedor } from "@/lib/proveedores";
import { borrarPagoProveedor } from "@/lib/acciones";
import { METODOS_PAGO, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar pago" };

/** Confirmación antes de borrar un pago a un proveedor. Ver `pagos/[id]/eliminar`. */
export default async function PaginaEliminarPagoProveedor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pago = await buscarPagoProveedor(Number(id));
  if (!pago) notFound();
  const volver = `/admin/proveedores/${pago.proveedor_id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {pago.proveedor_nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar este pago?</h1>
      </div>

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Proveedor</dt>
            <dd>{pago.proveedor_nombre}</dd>
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
        </dl>

        <p className={estilos.ayuda}>
          Se quita del historial y vuelves a deber {usd(pago.monto_usd)} más. No se puede deshacer.
        </p>

        <form action={borrarPagoProveedor} className={estilos.accionesFila}>
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
