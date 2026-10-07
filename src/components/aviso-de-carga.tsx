"use client";

import { useEffect } from "react";

/** Cuánto tarda en aparecer: un cambio rápido de pantalla no parpadea. */
const RETRASO_MS = 250;
/** Si en este tiempo la página no cambió, el aviso se quita solo. */
const TOPE_MS = 20000;

/**
 * Una raya dorada arriba del todo mientras llega la pantalla que se tocó:
 * en el teléfono, con la web dormida tras un rato sin uso, la primera
 * puede tardar unos segundos, y sin esto parecía que el toque no había
 * hecho nada. Se enciende al tocar un enlace del panel o al buscar, y se
 * apaga cuando la dirección cambia. Sin JavaScript no hace falta: el
 * navegador enseña su propio progreso.
 */
export function AvisoDeCarga() {
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let vigilante: ReturnType<typeof setInterval> | null = null;
    const raya = document.createElement("div");
    raya.className = "cargando-raya";
    raya.setAttribute("role", "status");
    raya.setAttribute("aria-label", "Cargando");
    raya.hidden = true;
    document.body.appendChild(raya);

    const apagar = () => {
      if (temporizador) clearTimeout(temporizador);
      if (vigilante) clearInterval(vigilante);
      temporizador = null;
      vigilante = null;
      raya.hidden = true;
    };
    const encender = () => {
      apagar();
      const direccion = location.href;
      const desde = Date.now();
      temporizador = setTimeout(() => {
        raya.hidden = false;
      }, RETRASO_MS);
      vigilante = setInterval(() => {
        if (location.href !== direccion || Date.now() - desde > TOPE_MS) apagar();
      }, 200);
    };

    const alTocar = (evento: MouseEvent) => {
      if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      const enlace = (evento.target as Element | null)?.closest?.("a[href]");
      if (!(enlace instanceof HTMLAnchorElement)) return;
      // Solo lo que cambia de pantalla dentro de la web: ni WhatsApp, ni descargas, ni otra pestaña, ni un ancla de la misma página.
      if (enlace.target === "_blank" || enlace.hasAttribute("download") || enlace.origin !== location.origin) return;
      if (enlace.pathname === location.pathname && enlace.search === location.search) return;
      encender();
    };
    const alBuscar = (evento: Event) => {
      const formulario = evento.target;
      if (formulario instanceof HTMLFormElement && formulario.method.toLowerCase() === "get" && !evento.defaultPrevented) encender();
    };
    // En fase de captura: Next cancela el clic del enlace para cambiar de pantalla sin recargar, y aquí hay que verlo antes.
    document.addEventListener("click", alTocar, true);
    document.addEventListener("submit", alBuscar, true);
    window.addEventListener("pageshow", apagar);
    return () => {
      document.removeEventListener("click", alTocar, true);
      document.removeEventListener("submit", alBuscar, true);
      window.removeEventListener("pageshow", apagar);
      apagar();
      raya.remove();
    };
  }, []);
  return null;
}
