import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarAdjunto } from "@/lib/adjuntos";
import { buscarCliente } from "@/lib/clientes";
import { borrarAdjunto } from "@/lib/acciones";
import { fechaCorta, fechaDeLaBase } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar foto" };

/** Confirmación antes de borrar una foto de nota. Ver `ventas/[id]/eliminar`. */
export default async function PaginaEliminarAdjunto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adjunto = await buscarAdjunto(Number(id));
  if (!adjunto) notFound();
  const cliente = await buscarCliente(adjunto.cliente_id);
  const volver = `/admin/clientes/${adjunto.cliente_id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {cliente?.nombre ?? "Cliente"}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar esta foto?</h1>
      </div>

      <section className="tarjeta">
        <div className={estilos.miniaturas}>
          <div className={estilos.miniatura}>
            {adjunto.tipo === "application/pdf" ? (
              <span className={estilos.miniaturaPdf}>PDF</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/admin/adjuntos/${adjunto.id}`} alt={adjunto.descripcion || "Nota de entrega"} />
            )}
            <div className={estilos.miniaturaTexto}>
              <strong>{adjunto.descripcion || "Nota"}</strong>
              <span>{fechaCorta(fechaDeLaBase(adjunto.creado_en))}</span>
            </div>
          </div>
        </div>

        <p className={estilos.ayuda}>Se borra de la base de datos y no se puede recuperar.</p>

        <form action={borrarAdjunto} className={estilos.accionesFila}>
          <input type="hidden" name="id" value={adjunto.id} />
          <button type="submit" className="boton boton--peligro">
            Sí, eliminar
          </button>
          <Link href={volver} className="boton boton--secundario">
            Cancelar
          </Link>
        </form>
      </section>
    </>
  );
}
