"use client";

import type { ReactNode } from "react";

/**
 * Abre el cuadro de imprimir del teléfono o del ordenador, que también
 * sirve para guardar como PDF. Necesita JavaScript: sin él, la página se
 * imprime igual desde el menú del navegador.
 */
export function BotonImprimir({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}
