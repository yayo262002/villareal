import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCliente } from "@/lib/clientes";
import { listarVentasDeCliente, lineasDeVenta } from "@/lib/ventas";
import { listarPagosDeCliente, ultimaTasa } from "@/lib/pagos";
import { editarCliente } from "@/lib/acciones";
import { METODOS_PAGO, cantidad, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioPago } from "@/components/formulario-pago";
import estilos from "../../panel.module.css";

export default async function PaginaCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosAviso>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  const cliente = buscarCliente(Number(id));
  if (!cliente) notFound();

  const ventas = listarVentasDeCliente(cliente.id).map((v) => ({ ...v, lineas: lineasDeVenta(v.id) }));
  const pagos = listarPagosDeCliente(cliente.id);
  const claseSaldo =
    cliente.saldo_usd > 0 ? estilos.deuda : cliente.saldo_usd < 0 ? estilos.favor : estilos.saldado;
  const textoSaldo =
    cliente.saldo_usd > 0
      ? `Debe ${usd(cliente.saldo_usd)}`
      : cliente.saldo_usd < 0
        ? `A favor ${usd(-cliente.saldo_usd)}`
        : "Al día";

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p>
            <Link href="/admin/clientes">← Clientes</Link>
          </p>
          <h1 className={estilos.titulo}>{cliente.nombre}</h1>
        </div>
        <Link href={`/admin/ventas?cliente=${cliente.id}`} className="boton boton--secundario">
          Nueva venta
        </Link>
      </div>
      <Avisos parametros={parametros} />

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Comprado</dt>
          <dd>{usd(cliente.total_comprado_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Pagado</dt>
          <dd>{usd(cliente.total_pagado_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Saldo</dt>
          <dd className={claseSaldo}>{textoSaldo}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Tipo</dt>
          <dd>{cliente.tipo === "mayor" ? "Mayor" : "Detal"}</dd>
        </div>
      </dl>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Registrar pago</h2>
          <FormularioPago
            clientes={[cliente]}
            clienteFijo={cliente.id}
            ultimaTasa={ultimaTasa()}
            volverA={`/admin/clientes/${cliente.id}`}
          />
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Datos</h2>
          <form action={editarCliente} className="formulario">
            <input type="hidden" name="id" value={cliente.id} />
            <div className="campo">
              <label htmlFor="nombre">Nombre o negocio</label>
              <input id="nombre" name="nombre" type="text" required defaultValue={cliente.nombre} />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" name="telefono" type="tel" defaultValue={cliente.telefono} />
              </div>
              <div className="campo">
                <label htmlFor="cedula_rif">Cédula o RIF</label>
                <input id="cedula_rif" name="cedula_rif" type="text" defaultValue={cliente.cedula_rif} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" type="text" defaultValue={cliente.direccion} />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="tipo">Tipo</label>
                <select id="tipo" name="tipo" defaultValue={cliente.tipo}>
                  <option value="detal">Detal</option>
                  <option value="mayor">Mayor</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="nota">Nota</label>
                <input id="nota" name="nota" type="text" defaultValue={cliente.nota} />
              </div>
            </div>
            <div>
              <button type="submit" className="boton boton--secundario">
                Guardar cambios
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Pagos</h2>
        {pagos.length === 0 ? (
          <p className="vacio">Sin pagos todavía.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th className="numero">Monto</th>
                  <th className="numero">Tasa</th>
                  <th className="numero">En USD</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{fechaCorta(p.fecha)}</td>
                    <td>{METODOS_PAGO[p.metodo]}</td>
                    <td className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    <td className="numero">{p.tasa ? p.tasa.toFixed(2) : "—"}</td>
                    <td className="numero">{usd(p.monto_usd)}</td>
                    <td>{p.referencia || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Ventas</h2>
        {ventas.length === 0 ? (
          <p className="vacio">Sin ventas todavía.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      {v.lineas
                        .map((l) => `${cantidad(l.cantidad, l.unidad)} ${l.producto_nombre}`)
                        .join(" · ")}
                    </td>
                    <td className="numero">{usd(v.total_usd)}</td>
                    <td>{v.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = buscarCliente(Number(id));
  return { title: cliente?.nombre ?? "Cliente" };
}
