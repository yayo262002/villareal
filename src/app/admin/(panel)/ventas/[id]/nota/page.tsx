import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio } from "@/config/negocio";
import { buscarCliente } from "@/lib/clientes";
import { buscarVenta, listarVentasDeCliente } from "@/lib/ventas";
import { leerTasa } from "@/lib/ajustes";
import { NOMBRE_ESTADO, aplicarPagos } from "@/lib/cuentas";
import { sumarDias } from "@/lib/credito";
import { cambiarEntrega, subirAdjunto } from "@/lib/acciones";
import { adjuntosDeVenta } from "@/lib/adjuntos";
import { numeroDeNota, piezasDe } from "@/lib/entregas";
import { aBolivares, bs, cantidad, fechaCorta, fechaDeLaBase, usd } from "@/lib/dinero";
import { enlaceWhatsappA, mensajeNota } from "@/lib/whatsapp";
import { direccionDeCuenta } from "@/lib/enlace-cuenta";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EntradaFoto } from "@/components/entrada-foto";
import { FotosDeLaNota } from "@/components/fotos-de-nota";
import { DatosDelCliente, Membrete } from "../../../membrete";
import estilos from "../../../panel.module.css";

type Parametros = { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> };

/** Marcar entregada puede incluir leer la foto de la nota, que tarda unos segundos. */
export const maxDuration = 60;

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

  // Si la foto vino con reparos desde el despacho, sigue guardada y se confirma desde aquí; después se vuelve adonde se estaba.
  const fotoEnEspera = typeof parametros.foto_espera === "string" ? parametros.foto_espera : "";
  const pideConfirmarNota = parametros.confirmar_nota === "1";
  const volverA = typeof parametros.volver_a === "string" && parametros.volver_a.startsWith("/admin") ? parametros.volver_a : `/admin/ventas/${venta.id}/nota`;

  const [ventas, tasaDeHoy, fotos] = await Promise.all([listarVentasDeCliente(cliente.id), leerTasa(), adjuntosDeVenta(venta.id)]);
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
      enlace: cliente.enlace ? direccionDeCuenta(cliente.enlace) : null,
    }),
  );

  return (
    <>
      <div className={estilos.noImprimir}>
        <p>
          <Link href={`/admin/clientes/${cliente.id}`}>← {cliente.rotulo}</Link>
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
        <form action={cambiarEntrega} className={estilos.entrega} encType="multipart/form-data">
          <input type="hidden" name="id" value={venta.id} />
          <input type="hidden" name="entregada" value={venta.por_entregar ? "1" : "0"} />
          <input type="hidden" name="volver_a" value={volverA} />
          {venta.por_entregar ? (
            <>
              <span className={`${estilos.estado} ${estilos["estado--parcial"]}`}>Por entregar</span>
              <span>
                {venta.entrega_prevista ? `Prevista para el ${fechaCorta(venta.entrega_prevista)}. ` : ""}
                Está en la <Link href="/admin/despacho">ruta de despacho</Link>.
              </span>
              <label htmlFor="foto-entrega" className="ayuda">
                {fotoEnEspera ? "La foto que pusiste ya está guardada; solo pon otra si quieres cambiarla:" : "Foto de la nota firmada:"}
              </label>
              {fotoEnEspera && <input type="hidden" name="foto_espera" value={fotoEnEspera} />}
              <EntradaFoto nombre="foto" id="foto-entrega" opcional={Boolean(fotoEnEspera)} />
              {pideConfirmarNota && (
                <label className={estilos.casilla}>
                  <input type="checkbox" name="confirmar_nota" value="1" />
                  <span>Ya revisé la foto de la nota: marcarla entregada igual</span>
                </label>
              )}
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

        {/* La foto de la nota firmada que se guardó al entregar: aquí, donde se busca. Si no la hay, se pone aquí mismo. */}
        {!venta.por_entregar && (
          <section id="nota-firmada" aria-labelledby="titulo-nota-firmada" style={{ marginTop: "var(--espacio-4)" }}>
            <h2 id="titulo-nota-firmada" className={estilos.subtituloPequeno}>
              {fotos.length === 1 ? "Foto de la nota firmada" : fotos.length > 1 ? `Fotos de la nota firmada (${fotos.length})` : "Foto de la nota firmada"}
            </h2>
            {fotos.length > 0 ? (
              <>
                <p className="ayuda">Toca la foto para verla entera. Está también en la ficha del cliente.</p>
                <FotosDeLaNota adjuntos={fotos} conEliminar />
              </>
            ) : (
              <>
                <p className="ayuda">Esta venta no tiene guardada la foto de la nota firmada (es de antes de que se pidiera, o se borró). Puedes ponerla aquí:</p>
                <form action={subirAdjunto} encType="multipart/form-data" className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
                  <input type="hidden" name="cliente_id" value={cliente.id} />
                  <input type="hidden" name="venta_id" value={venta.id} />
                  <input type="hidden" name="descripcion" value={`Nota N.º ${numeroDeNota(venta.id)} firmada`} />
                  <input type="hidden" name="volver_a" value={`/admin/ventas/${venta.id}/nota#nota-firmada`} />
                  <EntradaFoto nombre="archivo" id="foto-nota-firmada" soloFoto />
                  <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                    Guardar la foto
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>

      <article className={estilos.nota}>
        <Membrete titulo="Nota de entrega" numero={<>N.º {numeroDeNota(venta.id)}</>} fecha={fechaCorta(venta.fecha)} />
        <DatosDelCliente cliente={cliente} />

        <div className="tabla-envoltorio">
          <table className="tabla tabla--fichas">
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
                  <td data-label="Producto">{l.producto_nombre}</td>
                  <td data-label="Cantidad" className="numero">
                    {cantidad(l.cantidad, l.unidad)}
                    {piezasDe(l)}
                  </td>
                  <td data-label="Precio" className="numero">{usd(l.precio_unitario_usd)}</td>
                  <td data-label="Importe" className="numero">{usd(l.subtotal_usd)}</td>
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
                  {usd(cuenta.pendiente_usd)} · <span style={{ whiteSpace: "nowrap" }}>{NOMBRE_ESTADO[cuenta.estado]}</span>
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
