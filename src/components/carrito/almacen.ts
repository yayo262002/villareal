"use client";

import { useSyncExternalStore } from "react";
import { CLAVE_DEL_CARRITO, leerCarrito, type LineaDelCarrito } from "@/lib/carrito";

/**
 * Dónde vive el carrito: en el teléfono del cliente (localStorage), para
 * que siga ahí si cierra la página. Si el navegador no deja guardar (una
 * ventana privada), vive en la memoria de esta visita. Todas las piezas del
 * carrito lo leen con `useCarrito` y se enteran al momento de cada cambio,
 * también si cambia en otra pestaña.
 */

const EVENTO = "villareal-carrito";
const VACIO: LineaDelCarrito[] = [];
let memoria: LineaDelCarrito[] | null = null;
let ultimo: { texto: string | null; lineas: LineaDelCarrito[] } = { texto: null, lineas: VACIO };

function leerTexto(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_DEL_CARRITO);
  } catch {
    return null;
  }
}

function lineasActuales(): LineaDelCarrito[] {
  if (memoria) return memoria;
  const texto = leerTexto();
  // La misma lista mientras no cambie: React la compara para saber si repintar.
  if (texto !== ultimo.texto) ultimo = { texto, lineas: leerCarrito(texto) };
  return ultimo.lineas;
}

function suscribirse(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

export function guardarCarrito(lineas: LineaDelCarrito[]): void {
  try {
    window.localStorage.setItem(CLAVE_DEL_CARRITO, JSON.stringify(lineas));
    memoria = null;
  } catch {
    memoria = lineas;
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Las líneas del carrito; en el servidor (y antes de cargar), ninguna. */
export function useCarrito(): LineaDelCarrito[] {
  return useSyncExternalStore(suscribirse, lineasActuales, () => VACIO);
}
