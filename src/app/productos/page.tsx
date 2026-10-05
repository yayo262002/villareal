import type { Metadata } from "next";
import { negocio } from "@/config/negocio";
import { buscarEnLaVitrina, vitrina } from "@/lib/vitrina";
import { CabeceraPublica, LineaTasa, PiePublico } from "@/components/publico";
import { ChipsDeFamilias, EncabezadoDePagina, NotaDePrecios, PaginaDeVitrina, RejillaDeProductos, SinProductos } from "@/components/vitrina";
import estilos from "@/components/vitrina.module.css";

export const metadata: Metadata = {
  title: "Productos",
  description: `Todo lo que vende ${negocio.nombre} al mayor en ${negocio.localidad}, con el precio del día en bolívares y en dólares.`,
  // Una búsqueda (?q=) es la misma página: la dirección buena es una.
  alternates: { canonical: "/productos" },
};

type Parametros = { searchParams: Promise<{ q?: string | string[] }> };

/**
 * Todos los productos publicados, con su precio de hoy y su «Agregar», las
 * familias para saltar de una a otra y el buscador (por nombre, marca,
 * presentación, descripción o familia, sin tildes). Lo que no se encuentra
 * se dice, y se ofrece preguntarlo por WhatsApp.
 */
export default async function PaginaProductos({ searchParams }: Parametros) {
  const { q } = await searchParams;
  const busqueda = (Array.isArray(q) ? q[0] : (q ?? "")).trim().slice(0, 80);
  const v = await vitrina();
  const tasa = v.tasa?.valor ?? null;
  const lista = busqueda ? buscarEnLaVitrina(v, busqueda) : v.productos;

  return (
    <>
      <CabeceraPublica actual="productos" />
      <PaginaDeVitrina>
        <section className={estilos.seccion} aria-labelledby="titulo-productos">
          <EncabezadoDePagina
            id="titulo-productos"
            titulo={busqueda ? `Buscar: ${busqueda}` : "Productos"}
            entradilla={
              busqueda
                ? `${lista.length === 0 ? "Ningún producto encontrado" : lista.length === 1 ? "1 producto encontrado" : `${lista.length} productos encontrados`}.`
                : "Todo lo que vendemos al mayor, con el precio de hoy. Agrega lo que necesites al carrito y envíanos el pedido por WhatsApp."
            }
          >
            <LineaTasa tasa={v.tasa} className={estilos.tasa} />
          </EncabezadoDePagina>
          <form action="/productos" className={estilos.buscador} role="search">
            <label htmlFor="buscar-productos" className="visualmente-oculto">
              Buscar productos
            </label>
            <input id="buscar-productos" name="q" type="search" defaultValue={busqueda} placeholder="Queso, tocineta, salsa…" enterKeyHint="search" />
            <button type="submit" className="boton">
              Buscar
            </button>
          </form>
          <ChipsDeFamilias familias={v.familias} actual={busqueda ? "" : null} />
          {lista.length === 0 ? (
            <SinProductos
              texto={busqueda ? `No encontramos «${busqueda}» en la web. Pregúntanos: puede que lo tengamos o que lo consigamos.` : "Todavía no hay productos publicados."}
              pregunta={busqueda ? `Hola, ¿tienen ${busqueda}?` : "Hola, ¿qué productos tienen disponibles?"}
            />
          ) : (
            <>
              <RejillaDeProductos items={lista} tasa={tasa} />
              <NotaDePrecios hayTasa={tasa !== null} />
            </>
          )}
        </section>
      </PaginaDeVitrina>
      <PiePublico />
    </>
  );
}
