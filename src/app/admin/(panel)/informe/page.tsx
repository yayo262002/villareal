import Link from "next/link";
import { ventasPorCliente, ventasPorMes, ventasPorProducto, ventasPorTipo } from "@/lib/ventas";
import { cantidad, hace, mesLegible, usd, usdConSigno } from "@/lib/dinero";
import estilos from "../panel.module.css";

export const metadata = { title: "Informe" };

const DIAS_RECIENTES = 30;

/** Estudio de ventas: cuánto se vende, de qué, a quién y cómo va el cobro. */
export default async function PaginaInforme() {
  const desde = hace(DIAS_RECIENTES);
  const [meses, productos, productosRecientes, clientes, tipos, tiposRecientes] = await Promise.all([
    ventasPorMes(),
    ventasPorProducto(),
    ventasPorProducto(desde),
    ventasPorCliente(10),
    ventasPorTipo(),
    ventasPorTipo(desde),
  ]);
  const totalTipos = tipos.reduce((s, t) => s + Number(t.vendido_usd), 0);

  const vendidoReciente = productosRecientes.reduce((s, p) => s + Number(p.vendido_usd), 0);
  const kilosRecientes = productosRecientes
    .filter((p) => p.unidad === "kg")
    .reduce((s, p) => s + Number(p.cantidad), 0);

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Informe de ventas</h1>
        <Link href="/admin/caja#exportar" className="boton boton--secundario">
          Descargar movimientos (Excel)
        </Link>
      </div>

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Vendido, últimos {DIAS_RECIENTES} días</dt>
          <dd>{usd(vendidoReciente)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Kilos, últimos {DIAS_RECIENTES} días</dt>
          <dd>{cantidad(kilosRecientes, "kg")}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Meses con ventas</dt>
          <dd>{meses.filter((m) => Number(m.ventas) > 0).length}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Vendido en total</dt>
          <dd>{usd(productos.reduce((s, p) => s + Number(p.vendido_usd), 0))}</dd>
        </div>
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Por mes</h2>
        <p className={estilos.ayuda}>
          Lo que se vendió y lo que se cobró a los clientes; lo que se compró y lo que se pagó a los proveedores.
          Cobrado menos pagado es lo que entró de verdad ese mes.
        </p>
        {meses.length === 0 ? (
          <p className="vacio">Todavía no hay ventas ni pagos.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="numero">Ventas</th>
                  <th className="numero">Vendido</th>
                  <th className="numero">Cobrado</th>
                  <th className="numero">Comprado</th>
                  <th className="numero">Pagado a proveedores</th>
                  <th className="numero">Entró neto</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes}>
                    <td data-label="Mes">{mesLegible(m.mes)}</td>
                    <td data-label="Ventas" className="numero">{m.ventas}</td>
                    <td data-label="Vendido" className="numero">{usd(Number(m.vendido_usd))}</td>
                    <td data-label="Cobrado" className="numero">{usd(Number(m.cobrado_usd))}</td>
                    <td data-label="Comprado" className="numero">{usd(Number(m.comprado_usd))}</td>
                    <td data-label="Pagado a proveedores" className="numero">{usd(Number(m.pagado_proveedores_usd))}</td>
                    <td data-label="Entró neto" className="numero">{usdConSigno(Number(m.cobrado_usd) - Number(m.pagado_proveedores_usd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Al detal y al mayor</h2>
        {tipos.length === 0 ? (
          <p className="vacio">Todavía no hay ventas.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Clientes</th>
                  <th className="numero">Ventas</th>
                  <th className="numero">Últimos {DIAS_RECIENTES} días</th>
                  <th className="numero">Total</th>
                  <th className="numero">Parte</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => {
                  const reciente = tiposRecientes.find((r) => r.tipo === t.tipo);
                  return (
                    <tr key={t.tipo}>
                      <td data-label="Clientes">{t.tipo === "mayor" ? "Al mayor" : "Al detal"}</td>
                      <td data-label="Ventas" className="numero">{t.ventas}</td>
                      <td data-label={`Últimos ${DIAS_RECIENTES} días`} className="numero">{usd(Number(reciente?.vendido_usd ?? 0))}</td>
                      <td data-label="Total" className="numero">{usd(Number(t.vendido_usd))}</td>
                      <td data-label="Parte" className="numero">
                        {totalTipos > 0 ? Math.round((Number(t.vendido_usd) / totalTipos) * 100) : 0} %
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Por producto</h2>
          {productos.length === 0 ? (
            <p className="vacio">Todavía no hay ventas.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla tabla--fichas">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="numero">Últimos {DIAS_RECIENTES} días</th>
                    <th className="numero">Total</th>
                    <th className="numero">Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => {
                    const reciente = productosRecientes.find((r) => r.producto === p.producto);
                    return (
                      <tr key={p.producto}>
                        <td data-label="Producto">{p.producto}</td>
                        <td data-label={`Últimos ${DIAS_RECIENTES} días`} className="numero">{cantidad(Number(reciente?.cantidad ?? 0), p.unidad)}</td>
                        <td data-label="Total" className="numero">{cantidad(Number(p.cantidad), p.unidad)}</td>
                        <td data-label="Vendido" className="numero">{usd(Number(p.vendido_usd))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Mejores clientes</h2>
          {clientes.length === 0 ? (
            <p className="vacio">Todavía no hay ventas.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla tabla--fichas">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="numero">Compras</th>
                    <th className="numero">Comprado</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.cliente_id}>
                      <td data-label="Cliente">
                        <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente}</Link>
                      </td>
                      <td data-label="Compras" className="numero">{c.ventas}</td>
                      <td data-label="Comprado" className="numero">{usd(Number(c.vendido_usd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
