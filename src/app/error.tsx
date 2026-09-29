"use client";

import { useEffect } from "react";
import { enlaceWhatsapp, negocio } from "@/config/negocio";

/**
 * Lo que se ve si algo falla al cargar una página, por ejemplo si la base
 * de datos no responde. Next exige que sea un componente de cliente. No usa
 * nada del servidor: si el servidor es lo que falla, esto tiene que poder
 * pintarse igual.
 */
export default function ErrorDePagina({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");

  return (
    <main
      id="contenido"
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--espacio-7) var(--espacio-4)",
        display: "grid",
        gap: "var(--espacio-4)",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--color-marca-oscuro)" }}>
        No pudimos cargar la página
      </h1>
      <p>
        Es un problema nuestro, no tuyo. Prueba otra vez en un momento. Si necesitas los precios ya, en{" "}
        {negocio.nombre} te los damos por WhatsApp.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--espacio-3)" }}>
        <button type="button" className="boton" onClick={() => retry()}>
          Probar otra vez
        </button>
        {whatsapp && (
          <a href={whatsapp} className="boton boton--secundario" target="_blank" rel="noopener">
            Escribir por WhatsApp
          </a>
        )}
      </div>
    </main>
  );
}
