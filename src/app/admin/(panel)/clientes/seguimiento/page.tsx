import Link from "next/link";
import { negocio } from "@/config/negocio";
import { estudioDeClientes } from "@/lib/estudio-de-clientes";
import { DIAS_SIN_TRATO, describirTrato } from "@/lib/seguimiento";
import { anotarContactoAccion } from "@/lib/acciones";
import { enlaceWhatsappA, mensajeOfrecer } from "@/lib/whatsapp";
import { fechaCorta, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../panel.module.css";

export const metadata = { title: "Estudio de clientes" };

const AQUI = "/admin/clientes/seguimiento";

/**
 * El estudio de clientes: quién lleva una semana o más sin trato (ni
 * compra, ni abono, ni recordatorio, ni llamada anotada), para llamarlo,
 * ofrecerle mercancía y ver cómo va todo; y de cada uno, qué suele
 * comprar, cada cuánto y cuándo le tocaría. «Lo llamé hoy» deja anotado el
 * trato y lo saca de la lista hasta dentro de una semana.
 */
export default async function PaginaSeguimiento({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const fecha = hoy();
  const estudio = await estudioDeClientes(fecha);
  const porLlamar = estudio.filter((e) => e.trato.porLlamar);
  const conCompraReciente = estudio.filter((e) => e.trato.comprado30Usd > 0).length;

  const ofrecer = (e: (typeof estudio)[number]) =>
    enlaceWhatsappA(e.cliente.telefono, mensajeOfrecer({ negocio: negocio.nombre, cliente: e.cliente.nombre, productos: e.trato.loQueCompra, web: negocio.web }));

  return (
    <>
      <div>
        <p>
          <Link href="/admin/clientes">← Cartera de clientes</Link>
        </p>
        <h1 className={estilos.titulo}>Estudio de clientes</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className={estilos.ayuda}>
        De cada cliente, cuándo fue el último trato (una compra, un abono, un recordatorio o una llamada que anotaste), qué suele comprar y cada
        cuánto. Quien lleva {DIAS_SIN_TRATO} días o más sin trato sale arriba, para llamarlo, ofrecerle mercancía y ver cómo va todo. «Lo llamé
        hoy» lo anota y lo baja de la lista.
      </p>

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Clientes</dt>
          <dd>{estudio.length}</dd>
        </div>
        <div className={`${estilos.cifra} ${porLlamar.length > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Por llamar</dt>
          <dd>{porLlamar.length}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Compraron en 30 días</dt>
          <dd>{conCompraReciente}</dd>
        </div>
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>
          {porLlamar.length === 0 ? "Nadie por llamar: todos con trato en la última semana" : `Por llamar (${porLlamar.length}), el que más tiempo lleva primero`}
        </h2>
        {estudio.length === 0 ? (
          <p className="vacio">Todavía no hay clientes.</p>
        ) : (
          <ul className={estilos.cartera}>
            {estudio.map(({ cliente, trato }) => {
              const whatsapp = ofrecer({ cliente, trato });
              return (
                <li key={cliente.id} className={estilos.carteraCliente} data-por-llamar={trato.porLlamar ? "1" : undefined}>
                  <div className={estilos.carteraCabecera}>
                    <Link href={`/admin/clientes/${cliente.id}`} className={estilos.carteraNombre}>
                      {cliente.rotulo}
                    </Link>
                    <span className={`${estilos.estado} ${trato.porLlamar ? estilos["estado--por_pagar"] : estilos["estado--pagada"]}`}>
                      {trato.porLlamar ? "Por llamar" : "Al día"}
                    </span>
                  </div>
                  <p className={estilos.carteraDato}>
                    <strong className={trato.porLlamar ? estilos.vencida : undefined}>{describirTrato(trato)}</strong>
                    {trato.ultimaCompra ? ` · última compra el ${fechaCorta(trato.ultimaCompra)}` : " · nunca ha comprado"}
                    {trato.ultimoAbono ? ` · último abono el ${fechaCorta(trato.ultimoAbono)}` : ""}
                    {cliente.saldo_usd > 0 ? ` · debe ${usd(cliente.saldo_usd)}` : ""}
                  </p>
                  {trato.compras > 0 && (
                    <p className={estilos.carteraDato}>
                      {trato.loQueCompra.length > 0 ? `Suele comprar ${trato.loQueCompra.join(", ")}` : `${trato.compras} ${trato.compras === 1 ? "compra" : "compras"}`}
                      {trato.cadaCuantosDias ? ` · cada ${trato.cadaCuantosDias} días` : ""}
                      {trato.proximaCompra ? ` · le tocaría el ${fechaCorta(trato.proximaCompra)}` : ""}
                      {` · ${usd(trato.comprado30Usd)} en los últimos 30 días`}
                    </p>
                  )}
                  <div className={estilos.carteraAcciones}>
                    {whatsapp && (
                      <a href={whatsapp} target="_blank" rel="noopener" className={estilos.whatsapp}>
                        Ofrecer por WhatsApp
                      </a>
                    )}
                    <form action={anotarContactoAccion}>
                      <input type="hidden" name="cliente_id" value={cliente.id} />
                      <input type="hidden" name="tipo" value="llamada" />
                      <input type="hidden" name="volver_a" value={AQUI} />
                      <button type="submit" className={estilos.botonEnlace}>
                        Lo llamé hoy
                      </button>
                    </form>
                    <Link href={`/admin/clientes/${cliente.id}#seguimiento`}>Anotar otro trato</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
