import Link from "next/link";
import type { Metadata } from "next";
import { enlaceMapa, enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { ofertasVigentes } from "@/lib/ofertas";
import { hoy } from "@/lib/dinero";
import { destacados, rutasPublicas, vitrina } from "@/lib/vitrina";
import { direccionDePortada, type Familia } from "@/lib/familias";
import { CabeceraPublica, DatosEstructurados, LineaTasa, PiePublico, datosDeLaTienda } from "@/components/publico";
import {
  AtajosDeCategorias,
  FranjaDeConfianza,
  FranjaMayorista,
  MontandoTuNegocio,
  NotaDePrecios,
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

/** Cuántos productos destacados enseña la portada; todos están en Productos. */
const DESTACADOS_EN_PORTADA = 8;
/** Cuántos combos enseña la portada; todos están en Ofertas. */
const OFERTAS_EN_PORTADA = 3;
/** Cuántas familias enseña la portada, en el orden del dueño: Burger, Pizzería, Quesos, Huevos, Embutidos, Salsas, Papas y Bebidas. */
const FAMILIAS_EN_PORTADA = 8;

/**
 * Los atajos de la foto de arriba, cada uno a su categoría (la tocineta, a
 * buscarla). Un atajo cuya familia no existe o está escondida no sale: no
 * se lleva a nadie a una página que no existe.
 */
const ATAJOS: { texto: string; familia?: string; busqueda?: string; foto?: string }[] = [
  { texto: "Quesos", familia: "quesos" },
  { texto: "Huevos", familia: "huevos" },
  { texto: "Embutidos", familia: "embutidos" },
  { texto: "Salsas", familia: "salsas-y-aderezos" },
  { texto: "Papas", familia: "papas-y-congelados" },
  { texto: "Tocineta", busqueda: "tocineta", foto: "/productos/tocineta.webp" },
  { texto: "Refrescos", familia: "bebidas", foto: "/productos/refrescos.webp" },
];

function atajosDe(familias: Familia[]): Atajo[] {
  return ATAJOS.flatMap((a) => {
    if (a.busqueda) return [{ texto: a.texto, ruta: `/productos?q=${encodeURIComponent(a.busqueda)}`, foto: a.foto ?? null }];
    const familia = familias.find((f) => f.slug === a.familia);
    return familia ? [{ texto: a.texto, ruta: `/categoria/${familia.slug}`, foto: a.foto ?? direccionDePortada(familia) }] : [];
  });
}

/**
 * La portada: «Todo para tu burger & pizzería» sobre una foto oscura de
 * hamburguesa, pizza y papas, con los atajos a cada categoría; la franja
 * dorada de precios al mayor; las ocho familias principales con su foto;
 * los productos destacados con su foto, su precio y «Agregar»; los combos
 * vigentes; la franja de confianza; la llamada a quien monta su negocio y
 * dónde está la tienda. Sin marcas: cada marca sale al entrar en su
 * producto. Lo que no está (tasa, precios) no se inventa, y una familia sin
 * productos publicados lo dice en su página.
 */
export default async function PaginaInicio() {
  const [v, ofertas] = await Promise.all([vitrina(), ofertasVigentes(hoy())]);
  const tasa = v.tasa?.valor ?? null;
  const lista = destacados(v.productos).slice(0, DESTACADOS_EN_PORTADA);
  const whatsapp = enlaceWhatsapp("Hola, quiero hacer un pedido.");
  const mapa = enlaceMapa();
  const familias = v.todasLasFamilias.slice(0, FAMILIAS_EN_PORTADA);

  return (
    <>
      <DatosEstructurados datos={{ "@context": "https://schema.org", ...datosDeLaTienda() }} />
      <CabeceraPublica actual="inicio" />

      <main id="contenido">
        <section className={estilos.heroe} aria-labelledby="titulo-portada">
          <picture className={estilos.heroeFoto}>
            <source media="(min-width: 900px)" srcSet="/portada/heroe.webp" />
            <img src="/portada/heroe-movil.webp" alt="" width={900} height={760} fetchPriority="high" />
          </picture>
          <div className={estilos.heroeTexto}>
            <p className={estilos.antetitulo}>{negocio.nombreCorto} · Precios al mayor</p>
            <h1 id="titulo-portada" className={estilos.titulo}>
              Todo para tu <span>burger &amp; pizzería</span>
            </h1>
            <p className={estilos.subtitulo}>Tu proveedor de confianza para negocios de comida en {negocio.localidad}.</p>
            <p className={estilos.texto}>Quesos, huevos, embutidos, papas, salsas, tocineta y bebidas a precios especiales por volumen.</p>
            <AtajosDeCategorias atajos={atajosDe(v.todasLasFamilias)} />
            <div className={estilos.botones}>
              <Link href="/productos" className={`boton boton--acento ${estilos.botonGrande}`}>
                Ver todos los productos
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
        </section>

        <FranjaMayorista />

        <div className={estilos.cuerpo}>
          {familias.length > 0 && (
            <section className={estilos.seccion} aria-labelledby="titulo-categorias">
              <TituloDeSeccion id="titulo-categorias" antetitulo="Todo para tu cocina">
                Categorías principales
              </TituloDeSeccion>
              <RejillaDeFamilias familias={familias} />
            </section>
          )}

          <section className={estilos.seccion} aria-labelledby="titulo-destacados">
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
                  <Link href="/productos" className={`boton boton--secundario ${estilos.verTodos}`}>
                    Ver los {v.productos.length} productos
                  </Link>
                )}
              </>
            )}
          </section>

          {ofertas.length > 0 && (
            <section className={estilos.seccion} aria-labelledby="titulo-ofertas">
              <TituloDeSeccion id="titulo-ofertas" antetitulo="Compra más · Paga menos">
                Ofertas y combos
              </TituloDeSeccion>
              <RejillaDeOfertas ofertas={ofertas.slice(0, OFERTAS_EN_PORTADA)} tasa={tasa} rutas={rutasPublicas(v.productos)} />
              {ofertas.length > OFERTAS_EN_PORTADA && (
                <Link href="/ofertas" className={`boton boton--secundario ${estilos.verTodos}`}>
                  Ver las {ofertas.length} ofertas
                </Link>
              )}
            </section>
          )}

          <FranjaDeConfianza />
          <MontandoTuNegocio />

          <section id="contacto" className={`${estilos.seccion} ${estilos.contacto}`} aria-labelledby="titulo-contacto">
            <TituloDeSeccion id="titulo-contacto" antetitulo="Tienda física en el centro">
              Dónde estamos
            </TituloDeSeccion>
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
                <a className="boton boton--secundario" href={mapa} target="_blank" rel="noopener">
                  Cómo llegar
                </a>
              )}
            </div>
          </section>
        </div>
      </main>

      <PiePublico />
    </>
  );
}
