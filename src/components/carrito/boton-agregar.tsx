"use client";

import Link from "next/link";
import { useState } from "react";
import { agregarAlCarrito, cantidadValida, pasoDe } from "@/lib/carrito";
import { guardarCarrito, useCarrito } from "./almacen";
import estilos from "./carrito.module.css";

type Props = {
  /** «3»; con marca, «1-7»; un combo, «o2». */
  clave: string;
  nombre: string;
  unidad: string;
  /** Con selector de cantidad (la página del producto) o un solo botón (las tarjetas). */
  conCantidad?: boolean;
  className?: string;
};

/**
 * «Agregar» al carrito. En una tarjeta suma uno (un kilo, un cartón); en
 * la página del producto se elige cuánto. Después dice cuánto hay ya y deja
 * ir al carrito. Sin JavaScript no hace nada: por eso cada producto tiene
 * también su «Pedir por WhatsApp».
 */
export function BotonAgregar({ clave, nombre, unidad, conCantidad = false, className }: Props) {
  const lineas = useCarrito();
  const paso = pasoDe(unidad);
  // Se empieza por uno: un kilo, un cartón, una unidad.
  const [cantidad, setCantidad] = useState(1);
  const [aviso, setAviso] = useState("");
  const enCarrito = lineas.find((l) => l.clave === clave)?.cantidad ?? 0;
  const palabra =
    unidad === "kg"
      ? "kg"
      : unidad === "carton"
        ? cantidad === 1
          ? "cartón"
          : "cartones"
        : unidad === "combo"
          ? cantidad === 1
            ? "combo"
            : "combos"
          : cantidad === 1
            ? "unidad"
            : "unidades";

  const agregar = () => {
    const cuanto = conCantidad ? cantidadValida(cantidad, unidad) || paso : 1;
    guardarCarrito(agregarAlCarrito(lineas, clave, cuanto, unidad));
    setAviso(`Agregado al carrito: ${nombre}.`);
  };

  return (
    <div className={`${estilos.agregar} ${className ?? ""}`}>
      {conCantidad && (
        <div className={estilos.cantidad} role="group" aria-label={`Cuánto de ${nombre}`}>
          <button type="button" onClick={() => setCantidad((c) => Math.max(paso, cantidadValida(c - paso, unidad) || paso))} aria-label="Menos">
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            min={paso}
            step={paso}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            onBlur={() => setCantidad((c) => cantidadValida(c, unidad) || paso)}
            aria-label={`Cantidad (${palabra})`}
          />
          <button type="button" onClick={() => setCantidad((c) => cantidadValida(c + paso, unidad))} aria-label="Más">
            +
          </button>
          <span className={estilos.unidad}>{palabra}</span>
        </div>
      )}
      <button type="button" className={`boton ${estilos.botonAgregar}`} onClick={agregar}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" />
          <circle cx="9" cy="19" r="1.4" />
          <circle cx="17" cy="19" r="1.4" />
        </svg>
        {conCantidad ? "Agregar al carrito" : "Agregar"}
      </button>
      {enCarrito > 0 && (
        <Link href="/carrito" className={estilos.enCarrito}>
          ✓ En el carrito ({new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(enCarrito)}) · Ver carrito
        </Link>
      )}
      <span className="visualmente-oculto" aria-live="polite">
        {aviso}
      </span>
    </div>
  );
}
