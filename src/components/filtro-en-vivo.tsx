"use client";

import { useEffect, useState } from "react";
import { coincideParecido } from "@/lib/parecido";

/**
 * Filtra una lista mientras se escribe, sin recargar: la casilla de buscar
 * de la cartera deja a la vista solo a los clientes que casan con lo
 * escrito, aunque falte o sobre una letra (`parecido.ts`). Cada elemento de
 * la lista lleva en `data-busca` el texto por el que se busca. Sin
 * JavaScript, el botón «Buscar» de siempre hace lo mismo desde el servidor.
 */
export function FiltroEnVivo({ entrada, lista }: { entrada: string; lista: string }) {
  const [cuenta, setCuenta] = useState<{ vistos: number; total: number } | null>(null);

  useEffect(() => {
    const casilla = document.getElementById(entrada) as HTMLInputElement | null;
    const contenedor = document.getElementById(lista);
    if (!casilla || !contenedor) return;
    const filtrar = () => {
      const escrito = casilla.value.trim();
      const elementos = Array.from(contenedor.querySelectorAll<HTMLElement>("[data-busca]"));
      let vistos = 0;
      for (const el of elementos) {
        const casa = !escrito || coincideParecido(escrito, el.dataset.busca ?? "");
        el.hidden = !casa;
        if (casa) vistos++;
      }
      setCuenta(escrito ? { vistos, total: elementos.length } : null);
    };
    casilla.addEventListener("input", filtrar);
    filtrar();
    return () => casilla.removeEventListener("input", filtrar);
  }, [entrada, lista]);

  if (!cuenta) return null;
  return (
    <p className="ayuda" role="status" aria-live="polite" style={{ margin: "var(--espacio-2) 0 0" }}>
      {cuenta.vistos === 0 ? "Ninguno se parece a lo escrito." : `${cuenta.vistos} de ${cuenta.total} se parecen a lo escrito.`}
    </p>
  );
}
