import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCliente } from "@/lib/clientes";
import { conLineas, listarVentasDeCliente } from "@/lib/ventas";
import { listarPagosDeCliente, ultimaTasa } from "@/lib/pagos";
import { listarAdjuntosDeCliente } from "@/lib/adjuntos";
import { NOMBRE_ESTADO, aplicarPagos } from "@/lib/cuentas";
import { editarCliente, subirAdjunto } from "@/lib/acciones";
import { METODOS_PAGO, cantidad, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioPago } from "@/components/formulario-pago";
import { EntradaFoto } from "@/components/entrada-foto";
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
  const cliente = await buscarCliente(Number(id));
  if (!cliente) notFound();

  const [ventas, pagos, adjuntos, tasa] = await Promise.all([
    listarVentasDeCliente(cliente.id).then(conLineas),
    listarPagosDeCliente(cliente.id),
    listarAdjuntosDeCliente(cliente.id),
    ultimaTasa(),
  ]);
  const cuentas = aplicarPagos(ventas, cliente.total_pagado_usd);
  const ventaDeAdjunto = new Map(ventas.map((v) => [v.id, v]));

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
            ultimaTasa={tasa}
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
        <h2 className={estilos.subtitulo}>Cuentas</h2>
        {cuentas.length === 0 ? (
          <p className="vacio">Sin ventas todavía.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                  <th className="numero">Pendiente</th>
                  <th>Estado</th>
                  <th>Nota</th>
                  <th>
                    <span className="visualmente-oculto">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((v) => (
                  <tr key={v.id}>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      {v.lineas
                        .map((l) => `${cantidad(l.cantidad, l.unidad)} ${l.producto_nombre}`)
                        .join(" · ")}
                    </td>
                    <td className="numero">{usd(v.total_usd)}</td>
                    <td className="numero">{v.pendiente_usd > 0 ? usd(v.pendiente_usd) : "—"}</td>
                    <td>
                      <span className={`${estilos.estado} ${estilos[`estado--${v.estado}`]}`}>
                        {NOMBRE_ESTADO[v.estado]}
                      </span>
                    </td>
                    <td>{v.nota || "—"}</td>
                    <td>
                      <Link href={`/admin/ventas/${v.id}/eliminar`} className="enlace-fila">
                        Eliminar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                  <th>
                    <span className="visualmente-oculto">Acciones</span>
                  </th>
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
                    <td>
                      <Link href={`/admin/pagos/${p.id}/eliminar`} className="enlace-fila">
                        Eliminar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Notas de entrega</h2>
        <p className={estilos.ayuda}>
          Haz una foto a la nota en papel y guárdala aquí. Queda unida al cliente y, si la eliges, a
          la venta. Las fotos entran en la copia de seguridad.
        </p>
        <form action={subirAdjunto} className="formulario" encType="multipart/form-data">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="archivo">Foto o PDF</label>
              <EntradaFoto nombre="archivo" id="archivo" />
            </div>
            <div className="campo">
              <label htmlFor="venta_id">De qué venta</label>
              <select id="venta_id" name="venta_id" defaultValue="">
                <option value="">Sin venta concreta</option>
                {ventas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {fechaCorta(v.fecha)} · {usd(v.total_usd)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="descripcion">Descripción</label>
            <input id="descripcion" name="descripcion" type="text" placeholder="Nota n.º 123" />
          </div>
          <div>
            <button type="submit" className="boton boton--secundario">
              Guardar foto
            </button>
          </div>
        </form>

        {adjuntos.length > 0 && (
          <ul className={estilos.miniaturas}>
            {adjuntos.map((a) => {
              const venta = a.venta_id ? ventaDeAdjunto.get(a.venta_id) : undefined;
              return (
                <li key={a.id} className={estilos.miniatura}>
                  <a href={`/admin/adjuntos/${a.id}`} target="_blank" rel="noopener">
                    {a.tipo === "application/pdf" ? (
                      <span className={estilos.miniaturaPdf}>PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/admin/adjuntos/${a.id}`} alt={a.descripcion || "Nota de entrega"} loading="lazy" />
                    )}
                  </a>
                  <div className={estilos.miniaturaTexto}>
                    <strong>{a.descripcion || "Nota"}</strong>
                    <span>
                      {fechaCorta(a.creado_en)}
                      {venta ? ` · venta del ${fechaCorta(venta.fecha)} (${usd(venta.total_usd)})` : ""}
                    </span>
                    <Link href={`/admin/adjuntos/${a.id}/eliminar`} className="enlace-fila">
                      Eliminar
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  return { title: cliente?.nombre ?? "Cliente" };
}
