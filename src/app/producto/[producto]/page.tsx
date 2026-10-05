import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { direccionCompleta, enlaceCompartir, enlaceWhatsapp, negocio } from "@/config/negocio";
import { buscarProducto, direccionDeFotoDeProducto, type Producto } from "@/lib/productos";
import { direccionDeFotoDeVariante, variantesDeProducto, type Variante } from "@/lib/variantes";
import { claveDe, nombreDeVenta, porQueSeCobra, precioPublicado, type PrecioPublicado } from "@/lib/catalogo";
import { contarResenasPorVariante, resenasDeProducto } from "@/lib/resenas";
import { haySesion } from "@/lib/sesion";
import { idDeRuta, rutaProducto, rutaVariante } from "@/lib/enlaces";
import { vitrina } from "@/lib/vitrina";
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
import { ComoComprar } from "@/components/como-comprar";
import { BotonAgregar } from "@/components/carrito/boton-agregar";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import { RejillaDeProductos, TituloDeSeccion } from "@/components/vitrina";
import estilos from "../../page.module.css";

type Parametros = { params: Promise<{ producto: string }> };

/** Cuántos productos de la misma familia se enseñan debajo. */
const RELACIONADOS = 4;

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
  return `${producto.nombre} en ${negocio.localidad}. ${detalle}Al mayor, a tasa BCV.`;
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
    brand: { "@type": "Brand", name: producto.marca || negocio.nombre },
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
 * cada tarjeta. Su foto (o su dibujo), el precio de hoy con «Agregar al
 * carrito» y el pedido directo por WhatsApp, por qué elegirlo (lo que dicen
 * los negocios que lo compran y sus ventajas), cómo se paga y dónde se
 * recoge, y otros de su familia. Si tiene marcas, cada una con su foto, su
 * precio y su «Agregar» lleva a su propia página, con su descripción y sus
 * reseñas.
 *
 * Las reseñas de ejemplo solo se enseñan al dueño, con la sesión del panel
 * abierta: al público, nunca.
 */
