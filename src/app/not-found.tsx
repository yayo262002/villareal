import Link from "next/link";
import type { Metadata } from "next";
import { enlaceWhatsapp } from "@/config/negocio";
import { CabeceraPublica, PiePublico } from "@/components/publico";
import estilos from "./page.module.css";

export const metadata: Metadata = { title: "No encontramos esa página", robots: { index: false } };

/** Lo que ve quien llega a una dirección que no existe o a un producto retirado. */
export default function NoEncontrada() {
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");
  return (
    <>
      <CabeceraPublica />
      <main id="contenido" className={estilos.contenido}>
        <section className={`${estilos.seccion} ${estilos.mensaje}`}>
          <h1 className={estilos.titulo}>No encontramos esa página</h1>
          <p>Puede que el enlace esté mal escrito o que el producto ya no esté a la venta.</p>
          <div className={`${estilos.acciones} ${estilos.accionesApiladas}`}>
            <Link href="/" className="boton">
              Ver los productos
            </Link>
            {whatsapp && (
              <a href={whatsapp} className="boton boton--secundario" target="_blank" rel="noopener">
                Escribir por WhatsApp
              </a>
            )}
          </div>
        </section>
      </main>
      <PiePublico />
    </>
  );
}
