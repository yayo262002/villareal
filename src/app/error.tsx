"use client";

import { useEffect } from "react";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import estilos from "./page.module.css";

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
    <main id="contenido" className={estilos.contenido}>
      <section className={`${estilos.seccion} ${estilos.mensaje}`}>
        <h1 className={estilos.titulo}>No pudimos cargar la página</h1>
        <p>
          Es un problema nuestro, no tuyo. Prueba otra vez en un momento. Si necesitas los precios ya, en{" "}
          {negocio.nombre} te los damos por WhatsApp.
        </p>
        <div className={`${estilos.acciones} ${estilos.accionesApiladas}`}>
          <button type="button" className="boton" onClick={() => retry()}>
            Probar otra vez
          </button>
          {whatsapp && (
            <a href={whatsapp} className="boton boton--secundario" target="_blank" rel="noopener">
              Escribir por WhatsApp
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
