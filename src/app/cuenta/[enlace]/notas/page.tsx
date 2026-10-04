import { notFound } from "next/navigation";
import { cuentaDelCliente } from "@/lib/cuenta-cliente";
import { MarcoDeCuenta, TarjetaDeNota } from "@/components/cuenta";
import estilos from "@/components/cuenta.module.css";

type Parametros = { params: Promise<{ enlace: string }> };

export const metadata = { title: "Mis notas" };

/** Todas las notas del cliente: primero las que tienen algo por pagar, de la más antigua a la más nueva; después las pagadas, de la más nueva a la más vieja. */
export default async function PaginaNotas({ params }: Parametros) {
  const { enlace } = await params;
  const cuenta = await cuentaDelCliente(enlace);
  if (!cuenta) notFound();
  const pagadas = cuenta.notas.filter((n) => n.pendiente_usd <= 0);

  return (
    <MarcoDeCuenta enlace={enlace} actual="notas" cuenta={cuenta}>
      {cuenta.notas.length === 0 ? (
        <p className={estilos.vacio}>Todavía no tienes notas con nosotros.</p>
      ) : (
        <>
          {cuenta.pendientes.length > 0 && (
            <>
              <h2 className={estilos.subtitulo}>Por pagar ({cuenta.pendientes.length})</h2>
              <ul className={estilos.notas}>
                {cuenta.pendientes.map((n) => (
                  <TarjetaDeNota key={n.id} enlace={enlace} nota={n} fecha={cuenta.fecha} />
                ))}
              </ul>
            </>
          )}
          {pagadas.length > 0 && (
            <>
              <h2 className={estilos.subtitulo}>Pagadas ({pagadas.length})</h2>
              <ul className={estilos.notas}>
                {pagadas.map((n) => (
                  <TarjetaDeNota key={n.id} enlace={enlace} nota={n} fecha={cuenta.fecha} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </MarcoDeCuenta>
  );
}
