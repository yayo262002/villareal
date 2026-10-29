import Link from "next/link";
import { negocio } from "@/config/negocio";
import { ponerClaveNueva } from "@/lib/acciones";
import { LARGO_MINIMO_CLAVE, enlaceDeRecuperacionVale } from "@/lib/clave";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../(panel)/panel.module.css";

export const metadata = { title: "Clave nueva" };

/**
 * La pantalla a la que lleva el enlace de «He olvidado la clave»: con el
 * enlace vigente, pide la clave nueva dos veces; con uno caducado, usado o
 * inventado, lo dice y ofrece pedir otro.
 */
export default async function PaginaClaveNueva({ searchParams }: { searchParams: Promise<ParametrosAviso & { clave?: string }> }) {
  const parametros = await searchParams;
  const enlace = typeof parametros.clave === "string" ? parametros.clave : "";
  const vale = await enlaceDeRecuperacionVale(enlace);

  return (
    <div className={estilos.acceso}>
      {vale ? (
        <form action={ponerClaveNueva} className="tarjeta formulario">
          <div>
            <h1 className={estilos.titulo}>{negocio.nombre}</h1>
            <p>Clave nueva del panel</p>
          </div>
          <Avisos parametros={parametros} />
          <input type="hidden" name="enlace" value={enlace} />
          <div className="campo">
            <label htmlFor="clave">Clave nueva</label>
            <input id="clave" name="clave" type="password" autoComplete="new-password" minLength={LARGO_MINIMO_CLAVE} required />
            <span className="ayuda">Al menos {LARGO_MINIMO_CLAVE} caracteres. Apúntala donde la encuentres.</span>
          </div>
          <div className="campo">
            <label htmlFor="otra_vez">Otra vez</label>
            <input id="otra_vez" name="otra_vez" type="password" autoComplete="new-password" minLength={LARGO_MINIMO_CLAVE} required />
          </div>
          <button type="submit" className="boton">
            Guardar la clave nueva
          </button>
        </form>
      ) : (
        <div className="tarjeta formulario">
          <div>
            <h1 className={estilos.titulo}>{negocio.nombre}</h1>
            <p>Clave nueva del panel</p>
          </div>
          <p className="aviso aviso--aviso">Ese enlace ya no vale: caducó, ya se usó o no es de aquí.</p>
          <p>
            <Link href="/admin/entrar/olvide" className="boton">
              Pedir otro enlace
            </Link>
          </p>
          <p className="ayuda" style={{ margin: 0 }}>
            <Link href="/admin/entrar">← Volver a entrar</Link>
          </p>
        </div>
      )}
    </div>
  );
}
