import Link from "next/link";
import { negocio } from "@/config/negocio";
import estilos from "../panel.module.css";

export const metadata = { title: "Ponerlo como app" };

/**
 * Cómo poner el panel en la pantalla de inicio del teléfono, que es lo
 * mismo que tener una app: abre de un toque, a pantalla completa y con el
 * león de icono. No hay que instalar nada ni pagar nada.
 */
export default function PaginaApp() {
  return (
    <>
      <div>
        <p>
          <Link href="/admin">← Resumen</Link>
        </p>
        <h1 className={estilos.titulo}>El panel como app en tu teléfono</h1>
      </div>

      <section className="tarjeta">
        <p className={estilos.ayuda}>
          Esta misma página se puede poner en la pantalla de inicio del teléfono. Queda con el león de icono, se llama
          «Panel», abre de un toque directamente aquí y sin la barra del navegador, como cualquier otra app. No hay
          que instalar nada de una tienda ni pagar nada. Hazlo desde el teléfono, con la sesión ya iniciada.
        </p>

        <h2 className={estilos.subtitulo}>En Android (Chrome)</h2>
        <ol className={estilos.pasos}>
          <li>Abre {negocio.web}/admin en Chrome y entra con tu clave.</li>
          <li>Toca los tres puntos de arriba a la derecha.</li>
          <li>Toca «Instalar aplicación» o «Añadir a pantalla de inicio».</li>
          <li>Confirma. El icono del león aparece entre tus apps.</li>
        </ol>

        <h2 className={estilos.subtitulo}>En iPhone (Safari)</h2>
        <ol className={estilos.pasos}>
          <li>Abre {negocio.web}/admin en Safari y entra con tu clave.</li>
          <li>Toca el botón de compartir (el cuadrado con la flecha hacia arriba).</li>
          <li>Baja y toca «Añadir a pantalla de inicio».</li>
          <li>Toca «Añadir». El icono del león aparece en la pantalla de inicio.</li>
        </ol>

        <h2 className={estilos.subtitulo}>Atajos</h2>
        <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
          En Android, manteniendo pulsado el icono salen atajos a Anotar una venta, Registrar un abono, la Ruta de
          despacho y el Cierre del día. La sesión dura 30 días; después vuelve a pedir la clave.
        </p>
      </section>
    </>
  );
}
