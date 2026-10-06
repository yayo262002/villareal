import Link from "next/link";
import type { ReactNode } from "react";
import { enlaceWhatsapp } from "@/config/negocio";
import { nombreDeVenta, porQueSeCobra } from "@/lib/catalogo";
import { direccionDePortada, type Familia } from "@/lib/familias";
import { rutaProducto } from "@/lib/enlaces";
import { aBolivares, bs, fechaCorta, unidadEnPalabras, usd } from "@/lib/dinero";
import { claveDeOferta } from "@/lib/carrito";
import { fotoDeCombo } from "@/lib/fotos-referenciales";
import type { Oferta } from "@/lib/ofertas";
import type { MarcaDeVitrina, ProductoDeVitrina } from "@/lib/vitrina";
import { presentacionYContenido } from "@/lib/marcas-texto";
import { FotoDeProducto } from "@/components/foto-de-producto";
import { Icono } from "@/components/icono";
import { BotonAgregar } from "@/components/carrito/boton-agregar";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import estilos from "./vitrina.module.css";

/**
 * Las piezas de la vitrina pública: el título de cada sección con sus dos
 * rayas doradas, la tarjeta de un producto (su foto grande, el nombre, la
 * presentación, el precio al mayor en bolívares bien visible con los
 * dólares debajo, «Agregar» y «Ver detalles»), la tarjeta de una familia
 * con su foto, los atajos de la portada, la franja mayorista, la de
 * confianza y la llamada a quien monta su negocio. Primero el teléfono.
 * Ningún producto se enseña con un dibujo: con su foto, con una de
 * referencia o con el fondo del león.
 */

export function TituloDeSeccion({ children, id, antetitulo }: { children: ReactNode; id?: string; antetitulo?: string }) {
  return (
    <div className={estilos.cabezaSeccion}>
      {antetitulo && <p className={estilos.antetituloSeccion}>{antetitulo}</p>}
      <h2 id={id} className={estilos.tituloSeccion}>
        <span>{children}</span>
      </h2>
    </div>
  );
}

/** «kg», «cartón», «bolsa de 2,5 kg»: por qué se cobra, corto, para ir tras la barra del precio. */
function porCada(producto: ProductoDeVitrina["producto"]): string {
  return producto.unidad === "kg" ? "kg" : porQueSeCobra(producto);
}

/** El precio de una tarjeta: al mayor, en bolívares y grande; en dólares, debajo y pequeño. Sin precio no se inventa. */
function PrecioDeTarjeta({ item, tasa }: { item: ProductoDeVitrina; tasa: number | null }) {
  const { publicado, producto } = item;
  if (publicado.precio_usd === null) return <p className={estilos.precioPendiente}>Consulta el precio del día</p>;
  const enBs = aBolivares(publicado.precio_usd, tasa);
  const detal = item.variantes.length === 0 && producto.precio_detal_usd !== null ? producto.precio_detal_usd : null;
  const detalBs = detal !== null ? aBolivares(detal, tasa) : null;
  return (
    <div className={estilos.precio}>
      <p className={estilos.precioEtiqueta}>{publicado.desde ? "Al mayor, desde" : "Precio al mayor"}</p>
      <p className={estilos.precioPrincipal}>{enBs !== null ? bs(enBs) : usd(publicado.precio_usd)}</p>
      <p className={estilos.precioSecundario}>
        {enBs !== null ? `${usd(publicado.precio_usd)} / ${porCada(producto)}` : `por ${porQueSeCobra(producto)}`}
      </p>
      {detal !== null && <p className={estilos.precioSecundario}>Al detal: {detalBs !== null ? bs(detalBs) : usd(detal)}</p>}
    </div>
  );
}

/**
 * Bajo el nombre del tipo, lo secundario: cuántas marcas hay para elegir;
 * con una sola, su marca y su presentación («Guaralact · bolsa de 1 kg»);
 * sin marca, la presentación o cómo se vende.
 */
function detalleDe(item: ProductoDeVitrina): string {
  const { producto, variantes, marcas } = item;
  if (marcas.length >= 2) return `${marcas.length} marcas para elegir`;
  if (variantes.length >= 2) return `${variantes.length} presentaciones`;
  const unico = variantes[0];
  const presentacion = presentacionYContenido(unico ?? producto);
  const marca = marcas[0]?.nombre;
  if (marca) return [`Marca ${marca}`, presentacion].filter(Boolean).join(" · ");
  return presentacion ? `Presentación: ${presentacion}` : `Venta por ${unidadEnPalabras(producto.unidad)}`;
}

