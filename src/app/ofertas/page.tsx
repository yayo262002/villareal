import type { Metadata } from "next";
import { negocio } from "@/config/negocio";
import { ofertasVigentes } from "@/lib/ofertas";
import { hoy } from "@/lib/dinero";
import { rutasPublicas, vitrina } from "@/lib/vitrina";
import { CabeceraPublica, LineaTasa, PiePublico } from "@/components/publico";
import {
  EncabezadoDePagina,
  NotaDePrecios,
  PaginaDeVitrina,
  RejillaDeOfertas,
  RejillaDeProductos,
  SinProductos,
  TituloDeSeccion,
} from "@/components/vitrina";
import estilos from "@/components/vitrina.module.css";

export const metadata: Metadata = {
  title: "Ofertas y combos",
  description: `Combos y productos en oferta de ${negocio.nombre} para hamburgueserías, pizzerías y restaurantes de ${negocio.localidad}.`,
  alternates: { canonical: "/ofertas" },
};

/**
 * Los combos que el dueño activó y están dentro de sus fechas, y los
 * productos publicados que marcó «en oferta». Sin ninguno, se dice: no se
 * enseñan ofertas que no existen.
 */
export default async function PaginaOfertas() {
  const [v, ofertas] = await Promise.all([vitrina(), ofertasVigentes(hoy())]);
  const tasa = v.tasa?.valor ?? null;
  const enOferta = v.productos.filter((p) => p.producto.en_oferta);
  const nada = ofertas.length === 0 && enOferta.length === 0;

  return (
    <>
      <CabeceraPublica actual="ofertas" />
      <PaginaDeVitrina>
        <EncabezadoDePagina titulo="Ofertas y combos" entradilla="Combos pensados para tu hamburguesería o pizzería y productos con precio especial. Agrégalos al carrito o pídelos directo por WhatsApp.">
          <LineaTasa tasa={v.tasa} className={estilos.tasa} />
        </EncabezadoDePagina>

        {nada && (
          <SinProductos
            texto="Ahora mismo no hay ofertas publicadas. Escríbenos: por volumen siempre te damos el mejor precio que podemos."
            pregunta="Hola, ¿tienen alguna oferta o combo esta semana?"
          />
        )}

        {ofertas.length > 0 && (
          <section className={estilos.seccion} aria-labelledby="titulo-combos">
            <TituloDeSeccion id="titulo-combos">Combos</TituloDeSeccion>
            <RejillaDeOfertas ofertas={ofertas} tasa={tasa} rutas={rutasPublicas(v.productos)} />
          </section>
        )}

        {enOferta.length > 0 && (
          <section className={estilos.seccion} aria-labelledby="titulo-en-oferta">
            <TituloDeSeccion id="titulo-en-oferta">Productos en oferta</TituloDeSeccion>
            <RejillaDeProductos items={enOferta} tasa={tasa} />
          </section>
        )}

        {!nada && <NotaDePrecios hayTasa={tasa !== null} />}
      </PaginaDeVitrina>
      <PiePublico />
    </>
  );
}
