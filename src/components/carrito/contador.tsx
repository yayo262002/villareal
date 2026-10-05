"use client";

import { useCarrito } from "./almacen";
import estilos from "./carrito.module.css";

/** Cuántos productos hay en el carrito, sobre el icono de la cabecera. Sin ninguno no se enseña. */
export function ContadorCarrito() {
  const cuantos = useCarrito().length;
  if (cuantos === 0) return null;
  return (
    <span className={estilos.contador} aria-label={`${cuantos} ${cuantos === 1 ? "producto" : "productos"} en el carrito`}>
      {cuantos}
    </span>
  );
}
