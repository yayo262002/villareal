import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCompra } from "@/lib/proveedores";
import { borrarCompra } from "@/lib/acciones";
import { fechaCorta, usd } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar compra" };

/** Confirmación antes de borrar una compra a un proveedor. Ver `ventas/[id]/eliminar`. */
export default async function PaginaEliminarCompra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const compra = await buscarCompra(Number(id));
  if (!compra) notFound();
  const volver = `/admin/proveedores/${compra.proveedor_id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {compra.proveedor_nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar esta compra?</h1>
      </div>

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Proveedor</dt>
            <dd>{compra.proveedor_nombre}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{fechaCorta(compra.fecha)}</dd>
          </div>
          {compra.descripcion && (
            <div>
              <dt>Qué se compró</dt>
              <dd>{compra.descripcion}</dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd>{usd(compra.total_usd)}</dd>
          </div>
        </dl>

        <p className={estilos.ayuda}>
          Se quita del historial y dejas de deber {usd(compra.total_usd)} por ella. No se puede deshacer: si te
          equivocaste, bórrala y regístrala de nuevo.
        </p>

        <form action={borrarCompra} className={estilos.accionesFila}>
          <input type="hidden" name="id" value={compra.id} />
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
