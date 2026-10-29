import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buscarFactura, rotuloFacturado } from "@/lib/facturas";
import { anularFactura } from "@/lib/acciones";
import { numeroDeFactura } from "@/lib/factura-calculo";
import { fechaCorta, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Anular factura" };

/**
 * Pantalla de confirmación. Una factura emitida no se borra: se anula con
 * una nota de crédito por el mismo importe, que la referencia, y las dos
 * quedan en el libro de ventas. La venta no se toca.
 */
export default async function PaginaAnularFactura({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> }) {
  const { id } = await params;
  const parametros = await searchParams;
  const factura = await buscarFactura(Number(id));
  if (!factura || factura.tipo !== "factura") notFound();
  if (factura.estado === "anulada") redirect(`/admin/facturas/${factura.id}`);

  return (
    <>
      <div>
        <p>
          <Link href={`/admin/facturas/${factura.id}`}>← Factura N.º {numeroDeFactura(factura.numero)}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Anular esta factura?</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Factura</dt>
            <dd>
              N.º {numeroDeFactura(factura.numero)} del {fechaCorta(factura.fecha)}
              {factura.numero_control ? ` · control ${factura.numero_control}` : ""}
            </dd>
          </div>
          <div>
            <dt>Cliente</dt>
            <dd>
              {rotuloFacturado(factura.cliente)} · {factura.cliente.cedula_rif}
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              {usd(factura.total_usd)} (IVA {usd(factura.iva_usd)})
            </dd>
          </div>
        </dl>
        <p>
          Se emite una <strong>nota de crédito</strong> por el mismo importe que deja esta factura sin efecto; las dos se conservan y salen en el libro de ventas. La
          venta y la cuenta del cliente no cambian: si la venta estaba mal, bórrala después desde su nota; si solo hay que corregir la factura, vuelve a facturar la
          venta.
        </p>
        <form action={anularFactura} className="formulario">
          <input type="hidden" name="id" value={factura.id} />
          <div className="campo">
            <label htmlFor="motivo">Motivo</label>
            <input id="motivo" name="motivo" type="text" maxLength={200} placeholder="Error en el cliente · Devolución · Precio mal puesto" />
          </div>
          <div className={estilos.accionesFila}>
            <button type="submit" className="boton boton--peligro">
              Anular con nota de crédito
            </button>
            <Link href={`/admin/facturas/${factura.id}`} className="boton boton--secundario">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
