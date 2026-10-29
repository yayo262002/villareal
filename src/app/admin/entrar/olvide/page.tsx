import Link from "next/link";
import { redirect } from "next/navigation";
import { negocio } from "@/config/negocio";
import { pedirRecuperacion } from "@/lib/acciones";
import { haySesion } from "@/lib/sesion";
import { correoConfigurado, correoDelDueno, correoDisimulado } from "@/lib/correo";
import { contarTelefonos } from "@/lib/push";
import { MINUTOS_QUE_VALE_EL_ENLACE } from "@/lib/clave";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../(panel)/panel.module.css";

export const metadata = { title: "He olvidado la clave" };

/**
 * «He olvidado la clave»: un botón manda un enlace de un solo uso para
 * poner una clave nueva. Va al correo del dueño (si hay servicio de correo
 * configurado) y, además, como aviso a los teléfonos con avisos activados.
 * No pide ningún dato: el destino ya está configurado, así que nadie puede
 * usar esta pantalla para averiguar nada.
 */
export default async function PaginaOlvide({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  if (await haySesion()) redirect("/admin");
  const parametros = await searchParams;
  const [conCorreo, telefonos] = [correoConfigurado(), await contarTelefonos()];

  return (
    <div className={estilos.acceso}>
      <form action={pedirRecuperacion} className="tarjeta formulario">
        <div>
          <h1 className={estilos.titulo}>{negocio.nombre}</h1>
          <p>He olvidado la clave</p>
        </div>
        <Avisos parametros={parametros} />
        <p>
          Te mando un enlace para poner una clave nueva. Vale {MINUTOS_QUE_VALE_EL_ENLACE} minutos y se usa una sola vez.
        </p>
        <ul className="ayuda" style={{ margin: 0, paddingLeft: "1.2em" }}>
          <li>{conCorreo ? `Al correo ${correoDisimulado(correoDelDueno())}.` : "Al correo: todavía no hay servicio de correo configurado (ver el README: RESEND_API_KEY)."}</li>
          <li>
            {telefonos > 0
              ? `Como aviso ${telefonos === 1 ? "al teléfono" : `a los ${telefonos} teléfonos`} con avisos activados.`
              : "Al teléfono: ningún teléfono tiene los avisos activados (se activan desde la campanita del panel)."}
          </li>
        </ul>
        <button type="submit" name="pedir" value="1" className="boton" disabled={!conCorreo && telefonos === 0}>
          Mandarme el enlace
        </button>
        <p className="ayuda" style={{ margin: 0 }}>
          <Link href="/admin/entrar">← Volver a entrar</Link>
        </p>
      </form>
    </div>
  );
}
