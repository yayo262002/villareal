import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { direccionCompleta, enlaceCompartir, enlaceMapa, enlaceWhatsapp, negocio } from "@/config/negocio";
import { buscarProducto, listarProductos, type Producto } from "@/lib/productos";
import { leerTasa } from "@/lib/ajustes";
import { nombreUnidad } from "@/lib/dinero";
import { idDeRuta, rutaProducto } from "@/lib/enlaces";
import {
  CabeceraPublica,
  DatosEstructurados,
  LineaTasa,
  PiePublico,
  PreciosProducto,
  datosDeLaTienda,
  ventajasDe,
} from "@/components/publico";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import estilos from "../../page.module.css";

type Parametros = { params: Promise<{ producto: string }> };

/** El producto de la dirección, solo si existe y está publicado. */
async function productoDe(segmento: string) {
  const id = idDeRuta(segmento);
  const producto = id ? await buscarProducto(id) : null;
  return producto && producto.activo ? producto : null;
}

/** Una frase que resume el producto, para los buscadores y la vista previa. */
function resumenDe(producto: Producto): string {
  const ventajas = ventajasDe(producto.descripcion);
  const detalle = ventajas.length > 0 ? `${ventajas.join(". ")}. ` : "";
  return `${producto.nombre} en ${negocio.localidad}. ${detalle}Al detal y al mayor, a tasa BCV.`;
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { producto: segmento } = await params;
  const producto = await productoDe(segmento);
  if (!producto) return { title: "Producto", robots: { index: false } };
  const ruta = rutaProducto(producto);
  return {
    title: producto.nombre,
    description: resumenDe(producto),
    // Se llega con cualquier nombre detrás del número; la dirección buena es una.
    alternates: { canonical: ruta },
    openGraph: {
      type: "website",
      locale: "es_VE",
      siteName: negocio.nombre,
      title: `${producto.nombre} · ${negocio.nombre}`,
      description: resumenDe(producto),
      url: ruta,
    },
  };
}

/** El producto y su precio, como los entienden los buscadores. */
function datosDelProducto(producto: Producto): Record<string, unknown> {
  const ruta = direccionCompleta(rutaProducto(producto));
  const precios = [producto.precio_usd, producto.precio_mayor_usd].filter((p): p is number => p !== null);
  const oferta =
    precios.length === 0
      ? undefined
      : precios.length === 1
        ? { "@type": "Offer", price: precios[0], priceCurrency: "USD" }
        : {
            "@type": "AggregateOffer",
            lowPrice: Math.min(...precios),
            highPrice: Math.max(...precios),
            offerCount: precios.length,
            priceCurrency: "USD",
          };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    description: resumenDe(producto),
    image: `${ruta}/opengraph-image`,
    url: ruta,
    brand: { "@type": "Brand", name: negocio.nombre },
    offers: oferta && {
      ...oferta,
      availability: "https://schema.org/InStock",
      url: ruta,
      seller: datosDeLaTienda(),
    },
  };
}

/**
 * La página de un producto: a ella llevan «Ver detalles» y el nombre de
 * cada tarjeta de la portada. Dibujo grande, precios, ventajas, cómo se paga
 * y dónde se recoge, con el botón de pedir siempre a mano.
 */
export default async function PaginaProducto({ params }: Parametros) {
  const { producto: segmento } = await params;
  const producto = await productoDe(segmento);
  if (!producto) notFound();

  const [tasa, todos] = await Promise.all([leerTasa(), listarProductos(true)]);
  const ventajas = ventajasDe(producto.descripcion);
  const otros = todos.filter((p) => p.id !== producto.id);
  const nombre = producto.nombre.toLowerCase();
  const pedir = enlaceWhatsapp(`Hola, quiero pedir ${nombre}.`);
  const mayor = enlaceWhatsapp(`Hola, quiero comprar ${nombre} al mayor.`);
  const compartir = enlaceCompartir(
    `${producto.nombre} en ${negocio.nombre}: ${direccionCompleta(rutaProducto(producto))}`,
  );
  const mapa = enlaceMapa();

  return (
    <>
      <DatosEstructurados datos={datosDelProducto(producto)} />
      <CabeceraPublica />

      <main id="contenido" className={estilos.contenido}>
        <section className={estilos.seccion}>
          <Link href="/" className={estilos.volver}>
            ← Todos los productos
          </Link>

          <article className={estilos.ficha}>
            <header className={estilos.fichaCabecera}>
              <IlustracionProducto nombre={producto.nombre} className={estilos.dibujoGrande} />
              <h1 className={estilos.fichaNombre}>{producto.nombre}</h1>
              <p className={estilos.fichaUnidad}>Se vende por {nombreUnidad(producto.unidad)}, al detal y al mayor</p>
            </header>

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Precio de hoy</h2>
              <PreciosProducto producto={producto} tasa={tasa?.valor ?? null} />
              <LineaTasa tasa={tasa} className={estilos.tasa} />
              {pedir && (
                <a className={`boton boton--acento ${estilos.botonPedir}`} href={pedir} target="_blank" rel="noopener">
                  Pedir por WhatsApp
                </a>
              )}
              <a className={estilos.compartir} href={compartir} target="_blank" rel="noopener">
                Compartir este producto por WhatsApp
              </a>
            </div>

            {ventajas.length > 0 && (
              <div className={estilos.bloque}>
                <h2 className={estilos.bloqueTitulo}>Por qué elegirlo</h2>
                <ul className={estilos.ventajas}>
                  {ventajas.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Cómo comprar</h2>
              <dl className={estilos.datos}>
                <div>
                  <dt>Formas de pago</dt>
                  <dd>Pago móvil, transferencia, efectivo, Zelle o Binance. En bolívares, a la tasa del día.</dd>
                </div>
                {(negocio.direccion || negocio.ciudad) && (
                  <div>
                    <dt>Tienda física</dt>
                    <dd>
                      {[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}
                      {mapa && (
                        <>
                          {" · "}
                          <a href={mapa} target="_blank" rel="noopener">
                            Cómo llegar
                          </a>
                        </>
                      )}
                    </dd>
                  </div>
                )}
                {negocio.horario && (
                  <div>
                    <dt>Horario</dt>
                    <dd>{negocio.horario}</dd>
                  </div>
                )}
                {mayor && (
                  <div>
                    <dt>Al mayor</dt>
                    <dd>
                      <a href={mayor} target="_blank" rel="noopener">
                        Pide el precio según la cantidad
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {otros.length > 0 && (
              <div>
                <h2 className={estilos.subtitulo}>Otros productos</h2>
                <ul className={estilos.otros}>
                  {otros.map((p) => (
                    <li key={p.id}>
                      <Link href={rutaProducto(p)} className={estilos.otro}>
                        <IlustracionProducto nombre={p.nombre} />
                        {p.nombre}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </section>
      </main>

      <PiePublico />
    </>
  );
}
