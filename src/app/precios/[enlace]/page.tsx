import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { enlaceDeMisPrecios, leerTasa } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { listarFamilias } from "@/lib/familias";
import { filasDeMisPrecios } from "@/lib/mis-precios";
import { textoCoincide } from "@/lib/buscar";
import { FiltroEnVivo } from "@/components/filtro-en-vivo";
import { bs, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, tasaLegible, usd } from "@/lib/dinero";
import estilos from "../../lista/[enlace]/lista.module.css";
import propios from "./precios.module.css";

type Parametros = { params: Promise<{ enlace: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Puesta en la pantalla de inicio, es su propia app, «Mis precios» (su manifiesto, al lado). */
export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { enlace } = await params;
  return {
    title: "Mis precios",
    manifest: `/precios/${enlace}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Mis precios", statusBarStyle: "default" },
  };
}

/**
 * «Mis precios»: la lista personal del dueño, con su enlace y sin clave, como
 * la de la familia, pero de Villa Real: todo lo que está en la web, por
 * familias, con el precio al mayor en bolívares a la tasa BCV de hoy y en
 * dólares, y debajo el costo y lo que deja. Lleva los costos: el enlace es
 * solo para él (se renueva en Productos). Se busca escribiendo.
 */
export default async function PaginaMisPrecios({ params, searchParams }: Parametros) {
  const { enlace } = await params;
  const guardado = await enlaceDeMisPrecios();
  if (!esEnlaceValido(enlace) || enlace !== guardado) notFound();
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.slice(0, 80) : "";
  const [productos, variantes, familias, tasa] = await Promise.all([listarProductos(), listarVariantes(), listarFamilias(), leerTasa()]);
  const grupos = filasDeMisPrecios(productos, variantes, familias, tasa?.valor ?? null)
    .map((g) => ({ ...g, filas: g.filas.filter((f) => textoCoincide([f.tipo, f.detalle, g.familia], busqueda)) }))
    .filter((g) => g.filas.length > 0);
  const dia = hoy();
  const fechaTasa = tasa ? (tasa.fecha_valor ?? fechaDeLaBase(tasa.actualizada_en)) : null;

  return (
    <main className={`${estilos.pagina} ${estilos.alMayor}`}>
      <header className={estilos.cabecera}>
        <p className={estilos.antetitulo}>Villa Real · solo para ti</p>
        <h1 className={estilos.titulo}>Mis precios</h1>
        <p className={estilos.fecha}>
          {diaDeLaSemana(dia)} {fechaCorta(dia)}
        </p>
        {tasa ? (
          <p className={estilos.tasa}>
            {tasa.origen === "bcv" ? "Tasa BCV" : "Tasa"}: <strong>{tasaLegible(tasa.valor)}</strong> Bs por dólar
            {fechaTasa && fechaTasa !== dia ? ` (del ${diaDeLaSemana(fechaTasa)} ${fechaCorta(fechaTasa)})` : ""}
          </p>
        ) : (
          <p className={estilos.tasa}>Todavía no hay tasa de hoy: los precios van solo en dólares.</p>
        )}
      </header>

      <form method="get" className={estilos.buscador} role="search">
        <label htmlFor="q" className={estilos.oculto}>
          Buscar un producto
        </label>
        <input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Buscar: carne, salsa, caja…" autoComplete="off" />
        <button type="submit">Buscar</button>
        {busqueda && <a href="?">Todos</a>}
      </form>
      <FiltroEnVivo entrada="q" lista="productos" clase={estilos.vacio} />

      {grupos.length === 0 ? (
        <p className={estilos.vacio}>{busqueda ? `Nada responde a «${busqueda}».` : "Todavía no hay nada publicado en la web."}</p>
      ) : (
        <div id="productos" className={estilos.productos}>
          {grupos.map((g) => (
            <section key={g.familia} className={estilos.grupo} data-grupo>
              <h2 className={estilos.categoria}>{g.familia}</h2>
              <ul className={estilos.filas}>
                {g.filas.map((f) => (
                  <li key={f.clave} className={estilos.fila} data-busca={`${f.tipo} ${f.detalle}`} data-busca-mas={g.familia}>
                    <span className={estilos.nombre}>
                      {f.tipo}
                      {f.porKilo && <span className={estilos.unidad}>{" · el kilo"}</span>}
                      {f.detalle && <span className={propios.detalle}>{f.detalle}</span>}
                      <span className={propios.costo}>
                        {f.costo === null ? (
                          <span className={propios.falta}>Sin costo</span>
                        ) : (
                          <>
                            Costo <strong>{usd(f.costo)}</strong>
                            {f.deja !== null && (
                              <>
                                {" · deja "}
                                <strong>{usd(f.deja)}</strong>
                                {f.margenPct !== null && ` (${String(f.margenPct).replace(".", ",")} %)`}
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </span>
                    <span className={estilos.precios}>
                      {f.precio === null ? (
                        <span className={propios.falta}>Sin precio</span>
                      ) : (
                        <>
                          <span className={estilos.bs}>{f.bs !== null ? bs(f.bs) : usd(f.precio)}</span>
                          {f.bs !== null && <span className={estilos.usd}>{usd(f.precio)}</span>}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className={estilos.nota}>
        Lo que está publicado en la web, con el precio al mayor que ven los clientes. Los bolívares salen del precio en dólares por la tasa del
        BCV de hoy y cambian solos cada mañana. El costo es el que tiene cada producto en el panel; «deja» es el precio menos el costo.
      </p>
    </main>
  );
}
