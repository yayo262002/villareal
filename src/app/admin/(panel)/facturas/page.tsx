import Link from "next/link";
import { contarFacturas, documentosDelLibro, facturasSinControl, listarFacturas, mesesConFacturas, resumenDeIva, rotuloFacturado } from "@/lib/facturas";
import { alicuotaIva, numeracionDeFacturasDesde } from "@/lib/ajustes";
import { guardarAjustesDeFacturacion } from "@/lib/acciones";
import { NOMBRE_DOCUMENTO, mesDe, numeroDeFactura, totalesDelLibro } from "@/lib/factura-calculo";
import { bs, fechaCorta, hoy, mesLegible, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Facturas" };

/**
 * Las facturas y las notas de crédito, por mes: lo facturado, el IVA, el
 * número de control de cada una y el libro de ventas para el contador. Y
 * los ajustes: la alícuota y desde qué número se numera.
 */
export default async function PaginaFacturas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const mesDeHoy = mesDe(hoy());
  const mes = typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes) ? parametros.mes : mesDeHoy;
  const [facturas, documentos, meses, cuantas, sinControl, iva, ivaPct, desde] = await Promise.all([
    listarFacturas(mes),
    documentosDelLibro(mes),
    mesesConFacturas(),
    contarFacturas(),
    facturasSinControl(),
    resumenDeIva(),
    alicuotaIva(),
    numeracionDeFacturasDesde(),
  ]);
  const totales = totalesDelLibro(documentos);
  const mesesParaElegir = meses.includes(mes) ? meses : [mes, ...meses].sort().reverse();

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Facturas</h1>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <a href={`/admin/facturas/libro?mes=${mes}`} className="boton boton--secundario">
            Libro de ventas (Excel)
          </a>
          <Link href="/admin/ventas" className="boton">
            Registrar venta
          </Link>
        </div>
      </div>
      <Avisos parametros={parametros} />

      <p className="ayuda">
        Cada factura sale de una venta: en la caja, marcando «Emitir factura fiscal», o desde su nota de entrega con «Facturar». Lleva el IVA desglosado (los precios lo
        incluyen), el número correlativo y, cuando lo tengas, el <strong>número de control</strong> que asigna la imprenta digital autorizada por el SENIAT. Una factura
        no se borra: se anula con una nota de crédito.
      </p>
      {sinControl > 0 && (
        <p className="aviso aviso--aviso">
          {sinControl === 1 ? "Hay una factura sin número de control" : `Hay ${sinControl} documentos sin número de control`}: hasta tenerlo no valen como factura fiscal.
          Se anota en cada una.
        </p>
      )}

      <section className="tarjeta">
        <form method="get" action="/admin/facturas" className={estilos.buscador} role="search">
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
            {totales.notas_credito > 0 && <div className={estilos.cifraNota}>{totales.notas_credito === 1 ? "1 nota de crédito" : `${totales.notas_credito} notas de crédito`}</div>}
          </div>
          <div className={estilos.cifra}>
            <dt>Base imponible</dt>
            <dd>{usd(totales.base_imponible_usd)}</dd>
            {totales.exento_usd > 0 && <div className={estilos.cifraNota}>Exento: {usd(totales.exento_usd)}</div>}
          </div>
          <div className={estilos.cifra}>
            <dt>IVA</dt>
            <dd>{usd(totales.iva_usd)}</dd>
          </div>
          <div className={estilos.cifra}>
            <dt>Total facturado</dt>
            <dd>{usd(totales.total_usd)}</dd>
            <div className={estilos.cifraNota}>{mesLegible(mes)}, netas de notas de crédito</div>
          </div>
        </dl>

        {facturas.length === 0 ? (
          <p className="vacio">Ningún documento en {mesLegible(mes)}.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="numero">Base</th>
                  <th className="numero">IVA</th>
                  <th className="numero">Total</th>
                  <th>N.º de control</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id}>
                    <td data-label="Documento">
                      <Link href={`/admin/facturas/${f.id}`}>
                        {NOMBRE_DOCUMENTO[f.tipo]} N.º {numeroDeFactura(f.numero)}
                      </Link>
                    </td>
                    <td data-label="Fecha">{fechaCorta(f.fecha)}</td>
                    <td data-label="Cliente">
                      {rotuloFacturado(f.cliente)} <span className="ayuda">{f.cliente.cedula_rif}</span>
                    </td>
                    <td data-label="Base" className="numero">
                      {usd(f.base_imponible_usd)}
                      {f.exento_usd > 0 && <span className="ayuda"> + {usd(f.exento_usd)} (E)</span>}
                    </td>
                    <td data-label="IVA" className="numero">
                      {usd(f.iva_usd)}
                    </td>
                    <td data-label="Total" className="numero">
                      {usd(f.total_usd)}
                      {f.total_bs !== null && <span className="ayuda"> · {bs(f.total_bs)}</span>}
                    </td>
                    <td data-label="N.º de control" data-vacio={f.numero_control ? undefined : ""}>
                      {f.numero_control || <span className={estilos.sinNombre}>pendiente</span>}
                    </td>
                    <td data-label="Estado">
                      {f.tipo === "nota_credito" ? (
                        <span className={`${estilos.estado} ${estilos["estado--parcial"]}`}>Nota de crédito</span>
                      ) : f.estado === "anulada" ? (
                        <span className={`${estilos.estado} ${estilos["estado--por_pagar"]}`}>Anulada</span>
                      ) : (
                        <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Emitida</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Ajustes de facturación</h2>
        <form action={guardarAjustesDeFacturacion} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="iva_pct">Alícuota general del IVA (%)</label>
              <input id="iva_pct" name="iva_pct" type="number" inputMode="decimal" step="0.01" min="0" max="100" defaultValue={ivaPct} required />
              <span className="ayuda">Hoy es el 16 %. Si el Gobierno la cambia, cámbiala aquí: las facturas ya emitidas no se tocan.</span>
            </div>
            <div className="campo">
              <label htmlFor="facturas_desde">Numerar las facturas desde el</label>
              <input id="facturas_desde" name="facturas_desde" type="number" inputMode="numeric" min="1" step="1" defaultValue={desde} disabled={cuantas > 0} />
              <span className="ayuda">
                {cuantas > 0
                  ? "Ya hay facturas emitidas: la numeración sigue sola."
                  : "Si ya facturabas en papel, pon el número que sigue a tu última factura; si no, déjalo en 1."}
              </span>
            </div>
          </div>
          <button type="submit" className="boton">
            Guardar ajustes
          </button>
        </form>
        <p className="ayuda" style={{ marginTop: "var(--espacio-3)" }}>
          <strong>IVA de cada producto:</strong> {iva.gravados} {iva.gravados === 1 ? "tipo gravado" : "tipos gravados"} y {iva.exentos}{" "}
          {iva.exentos === 1 ? "exento" : "exentos"}
          {iva.exentos_nombres.length > 0 ? ` (${iva.exentos_nombres.join(", ")})` : ""}. Se cambia en la ficha de cada producto, en{" "}
          <Link href="/admin/productos">Productos</Link>. Los precios de la lista llevan el IVA incluido: la factura lo desglosa.
        </p>
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Lo que hace falta para que la factura valga ante el SENIAT</h2>
        <ol className={estilos.pasos}>
          <li>
            Un <strong>RIF vigente</strong> del negocio: el que hay venció en 2019; se renueva en el portal del SENIAT.
          </li>
          <li>
            Una <strong>imprenta digital autorizada</strong> (o el servicio gratuito del SENIAT cuando esté disponible), que asigna el número de control a cada factura.
            Cuando lo mande, se anota en la factura, aquí.
          </li>
          <li>
            Un <strong>contador</strong> que confirme qué productos están exentos, declare el IVA cada mes con el libro de ventas que baja de aquí y lleve el libro de
            compras.
          </li>
        </ol>
      </section>
    </>
  );
}