export function TarjetaDeProducto({ item, tasa, prioridad = false }: { item: ProductoDeVitrina; tasa: number | null; prioridad?: boolean }) {
  const { producto, variantes } = item;
  const ruta = rutaProducto(producto);
  const nombreParaElCarrito = variantes.length === 1 ? nombreDeVenta(producto.nombre, variantes[0].nombre) : producto.nombre;
  return (
    <li className={estilos.tarjeta}>
      <Link href={ruta} className={estilos.tarjetaImagen} tabIndex={-1} aria-hidden="true">
        <FotoDeProducto imagen={item.imagen} nombre={producto.nombre} className={estilos.tarjetaFoto} tamano={720} prioridad={prioridad} />
        {producto.en_oferta ? <span className={estilos.etiqueta}>Oferta</span> : null}
      </Link>
      <div className={estilos.tarjetaCuerpo}>
        <h3 className={estilos.tarjetaNombre}>
          <Link href={ruta}>{producto.nombre}</Link>
        </h3>
        <p className={estilos.tarjetaDetalle}>{detalleDe(item)}</p>
        <PrecioDeTarjeta item={item} tasa={tasa} />
        <div className={estilos.tarjetaAcciones}>
          {item.clave ? (
            <BotonAgregar clave={item.clave} nombre={nombreParaElCarrito} unidad={producto.unidad} className={estilos.agregar} />
          ) : (
            <Link href={`${ruta}#marcas`} className={`boton ${estilos.botonOpciones}`} aria-label={`Ver las ${variantes.length} opciones de ${producto.nombre}`}>
              Ver opciones
            </Link>
          )}
          <Link href={ruta} className={estilos.verDetalles}>
            Ver detalles
          </Link>
        </div>
      </div>
    </li>
  );
}

export function RejillaDeProductos({ items, tasa }: { items: ProductoDeVitrina[]; tasa: number | null }) {
  return (
    <ul className={estilos.rejillaProductos}>
      {items.map((item, i) => (
        <TarjetaDeProducto key={item.producto.id} item={item} tasa={tasa} prioridad={i < 2} />
      ))}
    </ul>
  );
}

/**
 * Los tipos de una familia por secciones: «Quesos», «Proteínas», «Salsas
 * y aderezos»… Una sección sin título (los propios de la familia) va sin
 * encabezado.
 */
export function SeccionesDeProductos({ secciones, tasa }: { secciones: { titulo: string; items: ProductoDeVitrina[] }[]; tasa: number | null }) {
  return (
    <div className={estilos.secciones}>
      {secciones.map((s) => (
        <section key={s.titulo || "-"} className={estilos.seccionDeFamilia} aria-label={s.titulo || undefined}>
          {s.titulo && (
            <h2 className={estilos.tituloDeSeccion}>
              {s.titulo}
              <span>{s.items.length === 1 ? "1 producto" : `${s.items.length} productos`}</span>
            </h2>
          )}
          <RejillaDeProductos items={s.items} tasa={tasa} />
        </section>
      ))}
    </div>
  );
}

/**
 * «Filtrar por marca»: casillas con las marcas de lo que se ve, y el
 * botón. Va y vuelve sin JavaScript (`?marca=guaralact`); el cliente busca
 * primero lo que necesita y después elige la marca. Con una sola marca no
 * hace falta.
 */
