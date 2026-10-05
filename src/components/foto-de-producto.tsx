import type { ImagenDeProducto } from "@/lib/fotos-referenciales";
import estilos from "./foto-de-producto.module.css";

/**
 * La foto de un producto: la que subió el dueño o, mientras no la haya,
 * una foto de referencia de lo que es. Sin ninguna de las dos, un fondo
 * crema con el león de la marca. Nunca un dibujo. Con `aviso`, la de
 * referencia lo dice debajo («Foto referencial»): el cliente sabe que no
 * es la mercancía de la tienda.
 */
export function FotoDeProducto({
  imagen,
  nombre,
  className,
  tamano = 720,
  prioridad = false,
  aviso = false,
}: {
  imagen: ImagenDeProducto;
  nombre: string;
  className?: string;
  /** El lado de la foto en píxeles, para reservar su sitio. */
  tamano?: number;
  /** La primera foto de la página se pide en seguida. */
  prioridad?: boolean;
  aviso?: boolean;
}) {
  if (!imagen) {
    return (
      <span className={`${estilos.sinFoto} ${className ?? ""}`} role="img" aria-label={nombre}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marca/leon.svg" alt="" width={33} height={52} />
      </span>
    );
  }
  return (
    <span className={`${estilos.marco} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagen.src}
        alt={nombre}
        width={tamano}
        height={tamano}
        loading={prioridad ? "eager" : "lazy"}
        fetchPriority={prioridad ? "high" : undefined}
        decoding="async"
        className={imagen.referencial ? estilos.referencial : estilos.propia}
      />
      {aviso && imagen.referencial && <span className={estilos.aviso}>Foto referencial</span>}
    </span>
  );
}
