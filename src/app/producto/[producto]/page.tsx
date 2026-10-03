import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { direccionCompleta, enlaceCompartir, enlaceMapa, enlaceWhatsapp, negocio } from "@/config/negocio";
import { buscarProducto, listarProductos, type Producto } from "@/lib/productos";
import { direccionDeFotoDeVariante, variantesDeProducto, type Variante } from "@/lib/variantes";
import { precioPublicado, type PrecioPublicado } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { resenasDeProducto } from "@/lib/resenas";
import { haySesion } from "@/lib/sesion";
import { unidadEnPalabras } from "@/lib/dinero";
import { idDeRuta, rutaProducto } from "@/lib/enlaces";
import {
  CabeceraPublica,
  DatosEstructurados,
  LineaTasa,
  PiePublico,
  PreciosEnLinea,
  PreciosProducto,
  datosDeLaTienda,
  ventajasDe,
} from "@/components/publico";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import { AvisoDeEjemplos, ListaDeResenas } from "@/components/resenas";
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
  return `${producto.nombre} en ${negocio.localidad}. ${detalle}Solo al mayor, a tasa BCV.`;
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

/** El producto y su precio, como los entienden los buscadores. Con marcas, los precios de todas. */
function datosDelProducto(producto: Producto, publicado: PrecioPublicado, variantes: Variante[]): Record<string, unknown> {
  const ruta = direccionCompleta(rutaProducto(producto));
  const conPrecios = variantes.length > 0 ? variantes : [publicado];
  const precios = conPrecios.map((v) => v.precio_usd).filter((p): p is number => p !== null);
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
 * cada tarjeta de la portada. Dibujo grande, precios, por qué elegirlo (lo
 * que dicen los negocios que lo compran y sus ventajas), cómo se paga y
 * dónde se recoge, con el botón de pedir siempre a mano.
 *
 * Las reseñas de ejemplo solo se enseñan al dueño, con la sesión del panel
 * abierta: al público, nunca.
 */
export default async function PaginaProducto({ params }: Parametros) {
  const { producto: segmento } = await params;
  const producto = await productoDe(segmento);
  if (!producto) notFound();

  const esElDueno = await haySesion();
  const [tasa, todos, resenas, variantes] = await Promise.all([
    leerTasa(),
    listarProductos(true),
    resenasDeProducto(producto.id, esElDueno),
    variantesDeProducto(producto.id, true),
  ]);
  const publicado = precioPublicado(producto, variantes);
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
      <DatosEstructurados datos={datosDelProducto(producto, publicado, variantes)} />
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
              <p className={estilos.fichaUnidad}>
                Solo al mayor, por {unidadEnPalabras(producto.unidad)}
                {variantes.length >= 2 && ` · ${variantes.length} marcas o presentaciones`}
              </p>
            </header>

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Precio de hoy</h2>
              <PreciosProducto producto={{ ...publicado, unidad: producto.unidad }} tasa={tasa?.valor ?? null} desde={publicado.desde} />
              <LineaTasa tasa={tasa} className={estilos.tasa} />
              {variantes.length > 0 ? (
                // Se pide desde la marca elegida, más abajo: así el mensaje dice cuál es.
                <a className={`boton boton--secundario ${estilos.botonPedir}`} href="#marcas">
                  Elige la marca para pedir ↓
                </a>
              ) : (
                pedir && (
                  <a className={`boton boton--acento ${estilos.botonPedir}`} href={pedir} target="_blank" rel="noopener">
                    Pedir por WhatsApp
                  </a>
                )
              )}
              <a className={estilos.compartir} href={compartir} target="_blank" rel="noopener">
                Compartir este producto por WhatsApp
              </a>
            </div>

            {/* Las marcas o presentaciones en que se vende, cada una con su foto y su precio. */}
            {variantes.length > 0 && (
              <div className={estilos.bloque} id="marcas">
                <h2 className={estilos.bloqueTitulo}>Marcas y presentaciones</h2>
                <ul className={estilos.variantes}>
                  {variantes.map((v) => {
                    const foto = direccionDeFotoDeVariante(v);
                    const pedirEsta = enlaceWhatsapp(`Hola, quiero pedir ${nombre} ${v.nombre.toLowerCase()}.`);
                    return (
                      <li key={v.id} className={estilos.variante}>
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={foto} alt={`${producto.nombre} ${v.nombre}`} width={800} height={800} className={estilos.varianteFoto} loading="lazy" />
                        ) : (
                          <IlustracionProducto nombre={producto.nombre} className={estilos.varianteDibujo} />
                        )}
                        <div className={estilos.varianteTexto}>
                          <h3 className={estilos.varianteNombre}>{v.nombre}</h3>
                          {v.descripcion && <p className={estilos.varianteDetalle}>{v.descripcion}</p>}
                          <PreciosEnLinea precios={v} unidad={producto.unidad} tasa={tasa?.valor ?? null} />
                          {pedirEsta && (
                            <a className={`boton ${estilos.varianteBoton}`} href={pedirEsta} target="_blank" rel="noopener" aria-label={`Pedir ${v.nombre}`}>
                              Pedir
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {(resenas.length > 0 || ventajas.length > 0) && (
              <div className={estilos.bloque}>
                <h2 className={estilos.bloqueTitulo}>Por qué elegirlo</h2>
                {resenas.some((r) => r.de_ejemplo) && <AvisoDeEjemplos />}
                <ListaDeResenas resenas={resenas} />
                {ventajas.length > 0 && (
                  <ul className={estilos.ventajas}>
                    {ventajas.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                )}
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