export function FiltroDeMarcas({
  marcas,
  elegidas,
  accion,
  conservar = {},
  desde = 2,
}: {
  marcas: MarcaDeVitrina[];
  elegidas: string[];
  /** La página a la que vuelve el filtro. */
  accion: string;
  /** Lo demás de la dirección que se mantiene (la búsqueda, por ejemplo). */
  conservar?: Record<string, string>;
  /** Cuántas marcas hacen falta para que valga la pena filtrar. */
  desde?: number;
}) {
  if (marcas.length < desde) return null;
  const sinFiltro = Object.keys(conservar).length > 0 ? `${accion}?${new URLSearchParams(conservar).toString()}` : accion;
  return (
    <form action={accion} method="get" className={estilos.filtroMarcas} aria-label="Filtrar por marca">
      {Object.entries(conservar).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <p className={estilos.filtroTitulo}>Filtrar por marca</p>
      <div className={estilos.filtroOpciones}>
        {marcas.map((m) => (
          <label key={m.slug} className={estilos.filtroOpcion}>
            <input type="checkbox" name="marca" value={m.slug} defaultChecked={elegidas.includes(m.slug)} />
            <span>{m.nombre}</span>
          </label>
        ))}
      </div>
      <div className={estilos.filtroAcciones}>
        <button type="submit" className="boton">
          Filtrar
        </button>
        {elegidas.length > 0 && (
          <Link href={sinFiltro} className={estilos.verDetalles}>
            Ver todas las marcas
          </Link>
        )}
      </div>
    </form>
  );
}

/** La tarjeta de una familia (o de una colección): su foto a todo el ancho, con el nombre encima, todas con el mismo velo. */
export function TarjetaDeFamilia({ familia, conDescripcion = false }: { familia: Familia; conDescripcion?: boolean }) {
  const portada = direccionDePortada(familia);
  return (
    <li>
      <Link href={`/categoria/${familia.slug}`} className={estilos.familia}>
        {portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portada} alt="" width={640} height={480} loading="lazy" decoding="async" className={estilos.familiaFoto} />
        ) : (
          <span className={estilos.familiaSinFoto} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/leon.svg" alt="" width={33} height={52} />
          </span>
        )}
        <span className={estilos.familiaTexto}>
          <span className={estilos.familiaNombre}>{familia.nombre}</span>
          {conDescripcion && familia.descripcion && <span className={estilos.familiaDescripcion}>{familia.descripcion}</span>}
          <span className={estilos.familiaVer}>
            Ver productos
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Las familias de productos para comprar por categoría; `compacta`, cuatro por fila. */
export function RejillaDeFamilias({ familias, compacta = false }: { familias: Familia[]; compacta?: boolean }) {
  return (
    <ul className={`${estilos.rejillaFamilias} ${compacta ? estilos["rejillaFamilias--compacta"] : ""}`}>
      {familias.map((f) => (
        <TarjetaDeFamilia key={f.id} familia={f} />
      ))}
    </ul>
  );
}

/** Las colecciones por tipo de negocio («¿Qué necesitas para tu negocio?»): Burger, Pizzería…, cada una con para quién es. */
export function RejillaDeColecciones({ colecciones }: { colecciones: Familia[] }) {
  return (
    <ul className={estilos.rejillaColecciones}>
      {colecciones.map((f) => (
        <TarjetaDeFamilia key={f.id} familia={f} conDescripcion />
      ))}
    </ul>
  );
}

/** Para ir de una familia a otra: «Todos» y las que tienen productos. */
export function ChipsDeFamilias({ familias, actual }: { familias: Familia[]; actual: string | null }) {
  return (
    <nav className={estilos.chips} aria-label="Familias">
      <Link href="/productos" aria-current={actual === null ? "page" : undefined}>
        Todos
      </Link>
      {familias.map((f) => (
        <Link key={f.id} href={`/categoria/${f.slug}`} aria-current={actual === f.slug ? "page" : undefined}>
          <Icono nombre={f.icono} className={estilos.chipIcono} />
          {f.nombre}
        </Link>
      ))}
    </nav>
  );
}

export type Atajo = { texto: string; ruta: string; foto: string | null };

/** Los atajos de la portada: cada uno con una foto pequeña y redonda de lo suyo, y su enlace. */
export function AtajosDeCategorias({ atajos, className }: { atajos: Atajo[]; className?: string }) {
  return (
    <nav className={`${estilos.atajos} ${className ?? ""}`} aria-label="Categorías">
      {atajos.map((a) => (
        <Link key={a.ruta} href={a.ruta}>
          {a.foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.foto} alt="" width={64} height={64} loading="lazy" decoding="async" />
          )}
          {a.texto}
        </Link>
      ))}
    </nav>
  );
}

/** La franja dorada que dice a quién le vende Villa Real: al mayor, a negocios de burger y pizza. */
/** Una línea discreta bajo la portada: el mensaje mayorista, sin cubrir la página de dorado. */
export function FranjaMayorista() {
  return (
    <section className={estilos.mayorista} aria-label="Precios al mayor">
      <ul className={estilos.mayoristaLemas}>
        <li>Precios al mayor</li>
        <li>Compra más, paga menos</li>
        <li>Tu proveedor para burger &amp; pizza</li>
      </ul>
      <p className={estilos.mayoristaProductos}>Quesos · Embutidos · Salsas · Papas · Huevos · Lácteos · Bebidas</p>
    </section>
  );
}

const CONFIANZA = [
  { icono: "etiqueta", texto: "Precios especiales por volumen" },
  { icono: "camion", texto: "Entregas y distribución en Barquisimeto" },
  { icono: "escudo", texto: "Productos de alta calidad" },
  { icono: "manos", texto: "Tu proveedor de confianza" },
] as const;

