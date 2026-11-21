import type { Metadata } from "next";
import Link from "next/link";
import { negocio, whatsappLegible } from "@/config/negocio";
import { CabeceraPublica, PiePublico } from "@/components/publico";
import { EncabezadoDePagina, PaginaDeVitrina } from "@/components/vitrina";
import estilos from "./privacidad.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos guarda ${negocio.nombre}, para qué, con quién se comparten y cómo pedir que se borren.`,
  alternates: { canonical: "/privacidad" },
};

/**
 * La política de privacidad. Meta la pide para publicar la app que conecta el WhatsApp del negocio con la web
 * (21/11/2026), con las instrucciones para borrar los datos (`#eliminar-datos`). Dice lo que de verdad se guarda: nada
 * inventado ni de más.
 */
export default function PaginaPrivacidad() {
  const telefono = whatsappLegible();
  return (
    <>
      <CabeceraPublica />
      <PaginaDeVitrina>
        <EncabezadoDePagina titulo="Política de privacidad" entradilla="Qué datos tuyos guardamos, para qué, con quién se comparten y cómo pedir que se borren." />
        <article className={estilos.texto}>
          <p className={estilos.fecha}>Última actualización: 21/11/2026.</p>

          <h2>Quiénes somos</h2>
          <p>
            {negocio.razonSocial} ({negocio.nombreCorto}), RIF {negocio.rif}, {negocio.direccion}, {negocio.ciudad}, Venezuela. Somos responsables de los
            datos que se describen aquí.
          </p>

          <h2>Qué datos guardamos</h2>
          <ul>
            <li>
              <strong>Si eres cliente:</strong> tu nombre o el de tu negocio, tu teléfono, la dirección de entrega, tu cédula o RIF si pides factura, lo que
              compras, lo que pagas y las capturas de pago que nos mandas.
            </li>
            <li>
              <strong>Si haces un pedido en la web:</strong> los productos del carrito y, si los escribes, tu nombre, tu negocio, una nota y la dirección o la
              ubicación para el delivery. El carrito se guarda en tu propio teléfono; cuando envías el pedido, guardamos una copia para atenderlo.
            </li>
            <li>
              <strong>Si nos escribes por WhatsApp:</strong> tu número, el nombre con que sales en WhatsApp y los mensajes que nos envías y te respondemos. Los
              recibimos a través de la plataforma de WhatsApp Business de Meta.
            </li>
          </ul>
          <p>La web no usa cookies de publicidad ni de seguimiento. La única cookie es la de entrada al panel interno del negocio.</p>

          <h2>Para qué los usamos</h2>
          <p>
            Para atender tus pedidos y entregas, llevar tu cuenta (lo que compraste y lo que pagaste), emitir tus facturas, avisarte de tu cuenta y responder
            tus mensajes. No vendemos ni cedemos tus datos a nadie para publicidad.
          </p>

          <h2>Con quién se comparten</h2>
          <p>
            Solo con quienes nos prestan el servicio y lo necesitan para funcionar: Meta (WhatsApp), donde llegan y salen los mensajes; Vercel, que aloja la
            web; y Turso, donde se guarda la base de datos. Y con las autoridades cuando la ley lo exige, por ejemplo los datos de una factura.
          </p>

          <h2>Cuánto tiempo</h2>
          <p>
            Mientras seas cliente y nos hagan falta para atenderte. Lo que la ley obliga a conservar (las facturas y los libros de ventas) se guarda el
            tiempo que pide la ley.
          </p>

          <h2 id="eliminar-datos">Cómo ver, corregir o borrar tus datos</h2>
          <p>
            Escríbenos {telefono ? <>por WhatsApp al <strong>{telefono}</strong></> : null}
            {telefono && negocio.correo ? " o " : null}
            {negocio.correo ? <>al correo <strong>{negocio.correo}</strong></> : null} y dinos qué quieres: ver lo que tenemos de ti, corregirlo o borrarlo
            (también tus mensajes de WhatsApp). Lo hacemos en un máximo de 30 días y te avisamos. Lo único que no se puede borrar es lo que la ley obliga a
            guardar, como las facturas emitidas.
          </p>

          <h2>Cambios</h2>
          <p>
            Si cambia algo de esta política, lo ponemos aquí con su fecha. ¿Dudas? Escríbenos: estamos en <Link href="/#contacto">Contacto</Link>.
          </p>
        </article>
      </PaginaDeVitrina>
      <PiePublico />
    </>
  );
}
