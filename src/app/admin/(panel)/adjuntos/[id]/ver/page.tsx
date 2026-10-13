import Link from "next/link";
import { notFound } from "next/navigation";
import { datosDelAdjunto } from "@/lib/adjuntos";
import { buscarCliente } from "@/lib/clientes";
import { listarPagosDeCliente } from "@/lib/pagos";
import { numeroDeNota } from "@/lib/entregas";
import { fechaCorta, fechaDeLaBase, horaDeLaBase, usd } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

type Parametros = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Parametros) {
  const { id } = await params;
  const adjunto = await datosDelAdjunto(Number(id));
  return { title: adjunto?.descripcion || "Foto" };
}

/**
 * Una foto (la nota firmada, la captura de un abono) vista entera, con su
 * fecha, de qué cliente es y de qué nota o abono, y la vuelta a donde se
 * estaba. El archivo en sí lo sirve `/admin/adjuntos/[id]`.
 */
export default async function PaginaAdjunto({ params, searchParams }: Parametros) {
  const { id } = await params;
  const parametros = await searchParams;
  const numero = Number(id);
  const adjunto = Number.isSafeInteger(numero) && numero > 0 ? await datosDelAdjunto(numero) : null;
  if (!adjunto) notFound();
  const cliente = await buscarCliente(adjunto.cliente_id);
  if (!cliente) notFound();

  const volver = typeof parametros.volver_a === "string" && parametros.volver_a.startsWith("/admin") ? parametros.volver_a : `/admin/clientes/${cliente.id}`;
  // La captura de un abono dice cuál: el número que tiene en la lista del cliente, del más antiguo al más nuevo.
  const pagos = adjunto.pago_id ? await listarPagosDeCliente(cliente.id) : [];
  const enOrden = [...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const abono = adjunto.pago_id ? enOrden.find((p) => p.id === adjunto.pago_id) : null;
  const numeroDeAbono = abono ? enOrden.indexOf(abono) + 1 : 0;
  const archivo = `/admin/adjuntos/${adjunto.id}`;

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p>
            <Link href={volver}>← Volver</Link>
          </p>
          <h1 className={estilos.titulo}>{adjunto.descripcion || "Foto"}</h1>
        </div>
      </div>
      <section className="tarjeta">
        <p className={estilos.ayuda}>
          De <Link href={`/admin/clientes/${cliente.id}`}>{cliente.rotulo}</Link> · guardada el {fechaCorta(fechaDeLaBase(adjunto.creado_en))} a las{" "}
          {horaDeLaBase(adjunto.creado_en)}
          {adjunto.venta_id && (
            <>
              {" "}
              · <Link href={`/admin/ventas/${adjunto.venta_id}/nota`}>nota N.º {numeroDeNota(adjunto.venta_id)}</Link>
            </>
          )}
          {abono && (
            <>
              {" "}
              · <Link href={`/admin/clientes/${cliente.id}#abonos`}>abono N.º {numeroDeAbono}</Link> del {fechaCorta(abono.fecha)} ({usd(abono.monto_usd)})
            </>
          )}
          {!adjunto.venta_id && !adjunto.pago_id && /^Nota N\.º/.test(adjunto.descripcion) ? " · esa nota ya se borró; la foto se queda con el cliente" : ""}
        </p>
        {adjunto.tipo === "application/pdf" ? (
          <p>
            <a href={archivo} target="_blank" rel="noopener" className="boton boton--secundario">
              Abrir el PDF
            </a>
          </p>
        ) : (
          <a href={archivo} target="_blank" rel="noopener" title="Abrir la foto sola, para ampliarla">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={archivo} alt={adjunto.descripcion || "Foto"} className={estilos.adjuntoEntero} />
          </a>
        )}
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
          <Link href={volver} className="boton boton--secundario">
            ← Volver
          </Link>
          <a href={archivo} target="_blank" rel="noopener" className="boton boton--secundario">
            Abrir la foto sola
          </a>
          <Link href={`/admin/adjuntos/${adjunto.id}/eliminar`} className="enlace-fila">
            Eliminar
          </Link>
        </div>
      </section>
    </>
  );
}