const DIBUJOS_DE_CONFIANZA: Record<(typeof CONFIANZA)[number]["icono"], string> = {
  etiqueta: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="8" cy="8" r="1.6"/>',
  camion: '<path d="M2 6h11v10H2Z"/><path d="M13 9h4l3 3v4h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  manos: '<path d="m11 17 2 2a1.4 1.4 0 0 0 2-2"/><path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3-3"/><path d="M8 13 3 8l4-4 4 4h3l3-3 4 4-4 4"/><path d="m11 12-2 2"/>',
};

/** Las cuatro cosas que el negocio quiere que se sepan, en tarjetas claras con su icono dorado. */
export function FranjaDeConfianza() {
  return (
    <ul className={estilos.confianza}>
      {CONFIANZA.map((c) => (
        <li key={c.texto}>
          <span className={estilos.confianzaIcono}>
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: DIBUJOS_DE_CONFIANZA[c.icono] }}
            />
          </span>
          <span>{c.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** «¿Estás montando tu negocio?»: la llamada a quien abre una hamburguesería, una pizzería o un restaurante, con sus fotos. */
export function MontandoTuNegocio() {
  const whatsapp = enlaceWhatsapp("Hola, estoy montando mi negocio y quiero saber qué productos tienen.");
  if (!whatsapp) return null;
  return (
    <section className={estilos.montando} aria-labelledby="titulo-montando">
      <div className={estilos.montandoFotos} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/familias/burger.webp" alt="" width={640} height={480} loading="lazy" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/familias/pizzeria.webp" alt="" width={640} height={480} loading="lazy" decoding="async" />
      </div>
      <div className={estilos.montandoTexto}>
        <h2 id="titulo-montando" className={estilos.montandoTitulo}>
          ¿Estás montando tu negocio?
        </h2>
        <p>Te ayudamos a conseguir los productos que necesitas para:</p>
        <ul className={estilos.montandoLista}>
          {["Hamburgueserías", "Pizzerías", "Restaurantes", "Emprendedores"].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <a className={`boton ${estilos.botonWhatsapp}`} href={whatsapp} target="_blank" rel="noopener">
          <IconoWhatsapp tamano={22} />
          Contactar por WhatsApp
        </a>
      </div>
    </section>
  );
}

/** El cuerpo de una página de la vitrina: a lo ancho de la web, con aire entre secciones. */
export function PaginaDeVitrina({ children }: { children: ReactNode }) {
  return (
    <main id="contenido" className={estilos.pagina}>
      {children}
    </main>
  );
}

/** El título de una página (Productos, Ofertas), con su entradilla y lo que se quiera debajo. */
export function EncabezadoDePagina({ titulo, id, entradilla, children }: { titulo: string; id?: string; entradilla?: ReactNode; children?: ReactNode }) {
  return (
    <header className={estilos.encabezado}>
      <h1 id={id} className={estilos.tituloPagina}>
        {titulo}
      </h1>
      {entradilla && <p className={estilos.entradilla}>{entradilla}</p>}
      {children}
    </header>
  );
}

/** La cabecera de una familia: su portada de fondo, su nombre y su descripción. */
export function CabeceraDeFamilia({ familia, cuantos, children }: { familia: Familia; cuantos: number; children?: ReactNode }) {
  const portada = direccionDePortada(familia);
  return (
    <header className={estilos.cabeceraFamilia}>
      {portada && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portada} alt="" width={960} height={720} className={estilos.cabeceraFamiliaFoto} fetchPriority="high" />
      )}
      <div className={estilos.cabeceraFamiliaTexto}>
        <p className={estilos.antetitulo}>
          <Icono nombre={familia.icono} className={estilos.chipIcono} />
          Categoría
        </p>
        <h1 id="titulo-familia" className={estilos.cabeceraFamiliaNombre}>
          {familia.nombre}
        </h1>
        {familia.descripcion && <p className={estilos.cabeceraFamiliaDescripcion}>{familia.descripcion}</p>}
        {cuantos > 0 && <p className={estilos.cabeceraFamiliaCuenta}>{cuantos === 1 ? "1 producto" : `${cuantos} productos`}</p>}
        {children}
      </div>
    </header>
  );
}

/** Lo que se dice bajo los precios: en qué moneda están, cómo se puede pagar y, si hace falta, que las fotos son de referencia. */
export function NotaDePrecios({ hayTasa, items = [] }: { hayTasa: boolean; items?: ProductoDeVitrina[] }) {
  const conReferencia = items.some((i) => i.imagen?.referencial);
  return (
    <p className={estilos.notaPrecios}>
      {hayTasa
        ? "Precios al mayor en bolívares a la tasa BCV del día, con su equivalente en dólares. También puedes pagar en dólares, Zelle o Binance."
        : "Precios al mayor en dólares. Puedes pagar en bolívares a la tasa del día por pago móvil, transferencia o efectivo."}
      {conReferencia && " Las fotos de algunos productos son referenciales."}
    </p>
  );
}

/**
 * Un combo u oferta: su foto, qué lleva (cada producto publicado con su
 * enlace), su precio si lo tiene, hasta cuándo vale, «Agregar» al carrito y
 * pedirlo solo por WhatsApp. Sin precio, «Consulta el precio del combo».
 */
export function TarjetaDeOferta({ oferta, tasa, rutas }: { oferta: Oferta; tasa: number | null; rutas: Map<number, string> }) {
  const enBs = oferta.precio_usd !== null ? aBolivares(oferta.precio_usd, tasa) : null;
  const pedir = enlaceWhatsapp(`Hola, quiero el combo ${oferta.nombre}${oferta.precio_usd !== null ? ` (${usd(oferta.precio_usd)})` : ""}. ¿Me confirman disponibilidad?`);
  return (
    <li id={`oferta-${oferta.id}`} className={estilos.oferta}>
      <div className={estilos.ofertaFoto}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fotoDeCombo(oferta.nombre)} alt="" width={640} height={480} loading="lazy" decoding="async" />
        <span className={estilos.etiquetaCombo}>Combo</span>
      </div>
      <div className={estilos.ofertaCuerpo}>
        <div className={estilos.ofertaCabecera}>
          <h3 className={estilos.ofertaNombre}>{oferta.nombre}</h3>
          {oferta.descripcion && <p className={estilos.ofertaDescripcion}>{oferta.descripcion}</p>}
        </div>
        {oferta.productos.length > 0 && (
          <ul className={estilos.ofertaLleva} aria-label="Lo que lleva">
            {oferta.productos.map((p) => {
              const ruta = rutas.get(p.producto_id);
              return (
                <li key={p.producto_id}>
                  {p.cantidad && <strong>{p.cantidad} </strong>}
                  {ruta ? <Link href={ruta}>{p.nombre}</Link> : p.nombre}
                </li>
              );
            })}
          </ul>
        )}
        <div className={estilos.ofertaPie}>
          {oferta.precio_usd === null ? (
            <p className={estilos.precioPendiente}>Consulta el precio del combo</p>
          ) : (
            <div className={estilos.precio}>
              <p className={estilos.precioEtiqueta}>Precio del combo</p>
              <p className={estilos.precioPrincipal}>{enBs !== null ? bs(enBs) : usd(oferta.precio_usd)}</p>
              <p className={estilos.precioSecundario}>{enBs !== null ? `${usd(oferta.precio_usd)} el combo` : "el combo"}</p>
            </div>
          )}
          {oferta.hasta && <p className={estilos.precioSecundario}>Hasta el {fechaCorta(oferta.hasta)}</p>}
          <div className={estilos.tarjetaAcciones}>
            <BotonAgregar clave={claveDeOferta(oferta.id)} nombre={oferta.nombre} unidad="combo" className={estilos.agregar} />
            {pedir && (
              <a href={pedir} target="_blank" rel="noopener" className={estilos.verDetalles}>
                Pedir este combo por WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function RejillaDeOfertas({ ofertas, tasa, rutas }: { ofertas: Oferta[]; tasa: number | null; rutas: Map<number, string> }) {
  return (
    <ul className={estilos.rejillaOfertas}>
      {ofertas.map((o) => (
        <TarjetaDeOferta key={o.id} oferta={o} tasa={tasa} rutas={rutas} />
      ))}
    </ul>
  );
}

/** Cuando una familia o una búsqueda no tienen nada: se dice, y se ofrece preguntar por WhatsApp. */
export function SinProductos({ texto, pregunta }: { texto: string; pregunta: string }) {
  const whatsapp = enlaceWhatsapp(pregunta);
  return (
    <div className={estilos.sinProductos}>
      <p>{texto}</p>
      {whatsapp && (
        <a className={`boton ${estilos.botonWhatsapp}`} href={whatsapp} target="_blank" rel="noopener">
          <IconoWhatsapp />
          Preguntar por WhatsApp
        </a>
      )}
      <Link href="/productos">Ver todos los productos</Link>
    </div>
  );
}
