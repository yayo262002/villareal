import Link from "next/link";
import { notFound } from "next/navigation";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import { cuentaDelCliente } from "@/lib/cuenta-cliente";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { sumarDias } from "@/lib/credito";
import { aBolivares, bs, fechaCorta, usd } from "@/lib/dinero";
import { BarraDePago, EstadoDeNota, LineasDeNota, MarcoDeCuenta, PlazoDeNota } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string; id: string }> };

export async function generateMetadata({ params }: Parametros) {
  const { id } = await params;
  return { title: `Nota ${numeroDeNota(Number(id))}` };
}

/**
 * Una nota entera, para el cliente: lo que llevaba línea a línea, el total
 * en dólares y en bolívares a la tasa del día de la venta, lo abonado a
 * ella y lo que queda, su plazo y si ya se la entregaron. Con un botón para
 * pedir lo mismo otra vez. Solo las suyas: otra nota da 404.
 */
export default async function PaginaNotaDelCliente({ params }: Parametros) {
  const { enlace, id } = await params;
  const cuenta = await cuentaDelCliente(enlace);
  const nota = cuenta?.notas.find((n) => n.id === Number(id));
  if (!cuenta || !nota) notFound();

  const total = Number(nota.total_usd);
  const totalBs = aBolivares(total, nota.tasa);
  const pendienteBs = nota.pendiente_usd > 0 ? aBolivares(nota.pendiente_usd, cuenta.tasa?.valor ?? null) : null;
  const vence = sumarDias(nota.fecha, cuenta.cliente.dias_credito);
  const pedirLoMismo = enlaceWhatsapp(`Hola, soy ${cuenta.cliente.rotulo}. Quiero pedir lo mismo que la nota ${numeroDeNota(nota.id)}: ${resumenDeLineas(nota.lineas)}.`);
  const avisarPago = enlaceWhatsapp(`Hola, soy ${cuenta.cliente.rotulo}. Ya pagué la nota ${numeroDeNota(nota.id)}; le mando el comprobante.`);

  return (
    <MarcoDeCuenta enlace={enlace} actual="notas" cuenta={cuenta}>
      <p className={estilos.volver}>
        <Link href={`/cuenta/${enlace}/notas`}>← Mis notas</Link>
      </p>
      <article className={estilos.detalle}>
        <div className={estilos.notaCabecera}>
          <h2 className={estilos.detalleTitulo}>Nota {numeroDeNota(nota.id)}</h2>
          <EstadoDeNota estado={nota.estado} />
        </div>
        <p className={estilos.ayuda}>
          Del {fechaCorta(nota.fecha)} · {negocio.nombre}
          {nota.por_entregar ? ` · Por entregar${nota.entrega_prevista ? `, prevista para el ${fechaCorta(nota.entrega_prevista)}` : ""}` : " · Entregada"}
        </p>
        {nota.lineas.length > 0 ? <LineasDeNota nota={nota} /> : <p className={estilos.ayuda}>Sin detalle de productos.</p>}
        <dl className={estilos.totales}>
          <div className={estilos.totalGrande}>
            <dt>Total</dt>
            <dd>{usd(total)}</dd>
          </div>
          {totalBs !== null && nota.tasa && (
            <div>
              <dt>En bolívares, a {bs(nota.tasa)} por dólar ese día</dt>
              <dd>{bs(totalBs)}</dd>
            </div>
          )}
          <div>
            <dt>Abonado a esta nota</dt>
            <dd>{usd(nota.pagado_usd)}</dd>
          </div>
          <div className={estilos.totalGrande}>
            <dt>Queda por pagar</dt>
            <dd>{usd(nota.pendiente_usd)}</dd>
          </div>
          {pendienteBs !== null && cuenta.tasa && (
            <div>
              <dt>Lo que queda, en bolívares a la tasa de hoy</dt>
              <dd>{bs(pendienteBs)}</dd>
            </div>
          )}
          {nota.pendiente_usd > 0 && (
            <div>
              <dt>Fecha límite de pago</dt>
              <dd>{fechaCorta(vence)}</dd>
            </div>
          )}
        </dl>
        <BarraDePago nota={nota} />
        <PlazoDeNota nota={nota} fecha={cuenta.fecha} />
      </article>
      <div className={estilos.acciones}>
        {nota.pendiente_usd > 0 && avisarPago && (
          <a className="boton boton--acento" href={avisarPago} target="_blank" rel="noopener">
            Avisar que pagué esta nota
          </a>
        )}
        {pedirLoMismo && nota.lineas.length > 0 && (
          <a className="boton boton--secundario" href={pedirLoMismo} target="_blank" rel="noopener">
            Pedir lo mismo otra vez
          </a>
        )}
      </div>
      <p className={estilos.ayuda}>Los abonos se aplican a las notas más antiguas primero. Esta nota no es una factura fiscal.</p>
    </MarcoDeCuenta>
  );
}
