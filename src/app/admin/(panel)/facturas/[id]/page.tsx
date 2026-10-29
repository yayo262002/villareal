import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio } from "@/config/negocio";
import { buscarFactura, notaDeCreditoDe, rotuloFacturado } from "@/lib/facturas";
import { buscarVenta } from "@/lib/ventas";
import { buscarCliente } from "@/lib/clientes";
import { pagosDeVenta } from "@/lib/pagos";
import { ponerControlDeFactura } from "@/lib/acciones";
import { NOMBRE_DOCUMENTO, cantidadDeLinea, descripcionDeLinea, numeroDeFactura } from "@/lib/factura-calculo";
import { numeroDeNota } from "@/lib/entregas";
import { sumarDias } from "@/lib/credito";
import { bs, fechaCorta, fechaDeLaBase, usd } from "@/lib/dinero";
import { enlaceWhatsappA, mensajeFactura } from "@/lib/whatsapp";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { BotonImprimir } from "@/components/boton-imprimir";
import { DatosDelCliente } from "../../membrete";
import estilos from "../../panel.module.css";

type Parametros = {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosAviso>;
};

export async function generateMetadata({ params }: Parametros) {
  const { id } = await params;
  const factura = await buscarFactura(Number(id));
  return {
    title: factura ? `${NOMBRE_DOCUMENTO[factura.tipo]} ${numeroDeFactura(factura.numero)}` : "Factura",
  };
}

