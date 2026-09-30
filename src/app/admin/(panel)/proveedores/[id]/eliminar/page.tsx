import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarProveedor, loQueTieneElProveedor } from "@/lib/proveedores";
import { borrarProveedor } from "@/lib/acciones";
import { usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar proveedor" };

/** Como borrar un cliente: se pide la clave del panel. */
export default async function PaginaEliminarProveedor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosAviso>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  const proveedor = await buscarProveedor(Number(id));
  if (!proveedor) notFound();
  const tiene = await loQueTieneElProveedor(proveedor.id);
  const volver = `/admin/proveedores/${proveedor.id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {proveedor.nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar a {proveedor.nombre}?</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Se borran con el proveedor</dt>
            <dd>
              {tiene.compras} {tiene.compras === 1 ? "compra" : "compras"} y {tiene.pagos}{" "}
              {tiene.pagos === 1 ? "pago" : "pagos"}
            </dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>{proveedor.saldo_usd > 0 ? `Le debes ${usd(proveedor.saldo_usd)}` : "Al día"}</dd>
          </div>
        </dl>

        <p className={estilos.ayuda}>No se puede deshacer. Para borrar, escribe la clave del panel.</p>

        <form action={borrarProveedor} className="formulario">
          <input type="hidden" name="id" value={proveedor.id} />
          <div className="campo">
            <label htmlFor="clave">Clave del panel</label>
            <input id="clave" name="clave" type="password" autoComplete="current-password" required />
          </div>
          <div className={estilos.accionesFila}>
            <button type="submit" className="boton boton--peligro">
              Sí, eliminar todo
            </button>
            <Link href={volver} className="boton boton--secundario">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
