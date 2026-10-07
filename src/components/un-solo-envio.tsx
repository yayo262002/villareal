"use client";

import { useEffect } from "react";

/** Cuánto se espera, como mucho, a que la página cambie antes de volver a dejar enviar. */
const ESPERA_MAXIMA_MS = 12000;

/**
 * Evita que un toque doble registre dos veces lo mismo (una venta, un
 * abono): al enviar un formulario del panel, su botón se apaga y dice
 * «Guardando…» hasta que la página cambia; un segundo envío mientras
 * tanto no hace nada. Si en unos segundos la página no cambió (sin red,
 * un fallo), el botón vuelve a estar activo. Sin JavaScript no hace
 * falta: el navegador cambia de página solo.
 */
export function UnSoloEnvio() {
  useEffect(() => {
    const alEnviar = (evento: Event) => {
      const formulario = evento.target;
      if (!(formulario instanceof HTMLFormElement) || formulario.method.toLowerCase() === "get") return;
      if (formulario.dataset.enviando) {
        evento.preventDefault();
        evento.stopImmediatePropagation();
        return;
      }
      formulario.dataset.enviando = "1";
      const botones = [...formulario.querySelectorAll<HTMLButtonElement>('button[type="submit"], button:not([type])')];
      const direccion = location.href;
      const restaurar = () => {
        delete formulario.dataset.enviando;
        for (const b of botones) {
          b.disabled = false;
          if (b.dataset.texto !== undefined) b.textContent = b.dataset.texto;
        }
      };
      // Se apagan después de que el envío haya leído el formulario: un botón apagado no manda su valor.
      setTimeout(() => {
        if (!formulario.dataset.enviando) return;
        for (const b of botones) {
          if (b.dataset.texto === undefined) b.dataset.texto = b.textContent ?? "";
          b.disabled = true;
          b.textContent = "Guardando…";
        }
      }, 0);
      // En cuanto la página cambia (la respuesta siempre lleva a otra dirección), o pasado el tope, se restaura.
      const desde = Date.now();
      const vigilar = setInterval(() => {
        if (location.href !== direccion || !document.contains(formulario) || Date.now() - desde > ESPERA_MAXIMA_MS) {
          clearInterval(vigilar);
          restaurar();
        }
      }, 250);
    };
    document.addEventListener("submit", alEnviar, true);
    return () => document.removeEventListener("submit", alEnviar, true);
  }, []);
  return null;
}
