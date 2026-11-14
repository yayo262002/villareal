"use client";

import { useState } from "react";

/**
 * «Copiar»: copia un texto largo (la dirección del teléfono del banco) para
 * pegarlo en otra app. En el iPhone, seleccionar a mano una casilla así es
 * casi imposible. Sin JavaScript, o si el teléfono no deja copiar, el texto
 * sigue a la vista para seleccionarlo.
 */
export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [estado, setEstado] = useState<"" | "copiado" | "fallo">("");
  return (
    <button
      type="button"
      className="boton boton--secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setEstado("copiado");
        } catch {
          setEstado("fallo");
        }
      }}
    >
      {estado === "copiado" ? "¡Copiada!" : estado === "fallo" ? "No se pudo: mantén pulsada la dirección" : etiqueta}
    </button>
  );
}
