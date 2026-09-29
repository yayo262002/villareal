import { CAJA_DEL_DIBUJO, interiorDelDibujo } from "@/lib/dibujos";

/**
 * El dibujo de un producto dentro de la página. El dibujo en sí está en
 * `lib/dibujos.ts`, escrito como SVG en texto: aquí solo se le pone el marco.
 * Ese texto lo escribe el código, no el dueño ni el cliente, así que meterlo
 * tal cual en la página es seguro.
 */
export function IlustracionProducto({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <svg
      viewBox={CAJA_DEL_DIBUJO}
      className={className}
      role="img"
      aria-label={`Dibujo de ${nombre.toLowerCase()}`}
      dangerouslySetInnerHTML={{ __html: interiorDelDibujo(nombre) }}
    />
  );
}
