import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { conPrecios, listarArticulosDetal } from "@/lib/detal";
import { enlaceDeLaLista, leerTasa, reglasDelDetal } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { textoCoincide } from "@/lib/buscar";
import { CATEGORIAS_DETAL, type CategoriaDetal } from "@/lib/detal-calculo";
import { bsRedondo, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, tasaLegible, usd } from "@/lib/dinero";
import estilos from "./lista.module.css";

type Parametros = { params: Promise<{ enlace: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Puesta en la pantalla de inicio, es su propia app, «Precios», que abre en esta lista (su manifiesto, al lado). */
export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { enlace } = await params;
  return {
    title: "Lista de precios",
    manifest: `/lista/${enlace}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Precios", statusBarStyle: "default" },
  };
}

/** «500 g», «1 kg»: el número y su unidad no se separan al partir la línea (como en la lista del teléfono). */
const pegarUnidad = (nombre: string) => nombre.replace(/(\d) (?=(g|kg|ml|l|cm)\b)/g, "$1 ");

/** Qué lista se ve: la del detal (todo), la de la charcutería (con sus dos precios) o la del mayor. */
type Vista = "detal" | "charcuteria" | "mayor";

/** La dirección de una de las listas, con lo que se esté buscando. */
function enlaceA(vista: Vista, busqueda: string): string {
  const parametros = new URLSearchParams();
  if (vista !== "detal") parametros.set("precio", vista);
  if (busqueda) parametros.set("q", busqueda);
  return `?${parametros.toString()}`;
}

/**
 * La lista de precios de la charcutería, para la familia: con el enlace,
 * sin clave, cada producto en bolívares a la tasa BCV de hoy (subidos a
 * favor del negocio) y en dólares. Hasta tres listas: la del detal; la de
 * la charcutería aparte, cada producto con su precio al detal y al mayor
 * (`?precio=charcuteria`); y, si algo tiene precio al mayor, la del mayor
 * (`?precio=mayor`).
 * Se busca escribiendo, sin JavaScript. Solo enseña la lista: ni costos,
 * ni proveedores, ni nada del panel.
 */
export default async function PaginaLista({ params, searchParams }: Parametros) {
  const { enlace } = await params;
  const guardado = await enlaceDeLaLista();
  if (!esEnlaceValido(enlace) || enlace !== guardado) notFound();
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.slice(0, 80) : "";
  const [articulos, reglas, tasa] = await Promise.all([listarArticulosDetal("", true), reglasDelDetal(), leerTasa()]);
  const todos = conPrecios(articulos, reglas, tasa?.valor ?? null);
  const hayMayor = todos.some((a) => a.mayor_usd !== null);
  const hayCharcuteria = todos.some((a) => a.categoria === "charcuteria" && a.detal_usd !== null);
  const vista: Vista = parametros.precio === "mayor" && hayMayor ? "mayor" : parametros.precio === "charcuteria" && hayCharcuteria ? "charcuteria" : "detal";
  const alMayor = vista === "mayor";
  const lista = todos
    .filter((a) => vista !== "charcuteria" || a.categoria === "charcuteria")
    .map((a) => ({ ...a, usd: alMayor ? a.mayor_usd : a.detal_usd, bs: alMayor ? a.mayor_bs : a.detal_bs }))
    .filter((a) => a.usd !== null && textoCoincide([a.nombre, CATEGORIAS_DETAL[a.categoria] ?? ""], busqueda));
  const grupos = Object.keys(CATEGORIAS_DETAL)
    .map((c) => ({ categoria: c as CategoriaDetal, articulos: lista.filter((a) => a.categoria === c) }))
    .filter((g) => g.articulos.length > 0);
  const dia = hoy();
  const fechaTasa = tasa ? (tasa.fecha_valor ?? fechaDeLaBase(tasa.actualizada_en)) : null;

  return (
    <main className={`${estilos.pagina} ${alMayor ? estilos.alMayor : ""}`}>
      <header className={estilos.cabecera}>
        <p className={estilos.antetitulo}>{alMayor ? "Villa Real · al mayor" : vista === "charcuteria" ? "Villa Real · al detal y al mayor" : "Charcutería Villa Real"}</p>
        <h1 className={estilos.titulo}>{alMayor ? "Precios al mayor" : vista === "charcuteria" ? "Charcutería" : "Lista de precios"}</h1>
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

      {(hayMayor || hayCharcuteria) && (
        <nav className={estilos.pestanas} aria-label="Qué precios ver">
          <a href={enlaceA("detal", busqueda)} aria-current={vista === "detal" ? "page" : undefined}>
            Al detal
          </a>
          {hayCharcuteria && (
            <a href={enlaceA("charcuteria", busqueda)} aria-current={vista === "charcuteria" ? "page" : undefined}>
              Charcutería
            </a>
          )}
          {hayMayor && (
            <a href={enlaceA("mayor", busqueda)} aria-current={alMayor ? "page" : undefined}>
              Al mayor
            </a>
          )}
        </nav>
      )}

      <form method="get" className={estilos.buscador} role="search">
        {vista !== "detal" && <input type="hidden" name="precio" value={vista} />}
        <label htmlFor="q" className={estilos.oculto}>
          Buscar un producto
        </label>
        <input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Buscar: jamón, harina, jabón…" />
        <button type="submit">Buscar</button>
        {busqueda && <a href={enlaceA(vista, "")}>Todos</a>}
      </form>

      {lista.length === 0 ? (
        <p className={estilos.vacio}>{busqueda ? `Nada responde a «${busqueda}».` : "La lista todavía está vacía."}</p>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} className={estilos.grupo}>
            <h2 className={estilos.categoria}>
              {CATEGORIAS_DETAL[g.categoria]}
              {vista === "charcuteria" && (
                <span className={estilos.columnas} aria-hidden="true">
                  <span>Detal</span>
                  <span>Mayor</span>
                </span>
              )}
            </h2>
            <ul className={estilos.filas}>
              {g.articulos.map((a) => (
                <li key={a.id} className={estilos.fila}>
                  <span className={estilos.nombre}>
                    {pegarUnidad(a.nombre)}
                    {a.unidad === "kg" && <span className={estilos.unidad}>{" · el kilo"}</span>}
                  </span>
                  {vista === "charcuteria" ? (
                    <span className={estilos.dosPrecios}>
                      <Precio etiqueta="Al detal" bs={a.detal_bs} dolares={a.detal_usd} />
                      <Precio etiqueta="Al mayor" bs={a.mayor_bs} dolares={a.mayor_usd} />
                    </span>
                  ) : (
                    <Precio bs={a.bs} dolares={a.usd} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className={estilos.nota}>
        {alMayor ? "Precios al mayor. " : vista === "charcuteria" ? "Cada producto con su precio al detal y al mayor. " : ""}Los bolívares salen del precio en dólares por la tasa del BCV de hoy, subidos de {reglas.redondeo_bs} en {reglas.redondeo_bs}.
        Cambian solos cada mañana.
      </p>
    </main>
  );
}

/** Un precio: en bolívares, grande, y debajo en dólares; sin tasa, solo los dólares. `etiqueta` lo nombra para quien no ve las columnas. */
function Precio({ bs, dolares, etiqueta }: { bs: number | null; dolares: number | null; etiqueta?: string }) {
  return (
    <span className={estilos.precios}>
      {etiqueta && <span className={estilos.oculto}>{etiqueta}: </span>}
      {dolares === null ? (
        <span className={estilos.usd}>—</span>
      ) : (
        <>
          <span className={estilos.bs}>{bs !== null ? bsRedondo(bs) : usd(dolares)}</span>
          {bs !== null && <span className={estilos.usd}>{usd(dolares)}</span>}
        </>
      )}
    </span>
  );
}