export default async function PaginaProducto({ params }: Parametros) {
  const { producto: segmento } = await params;
  const producto = await productoDe(segmento);
  if (!producto) notFound();

  const esElDueno = await haySesion();
  const [v, resenas, variantes, resenasPorMarca] = await Promise.all([
    vitrina(),
    resenasDeProducto(producto.id, esElDueno),
    variantesDeProducto(producto.id, true),
    contarResenasPorVariante(producto.id, esElDueno),
  ]);
  const tasa = v.tasa;
  const publicado = precioPublicado(producto, variantes);
  const ventajas = ventajasDe(producto.descripcion);
  const foto = direccionDeFotoDeProducto(producto);
  const familia = v.todasLasFamilias.find((f) => f.id === producto.familia_id) ?? null;
  // Debajo, otros de sus familias; si no hay, otros cualquiera.
  const suyas = v.productos.find((p) => p.producto.id === producto.id)?.familias ?? [];
  const demas = v.productos.filter((p) => p.producto.id !== producto.id);
  const deSuFamilia = demas.filter((p) => p.familias.some((f) => suyas.includes(f)));
  const relacionados = (deSuFamilia.length > 0 ? deSuFamilia : demas).slice(0, RELACIONADOS);
  const nombre = producto.nombre.toLowerCase();
  const pedir = enlaceWhatsapp(`Hola, quiero pedir ${nombre}.`);
  const mayor = enlaceWhatsapp(`Hola, quiero comprar ${nombre} al mayor.`);
  const compartir = enlaceCompartir(`${producto.nombre} en ${negocio.nombre}: ${direccionCompleta(rutaProducto(producto))}`);
  const sinMarcas = variantes.length === 0;
  const detal = sinMarcas ? producto.precio_detal_usd : null;

  return (
    <>
      <DatosEstructurados datos={datosDelProducto(producto, publicado, variantes)} />
      <CabeceraPublica actual="productos" />

      <main id="contenido" className={estilos.contenido}>
        <nav className={estilos.migas} aria-label="Estás en">
          <Link href="/">Inicio</Link>
          <Link href="/productos">Productos</Link>
          {familia && familia.activa === 1 && <Link href={`/categoria/${familia.slug}`}>{familia.nombre}</Link>}
          <span aria-current="page">{producto.nombre}</span>
        </nav>

        <article className={estilos.ficha}>
          <header className={estilos.fichaCabecera}>
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={producto.nombre} width={800} height={800} className={estilos.fotoGrande} />
            ) : (
              <IlustracionProducto nombre={producto.nombre} className={estilos.dibujoGrande} />
            )}
          </header>

          <div className={estilos.fichaPrincipal}>
            <h1 className={estilos.fichaNombre}>{producto.nombre}</h1>
            <p className={estilos.fichaUnidad}>
              {detal !== null ? "Al mayor y al detal" : "Al mayor"}, por {sinMarcas ? porQueSeCobra(producto) : porQueSeCobra({ ...producto, presentacion: "", contenido: "" })}
              {sinMarcas && producto.marca && ` · Marca ${producto.marca}`}
              {variantes.length >= 2 && ` · ${variantes.length} marcas o presentaciones`}
            </p>

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Precio de hoy</h2>
              <PreciosProducto
                producto={
                  sinMarcas
                    ? { ...publicado, unidad: producto.unidad, presentacion: producto.presentacion, contenido: producto.contenido, precio_detal_usd: detal }
                    : { ...publicado, unidad: producto.unidad }
                }
                tasa={tasa?.valor ?? null}
                desde={publicado.desde}
              />
              <LineaTasa tasa={tasa} className={estilos.tasa} />
              {sinMarcas ? (
                <>
                  <BotonAgregar clave={claveDe(producto.id, null)} nombre={producto.nombre} unidad={producto.unidad} conCantidad />
                  {pedir && (
                    <a className={`boton ${estilos.botonWhatsapp} ${estilos.botonPedir}`} href={pedir} target="_blank" rel="noopener">
                      <IconoWhatsapp />
                      Pedir por WhatsApp
                    </a>
                  )}
                </>
              ) : (
                // Se pide desde la marca elegida, más abajo: así el pedido dice cuál es.
                <a className={`boton boton--acento ${estilos.botonPedir}`} href="#marcas">
                  Elige la marca para pedir ↓
                </a>
              )}
              <a className={estilos.compartir} href={compartir} target="_blank" rel="noopener">
                Compartir este producto por WhatsApp
              </a>
            </div>
          </div>

          {/* Las marcas o presentaciones en que se vende, cada una con su foto, su precio y su propia página. */}
          {variantes.length > 0 && (
            <section className={`${estilos.bloque} ${estilos.fichaAncha}`} id="marcas" aria-labelledby="titulo-marcas">
              <h2 id="titulo-marcas" className={estilos.bloqueTitulo}>
                Marcas y presentaciones
              </h2>
              <ul className={estilos.variantes}>
                {variantes.map((m) => {
                  const suFoto = direccionDeFotoDeVariante(m);
                  const ruta = rutaVariante(producto, m);
                  const primera = ventajasDe(m.descripcion)[0];
                  const cuantas = resenasPorMarca.get(m.id) ?? 0;
                  const pedirEsta = enlaceWhatsapp(`Hola, quiero pedir ${nombre} ${m.nombre.toLowerCase()}.`);
                  return (
                    <li key={m.id} className={estilos.variante}>
                      <Link href={ruta} className={estilos.varianteEnlace} aria-label={`Ver ${producto.nombre} ${m.nombre}`}>
                        {suFoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={suFoto} alt={`${producto.nombre} ${m.nombre}`} width={800} height={800} className={estilos.varianteFoto} loading="lazy" />
                        ) : (
                          <IlustracionProducto nombre={producto.nombre} className={estilos.varianteDibujo} />
                        )}
                      </Link>
                      <div className={estilos.varianteTexto}>
                        <h3 className={estilos.varianteNombre}>
                          <Link href={ruta}>{m.nombre}</Link>
                        </h3>
                        {primera && <p className={estilos.varianteDetalle}>{primera}</p>}
                        {cuantas > 0 && <p className={estilos.varianteDetalle}>{cuantas === 1 ? "1 reseña" : `${cuantas} reseñas`}</p>}
                        <PreciosEnLinea precios={m} unidad={producto.unidad} tasa={tasa?.valor ?? null} />
                        <div className={estilos.varianteAcciones}>
                          <BotonAgregar clave={claveDe(producto.id, m.id)} nombre={nombreDeVenta(producto.nombre, m.nombre)} unidad={producto.unidad} />
                          {pedirEsta && (
                            <a className={estilos.varianteEnlaceTexto} href={pedirEsta} target="_blank" rel="noopener" aria-label={`Pedir ${m.nombre} por WhatsApp`}>
                              Pedir por WhatsApp
                            </a>
                          )}
                          <Link href={ruta} className={estilos.varianteEnlaceTexto}>
                            Ver detalles
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(resenas.length > 0 || ventajas.length > 0) && (
            <section className={`${estilos.bloque} ${estilos.fichaAncha}`} aria-labelledby="titulo-por-que">
              <h2 id="titulo-por-que" className={estilos.bloqueTitulo}>
                Por qué elegirlo
              </h2>
              {resenas.some((r) => r.de_ejemplo) && <AvisoDeEjemplos />}
              <ListaDeResenas resenas={resenas} />
              {ventajas.length > 0 && (
                <ul className={estilos.ventajas}>
                  {ventajas.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className={estilos.fichaAncha}>
            <ComoComprar mayor={mayor} />
          </div>
        </article>

        {relacionados.length > 0 && (
          <section className={estilos.relacionados} aria-labelledby="titulo-relacionados">
            <TituloDeSeccion id="titulo-relacionados">{deSuFamilia.length > 0 ? "De la misma familia" : "Otros productos"}</TituloDeSeccion>
            <RejillaDeProductos items={relacionados} tasa={tasa?.valor ?? null} />
          </section>
        )}
      </main>

      <PiePublico />
    </>
  );
}
