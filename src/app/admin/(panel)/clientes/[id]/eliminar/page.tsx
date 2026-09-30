import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCliente, loQueTieneElCliente } from "@/lib/clientes";
import { borrarCliente } from "@/lib/acciones";
import { usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar cliente" };

/**
 * Confirmación antes de borrar un cliente con todo lo suyo. Como no tiene
 * vuelta atrás, además de la sesión se pide la clave del panel.
 */
export default async function PaginaEliminarCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosAviso>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  const cliente = await buscarCliente(Number(id));
  if (!cliente) notFound();
  const tiene = await loQueTieneElCliente(cliente.id);
  const volver = `/admin/clientes/${cliente.id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {cliente.rotulo}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar a {cliente.rotulo}?</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Se borran con el cliente</dt>
            <dd>
              {tiene.ventas} {tiene.ventas === 1 ? "nota de entrega" : "notas de entrega"}, {tiene.pagos}{" "}
              {tiene.pagos === 1 ? "abono" : "abonos"} y {tiene.adjuntos} {tiene.adjuntos === 1 ? "foto" : "fotos"}
            </dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>
              {cliente.saldo_usd > 0
                ? `Debe ${usd(cliente.saldo_usd)}: esa deuda desaparece con él`
                : cliente.saldo_usd < 0
                  ? `A su favor ${usd(-cliente.saldo_usd)}`
                  : "Al día"}
            </dd>
          </div>
        </dl>

        <p className={estilos.ayuda}>
          No se puede deshacer. Si solo quieres corregir un dato, vuelve a su ficha y cámbialo ahí. Para borrar,
          escribe la clave del panel.
        </p>

        <form action={borrarCliente} className="formulario">
          <input type="hidden" name="id" value={cliente.id} />
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
