import Link from "next/link";
import type { Metadata } from "next";
import { enlaceMapa, enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { ofertasVigentes } from "@/lib/ofertas";
import { hoy } from "@/lib/dinero";
import { destacados, rutasPublicas, vitrina } from "@/lib/vitrina";
import { direccionDePortada, type Familia } from "@/lib/familias";
import { miniatura } from "@/lib/portadas";
import { CabeceraPublica, DatosEstructurados, LineaTasa, PiePublico, datosDeLaTienda } from "@/components/publico";
import {
  AtajosDeCategorias,
  FranjaMayorista,
  MontandoTuNegocio,
  NotaDePrecios,
  RejillaDeColecciones,
  RejillaDeFamilias,
  RejillaDeOfertas,
  RejillaDeProductos,
  SinProductos,
  TituloDeSeccion,
  type Atajo,
} from "@/components/vitrina";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import estilos from "./inicio.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Cuántos productos destacados enseña la portada: cuatro, no una lista interminable; todos están en Productos. */
const DESTACADOS_EN_PORTADA = 4;
/** Cuántos combos enseña la portada; todos están en Ofertas. */
const OFERTAS_EN_PORTADA = 3;

/**
 * Los atajos de la foto de arriba, cada uno a su familia. Un atajo cuya
 * familia no existe o está escondida no sale: no se lleva a nadie a una
 * página que no existe.
 */
const ATAJOS: { texto: string; familia: string; foto?: string }[] = [
  { texto: "Quesos", familia: "quesos" },
  { texto: "Embutidos", familia: "embutidos" },
  { texto: "Salsas", familia: "salsas-y-aderezos" },
  { texto: "Papas", familia: "papas-y-congelados" },
  { texto: "Huevos", familia: "huevos" },
  { texto: "Lácteos", familia: "lacteos" },
  { texto: "Bebidas", familia: "bebidas", foto: "/productos/refrescos.webp" },
];

function atajosDe(familias: Familia[]): Atajo[] {
  return ATAJOS.flatMap((a) => {
    const familia = familias.find((f) => f.slug === a.familia);
    if (!familia) return [];
    // La foto, en miniatura: el círculo es de 64 px, y la foto entera le quitaba el turno a la de arriba.
    const foto = a.foto ?? direccionDePortada(familia);
    return [{ texto: a.texto, ruta: `/categoria/${familia.slug}`, foto: foto ? miniatura(foto) : null }];
  });
}

/**
 * La portada vende la idea de Villa Real, no un supermercado: «Todo para tu
 * burger & pizzería» sobre la foto de la hamburguesa y la pizza (a lo ancho
 * en la pantalla ancha, con el texto a la izquierda; en el teléfono, la foto
 * arriba y el título montado sobre ella), los atajos a las familias, una
 * banda con el mensaje mayorista, «¿Qué necesitas para tu negocio?» (las
 * colecciones: Burger, Pizzería), «Comprar por categoría» (las familias de
 * productos), cuatro productos destacados como mucho (los que el dueño
 * marca; si no marca ninguno, los primeros), los combos vigentes, la
 * llamada a quien monta su negocio y dónde está la tienda. Sin marcas: cada
 * marca sale al entrar en su producto. Lo que no está (tasa, precios) no se
 * inventa.
 */
export default async function PaginaInicio() {
  const [v, ofertas] = await Promise.all([vitrina(), ofertasVigentes(hoy())]);
  const tasa = v.tasa?.valor ?? null;
  const lista = destacados(v.productos).slice(0, DESTACADOS_EN_PORTADA);
  const whatsapp = enlaceWhatsapp("Hola, quiero hacer un pedido.");
  const mapa = enlaceMapa();

  return (
    <>
      <DatosEstructurados datos={{ "@context": "https://schema.org", ...datosDeLaTienda() }} />
      <CabeceraPublica actual="inicio" />

      <main id="contenido" className={estilos.portada}>
        <section className={estilos.heroe} aria-labelledby="titulo-portada">
          <picture className={estilos.heroeFoto}>
            <source media="(min-width: 900px)" srcSet="/portada/heroe.webp" />
            <img src="/portada/heroe-movil.webp" alt="" width={900} height={760} fetchPriority="high" />
          </picture>
          <div className={estilos.heroeDentro}>
            <div className={estilos.heroeTexto}>
              <p className={estilos.antetitulo}>{negocio.nombreCorto} · Precios al mayor</p>
              <h1 id="titulo-portada" className={estilos.titulo}>
                Todo para tu <span>burger &amp; pizzería</span>
              </h1>
              <p className={estilos.subtitulo}>Tu proveedor de confianza para negocios de comida en {negocio.localidad}.</p>
              <div className={estilos.botones}>
                <Link href="/productos" className={`boton ${estilos.botonOro} ${estilos.botonGrande}`}>
                  Ver todos los productos
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noopener" className={`boton ${estilos.botonWhatsapp} ${estilos.botonGrande}`}>
                    <IconoWhatsapp tamano={22} />
                    Pedir por WhatsApp
                  </a>
                )}
              </div>
              <LineaTasa tasa={v.tasa} className={estilos.tasa} />
            </div>
            <AtajosDeCategorias atajos={atajosDe(v.todasLasFamilias)} className={estilos.atajos} />
          </div>
        </section>

        <FranjaMayorista />

        {v.colecciones.length > 0 && (
          <section className={estilos.seccion} aria-labelledby="titulo-negocios">
            <TituloDeSeccion id="titulo-negocios" antetitulo="Colecciones por tipo de negocio">
              ¿Qué necesitas para tu negocio?
            </TituloDeSeccion>
            <RejillaDeColecciones colecciones={v.colecciones} />
          </section>
        )}

        {v.familiasDeProductos.length > 0 && (
          <section className={estilos.seccion} aria-labelledby="titulo-categorias">
            <TituloDeSeccion id="titulo-categorias" antetitulo="El catálogo, por familias">
              Comprar por categoría
            </TituloDeSeccion>
            <RejillaDeFamilias familias={v.familiasDeProductos} compacta />
          </section>
        )}

        <section className={`${estilos.seccion} ${estilos.banda}`} aria-labelledby="titulo-destacados">
          <TituloDeSeccion id="titulo-destacados" antetitulo="Precios al mayor de hoy">
            Productos destacados
          </TituloDeSeccion>
          {lista.length === 0 ? (
            <SinProductos texto="Todavía no hay productos publicados." pregunta="Hola, ¿qué productos tienen disponibles?" />
          ) : (
            <>
              <RejillaDeProductos items={lista} tasa={tasa} />
              <NotaDePrecios hayTasa={tasa !== null} items={lista} />
              {v.productos.length > lista.length && (
                <Link href="/productos" className={`boton ${estilos.verTodos}`}>
                  Ver los {v.productos.length} productos
                </Link>
              )}
            </>
          )}
        </section>

        {ofertas.length > 0 && (
          <section className={estilos.seccion} aria-labelledby="titulo-ofertas">
            <TituloDeSeccion id="titulo-ofertas" antetitulo="Compra más, paga menos">
              Ofertas y combos
            </TituloDeSeccion>
            <RejillaDeOfertas ofertas={ofertas.slice(0, OFERTAS_EN_PORTADA)} tasa={tasa} rutas={rutasPublicas(v.productos)} />
            {ofertas.length > OFERTAS_EN_PORTADA && (
              <Link href="/ofertas" className={`boton ${estilos.verTodos}`}>
                Ver las {ofertas.length} ofertas
              </Link>
            )}
          </section>
        )}

        <div className={estilos.seccion}>
          <MontandoTuNegocio />
        </div>

        <section id="contacto" className={`${estilos.seccion} ${estilos.banda} ${estilos.contacto}`} aria-labelledby="titulo-contacto">
          <TituloDeSeccion id="titulo-contacto" antetitulo="Tienda física en el centro">
            Dónde estamos
          </TituloDeSeccion>
          <div className={estilos.contactoTarjeta}>
            <dl className={estilos.datos}>
              {(negocio.direccion || negocio.ciudad) && (
                <div>
                  <dt>Tienda física</dt>
                  <dd>{[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}</dd>
                </div>
              )}
              {negocio.horario && (
                <div>
                  <dt>Horario</dt>
                  <dd>{negocio.horario}</dd>
                </div>
              )}
              {whatsapp && (
                <div>
                  <dt>WhatsApp</dt>
                  <dd>
                    <a href={whatsapp} target="_blank" rel="noopener">
                      {whatsappLegible()}
                    </a>
                  </dd>
                </div>
              )}
              {negocio.correo && (
                <div>
                  <dt>Correo</dt>
                  <dd>
                    <a href={`mailto:${negocio.correo}`}>{negocio.correo}</a>
                  </dd>
                </div>
              )}
            </dl>
            <div className={estilos.contactoBotones}>
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener" className={`boton ${estilos.botonWhatsapp}`}>
                  <IconoWhatsapp />
                  Escribir por WhatsApp
                </a>
              )}
              {mapa && (
                <a className={`boton ${estilos.botonClaro}`} href={mapa} target="_blank" rel="noopener">
                  Cómo llegar
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <PiePublico />
    </>
  );
}
