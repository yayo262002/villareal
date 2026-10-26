"use client";

import { useEffect, useState } from "react";
import estilos from "./foto-ampliable.module.css";

/**
 * Una foto que se amplía ahí mismo, sin salir de la página: tocarla la
 * abre a pantalla entera, sobre la misma pantalla, con una flecha para
 * volver. Antes la foto era un enlace al archivo, y en el panel puesto como
 * app del teléfono eso abría el archivo solo, sin ninguna forma de volver.
 * Sin JavaScript queda la foto tal cual, que ya se ve entera.
 */
export function FotoAmpliable({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    if (!ampliada) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliada(false);
    };
    window.addEventListener("keydown", alTeclear);
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = desbordeAnterior;
    };
  }, [ampliada]);

  return (
    <>
      <button type="button" className={estilos.boton} onClick={() => setAmpliada(true)} title="Tocar para ampliar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      {ampliada && (
        <div className={estilos.fondo} role="dialog" aria-modal="true" aria-label={alt}>
          <div className={estilos.barra}>
            <button type="button" className={estilos.volver} onClick={() => setAmpliada(false)} aria-label="Volver">
              ← Volver
            </button>
            <a href={src} target="_blank" rel="noopener" className={estilos.aparte}>
              Abrir aparte
            </a>
          </div>
          <div className={estilos.lienzo} onClick={() => setAmpliada(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className={estilos.entera} onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </>
  );
}
