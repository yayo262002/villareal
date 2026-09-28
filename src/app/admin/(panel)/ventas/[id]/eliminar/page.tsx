import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarVenta } from "@/lib/ventas";
import { borrarVenta } from "@/lib/acciones";
import { cantidad, fechaCorta, usd } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar venta" };

/**
 * Pantalla de confirmación. Sin JavaScript no hay `confirm()`, así que la
 * segunda pregunta es una página: un toque por error en la ficha del
 * cliente llega aquí, no borra nada.
 */
export default async function PaginaEliminarVenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venta = await buscarVenta(Number(id));
  if (!venta) notFound();

  const volver = `/admin/clientes/${venta.cliente_id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {venta.cliente_nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar esta venta?</h1>
      </div>

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Cliente</dt>
            <dd>{venta.cliente_nombre}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{fechaCorta(venta.fecha)}</dd>
          </div>
          <div>
            <dt>Productos</dt>
            <dd>
              {venta.lineas.map((l) => (
                <div key={l.id}>
                  {cantidad(l.cantidad, l.unidad)} {l.producto_nombre} a {usd(l.precio_unitario_usd)}
                </div>
              ))}
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{usd(venta.total_usd)}</dd>
          </div>
          {venta.nota && (
            <div>
              <dt>Nota</dt>
              <dd>{venta.nota}</dd>
            </div>
          )}
        </dl>

        <p className={estilos.ayuda}>
          Se quita del historial y el saldo del cliente baja {usd(venta.total_usd)}. No se puede
          deshacer: si te equivocaste de cantidad o precio, bórrala y regístrala de nuevo.
        </p>

        <form action={borrarVenta} className={estilos.accionesFila}>
          <input type="hidden" name="id" value={venta.id} />
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
