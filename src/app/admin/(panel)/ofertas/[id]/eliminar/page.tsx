import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarOferta } from "@/lib/ofertas";
import { borrarOferta } from "@/lib/acciones";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar oferta" };

/** La confirmación antes de borrar una oferta. Los productos que lleva no se tocan. */
export default async function PaginaEliminarOferta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oferta = await buscarOferta(Number(id));
  if (!oferta) notFound();
  const volver = `/admin/ofertas/${oferta.id}`;
  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {oferta.nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar la oferta «{oferta.nombre}»?</h1>
      </div>
      <section className="tarjeta">
        <p>
          Se borra la oferta; los productos que lleva siguen como están. <strong>No tiene vuelta atrás.</strong>
        </p>
        <form action={borrarOferta} className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-4)" }}>
          <input type="hidden" name="id" value={oferta.id} />
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
