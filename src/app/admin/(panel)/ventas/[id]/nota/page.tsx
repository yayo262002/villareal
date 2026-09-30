import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio } from "@/config/negocio";
import { buscarCliente } from "@/lib/clientes";
import { buscarVenta, listarVentasDeCliente } from "@/lib/ventas";
import { leerTasa } from "@/lib/ajustes";
import { NOMBRE_ESTADO, aplicarPagos } from "@/lib/cuentas";
import { sumarDias } from "@/lib/credito";
import { cambiarEntrega } from "@/lib/acciones";
import { numeroDeNota } from "@/lib/entregas";
import { aBolivares, bs, cantidad, fechaCorta, fechaDeLaBase, usd } from "@/lib/dinero";
import { enlaceWhatsappA, mensajeNota } from "@/lib/whatsapp";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { BotonImprimir } from "@/components/boton-imprimir";
import { DatosDelCliente, Membrete } from "../../../membrete";
import estilos from "../../../panel.module.css";

type Parametros = { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> };

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
      numero: numeroDeNota(venta.id),
      lineas: venta.lineas,
      total_usd: venta.total_usd,
      saldo_usd: cliente.saldo_usd,
      tasa: venta.tasa ?? tasaDeHoy?.valor,
      vence: cuenta && cuenta.pendiente_usd > 0 ? sumarDias(venta.fecha, cliente.dias_credito) : undefined,
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

        {/* La entrega: si va al despacho, si ya se llevó, y el botón para cambiarlo. */}
        <form action={cambiarEntrega} className={estilos.entrega}>
          <input type="hidden" name="id" value={venta.id} />
          <input type="hidden" name="entregada" value={venta.por_entregar ? "1" : "0"} />
          <input type="hidden" name="volver_a" value={`/admin/ventas/${venta.id}/nota`} />
          {venta.por_entregar ? (
            <>
              <span className={`${estilos.estado} ${estilos["estado--parcial"]}`}>Por entregar</span>
              <span>
                Está en la <Link href="/admin/despacho">ruta de despacho</Link>.
              </span>
              <button type="submit" className={`boton ${estilos.botonPequeno}`}>
                Marcar entregada
              </button>
            </>
          ) : (
            <>
              <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Entregada</span>
              {venta.entregada_en && <span>el {fechaCorta(fechaDeLaBase(venta.entregada_en))}</span>}
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Mandar al despacho
              </button>
            </>
          )}
        </form>
      </div>

      <article className={estilos.nota}>
        <Membrete titulo="Nota de entrega" numero={<>N.º {numeroDeNota(venta.id)}</>} fecha={fechaCorta(venta.fecha)} />
        <DatosDelCliente cliente={cliente} />

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
              {cuenta.pendiente_usd > 0 && (
                <div>
                  <dt>Fecha límite de pago</dt>
                  <dd>{fechaCorta(sumarDias(venta.fecha, cliente.dias_credito))}</dd>
                </div>
              )}
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
