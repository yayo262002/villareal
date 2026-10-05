import Link from "next/link";
import type { Metadata } from "next";
import { enlaceMapa, enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { ofertasVigentes } from "@/lib/ofertas";
import { hoy } from "@/lib/dinero";
import { destacados, rutasPublicas, vitrina } from "@/lib/vitrina";
import { CabeceraPublica, DatosEstructurados, LineaTasa, PiePublico, datosDeLaTienda } from "@/components/publico";
import {
  FranjaDeConfianza,
  MontandoTuNegocio,
  NotaDePrecios,
  RejillaDeFamilias,
  RejillaDeOfertas,
  RejillaDeProductos,
  SinProductos,
  TituloDeSeccion,
} from "@/components/vitrina";
import { Icono } from "@/components/icono";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import estilos from "./inicio.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Cuántos productos destacados enseña la portada; todos están en Productos. */
const DESTACADOS_EN_PORTADA = 8;
/** Cuántos combos enseña la portada; todos están en Ofertas. */
const OFERTAS_EN_PORTADA = 3;

/**
 * La portada: «Todo para tu burger & pizzería» sobre fotos de comida, las
 * categorías que tienen productos publicados, los productos destacados con
 * su precio y su botón de agregar al carrito, los combos vigentes, la
 * franja de confianza, la llamada a quien monta su negocio y dónde está la
 * tienda. Sin marcas: cada marca sale al entrar en su producto. Lo que no
 * está (tasa, precios, productos de una familia) no se inventa.
 */
export default async function PaginaInicio() {
  const [v, ofertas] = await Promise.all([vitrina(), ofertasVigentes(hoy())]);
  const tasa = v.tasa?.valor ?? null;
  const lista = destacados(v.productos).slice(0, DESTACADOS_EN_PORTADA);
  const whatsapp = enlaceWhatsapp("Hola, quiero hacer un pedido.");
  const mapa = enlaceMapa();
  // En la foto de arriba, las demás familias con productos: Burger y Pizzería ya van en el título.
  const atajos = v.familias.filter((f) => f.slug !== "burger" && f.slug !== "pizzeria");

  return (
    <>
      <DatosEstructurados datos={{ "@context": "https://schema.org", ...datosDeLaTienda() }} />
      <CabeceraPublica actual="inicio" />

      <main id="contenido">
        <section className={estilos.heroe} aria-labelledby="titulo-portada">
          <div className={estilos.heroeFotos} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/portada/hamburguesas.webp" alt="" width={1200} height={900} fetchPriority="high" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/portada/pizza.webp" alt="" width={1200} height={900} />
          </div>
          <div className={estilos.heroeTexto}>
            <p className={estilos.antetitulo}>{negocio.nombreCorto} · Tu proveedor para burger &amp; pizza</p>
            <h1 id="titulo-portada" className={estilos.titulo}>
              Todo para tu <span>burger &amp; pizzería</span>
            </h1>
            <p className={estilos.subtitulo}>Tu proveedor de confianza para negocios de comida en {negocio.localidad}.</p>
            <p className={estilos.texto}>Quesos, huevos, embutidos, papas, salsas, tocineta y bebidas a precios especiales por volumen.</p>
            {atajos.length > 0 && (
              <nav className={estilos.atajos} aria-label="Categorías">
                {atajos.map((f) => (
                  <Link key={f.id} href={`/categoria/${f.slug}`}>
                    <Icono nombre={f.icono} className={estilos.atajoIcono} />
                    {f.nombre}
                  </Link>
                ))}
              </nav>
            )}
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

        <div className={estilos.cuerpo}>
          {v.familias.length > 0 && (
            <section className={estilos.seccion} aria-labelledby="titulo-categorias">
              <TituloDeSeccion id="titulo-categorias">Categorías principales</TituloDeSeccion>
              <RejillaDeFamilias familias={v.familias} />
            </section>
          )}

          <section className={estilos.seccion} aria-labelledby="titulo-destacados">
            <TituloDeSeccion id="titulo-destacados">Productos destacados</TituloDeSeccion>
            {lista.length === 0 ? (
              <SinProductos texto="Todavía no hay productos publicados." pregunta="Hola, ¿qué productos tienen disponibles?" />
            ) : (
              <>
                <RejillaDeProductos items={lista} tasa={tasa} />
                <NotaDePrecios hayTasa={tasa !== null} />
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
              <TituloDeSeccion id="titulo-ofertas">Ofertas y combos</TituloDeSeccion>
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
            <TituloDeSeccion id="titulo-contacto">Dónde estamos</TituloDeSeccion>
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
