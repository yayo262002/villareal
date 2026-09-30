import Link from "next/link";
import { iniciales } from "@/lib/resenas-texto";
import estilos from "./resenas.module.css";

type ResenaParaMostrar = {
  id: number;
  autor: string;
  detalle: string;
  texto: string;
  de_ejemplo: number;
};

/**
 * Las reseñas de un producto, como las lee quien entra a la web: lo que
 * dijo el cliente, entre comillas, y debajo quién lo dijo. Las de ejemplo
 * llevan su etiqueta; solo llegan aquí cuando quien mira es el dueño.
 */
export function ListaDeResenas({ resenas }: { resenas: ResenaParaMostrar[] }) {
  if (resenas.length === 0) return null;
  return (
    <ul className={estilos.resenas}>
      {resenas.map((r) => {
        const letras = iniciales(r.autor);
        return (
          <li key={r.id} className={`${estilos.resena} ${r.de_ejemplo ? estilos.deEjemplo : ""}`}>
            {r.de_ejemplo ? <span className={estilos.etiqueta}>Ejemplo</span> : null}
            <blockquote className={estilos.texto}>
              <p>«{r.texto}»</p>
            </blockquote>
            <p className={estilos.autor}>
              {letras && (
                <span className={estilos.iniciales} aria-hidden="true">
                  {letras}
                </span>
              )}
              <span>
                <strong>{r.autor}</strong>
                {r.detalle && <span className={estilos.detalle}>{r.detalle}</span>}
              </span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Lo que ve el dueño encima de las reseñas de ejemplo, para que sepa que
 * esa parte de la página es solo suya.
 */
export function AvisoDeEjemplos() {
  return (
    <p className={estilos.avisoDelDueno}>
      Las reseñas marcadas «Ejemplo» solo las ves tú, porque tienes abierto el panel. Tus clientes no las ven.{" "}
      <Link href="/admin/resenas">Poner las de verdad</Link>
    </p>
  );
}
