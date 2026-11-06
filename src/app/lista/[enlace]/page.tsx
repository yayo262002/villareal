import { notFound } from "next/navigation";
import { conPrecios, listarArticulosDetal } from "@/lib/detal";
import { enlaceDeLaLista, leerTasa, reglasDelDetal } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { CATEGORIAS_DETAL, type CategoriaDetal } from "@/lib/detal-calculo";
import { bsRedondo, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, tasaLegible, usd } from "@/lib/dinero";
import estilos from "./lista.module.css";

type Parametros = { params: Promise<{ enlace: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata = { title: "Lista de precios" };

/**
 * La lista de precios de la charcutería, para la familia: con el enlace,
 * sin clave, cada producto en bolívares a la tasa BCV de hoy (subidos a
 * favor del negocio) y en dólares. Se busca escribiendo, sin JavaScript.
 * Solo enseña la lista: ni costos, ni clientes, ni nada del panel.
 */
export default async function PaginaLista({ params, searchParams }: Parametros) {
  const { enlace } = await params;
  const guardado = await enlaceDeLaLista();
  if (!esEnlaceValido(enlace) || enlace !== guardado) notFound();
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.slice(0, 80) : "";
  const [articulos, reglas, tasa] = await Promise.all([listarArticulosDetal(busqueda, true), reglasDelDetal(), leerTasa()]);
  const lista = conPrecios(articulos, reglas, tasa?.valor ?? null).filter((a) => a.detal_usd !== null);
  const hayMayor = lista.some((a) => a.mayor_usd !== null);
  const grupos = Object.keys(CATEGORIAS_DETAL)
    .map((c) => ({ categoria: c as CategoriaDetal, articulos: lista.filter((a) => a.categoria === c) }))
    .filter((g) => g.articulos.length > 0);
  const dia = hoy();
  const fechaTasa = tasa ? (tasa.fecha_valor ?? fechaDeLaBase(tasa.actualizada_en)) : null;

  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <p className={estilos.antetitulo}>Charcutería Villa Real</p>
        <h1 className={estilos.titulo}>Lista de precios</h1>
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
        <input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Buscar: harina, mavesa, jabón…" />
        <button type="submit">Buscar</button>
        {busqueda && <a href="?">Todos</a>}
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
                    <span className={estilos.bs}>{a.detal_bs !== null ? bsRedondo(a.detal_bs) : usd(a.detal_usd ?? 0)}</span>
                    {a.detal_bs !== null && <span className={estilos.usd}>{usd(a.detal_usd ?? 0)}</span>}
                    {hayMayor && a.mayor_usd !== null && (
                      <span className={estilos.mayor}>
                        Al mayor {a.mayor_bs !== null ? bsRedondo(a.mayor_bs) : ""} · {usd(a.mayor_usd)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className={estilos.nota}>
        Los bolívares salen del precio en dólares por la tasa del BCV de hoy, subidos de {reglas.redondeo_bs} en {reglas.redondeo_bs}. Cambian solos cada mañana.
      </p>
    </main>
  );
}
