import { redirect } from "next/navigation";
import { negocio } from "@/config/negocio";
import { entrar } from "@/lib/acciones";
import { claveConfigurada, haySesion } from "@/lib/sesion";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../(panel)/panel.module.css";

export const metadata = { title: "Entrar" };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  if (await haySesion()) redirect("/admin");
  const parametros = await searchParams;

  return (
    <div className={estilos.acceso}>
      <form action={entrar} className="tarjeta formulario">
        <div>
          <h1 className={estilos.titulo}>{negocio.nombre}</h1>
          <p>Panel del negocio</p>
        </div>

        {!claveConfigurada() ? (
          <p className="aviso aviso--aviso">
            Falta la clave del panel. Escribe una de al menos 8 caracteres en el archivo{" "}
            <code>.env.local</code> como <code>ADMIN_CLAVE=...</code> y reinicia el servidor.
          </p>
        ) : (
          <>
            <Avisos parametros={parametros} />
            <div className="campo">
              <label htmlFor="clave">Clave</label>
              <input id="clave" name="clave" type="password" autoComplete="current-password" required />
            </div>
            <button type="submit" className="boton">
              Entrar
            </button>
          </>
        )}
      </form>
    </div>
  );
}
