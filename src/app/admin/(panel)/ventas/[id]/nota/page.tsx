import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio, whatsappLegible } from "@/config/negocio";
import { buscarCliente } from "@/lib/clientes";
import { buscarVenta, listarVentasDeCliente } from "@/lib/ventas";
import { leerTasa } from "@/lib/ajustes";
import { NOMBRE_ESTADO, aplicarPagos } from "@/lib/cuentas";
import { aBolivares, bs, cantidad, fechaCorta, usd } from "@/lib/dinero";
import { enlaceWhatsappA, esSoloUnTelefono, mensajeNota } from "@/lib/whatsapp";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { BotonImprimir } from "@/components/boton-imprimir";
import estilos from "../../../panel.module.css";

type Parametros = { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> };

/** «000012»: el número de la nota es el de la venta, con ceros delante. */
function numeroDeNota(id: number): string {
  return String(id).padStart(6, "0");
}

export async function generateMetadata({ params }: Parametros) {
  const { id } = await params;
  return { title: `Nota de entrega ${numeroDeNota(Number(id))}` };
}

/**
 * La nota de entrega de una venta, lista para imprimir o mandar. El
 * negocio no factura todavía: esto es el comprobante de lo entregado y de
 * lo que queda por pagar, y lo dice. No es una factura fiscal.
 */
export default async function PaginaNota({ params, searchParams }: Parametros) {
  const { id } = await params;
  const parametros = await searchParams;
  const venta = await buscarVenta(Number(id));
  if (!venta) notFound();
  const cliente = await buscarCliente(venta.cliente_id);
  if (!cliente) notFound();

  const [ventas, tasaDeHoy] = await Promise.all([listarVentasDeCliente(cliente.id), leerTasa()]);
  const cuenta = aplicarPagos(ventas, cliente.total_pagado_usd).find((c) => c.id === venta.id);
  // Los bolívares son los del día de la venta. Las ventas viejas no la guardaron.
  const totalBs = aBolivares(venta.total_usd, venta.tasa);
  const enviar = enlaceWhatsappA(
    cliente.telefono,
    mensajeNota({
      negocio: negocio.nombre,
      cliente: cliente.nombre,
      fecha: venta.fecha,
      lineas: venta.lineas,
      total_usd: venta.total_usd,
      saldo_usd: cliente.saldo_usd,
      tasa: venta.tasa ?? tasaDeHoy?.valor,
    }),
  );

  return (
    <>
      <div className={estilos.noImprimir}>
        <p>
          <Link href={`/admin/clientes/${cliente.id}`}>← {cliente.nombre}</Link>
        </p>
        <Avisos parametros={parametros} />
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
          <BotonImprimir className="boton">Imprimir o guardar PDF</BotonImprimir>
          {enviar && (
            <a href={enviar} target="_blank" rel="noopener" className="boton boton--acento">
              Enviar por WhatsApp
            </a>
          )}
          <Link href={`/admin/clientes/${cliente.id}#abono`} className="boton boton--secundario">
            Registrar abono
          </Link>
          <Link href={`/admin/ventas?cliente=${cliente.id}`} className="boton boton--secundario">
            Otra venta
          </Link>
        </div>
      </div>

      <article className={estilos.nota}>
        <header className={estilos.notaCabecera}>
          <div className={estilos.notaEmisor}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/leon.svg" alt="" width={38} height={60} />
            <div>
              <strong>{negocio.razonSocial || negocio.nombre}</strong>
              {negocio.rif && <span>RIF {negocio.rif}</span>}
              <span>
                {negocio.direccion}, {negocio.ciudad}
              </span>
              {negocio.whatsapp && <span>Teléfono {whatsappLegible()}</span>}
            </div>
          </div>
          <div className={estilos.notaNumero}>
            <span>Nota de entrega</span>
            <strong>N.º {numeroDeNota(venta.id)}</strong>
            <span>{fechaCorta(venta.fecha)}</span>
          </div>
        </header>

        <dl className={estilos.notaCliente}>
          <div>
            <dt>Cliente</dt>
            <dd>{esSoloUnTelefono(cliente.nombre) ? "Sin nombre registrado" : cliente.nombre}</dd>
          </div>
          {cliente.telefono && (
            <div>
              <dt>Teléfono</dt>
              <dd>{cliente.telefono}</dd>
            </div>
          )}
          {cliente.cedula_rif && (
            <div>
              <dt>Cédula o RIF</dt>
              <dd>{cliente.cedula_rif}</dd>
            </div>
          )}
          {cliente.direccion && (
            <div>
              <dt>Dirección</dt>
              <dd>{cliente.direccion}</dd>
            </div>
          )}
        </dl>

        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="numero">Cantidad</th>
                <th className="numero">Precio</th>
                <th className="numero">Importe</th>
              </tr>
            </thead>
            <tbody>
              {venta.lineas.map((l) => (
                <tr key={l.id}>
                  <td>{l.producto_nombre}</td>
                  <td className="numero">{cantidad(l.cantidad, l.unidad)}</td>
                  <td className="numero">{usd(l.precio_unitario_usd)}</td>
                  <td className="numero">{usd(l.subtotal_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className={estilos.notaTotales}>
          <div className={estilos.notaTotal}>
            <dt>Total</dt>
            <dd>{usd(venta.total_usd)}</dd>
          </div>
          {totalBs !== null && venta.tasa && (
            <div>
              <dt>En bolívares, a {bs(venta.tasa)} por dólar</dt>
              <dd>{bs(totalBs)}</dd>
            </div>
          )}
          {cuenta && (
            <>
              <div>
                <dt>Abonado a esta nota</dt>
                <dd>{usd(cuenta.pagado_usd)}</dd>
              </div>
              <div>
                <dt>Queda por pagar de esta nota</dt>
                <dd>
                  {usd(cuenta.pendiente_usd)} · {NOMBRE_ESTADO[cuenta.estado]}
                </dd>
              </div>
            </>
          )}
          {cliente.saldo_usd !== 0 && (
            <div>
              <dt>{cliente.saldo_usd > 0 ? "Saldo total del cliente" : "Saldo a favor del cliente"}</dt>
              <dd>{usd(Math.abs(cliente.saldo_usd))}</dd>
            </div>
          )}
        </dl>

        {venta.nota && <p className={estilos.notaObservacion}>Observación: {venta.nota}</p>}

        <div className={estilos.notaFirmas}>
          <span>Entregado por</span>
          <span>Recibido conforme</span>
        </div>
        <p className={estilos.notaPie}>
          Nota de entrega. No es una factura. Los abonos se aplican a las notas más antiguas primero.
        </p>
      </article>
    </>
  );
}
