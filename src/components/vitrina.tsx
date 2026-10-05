import Link from "next/link";
import type { ReactNode } from "react";
import { enlaceWhatsapp } from "@/config/negocio";
import { nombreDeVenta, porQueSeCobra, presentacionDe } from "@/lib/catalogo";
import { direccionDePortada, type Familia } from "@/lib/familias";
import { rutaProducto } from "@/lib/enlaces";
import { aBolivares, bs, fechaCorta, usd } from "@/lib/dinero";
import { claveDeOferta } from "@/lib/carrito";
import type { Oferta } from "@/lib/ofertas";
import type { ProductoDeVitrina } from "@/lib/vitrina";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import { Icono } from "@/components/icono";
import { BotonAgregar } from "@/components/carrito/boton-agregar";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import estilos from "./vitrina.module.css";

/**
 * Las piezas de la vitrina pública: el título de cada sección con sus dos
 * rayas doradas, la tarjeta de un producto (foto, nombre, precio en
 * bolívares con su equivalente en dólares, «Agregar» y «Ver detalles»),
 * la tarjeta de una familia, la franja de confianza y la llamada a quien
 * está montando su negocio. Pensadas para el teléfono primero.
 */

export function TituloDeSeccion({ children, id, claro = false }: { children: ReactNode; id?: string; claro?: boolean }) {
  return (
    <h2 id={id} className={`${estilos.tituloSeccion} ${claro ? estilos.tituloClaro : ""}`}>
      <span>{children}</span>
    </h2>
  );
}

/** El precio de una tarjeta: en bolívares grande y en dólares debajo, «por kilo» o por su presentación. Sin precio no se inventa. */
function PrecioDeTarjeta({ item, tasa }: { item: ProductoDeVitrina; tasa: number | null }) {
  const { publicado, producto } = item;
  if (publicado.precio_usd === null) return <p className={estilos.precioPendiente}>Consulta el precio del día</p>;
  const enBs = aBolivares(publicado.precio_usd, tasa);
  const detal = item.variantes.length === 0 && producto.precio_detal_usd !== null ? producto.precio_detal_usd : null;
  const detalBs = detal !== null ? aBolivares(detal, tasa) : null;
  return (
    <div className={estilos.precio}>
      <p className={estilos.precioPrincipal}>
        {publicado.desde && <span className={estilos.desde}>desde </span>}
        {enBs !== null ? bs(enBs) : usd(publicado.precio_usd)}
      </p>
      <p className={estilos.precioSecundario}>
        {enBs !== null ? `${usd(publicado.precio_usd)} ` : ""}por {porQueSeCobra(producto)} · al mayor
      </p>
      {detal !== null && <p className={estilos.precioSecundario}>Al detal: {detalBs !== null ? bs(detalBs) : usd(detal)}</p>}
    </div>
  );
}

export function TarjetaDeProducto({ item, tasa }: { item: ProductoDeVitrina; tasa: number | null }) {
  const { producto, variantes } = item;
  const ruta = rutaProducto(producto);
  const detalle = variantes.length >= 2 ? `${variantes.length} marcas o presentaciones` : presentacionDe(producto);
  const nombreParaElCarrito = variantes.length === 1 ? nombreDeVenta(producto.nombre, variantes[0].nombre) : producto.nombre;
  return (
    <li className={estilos.tarjeta}>
      <Link href={ruta} className={estilos.tarjetaImagen} tabIndex={-1} aria-hidden="true">
        {item.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.foto} alt="" width={400} height={400} loading="lazy" className={estilos.tarjetaFoto} />
        ) : (
          <IlustracionProducto nombre={producto.nombre} className={estilos.tarjetaDibujo} />
        )}
        {producto.en_oferta ? <span className={estilos.etiqueta}>Oferta</span> : null}
      </Link>
      <div className={estilos.tarjetaCuerpo}>
        <h3 className={estilos.tarjetaNombre}>
          <Link href={ruta}>{producto.nombre}</Link>
        </h3>
        {detalle && <p className={estilos.tarjetaDetalle}>{detalle}</p>}
        <PrecioDeTarjeta item={item} tasa={tasa} />
        <div className={estilos.tarjetaAcciones}>
          {item.clave ? (
            <BotonAgregar clave={item.clave} nombre={nombreParaElCarrito} unidad={producto.unidad} />
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
      {items.map((item) => (
        <TarjetaDeProducto key={item.producto.id} item={item} tasa={tasa} />
      ))}
    </ul>
  );
}

export function TarjetaDeFamilia({ familia }: { familia: Familia }) {
  const portada = direccionDePortada(familia);
  return (
    <li>
      <Link href={`/categoria/${familia.slug}`} className={estilos.familia}>
        <span className={estilos.familiaImagen}>
          {portada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portada} alt="" width={320} height={240} loading="lazy" />
          ) : (
            <Icono nombre={familia.icono} className={estilos.familiaIcono} />
          )}
        </span>
        <span className={estilos.familiaNombre}>
          {familia.nombre}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M10.5 8.5 14 12l-3.5 3.5" />
          </svg>
        </span>
      </Link>
    </li>
  );
}

