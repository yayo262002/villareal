"use client";

import { useEffect, useState } from "react";
import { ordenDeParecido } from "@/lib/parecido";

/**
 * Filtra una lista mientras se escribe, sin recargar: la casilla de buscar
 * de la cartera deja a la vista solo a los clientes que casan con lo
 * escrito, desde la primera letra y aunque falte o sobre una letra
 * (`parecido.ts`); la lista de precios de la familia, igual. Cada elemento
 * de la lista lleva en `data-busca` lo principal por lo que se busca (el
 * nombre, el teléfono) y, si acaso, en `data-busca-mas` lo demás (la
 * dirección, la nota), que solo cuenta desde tres letras y va después. Con
 * `ordenar`, los que mejor casan suben arriba (primero los que empiezan
 * por lo escrito) y, al borrar, la lista vuelve a su orden. Un grupo marcado
 * `data-grupo` (una categoría con su título) se esconde si no le queda nada
 * a la vista. Sin JavaScript, el botón «Buscar» de siempre hace lo mismo
 * desde el servidor. `clase` es la del aviso de cuántos quedan.
 */
export function FiltroEnVivo({ entrada, lista, clase = "ayuda", ordenar = false }: { entrada: string; lista: string; clase?: string; ordenar?: boolean }) {
  const [cuenta, setCuenta] = useState<{ vistos: number; total: number } | null>(null);

  useEffect(() => {
    const casilla = document.getElementById(entrada) as HTMLInputElement | null;
    const contenedor = document.getElementById(lista);
    if (!casilla || !contenedor) return;
    // El sitio de cada elemento en la lista tal como vino, para devolverlo ahí al borrar lo escrito.
    const sitio = new WeakMap<HTMLElement, number>();
    let siguiente = 0;
    const filtrar = () => {
      const escrito = casilla.value.trim();
      const elementos = Array.from(contenedor.querySelectorAll<HTMLElement>("[data-busca]"));
      for (const el of elementos) if (!sitio.has(el)) sitio.set(el, siguiente++);
      const puntos = new Map<HTMLElement, number>();
      let vistos = 0;
      for (const el of elementos) {
        const p = escrito ? ordenDeParecido(escrito, el.dataset.busca ?? "", el.dataset.buscaMas ?? "") : 1;
        puntos.set(el, p);
        el.hidden = p === 0;
        if (p > 0) vistos++;
      }
      if (ordenar) {
        // Cada lista de hermanos, por cómo casan y, a igual, en su orden de siempre.
        for (const padre of new Set(elementos.map((el) => el.parentElement))) {
          if (!padre) continue;
          const hijos = elementos.filter((el) => el.parentElement === padre);
          const ordenados = [...hijos].sort((a, b) => (puntos.get(b) ?? 0) - (puntos.get(a) ?? 0) || (sitio.get(a) ?? 0) - (sitio.get(b) ?? 0));
          if (ordenados.some((el, i) => el !== hijos[i])) padre.append(...ordenados);
        }
      }
      for (const grupo of Array.from(contenedor.querySelectorAll<HTMLElement>("[data-grupo]"))) {
        grupo.hidden = !grupo.querySelector("[data-busca]:not([hidden])");
      }
      setCuenta(escrito ? { vistos, total: elementos.length } : null);
    };
    casilla.addEventListener("input", filtrar);
    filtrar();
    return () => casilla.removeEventListener("input", filtrar);
  }, [entrada, lista, ordenar]);

  if (!cuenta) return null;
  return (
    <p className={clase} role="status" aria-live="polite" style={{ margin: "var(--espacio-2) 0 0" }}>
      {cuenta.vistos === 0 ? "Ninguno se parece a lo escrito." : `${cuenta.vistos} de ${cuenta.total} se parecen a lo escrito.`}
    </p>
  );
}
