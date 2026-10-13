import Link from "next/link";
import { listarAvisos, marcarAvisosLeidos } from "@/lib/avisos";
import { contarTelefonos } from "@/lib/push";
import { probarAviso } from "@/lib/acciones";
import { fechaCorta, fechaDeLaBase, horaDeLaBase, hoy } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { AvisosDelTelefono } from "@/components/avisos-del-telefono";
import estilos from "../panel.module.css";

export const metadata = { title: "Avisos" };

/** «Hoy», «Ayer» o la fecha. */
function diaLegible(fecha: string, hoyIso: string): string {
  if (fecha === hoyIso) return "Hoy";
  const [a, m, d] = hoyIso.split("-").map(Number);
  const ayer = new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
  return fecha === ayer ? "Ayer" : fechaCorta(fecha);
}

/**
 * La campanita: los avisos de lo que el sistema sabe antes que el dueño
 * (entregas de hoy y atrasadas, plazos vencidos, inventario que se acaba,
 * clientes por llamar, el resumen de cada mañana) y, arriba, cómo
 * recibirlos en el teléfono. Abrir esta pantalla los da por leídos.
 */
export default async function PaginaAvisos({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [avisos, telefonos] = await Promise.all([listarAvisos(), contarTelefonos()]);
  const sinLeer = new Set(avisos.filter((a) => !a.leido_en).map((a) => a.id));
  if (sinLeer.size > 0) await marcarAvisosLeidos();

  const hoyIso = hoy();
  const porDia = new Map<string, typeof avisos>();
  for (const a of avisos) {
    const dia = fechaDeLaBase(a.creado_en);
    porDia.set(dia, [...(porDia.get(dia) ?? []), a]);
  }

  return (
    <>
      <div>
        <p>
          <Link href="/admin">← Resumen</Link>
        </p>
        <h1 className={estilos.titulo}>Avisos</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta" id="telefono">
        <h2 className={estilos.subtitulo}>Avisos en el teléfono</h2>
        <p className={estilos.ayuda}>
          Cada mañana a las 7 llega al teléfono un aviso con las entregas del día, los cobros con el plazo vencido, lo que se acaba del inventario,
          los clientes por llamar y la tasa BCV, como una notificación de cualquier app, aunque el panel esté cerrado. Se activa en cada teléfono
          una vez; en iPhone, con el panel puesto en la pantalla de inicio.
        </p>
        <AvisosDelTelefono />
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap", alignItems: "center", marginTop: "var(--espacio-3)" }}>
          <form action={probarAviso}>
            <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
              Mandar un aviso de prueba
            </button>
          </form>
          <span className="ayuda">
            {telefonos === 0 ? "Ningún teléfono tiene los avisos activados." : telefonos === 1 ? "1 teléfono con los avisos activados." : `${telefonos} teléfonos con los avisos activados.`}
          </span>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Lo que hay que saber{sinLeer.size > 0 ? ` (${sinLeer.size} ${sinLeer.size === 1 ? "nuevo" : "nuevos"})` : ""}</h2>
        {avisos.length === 0 ? (
          <p className="vacio">Todavía no hay avisos. Cada mañana a las 7 aparecen los del día; también al abrir el Resumen.</p>
        ) : (
          [...porDia.entries()].map(([dia, lista]) => (
            <div key={dia} className={estilos.grupoResenas}>
              <h3 className={estilos.subtituloPequeno}>{diaLegible(dia, hoyIso)}</h3>
              <ul className={estilos.avisos}>
                {lista.map((a) => (
                  <li key={a.id} className={`${estilos.aviso} ${sinLeer.has(a.id) ? estilos["aviso--nuevo"] : ""}`}>
                    <span className={estilos.avisoTitulo}>
                      <Link href={a.url}>{a.titulo}</Link>
                    </span>
                    {a.cuerpo && <span className={estilos.avisoCuerpo}>{a.cuerpo}</span>}
                    <span className={estilos.avisoFecha}>
                      {horaDeLaBase(a.creado_en)}
                      {sinLeer.has(a.id) ? " · nuevo" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
