import Link from "next/link";
import { cierreDelDia, diasConMovimiento, type EntradaPorMetodo } from "@/lib/caja";
import { listarVentas, conLineas } from "@/lib/ventas";
import { listarPagos } from "@/lib/pagos";
import { listarPagosAProveedores } from "@/lib/proveedores";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { METODOS_PAGO, fechaCorta, formatearMonto, hoy, usd } from "@/lib/dinero";
import { BotonImprimir } from "@/components/boton-imprimir";
import type { ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Cierre del día" };

/** «Pago móvil: Bs 42.894,38 (USD 50,00) · 2 abonos» */
function PorMetodo({ entradas, vacio }: { entradas: EntradaPorMetodo[]; vacio: string }) {
  if (entradas.length === 0) return <p className="vacio">{vacio}</p>;
  return (
    <ul className={estilos.carga}>
      {entradas.map((e) => (
        <li key={`${e.metodo}-${e.moneda}`}>
          <strong>{formatearMonto(e.monto, e.moneda)}</strong> {e.nombre}
          <span className="ayuda">
            {e.moneda === "VES" ? ` · ${usd(e.monto_usd)}` : ""} · {e.cantidad} {e.cantidad === 1 ? "movimiento" : "movimientos"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * El cierre del día: qué se vendió, qué entró (por método y en su moneda,
 * para contar la caja) y qué salió para los proveedores. Cualquier día se
 * elige arriba; por defecto, hoy.
 */
export default async function PaginaCaja({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const pedida = typeof parametros.fecha === "string" ? parametros.fecha : "";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hoy();

  const [cierre, dias, ventas, abonos, pagos] = await Promise.all([
    cierreDelDia(fecha),
    diasConMovimiento(14),
    listarVentas(100000).then((v) => v.filter((x) => x.fecha === fecha)).then(conLineas),
    listarPagos(100000).then((p) => p.filter((x) => x.fecha === fecha)),
    listarPagosAProveedores(100000).then((p) => p.filter((x) => x.fecha === fecha)),
  ]);
  const esHoy = fecha === hoy();

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p className={estilos.noImprimir}>
            <Link href="/admin">← Resumen</Link>
          </p>
          <h1 className={estilos.titulo}>Cierre del {esHoy ? "día" : fechaCorta(fecha)}</h1>
        </div>
        <BotonImprimir className={`boton boton--secundario ${estilos.noImprimir}`}>Imprimir</BotonImprimir>
      </div>

      <form method="get" action="/admin/caja" className={`${estilos.buscador} ${estilos.noImprimir}`}>
        <label htmlFor="fecha" className="visualmente-oculto">
          Día
        </label>
        <input id="fecha" name="fecha" type="date" defaultValue={fecha} className={estilos.entradaPequena} style={{ width: "auto" }} />
        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
          Ver ese día
        </button>
        {!esHoy && (
          <Link href="/admin/caja" className={estilos.limpiar}>
            Hoy
          </Link>
        )}
      </form>

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Vendido</dt>
          <dd>{usd(cierre.ventas.total_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Notas</dt>
          <dd>{cierre.ventas.cantidad}</dd>
        </div>
        <div className={`${estilos.cifra} ${cierre.cobrado.total_usd > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Entró (abonos)</dt>
          <dd>{usd(cierre.cobrado.total_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Salió (proveedores)</dt>
          <dd>{usd(cierre.pagado_a_proveedores.total_usd)}</dd>
        </div>
      </dl>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Lo que entró, por método</h2>
          <p className={estilos.ayuda}>En la moneda en que se recibió, para contar la caja.</p>
          <PorMetodo entradas={cierre.cobrado.por_metodo} vacio="Ningún abono ese día." />
        </section>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Lo que salió a proveedores</h2>
          <PorMetodo entradas={cierre.pagado_a_proveedores.por_metodo} vacio="Ningún pago a proveedores ese día." />
        </section>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Notas del día ({ventas.length})</h2>
        {ventas.length === 0 ? (
          <p className="vacio">Ninguna venta ese día.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/admin/ventas/${v.id}/nota`}>{numeroDeNota(v.id)}</Link>
                    </td>
                    <td>
                      <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                    </td>
                    <td>{resumenDeLineas(v.lineas)}</td>
                    <td className="numero">{usd(v.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Abonos del día ({abonos.length})</h2>
        {abonos.length === 0 ? (
          <p className="vacio">Ningún abono ese día.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th className="numero">Monto</th>
                  <th className="numero">En USD</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {abonos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/clientes/${p.cliente_id}`}>{p.cliente_nombre}</Link>
                    </td>
                    <td>{METODOS_PAGO[p.metodo]}</td>
                    <td className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    <td className="numero">{usd(p.monto_usd)}</td>
                    <td>{p.referencia || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pagos.length > 0 && (
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Pagos a proveedores del día ({pagos.length})</h2>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Método</th>
                  <th className="numero">Monto</th>
                  <th className="numero">En USD</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/proveedores/${p.proveedor_id}`}>{p.proveedor_nombre}</Link>
                    </td>
                    <td>{METODOS_PAGO[p.metodo]}</td>
                    <td className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    <td className="numero">{usd(p.monto_usd)}</td>
                    <td>{p.referencia || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dias.length > 0 && (
        <section className={`tarjeta ${estilos.noImprimir}`}>
          <h2 className={estilos.subtitulo}>Otros días con movimiento</h2>
          <nav aria-label="Días" className={estilos.pestanas} style={{ marginBottom: 0 }}>
            {dias.map((d) => (
              <Link key={d} href={`/admin/caja?fecha=${d}`} aria-current={d === fecha ? "true" : undefined}>
                {fechaCorta(d)}
              </Link>
            ))}
          </nav>
        </section>
      )}
    </>
  );
}
