import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { negocio } from "@/config/negocio";
import { buscarFamiliaPorSlug, direccionDePortada, type Familia } from "@/lib/familias";
import { deLaFamilia, deLasMarcas, marcasDeLaLista, porSecciones, vitrina, type ProductoDeVitrina } from "@/lib/vitrina";
import { marcasDelFiltro } from "@/lib/marcas-texto";
import { CabeceraPublica, LineaTasa, PiePublico, type SeccionPublica } from "@/components/publico";
import { CabeceraDeFamilia, ChipsDeFamilias, FiltroDeMarcas, NotaDePrecios, PaginaDeVitrina, SeccionesDeProductos, SinProductos } from "@/components/vitrina";
import estilos from "@/components/vitrina.module.css";

type Parametros = { params: Promise<{ slug: string }>; searchParams: Promise<{ marca?: string | string[] }> };

/** La familia de la dirección, solo si existe y está activa. */
async function familiaDe(slug: string): Promise<Familia | null> {
  const familia = await buscarFamiliaPorSlug(slug);
  return familia && familia.activa === 1 ? familia : null;
}

function resumenDe(familia: Familia): string {
  return familia.descripcion || `${familia.nombre} al mayor en ${negocio.localidad}, con el precio del día.`;
}

export async function generateMetadata({ params }: Pick<Parametros, "params">): Promise<Metadata> {
  const { slug } = await params;
  const familia = await familiaDe(slug);
  if (!familia) return { title: "Categoría", robots: { index: false } };
  const portada = direccionDePortada(familia);
  return {
    title: familia.nombre,
    description: resumenDe(familia),
    alternates: { canonical: `/categoria/${familia.slug}` },
    openGraph: {
      type: "website",
      locale: "es_VE",
      siteName: negocio.nombre,
      title: `${familia.nombre} · ${negocio.nombre}`,
      description: resumenDe(familia),
      url: `/categoria/${familia.slug}`,
      images: portada ? [{ url: portada }] : undefined,
    },
  };
}

/** Burger y Pizzería tienen su sitio en el menú; las demás familias cuelgan de Productos. */
function seccionDe(slug: string): SeccionPublica {
  return slug === "burger" ? "burger" : slug === "pizzeria" ? "pizzeria" : "productos";
}

/**
 * Una familia del catálogo (Burger, Pizzería, Quesos…): su portada, sus
 * tipos de producto publicados (los suyos y los que también salen en ella,
 * sin repetirse), por secciones (en Burger: Quesos, Proteínas, Salsas…),
 * cada uno con su precio y su «Agregar», el filtro por marca y las demás
 * familias para saltar. Una familia escondida no existe para el público;
 * una sin nada publicado lo dice y ofrece preguntar por WhatsApp.
 */
export default async function PaginaCategoria({ params, searchParams }: Parametros) {
  const { slug } = await params;
  const familia = await familiaDe(slug);
  if (!familia) notFound();
  const v = await vitrina();
  const tasa = v.tasa?.valor ?? null;
  const elegidas = marcasDelFiltro((await searchParams).marca);
  const todos = deLaFamilia(v.productos, familia.id);
  const lista = todos.map((p) => deLasMarcas(p, elegidas)).filter((p): p is ProductoDeVitrina => p !== null);

  return (
    <>
      <CabeceraPublica actual={seccionDe(familia.slug)} />
      <PaginaDeVitrina>
        <section className={estilos.seccion} aria-labelledby="titulo-familia">
          <CabeceraDeFamilia familia={familia} cuantos={lista.length}>
            <LineaTasa tasa={v.tasa} className={estilos.tasaClara} />
          </CabeceraDeFamilia>
          <ChipsDeFamilias familias={v.familias} actual={familia.slug} />
          <FiltroDeMarcas marcas={marcasDeLaLista(todos)} elegidas={elegidas} accion={`/categoria/${familia.slug}`} />
          {todos.length === 0 ? (
            <SinProductos
              texto={`Todavía no hay productos de ${familia.nombre.toLowerCase()} publicados en la web. Pregúntanos por WhatsApp: te decimos qué tenemos.`}
              pregunta={`Hola, ¿qué tienen de ${familia.nombre.toLowerCase()}?`}
            />
          ) : lista.length === 0 ? (
            <SinProductos texto="Ninguno de estos productos se vende de esas marcas. Quita el filtro o pregúntanos por WhatsApp." pregunta={`Hola, ¿qué tienen de ${familia.nombre.toLowerCase()}?`} />
          ) : (
            <>
              <SeccionesDeProductos secciones={porSecciones(lista, familia, v.todasLasFamilias)} tasa={tasa} />
              <NotaDePrecios hayTasa={tasa !== null} items={lista} />
            </>
          )}
        </section>
      </PaginaDeVitrina>
      <PiePublico />
    </>
  );
}
