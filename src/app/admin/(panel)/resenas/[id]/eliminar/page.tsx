import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarResena } from "@/lib/resenas";
import { borrarResena } from "@/lib/acciones";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar reseña" };

/** Confirmación antes de borrar una reseña. Ver `ventas/[id]/eliminar`. */
export default async function PaginaEliminarResena({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resena = await buscarResena(Number(id));
  if (!resena) notFound();

  return (
    <>
      <div>
        <p>
          <Link href="/admin/resenas">← Reseñas</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar esta reseña?</h1>
      </div>

      <section className="tarjeta">
        <dl className={estilos.detalle}>
          <div>
            <dt>Producto</dt>
            <dd>{resena.producto_nombre}</dd>
          </div>
          <div>
            <dt>Quién lo dice</dt>
            <dd>
              {resena.autor}
              {resena.detalle ? ` · ${resena.detalle}` : ""}
            </dd>
          </div>
          <div>
            <dt>Qué dijo</dt>
            <dd>«{resena.texto}»</dd>
          </div>
        </dl>

        <p className={estilos.ayuda}>
          Deja de salir en la web y no se puede deshacer. Si solo quieres que no se vea por ahora, vuelve atrás y
          pulsa «Esconder».
        </p>

        <form action={borrarResena} className={estilos.accionesFila}>
          <input type="hidden" name="id" value={resena.id} />
          <button type="submit" className="boton boton--peligro">
            Sí, eliminar
          </button>
          <Link href="/admin/resenas" className="boton boton--secundario">
            Cancelar
          </Link>
        </form>
      </section>
    </>
  );
}
