import type { Metadata } from "next";
import { negocio } from "@/config/negocio";
import { buscarEnLaVitrina, deLaFamilia, deLasMarcas, marcasDeLaLista, vitrina, type ProductoDeVitrina } from "@/lib/vitrina";
import { marcasDelFiltro } from "@/lib/marcas-texto";
import { CabeceraPublica, LineaTasa, PiePublico } from "@/components/publico";
import { EncabezadoDePagina, FiltroDeMarcas, NotaDePrecios, PaginaDeVitrina, RejillaDeProductos, SinProductos } from "@/components/vitrina";
import estilos from "@/components/vitrina.module.css";

export const metadata: Metadata = {
  title: "Productos",
  description: `Todo lo que vende ${negocio.nombre} al mayor en ${negocio.localidad}, con el precio del día en bolívares y en dólares.`,
  // Una búsqueda o un filtro (?q=, ?familia=) es la misma página: la dirección buena es una.
  alternates: { canonical: "/productos" },
};

type Parametros = { searchParams: Promise<{ q?: string | string[]; marca?: string | string[]; familia?: string | string[]; negocio?: string | string[] }> };

const uno = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : (valor ?? "")).trim().slice(0, 80);

/**
 * Todos los productos publicados, con su precio de hoy y su «Agregar», y
 * los filtros: por familia (Quesos), por negocio (Burger), por marca
 * (Guaralact) y el buscador (por nombre o tipo, marca, presentación,
 * descripción o familia, sin tildes): «mozzarella» trae todas las
 * mozzarellas. Todo va y vuelve por la dirección, sin JavaScript. Lo que no
 * se encuentra se dice, y se ofrece preguntarlo por WhatsApp.
 */
export default async function PaginaProductos({ searchParams }: Parametros) {
  const { q, marca, familia, negocio: negocioElegido } = await searchParams;
  const busqueda = uno(q);
  const elegidas = marcasDelFiltro(marca);
  const v = await vitrina();
  const tasa = v.tasa?.valor ?? null;
  const familiaElegida = v.familiasDeProductos.find((f) => f.slug === uno(familia)) ?? null;
  const coleccionElegida = v.colecciones.find((f) => f.slug === uno(negocioElegido)) ?? null;
  let encontrados = busqueda ? buscarEnLaVitrina(v, busqueda) : v.productos;
  if (familiaElegida) encontrados = deLaFamilia(encontrados, familiaElegida.id);
  if (coleccionElegida) encontrados = deLaFamilia(encontrados, coleccionElegida.id);
  const lista = encontrados.map((p) => deLasMarcas(p, elegidas)).filter((p): p is ProductoDeVitrina => p !== null);
  const filtrando = Boolean(busqueda || familiaElegida || coleccionElegida);
  const conservar: Record<string, string> = {};
  if (busqueda) conservar.q = busqueda;
  if (familiaElegida) conservar.familia = familiaElegida.slug;
  if (coleccionElegida) conservar.negocio = coleccionElegida.slug;
  const cuantos = lista.length === 0 ? "Ningún producto encontrado" : lista.length === 1 ? "1 producto encontrado" : `${lista.length} productos encontrados`;
  const detalle = [familiaElegida?.nombre, coleccionElegida?.nombre, busqueda ? `«${busqueda}»` : ""].filter(Boolean).join(" · ");

  return (
    <>
      <CabeceraPublica actual="productos" />
      <PaginaDeVitrina>
        <section className={estilos.seccion} aria-labelledby="titulo-productos">
          <EncabezadoDePagina
            id="titulo-productos"
            titulo={busqueda ? `Buscar: ${busqueda}` : "Productos"}
            entradilla={
              filtrando
                ? `${cuantos}${detalle ? ` en ${detalle}` : ""}.`
                : "Todo lo que vendemos al mayor, con el precio de hoy. Busca por tipo de producto o filtra por familia, negocio o marca; agrega lo que necesites al carrito y envíanos el pedido por WhatsApp."
            }
          >
            <LineaTasa tasa={v.tasa} className={estilos.tasa} />
          </EncabezadoDePagina>
          <form action="/productos" className={estilos.filtros} role="search" aria-label="Buscar y filtrar">
            <div className={estilos.filtroCampo}>
              <label htmlFor="buscar-productos">Buscar por tipo de producto</label>
              <input id="buscar-productos" name="q" type="search" defaultValue={busqueda} placeholder="Queso, tocineta, salsa…" enterKeyHint="search" />
            </div>
            <div className={estilos.filtroCampo}>
              <label htmlFor="filtro-familia">Familia</label>
              <select id="filtro-familia" name="familia" defaultValue={familiaElegida?.slug ?? ""}>
                <option value="">Todas</option>
                {v.familiasDeProductos.map((f) => (
                  <option key={f.id} value={f.slug}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            {v.colecciones.length > 0 && (
              <div className={estilos.filtroCampo}>
                <label htmlFor="filtro-negocio">Negocio</label>
                <select id="filtro-negocio" name="negocio" defaultValue={coleccionElegida?.slug ?? ""}>
                  <option value="">Todos</option>
                  {v.colecciones.map((f) => (
                    <option key={f.id} value={f.slug}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={estilos.filtroAcciones}>
              <button type="submit" className="boton">
                Buscar
              </button>
              {filtrando && (
                <a href="/productos" className={estilos.verDetalles}>
                  Ver todos
                </a>
              )}
            </div>
          </form>
          <FiltroDeMarcas marcas={marcasDeLaLista(encontrados)} elegidas={elegidas} accion="/productos" conservar={conservar} />
          {lista.length === 0 ? (
            <SinProductos
              texto={filtrando ? `No encontramos ${detalle || "eso"} en la web. Pregúntanos: puede que lo tengamos o que lo consigamos.` : "Todavía no hay productos publicados."}
              pregunta={busqueda ? `Hola, ¿tienen ${busqueda}?` : "Hola, ¿qué productos tienen disponibles?"}
            />
          ) : (
            <>
              <RejillaDeProductos items={lista} tasa={tasa} />
              <NotaDePrecios hayTasa={tasa !== null} items={lista} />
            </>
          )}
        </section>
      </PaginaDeVitrina>
      <PiePublico />
    </>
  );
}
