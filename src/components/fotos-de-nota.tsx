import Link from "next/link";
import type { Adjunto } from "@/lib/adjuntos";
import { fechaCorta, fechaDeLaBase } from "@/lib/dinero";
import estilos from "@/app/admin/(panel)/panel.module.css";

/**
 * Las fotos de la nota firmada de una venta, como se ven en la nota, en
 * el despacho y en la ficha del cliente: la miniatura abre la foto entera
 * con su fecha y la vuelta a donde se estaba (`/admin/adjuntos/[id]/ver`). `pequenas`
 * las pone chicas y en fila, para una lista; `conEliminar` añade el
 * enlace a la pantalla que confirma borrarla.
 */
export function FotosDeLaNota({ adjuntos, pequenas = false, conEliminar = false, volverA }: { adjuntos: Adjunto[]; pequenas?: boolean; conEliminar?: boolean; volverA?: string }) {
  const vuelta = volverA ? `?volver_a=${encodeURIComponent(volverA)}` : "";
  if (adjuntos.length === 0) return null;
  return (
    <ul className={pequenas ? estilos.fotosChicas : estilos.miniaturas}>
      {adjuntos.map((a) => (
        <li key={a.id} className={estilos.miniatura}>
          <Link href={`/admin/adjuntos/${a.id}/ver${vuelta}`} title="Ver la foto entera, con su fecha">
            {a.tipo === "application/pdf" ? (
              <span className={estilos.miniaturaPdf}>PDF</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/admin/adjuntos/${a.id}`} alt={a.descripcion || "Nota firmada"} />
            )}
          </Link>
          {!pequenas && (
            <div className={estilos.miniaturaTexto}>
              <strong>{a.descripcion || "Nota firmada"}</strong>
              <span>{fechaCorta(fechaDeLaBase(a.creado_en))}</span>
              {conEliminar && (
                <Link href={`/admin/adjuntos/${a.id}/eliminar`} className="enlace-fila">
                  Eliminar
                </Link>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
