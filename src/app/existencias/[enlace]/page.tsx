import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { enlaceDeExistencias } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { existenciasPorClave } from "@/lib/inventario";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { listarFamilias } from "@/lib/familias";
import { cantidadLegible, estadoParaVendedora, existenciasPorFamilia, type EstadoParaVendedora } from "@/lib/existencias-por-familia";
import { textoCoincide } from "@/lib/buscar";
import { FiltroEnVivo } from "@/components/filtro-en-vivo";
import { diaDeLaSemana, fechaCorta, hoy } from "@/lib/dinero";
import estilos from "../../lista/[enlace]/lista.module.css";
import propios from "./existencias.module.css";

type Parametros = { params: Promise<{ enlace: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOMBRE_DEL_ESTADO: Record<EstadoParaVendedora, string> = { hay: "Hay", poco: "Queda poco", agotado: "Agotado", sin_contar: "Pregunta" };

/** Puesta en la pantalla de inicio, es su propia app, «Lo que hay» (su manifiesto, al lado). */
export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { enlace } = await params;
  return {
    title: "Lo que hay",
    manifest: `/existencias/${enlace}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Lo que hay", statusBarStyle: "default" },
  };
}

/**
 * «Lo que hay»: lo que la vendedora puede ofrecer, desde su teléfono, con su
 * enlace y sin clave. Lo publicado en la web, por familias, cada artículo con
 * lo que hay según el inventario (que las ventas descuentan solas): si hay y
 * cuánto, si queda poco, si se acabó o si todavía no se ha contado. Sin costos
 * ni nada más del panel. El enlace se crea y se renueva en Inventario.
 */
export default async function PaginaLoQueHay({ params, searchParams }: Parametros) {
  const { enlace } = await params;
  const guardado = await enlaceDeExistencias();
  if (!esEnlaceValido(enlace) || enlace !== guardado) notFound();
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.slice(0, 80) : "";
  const [productos, variantes, familias, existencias] = await Promise.all([listarProductos(), listarVariantes(), listarFamilias(), existenciasPorClave()]);
  const todos = existenciasPorFamilia(productos, variantes, familias, existencias, { conEscondidos: false });
  const grupos = todos
    .map((g) => ({ ...g, filas: g.filas.filter((f) => textoCoincide([f.tipo, f.detalle, g.familia], busqueda)) }))
    .filter((g) => g.filas.length > 0);
  const cuenta = { hay: 0, poco: 0, agotado: 0, sin_contar: 0 };
  for (const f of todos.flatMap((g) => g.filas)) cuenta[estadoParaVendedora(f.existencia)]++;
  const dia = hoy();

  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <p className={estilos.antetitulo}>Villa Real · para vender</p>
        <h1 className={estilos.titulo}>Lo que hay</h1>
        <p className={estilos.fecha}>
          {diaDeLaSemana(dia)} {fechaCorta(dia)} · al día con las ventas
        </p>
        <ul className={propios.resumen}>
          {(["hay", "poco", "agotado", "sin_contar"] as const)
            .filter((estado) => cuenta[estado] > 0)
            .map((estado) => (
              <li key={estado} className={`${propios.etiqueta} ${propios[estado]}`}>
                {NOMBRE_DEL_ESTADO[estado]}: {cuenta[estado]}
              </li>
            ))}
        </ul>
      </header>

      <form method="get" className={estilos.buscador} role="search">
        <label htmlFor="q" className={estilos.oculto}>
          Buscar un producto
        </label>
        <input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Buscar: jamón, mozzarella, Drago…" autoComplete="off" />
        <button type="submit">Buscar</button>
        {busqueda && <a href="?">Todos</a>}
      </form>
      <FiltroEnVivo entrada="q" lista="productos" clase={estilos.vacio} />

      {grupos.length === 0 ? (
        <p className={estilos.vacio}>{busqueda ? `Nada responde a «${busqueda}».` : "Todavía no hay nada publicado."}</p>
      ) : (
        <div id="productos" className={estilos.productos}>
          {grupos.map((g) => (
            <section key={g.familia} className={estilos.grupo} data-grupo>
              <h2 className={estilos.categoria}>{g.familia}</h2>
              <ul className={estilos.filas}>
                {g.filas.map((f) => {
                  const e = f.existencia;
                  const estado = estadoParaVendedora(e);
                  return (
                    <li key={f.clave} className={estilos.fila} data-busca={`${f.tipo} ${f.detalle}`} data-busca-mas={g.familia}>
                      <span className={estilos.nombre}>
                        {f.tipo}
                        {f.detalle && <span className={propios.detalle}>{f.detalle}</span>}
                      </span>
                      <span className={estilos.precios}>
                        {(estado === "hay" || estado === "poco") && <span className={propios.cuanto}>{cantidadLegible(e.existencia, f.unidad)}</span>}
                        {(estado === "hay" || estado === "poco") && e.piezas !== null && (
                          <span className={propios.piezas}>unas {e.piezas} {e.piezas === 1 ? "pieza" : "piezas"}</span>
                        )}
                        <span className={`${propios.etiqueta} ${propios[estado]}`}>{NOMBRE_DEL_ESTADO[estado]}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className={estilos.nota}>
        Lo que dice el inventario de la tienda ahora: cada venta lo descuenta sola. «Pregunta» es que todavía no se ha contado. Antes de prometer
        una cantidad grande, confírmala con la tienda.
      </p>
    </main>
  );
}