export function RejillaDeFamilias({ familias }: { familias: Familia[] }) {
  return (
    <ul className={estilos.rejillaFamilias}>
      {familias.map((f) => (
        <TarjetaDeFamilia key={f.id} familia={f} />
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

/** La franja verde con las cuatro cosas que el negocio quiere que se sepan. */
export function FranjaDeConfianza() {
  return (
    <ul className={estilos.confianza}>
      {CONFIANZA.map((c) => (
        <li key={c.texto}>
          <svg
            viewBox="0 0 24 24"
            width="40"
            height="40"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: DIBUJOS_DE_CONFIANZA[c.icono] }}
          />
          <span>{c.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** «¿Estás montando tu negocio?»: la llamada a quien abre una hamburguesería, una pizzería o un restaurante. */
export function MontandoTuNegocio() {
  const whatsapp = enlaceWhatsapp("Hola, estoy montando mi negocio y quiero saber qué productos tienen.");
  if (!whatsapp) return null;
  return (
    <section className={estilos.montando} aria-labelledby="titulo-montando">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/familias/pizzeria.webp" alt="" width={640} height={480} className={estilos.montandoFotoIzquierda} loading="lazy" />
      <div className={estilos.montandoTexto}>
        <h2 id="titulo-montando" className={estilos.montandoTitulo}>
          ¿Estás montando tu negocio?
        </h2>
        <p>Te ayudamos a conseguir los productos que necesitas para tu hamburguesería, pizzería o restaurante.</p>
        <a className={`boton boton--acento ${estilos.botonWhatsapp}`} href={whatsapp} target="_blank" rel="noopener">
          <IconoWhatsapp />
          Contactar por WhatsApp
        </a>
      </div>
      <ul className={estilos.montandoLista}>
        {["Restaurantes", "Pizzerías", "Hamburgueserías", "Emprendedores"].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/familias/burger.webp" alt="" width={640} height={480} className={estilos.montandoFotoDerecha} loading="lazy" />
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
        <h1 id="titulo-familia" className={estilos.cabeceraFamiliaNombre}>{familia.nombre}</h1>
        {familia.descripcion && <p className={estilos.cabeceraFamiliaDescripcion}>{familia.descripcion}</p>}
        {cuantos > 0 && <p className={estilos.cabeceraFamiliaCuenta}>{cuantos === 1 ? "1 producto" : `${cuantos} productos`}</p>}
        {children}
      </div>
    </header>
  );
}

/** Lo que se dice bajo los precios: en qué moneda están y cómo se puede pagar. */
export function NotaDePrecios({ hayTasa }: { hayTasa: boolean }) {
  return (
    <p className={estilos.notaPrecios}>
      {hayTasa
        ? "Precios al mayor en bolívares a la tasa BCV del día, con su equivalente en dólares. También puedes pagar en dólares, Zelle o Binance."
        : "Precios al mayor en dólares. Puedes pagar en bolívares a la tasa del día por pago móvil, transferencia o efectivo."}
    </p>
  );
}

/**
 * Un combo u oferta: qué lleva (cada producto publicado con su enlace), su
 * precio si lo tiene, hasta cuándo vale, «Agregar» al carrito y pedirlo
 * solo por WhatsApp. Sin precio, «Consulta el precio del combo».
 */
export function TarjetaDeOferta({ oferta, tasa, rutas }: { oferta: Oferta; tasa: number | null; rutas: Map<number, string> }) {
  const enBs = oferta.precio_usd !== null ? aBolivares(oferta.precio_usd, tasa) : null;
  const pedir = enlaceWhatsapp(`Hola, quiero el combo ${oferta.nombre}${oferta.precio_usd !== null ? ` (${usd(oferta.precio_usd)})` : ""}. ¿Me confirman disponibilidad?`);
  return (
    <li id={`oferta-${oferta.id}`} className={estilos.oferta}>
      <div className={estilos.ofertaCabecera}>
        <span className={estilos.etiquetaCombo}>Combo</span>
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
            <p className={estilos.precioPrincipal}>{enBs !== null ? bs(enBs) : usd(oferta.precio_usd)}</p>
            <p className={estilos.precioSecundario}>{enBs !== null ? `${usd(oferta.precio_usd)} el combo` : "el combo"}</p>
          </div>
        )}
        {oferta.hasta && <p className={estilos.precioSecundario}>Hasta el {fechaCorta(oferta.hasta)}</p>}
        <div className={estilos.tarjetaAcciones}>
          <BotonAgregar clave={claveDeOferta(oferta.id)} nombre={oferta.nombre} unidad="combo" />
          {pedir && (
            <a href={pedir} target="_blank" rel="noopener" className={estilos.verDetalles}>
              Pedir este combo por WhatsApp
            </a>
          )}
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
        <a className={`boton boton--acento ${estilos.botonWhatsapp}`} href={whatsapp} target="_blank" rel="noopener">
          <IconoWhatsapp />
          Preguntar por WhatsApp
        </a>
      )}
      <Link href="/productos">Ver todos los productos</Link>
    </div>
  );
}