function formatearPct(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Una factura (o una nota de crédito), para imprimir en A4 o en la
 * impresora de 80 mm, mandar por WhatsApp, anotarle el número de control
 * y anularla. Todo lo que enseña está guardado en la propia factura: no
 * cambia aunque cambien el producto o el cliente.
 */
export default async function PaginaFactura({ params, searchParams }: Parametros) {
  const { id } = await params;
  const parametros = await searchParams;
  const factura = await buscarFactura(Number(id));
  if (!factura) notFound();
  const esNotaDeCredito = factura.tipo === "nota_credito";
  const [venta, anulada, notaDeCredito, afectada] = await Promise.all([
    factura.venta_id ? buscarVenta(factura.venta_id) : null,
    Promise.resolve(factura.estado === "anulada"),
    esNotaDeCredito ? null : notaDeCreditoDe(factura.id),
    esNotaDeCredito && factura.factura_id ? buscarFactura(factura.factura_id) : null,
  ]);
  // La condición de la operación: contado si se cobró entera con la venta; si no, crédito a los días de la nota.
  const [pagos, cliente] = await Promise.all([venta ? pagosDeVenta(venta.id) : [], venta ? buscarCliente(venta.cliente_id) : null]);
  const cobrado = pagos.reduce((s, p) => s + Number(p.monto_usd), 0);
  const alContado = venta ? cobrado + 0.009 >= Number(venta.total_usd) : true;
  const diasDeCredito = venta ? (venta.dias_credito ?? cliente?.dias_credito ?? 7) : null;
  const formatoTicket = parametros.formato === "ticket";
  const claveVendida = typeof parametros.vendida === "string" ? parametros.vendida : "";
  const titulo = esNotaDeCredito ? "NOTA DE CRÉDITO" : "FACTURA";
  const numero = numeroDeFactura(factura.numero);
  const enviar = enlaceWhatsappA(
    factura.cliente.telefono,
    mensajeFactura({
      negocio: factura.emisor.nombre,
      rif: factura.emisor.rif,
      cliente: rotuloFacturado(factura.cliente),
      cliente_rif: factura.cliente.cedula_rif,
      numero: `${esNotaDeCredito ? "NC " : ""}${numero}`,
      numero_control: factura.numero_control,
      fecha: factura.fecha,
      hora: factura.hora,
      lineas: factura.lineas,
      exento_usd: factura.exento_usd,
      base_imponible_usd: factura.base_imponible_usd,
      iva_pct: factura.iva_pct,
      iva_usd: factura.iva_usd,
      total_usd: factura.total_usd,
      tasa: factura.tasa,
      nota: factura.venta_id ? numeroDeNota(factura.venta_id) : undefined,
      anulada,
    }),
  );
  const volverA = `/admin/facturas/${factura.id}${formatoTicket ? "?formato=ticket" : ""}`;

  const acciones = (
    <div className={estilos.noImprimir}>
      <p>
        <Link href="/admin/facturas">← Facturas</Link>
        {venta && (
          <>
            {" · "}
            <Link href={`/admin/ventas/${venta.id}/nota`}>Nota de entrega N.º {numeroDeNota(venta.id)}</Link>
          </>
        )}
        {factura.cliente_id && (
          <>
            {" · "}
            <Link href={`/admin/clientes/${factura.cliente_id}`}>{rotuloFacturado(factura.cliente)}</Link>
          </>
        )}
      </p>
      <Avisos parametros={parametros} />
      {anulada && (
        <p className="aviso aviso--error">
          Factura anulada
          {factura.anulada_en ? ` el ${fechaCorta(fechaDeLaBase(factura.anulada_en))}` : ""}
          {notaDeCredito ? (
            <>
              {" "}
              con la <Link href={`/admin/facturas/${notaDeCredito.id}`}>nota de crédito N.º {numeroDeFactura(notaDeCredito.numero)}</Link>
            </>
          ) : null}
          {factura.motivo ? `. Motivo: ${factura.motivo}` : "."}
          {venta ? (
            <>
              {" "}
              La venta sigue registrada: se puede <Link href={`/admin/ventas/${venta.id}/nota`}>facturar otra vez</Link> o borrar desde su nota.
            </>
          ) : null}
        </p>
      )}
      {esNotaDeCredito && afectada && (
        <p className="aviso aviso--aviso">
          Anula la <Link href={`/admin/facturas/${afectada.id}`}>factura N.º {numeroDeFactura(afectada.numero)}</Link>
          {factura.motivo ? `. Motivo: ${factura.motivo}` : "."}
        </p>
      )}
      <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
        <BotonImprimir className="boton">{formatoTicket ? "Imprimir el ticket" : "Imprimir o guardar PDF"}</BotonImprimir>
        {claveVendida && (
          <Link href={`/admin/ventas?vendida=${encodeURIComponent(claveVendida)}`} className="boton boton--acento">
            Nueva venta
          </Link>
        )}
        {enviar && (
          <a href={enviar} target="_blank" rel="noopener" className="boton boton--acento">
            Enviar por WhatsApp
          </a>
        )}
        <Link href={formatoTicket ? `/admin/facturas/${factura.id}` : `/admin/facturas/${factura.id}?formato=ticket`} className="boton boton--secundario">
          {formatoTicket ? "Ver en tamaño carta" : "Ver como ticket (80 mm)"}
        </Link>
        {!esNotaDeCredito && !anulada && (
          <Link href={`/admin/facturas/${factura.id}/anular`} className="boton boton--secundario">
            Anular con nota de crédito
          </Link>
        )}
      </div>

      {/* El número de control: lo asigna la imprenta digital autorizada; se anota cuando llega. */}
      <form action={ponerControlDeFactura} className={`${estilos.entrega} ${estilos.facturaControl}`}>
        <input type="hidden" name="id" value={factura.id} />
        <input type="hidden" name="volver_a" value={volverA} />
        <div className="campo" style={{ flex: "1 1 220px", margin: 0 }}>
          <label htmlFor="numero_control">Número de control</label>
          <input
            id="numero_control"
            name="numero_control"
            type="text"
            autoComplete="off"
            defaultValue={factura.numero_control}
            placeholder="00-00000123"
            maxLength={40}
          />
        </div>
        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
          {factura.numero_control ? "Cambiar" : "Guardar"}
        </button>
        <span className="ayuda" style={{ flexBasis: "100%" }}>
          {factura.numero_control
            ? `Puesto${factura.control_puesto_en ? ` el ${fechaCorta(fechaDeLaBase(factura.control_puesto_en))}` : ""}.`
            : "Pendiente: lo da la imprenta digital autorizada por el SENIAT. Sin él, el papel no vale como factura fiscal."}
        </span>
      </form>
    </div>
  );

  const leyendaControl = factura.numero_control ? `N.º de control ${factura.numero_control}` : "N.º de control: pendiente de la imprenta digital";

  if (formatoTicket) {
    return (
      <>
        <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } }`}</style>
        {acciones}
        <article className={estilos.ticket}>
          {anulada && <p className={estilos.facturaSello}>ANULADA</p>}
          <header className={estilos.ticketCabecera}>
            <strong>{negocio.nombreCorto.toUpperCase()}</strong>
            <span>{factura.emisor.nombre}</span>
            <span>RIF {factura.emisor.rif}</span>
            <span>{factura.emisor.direccion}</span>
            {factura.emisor.telefono && <span>Tel. {factura.emisor.telefono}</span>}
          </header>
          <dl className={estilos.ticketDatos}>
            <div>
              <dt>{titulo}</dt>
              <dd>N.º {numero}</dd>
            </div>
            <div>
              <dt>Control</dt>
              <dd>{factura.numero_control || "pendiente"}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>
                {fechaCorta(factura.fecha)} {factura.hora}
              </dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{rotuloFacturado(factura.cliente)}</dd>
            </div>
            <div>
              <dt>RIF / C.I.</dt>
              <dd>{factura.cliente.cedula_rif}</dd>
            </div>
            {afectada && (
              <div>
                <dt>Anula</dt>
                <dd>Factura N.º {numeroDeFactura(afectada.numero)}</dd>
              </div>
            )}
          </dl>
          <table className={estilos.ticketLineas}>
            <tbody>
              {factura.lineas.map((l, i) => (
                <tr key={i}>
                  <td>
                    {cantidadDeLinea(l)} {descripcionDeLinea(l)}
                  </td>
                  <td>{usd(l.precio_sin_iva_usd)}</td>
                  <td>{usd(l.base_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className={estilos.ticketTotales}>
            {factura.descuento_usd > 0 && (
              <div>
                <dt>Descuento</dt>
                <dd>−{usd(factura.descuento_usd)}</dd>
              </div>
            )}
            {factura.exento_usd > 0 && (
              <div>
                <dt>Exento (E)</dt>
                <dd>{usd(factura.exento_usd)}</dd>
              </div>
            )}
            <div>
              <dt>Base imponible</dt>
              <dd>{usd(factura.base_imponible_usd)}</dd>
            </div>
            <div>
              <dt>IVA {formatearPct(factura.iva_pct)} %</dt>
              <dd>{usd(factura.iva_usd)}</dd>
            </div>
            <div className={estilos.ticketTotal}>
              <dt>TOTAL USD</dt>
              <dd>{usd(factura.total_usd)}</dd>
            </div>
            {factura.tasa && factura.total_bs !== null && (
              <>
                <div>
                  <dt>Tasa BCV</dt>
                  <dd>{bs(factura.tasa)} / USD</dd>
                </div>
                <div className={estilos.ticketTotal}>
                  <dt>TOTAL Bs</dt>
                  <dd>{bs(factura.total_bs)}</dd>
                </div>
              </>
            )}
          </dl>
          <p className={estilos.ticketPago}>
            {alContado ? "Contado." : `Crédito a ${diasDeCredito} días${venta ? `: vence el ${fechaCorta(sumarDias(venta.fecha, diasDeCredito ?? 7))}` : ""}.`}
            {venta ? ` Nota de entrega N.º ${numeroDeNota(venta.id)}.` : ""}
          </p>
          <p className={estilos.ticketPie}>Precios con IVA incluido. (E): exento de IVA.</p>
          <p className={estilos.ticketPie}>{leyendaControl}</p>
        </article>
      </>
    );
  }

  return (
    <>
      {acciones}
      <article className={estilos.nota}>
        {anulada && <p className={estilos.facturaSello}>ANULADA</p>}
        <header className={estilos.notaCabecera}>
          <div className={estilos.notaEmisor}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/leon.svg" alt="" width={38} height={60} />
            <div>
              <strong>{factura.emisor.nombre}</strong>
              <span>RIF {factura.emisor.rif}</span>
              <span>{factura.emisor.direccion}</span>
              {factura.emisor.telefono && <span>Teléfono {factura.emisor.telefono}</span>}
            </div>
          </div>
          <div className={estilos.notaNumero}>
            <span>{titulo}</span>
            <strong>N.º {numero}</strong>
            <span>{leyendaControl}</span>
            <span>
              {fechaCorta(factura.fecha)}
              {factura.hora ? `, ${factura.hora}` : ""}
            </span>
            {afectada && <span>Anula la factura N.º {numeroDeFactura(afectada.numero)}</span>}
          </div>
        </header>
        <DatosDelCliente cliente={factura.cliente} />

        <div className="tabla-envoltorio">
          <table className="tabla tabla--fichas">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="numero">Cantidad</th>
                <th className="numero">Precio</th>
                <th className="numero">Importe</th>
              </tr>
            </thead>
            <tbody>
              {factura.lineas.map((l, i) => (
                <tr key={i}>
                  <td data-label="Descripción">{descripcionDeLinea(l)}</td>
                  <td data-label="Cantidad" className="numero">
                    {cantidadDeLinea(l)}
                  </td>
                  <td data-label="Precio" className="numero">
                    {usd(l.precio_sin_iva_usd)}
                  </td>
                  <td data-label="Importe" className="numero">
                    {usd(l.base_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className={estilos.notaTotales}>
          {factura.descuento_usd > 0 && (
            <div>
              <dt>Descuento (ya repartido en los importes)</dt>
              <dd>−{usd(factura.descuento_usd)}</dd>
            </div>
          )}
          {factura.exento_usd > 0 && (
            <div>
              <dt>Exento (E)</dt>
              <dd>{usd(factura.exento_usd)}</dd>
            </div>
          )}
          <div>
            <dt>Base imponible</dt>
            <dd>{usd(factura.base_imponible_usd)}</dd>
          </div>
          <div>
            <dt>IVA {formatearPct(factura.iva_pct)} %</dt>
            <dd>{usd(factura.iva_usd)}</dd>
          </div>
          <div className={estilos.notaTotal}>
            <dt>Total</dt>
            <dd>{usd(factura.total_usd)}</dd>
          </div>
          {factura.tasa && factura.total_bs !== null && (
            <>
              <div>
                <dt>Total en bolívares, a {bs(factura.tasa)} por dólar (BCV)</dt>
                <dd>{bs(factura.total_bs)}</dd>
              </div>
              <div>
                <dt>
                  Base imponible Bs {bs(Math.round(factura.base_imponible_usd * factura.tasa * 100) / 100)} · IVA Bs{" "}
                  {bs(Math.round(factura.iva_usd * factura.tasa * 100) / 100)}
                </dt>
                <dd />
              </div>
            </>
          )}
        </dl>

        <p className={estilos.notaObservacion}>
          Condición de la operación:{" "}
          {alContado ? "contado" : `crédito a ${diasDeCredito} días${venta ? `, vence el ${fechaCorta(sumarDias(venta.fecha, diasDeCredito ?? 7))}` : ""}`}.
          {venta ? ` Corresponde a la nota de entrega N.º ${numeroDeNota(venta.id)} del ${fechaCorta(venta.fecha)}.` : ""}
        </p>
        <p className={estilos.notaPie}>
          Precios en dólares con el IVA incluido; el equivalente en bolívares va a la tasa oficial del BCV del día de emisión. (E): exento de IVA.
        </p>
      </article>
    </>
  );
}
