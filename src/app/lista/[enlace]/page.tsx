import { notFound } from "next/navigation";
import { conPrecios, listarArticulosDetal } from "@/lib/detal";
import { enlaceDeLaLista, leerTasa, reglasDelDetal } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { textoCoincide } from "@/lib/buscar";
import { CATEGORIAS_DETAL, type CategoriaDetal } from "@/lib/detal-calculo";
import { bsRedondo, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, tasaLegible, usd } from "@/lib/dinero";
import estilos from "./lista.module.css";

type Parametros = { params: Promise<{ enlace: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata = { title: "Lista de precios" };

/** La dirección de una de las dos listas, con lo que se esté buscando. */
function enlaceA(mayor: boolean, busqueda: string): string {
  const parametros = new URLSearchParams();
  if (mayor) parametros.set("precio", "mayor");
  if (busqueda) parametros.set("q", busqueda);
  return `?${parametros.toString()}`;
}

/**
 * La lista de precios de la charcutería, para la familia: con el enlace,
 * sin clave, cada producto en bolívares a la tasa BCV de hoy (subidos a
 * favor del negocio) y en dólares. Dos listas: la del detal y, si algo
 * tiene precio al mayor (la charcutería), la del mayor (`?precio=mayor`).
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
  const alMayor = hayMayor && parametros.precio === "mayor";
  const lista = todos
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
        <p className={estilos.antetitulo}>{alMayor ? "Villa Real · al mayor" : "Charcutería Villa Real"}</p>
        <h1 className={estilos.titulo}>{alMayor ? "Precios al mayor" : "Lista de precios"}</h1>
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

      {hayMayor && (
        <nav className={estilos.pestanas} aria-label="Qué precios ver">
          <a href={enlaceA(false, busqueda)} aria-current={alMayor ? undefined : "page"}>
            Al detal
          </a>
          <a href={enlaceA(true, busqueda)} aria-current={alMayor ? "page" : undefined}>
            Al mayor
          </a>
        </nav>
      )}

      <form method="get" className={estilos.buscador} role="search">
        {alMayor && <input type="hidden" name="precio" value="mayor" />}
        <label htmlFor="q" className={estilos.oculto}>
          Buscar un producto
        </label>
        <input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Buscar: jamón, harina, jabón…" />
        <button type="submit">Buscar</button>
        {busqueda && <a href={enlaceA(alMayor, "")}>Todos</a>}
      </form>

      {lista.length === 0 ? (
        <p className={estilos.vacio}>{busqueda ? `Nada responde a «${busqueda}».` : "La lista todavía está vacía."}</p>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} className={estilos.grupo}>
            <h2 className={estilos.categoria}>{CATEGORIAS_DETAL[g.categoria]}</h2>
            <ul className={estilos.filas}>
              {g.articulos.map((a) => (
                <li key={a.id} className={estilos.fila}>
                  <span className={estilos.nombre}>
                    {a.nombre}
                    {a.unidad === "kg" && <span className={estilos.unidad}> · el kilo</span>}
                  </span>
                  <span className={estilos.precios}>
                    <span className={estilos.bs}>{a.bs !== null ? bsRedondo(a.bs) : usd(a.usd ?? 0)}</span>
                    {a.bs !== null && <span className={estilos.usd}>{usd(a.usd ?? 0)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className={estilos.nota}>
        {alMayor ? "Precios al mayor. " : ""}Los bolívares salen del precio en dólares por la tasa del BCV de hoy, subidos de {reglas.redondeo_bs} en {reglas.redondeo_bs}.
        Cambian solos cada mañana.
      </p>
    </main>
  );
}
