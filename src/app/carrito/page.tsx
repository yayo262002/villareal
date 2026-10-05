import type { Metadata } from "next";
import { negocio } from "@/config/negocio";
import { CabeceraPublica, PiePublico } from "@/components/publico";
import { EncabezadoDePagina, PaginaDeVitrina } from "@/components/vitrina";
import estilos from "@/components/vitrina.module.css";
import { PaginaCarrito } from "@/components/carrito/pagina-carrito";

export const metadata: Metadata = {
  title: "Tu pedido",
  // Cada carrito es de quien lo llena: a los buscadores no les sirve.
  robots: { index: false },
};

/**
 * El carrito: lo que el cliente fue agregando, con los precios de hoy, y el
 * botón que abre WhatsApp con el pedido escrito. Vive en el teléfono del
 * cliente; el negocio no se entera hasta que el cliente envía el mensaje.
 */
export default function PaginaDelCarrito() {
  return (
    <>
      <CabeceraPublica />
      <PaginaDeVitrina>
        <section className={estilos.seccion} aria-labelledby="titulo-carrito">
          <EncabezadoDePagina
            id="titulo-carrito"
            titulo="Tu pedido" entradilla="Revisa lo que llevas, ajusta las cantidades y envíanos el pedido por WhatsApp. Te respondemos con la disponibilidad y el total." />
          <PaginaCarrito negocio={negocio.nombre} whatsapp={negocio.whatsapp || null} />
        </section>
      </PaginaDeVitrina>
      <PiePublico />
    </>
  );
}
