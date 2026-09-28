import Link from "next/link";
import { ventasPorCliente, ventasPorMes, ventasPorProducto } from "@/lib/ventas";
import { cantidad, hace, mesLegible, usd } from "@/lib/dinero";
import estilos from "../panel.module.css";

export const metadata = { title: "Informe" };

const DIAS_RECIENTES = 30;

/** Estudio de ventas: cuánto se vende, de qué, a quién y cómo va el cobro. */
export default async function PaginaInforme() {
  const desde = hace(DIAS_RECIENTES);
  const [meses, productos, productosRecientes, clientes] = await Promise.all([
    ventasPorMes(),
    ventasPorProducto(),
    ventasPorProducto(desde),
    ventasPorCliente(10),
  ]);

  const vendidoReciente = productosRecientes.reduce((s, p) => s + Number(p.vendido_usd), 0);
  const kilosRecientes = productosRecientes
    .filter((p) => p.unidad === "kg")
    .reduce((s, p) => s + Number(p.cantidad), 0);

  return (
    <>
      <h1 className={estilos.titulo}>Informe de ventas</h1>

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
        {meses.length === 0 ? (
          <p className="vacio">Todavía no hay ventas ni pagos.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="numero">Ventas</th>
                  <th className="numero">Vendido</th>
                  <th className="numero">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes}>
                    <td>{mesLegible(m.mes)}</td>
                    <td className="numero">{m.ventas}</td>
                    <td className="numero">{usd(Number(m.vendido_usd))}</td>
                    <td className="numero">{usd(Number(m.cobrado_usd))}</td>
                  </tr>
                ))}
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
              <table className="tabla">
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
                        <td>{p.producto}</td>
                        <td className="numero">{cantidad(Number(reciente?.cantidad ?? 0), p.unidad)}</td>
                        <td className="numero">{cantidad(Number(p.cantidad), p.unidad)}</td>
                        <td className="numero">{usd(Number(p.vendido_usd))}</td>
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
              <table className="tabla">
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
                      <td>
                        <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente}</Link>
                      </td>
                      <td className="numero">{c.ventas}</td>
                      <td className="numero">{usd(Number(c.vendido_usd))}</td>
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
