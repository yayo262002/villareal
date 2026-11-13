import Link from "next/link";
import { listarFacturasDeCompra, mesesConFacturasDeCompra } from "@/lib/facturas-compra";
import { totalesDelLibroDeCompras } from "@/lib/libro-compras-calculo";
import { anotarFacturaDeCompra, quitarFacturaDeCompra } from "@/lib/acciones";
import { mesDe } from "@/lib/factura-calculo";
import { bs, fechaCorta, hoy, mesLegible } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../panel.module.css";

export const metadata = { title: "Libro de compras" };

/**
 * El libro de compras: las facturas de compra de cada mes (Drago,
 * Cecosesola, Granos de Oro…) con lo exento, la base imponible y el IVA en
 * bolívares, como vienen impresas, y el Excel para la licenciada. Con el
 * libro de ventas, es lo que hace falta para declarar el IVA: el IVA pagado
 * en las compras se descuenta del cobrado en las ventas. Se anotan aquí o
 * salen solas al cargar una factura en la lista del detal con su número.
 */
export default async function PaginaLibroDeCompras({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const mesDeHoy = mesDe(hoy());
  const mes = typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes) ? parametros.mes : mesDeHoy;
  const [facturas, meses] = await Promise.all([listarFacturasDeCompra(mes), mesesConFacturasDeCompra()]);
  const totales = totalesDelLibroDeCompras(facturas);
  const mesesParaElegir = meses.includes(mes) ? meses : [mes, ...meses].sort().reverse();

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p>
            <Link href={`/admin/facturas?mes=${mes}`}>← Facturas</Link>
          </p>
          <h1 className={estilos.titulo}>Libro de compras</h1>
        </div>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <a href={`/admin/facturas/compras/libro?mes=${mes}`} className="boton boton--secundario">
            Libro de compras (Excel)
          </a>
          <a href={`/admin/facturas/libro?mes=${mes}`} className="boton boton--secundario">
            Libro de ventas (Excel)
          </a>
        </div>
      </div>
      <Avisos parametros={parametros} />

      <p className="ayuda" style={{ maxWidth: "70ch" }}>
        Las facturas de compra del mes, con lo exento, la base imponible y el IVA en bolívares, como vienen impresas. Con el libro de ventas es lo que la licenciada
        necesita para declarar el IVA: el IVA que pagaste en las compras se descuenta del que cobraste en las ventas. Al cargar una factura en la{" "}
        <Link href="/admin/detal#cargar">lista del detal</Link> con su número, entra aquí sola; las demás (Drago, el gas, las bolsas…) se anotan abajo.
      </p>

      <section className="tarjeta">
        <form method="get" action="/admin/facturas/compras" className={estilos.buscador} role="search">
          <label htmlFor="mes">Mes</label>
          <select id="mes" name="mes" defaultValue={mes}>
            {mesesParaElegir.map((m) => (
              <option key={m} value={m}>
                {mesLegible(m)}
              </option>
            ))}
          </select>
          <button type="submit" className="boton boton--secundario">
            Ver
          </button>
        </form>

        <dl className={estilos.cifras}>
          <div className={estilos.cifra}>
            <dt>Facturas</dt>
            <dd>{totales.facturas}</dd>
          </div>
          <div className={estilos.cifra}>
            <dt>Base imponible</dt>
            <dd>{bs(totales.base_bs)}</dd>
            {totales.exento_bs > 0 && <div className={estilos.cifraNota}>Exento: {bs(totales.exento_bs)}</div>}
          </div>
          <div className={estilos.cifra}>
            <dt>IVA pagado (crédito fiscal)</dt>
            <dd>{bs(totales.iva_bs)}</dd>
          </div>
          <div className={estilos.cifra}>
            <dt>Total comprado</dt>
            <dd>{bs(totales.total_bs)}</dd>
            <div className={estilos.cifraNota}>{mesLegible(mes)}</div>
          </div>
        </dl>

        {facturas.length === 0 ? (
          <p className="vacio">Ninguna factura de compra en {mesLegible(mes)}.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>N.º</th>
                  <th className="numero">Base</th>
                  <th className="numero">IVA</th>
                  <th className="numero">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id}>
                    <td data-label="Fecha">{fechaCorta(f.fecha)}</td>
                    <td data-label="Proveedor">
                      {f.proveedor} {f.rif && <span className="ayuda">{f.rif}</span>}
                      {f.origen === "detal" && <span className="ayuda"> · de la lista del detal</span>}
                    </td>
                    <td data-label="N.º">
                      {f.numero}
                      {f.numero_control && <span className="ayuda"> · control {f.numero_control}</span>}
                    </td>
                    <td data-label="Base" className="numero">
                      {bs(f.base_bs)}
                      {f.exento_bs > 0 && <span className="ayuda"> + {bs(f.exento_bs)} (E)</span>}
                    </td>
                    <td data-label="IVA" className="numero">
                      {bs(f.iva_bs)}
                    </td>
                    <td data-label="Total" className="numero">
                      {bs(f.total_bs)}
                    </td>
                    <td data-label="">
                      <form action={quitarFacturaDeCompra} style={{ display: "contents" }}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="volver_a" value={`/admin/facturas/compras?mes=${mes}`} />
                        <button type="submit" className={estilos.botonPequeno} title="Quita esta factura del libro (si se anotó por error)">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }} id="anotar">
        <h2 className={estilos.subtitulo}>Anotar una factura de compra</h2>
        <form action={anotarFacturaDeCompra} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="compra-fecha">Fecha de la factura</label>
              <input id="compra-fecha" name="fecha" type="date" max={hoy()} defaultValue={hoy()} required />
            </div>
            <div className="campo">
              <label htmlFor="compra-proveedor">Proveedor</label>
              <input id="compra-proveedor" name="proveedor" required autoComplete="off" placeholder="El Drago" />
            </div>
            <div className="campo">
              <label htmlFor="compra-rif">RIF del proveedor</label>
              <input id="compra-rif" name="rif" autoComplete="off" placeholder="J-12345678-9" />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="compra-numero">N.º de factura</label>
              <input id="compra-numero" name="numero" required autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="compra-control">N.º de control</label>
              <input id="compra-control" name="numero_control" autoComplete="off" />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="compra-exento">Exento (Bs)</label>
              <input id="compra-exento" name="exento_bs" inputMode="decimal" autoComplete="off" placeholder="0,00" />
            </div>
            <div className="campo">
              <label htmlFor="compra-base">Base imponible (Bs)</label>
              <input id="compra-base" name="base_bs" inputMode="decimal" autoComplete="off" placeholder="0,00" />
            </div>
            <div className="campo">
              <label htmlFor="compra-iva">IVA (Bs)</label>
              <input id="compra-iva" name="iva_bs" inputMode="decimal" autoComplete="off" placeholder="0,00" />
            </div>
            <div className="campo">
              <label htmlFor="compra-total">Total (Bs)</label>
              <input id="compra-total" name="total_bs" inputMode="decimal" autoComplete="off" required />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="compra-tasa">Tasa BCV (opcional)</label>
              <input id="compra-tasa" name="tasa" inputMode="decimal" autoComplete="off" placeholder="La del día de la factura" />
            </div>
            <div className="campo">
              <label htmlFor="compra-nota">Nota (opcional)</label>
              <input id="compra-nota" name="nota" autoComplete="off" />
            </div>
          </div>
          <span className="ayuda">
            Los montos como vienen en la factura («12.519,00»). Lo exento, la base y el IVA tienen que sumar el total. La misma factura (el mismo proveedor y el mismo
            número) anotada otra vez se corrige, no se repite.
          </span>
          <button type="submit" className="boton">
            Anotar la factura
          </button>
        </form>
      </section>
    </>
  );
}
