import Link from "next/link";
import { listarClientes, resumenDeudas } from "@/lib/clientes";
import { listarPagos, totalCobradoUsd } from "@/lib/pagos";
import { listarVentas, totalVendidoUsd } from "@/lib/ventas";
import { METODOS_PAGO, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import estilos from "./panel.module.css";

export const metadata = { title: "Resumen" };

export default async function PaginaResumen() {
  const [clientes, deudas, ultimasVentas, ultimosPagos, vendido, cobrado] = await Promise.all([
    listarClientes(),
    resumenDeudas(),
    listarVentas(5),
    listarPagos(5),
    totalVendidoUsd(),
    totalCobradoUsd(),
  ]);
  const deudores = clientes.filter((c) => c.saldo_usd > 0).sort((a, b) => b.saldo_usd - a.saldo_usd);

  return (
    <>
      <h1 className={estilos.titulo}>Resumen</h1>

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Clientes</dt>
          <dd>{clientes.length}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Vendido</dt>
          <dd>{usd(vendido)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Cobrado</dt>
          <dd>{usd(cobrado)}</dd>
        </div>
        <div className={`${estilos.cifra} ${deudas.total_por_cobrar_usd > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Por pagar</dt>
          <dd>{usd(deudas.total_por_cobrar_usd)}</dd>
        </div>
      </dl>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Quién debe</h2>
          {deudores.length === 0 ? (
            <p className="vacio">Nadie debe nada.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="numero">Debe</th>
                  </tr>
                </thead>
                <tbody>
                  {deudores.slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/clientes/${c.id}`}>{c.nombre}</Link>
                      </td>
                      <td className={`numero ${estilos.deuda}`}>{usd(c.saldo_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deudores.length > 8 && (
                <p className={estilos.ayuda}>
                  <Link href="/admin/cuentas">Ver todas las cuentas por pagar</Link>
                </p>
              )}
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Últimos pagos</h2>
          {ultimosPagos.length === 0 ? (
            <p className="vacio">
              Todavía no hay pagos. <Link href="/admin/pagos">Registrar el primero</Link>.
            </p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th className="numero">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosPagos.map((p) => (
                    <tr key={p.id}>
                      <td>{fechaCorta(p.fecha)}</td>
                      <td>
                        <Link href={`/admin/clientes/${p.cliente_id}`}>{p.cliente_nombre}</Link>
                      </td>
                      <td>{METODOS_PAGO[p.metodo]}</td>
                      <td className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Últimas ventas</h2>
        {ultimasVentas.length === 0 ? (
          <p className="vacio">
            Todavía no hay ventas. <Link href="/admin/ventas">Registrar la primera</Link>.
          </p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="numero">Total</th>
                </tr>
              </thead>
              <tbody>
                {ultimasVentas.map((v) => (
                  <tr key={v.id}>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                    </td>
                    <td className="numero">{usd(v.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Copia de seguridad</h2>
        <p className={estilos.ayuda}>
          Todo lo que registras, fotos incluidas, vive en un solo archivo. Descárgalo de vez en cuando
          y guárdalo en Drive o en otro teléfono: con este archivo se recupera todo.
        </p>
        <a href="/admin/copia" download className="boton boton--secundario">
          Descargar copia
        </a>
      </section>
    </>
  );
}
