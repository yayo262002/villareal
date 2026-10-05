import Link from "next/link";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import type { Tasa } from "@/lib/ajustes";
import { porQueSeCobra } from "@/lib/catalogo";
import { aBolivares, bs, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, unidadEnPalabras, usd } from "@/lib/dinero";
import { Icono } from "@/components/icono";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import { MenuMovil } from "@/components/menu-movil";
import { ContadorCarrito } from "@/components/carrito/contador";
import estilos from "./publico.module.css";

/**
 * Lo que comparten las páginas públicas: la cabecera (el león, el menú, el
 * buscador, el carrito y WhatsApp; en el teléfono, un menú compacto), el
 * pie, las cajas de precio y los datos para los buscadores.
 */

export type SeccionPublica = "inicio" | "productos" | "burger" | "pizzeria" | "ofertas" | "contacto";

const MENU: { seccion: SeccionPublica; nombre: string; ruta: string; icono?: string }[] = [
  { seccion: "inicio", nombre: "Inicio", ruta: "/" },
  { seccion: "productos", nombre: "Productos", ruta: "/productos" },
  { seccion: "burger", nombre: "Burger", ruta: "/categoria/burger", icono: "burger" },
  { seccion: "pizzeria", nombre: "Pizzería", ruta: "/categoria/pizzeria", icono: "pizza" },
  { seccion: "ofertas", nombre: "Ofertas", ruta: "/ofertas" },
  { seccion: "contacto", nombre: "Contacto", ruta: "/#contacto" },
];

function Lupa() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function Buscador({ id, className, ayuda = "Buscar productos" }: { id: string; className: string; ayuda?: string }) {
  return (
    <form action="/productos" className={className} role="search">
      <label htmlFor={id} className="visualmente-oculto">
        Buscar productos
      </label>
      <input id={id} name="q" type="search" placeholder={ayuda} enterKeyHint="search" />
      <button type="submit" aria-label="Buscar">
        <Lupa />
      </button>
    </form>
  );
}

export function CabeceraPublica({ actual = null }: { actual?: SeccionPublica | null }) {
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");
  const enlaces = MENU.map((m) => (
    <Link key={m.seccion} href={m.ruta} aria-current={actual === m.seccion ? "page" : undefined}>
      {m.icono && <Icono nombre={m.icono} className={estilos.menuIcono} />}
      {m.nombre}
    </Link>
  ));
  return (
    <>
      {/* Para quien navega con teclado o lector de pantalla: salta la cabecera. */}
      <a href="#contenido" className={estilos.saltar}>
        Saltar al contenido
      </a>
      <header className={estilos.cabecera}>
        <div className={estilos.barra}>
          <Link href="/" className={estilos.marca} aria-label={`${negocio.nombre}: inicio`}>
            {/* El león coronado de la marca. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/leon.svg" alt="" width={33} height={52} className={estilos.leon} />
            <span className={estilos.marcaTexto}>
              <span className={estilos.marcaArriba}>Comercializadora</span>
              <span className={estilos.marcaNombre}>Villa Real</span>
            </span>
          </Link>
          <nav className={estilos.menu} aria-label="Secciones">
            {enlaces}
          </nav>
          <Buscador id="buscar-cabecera" className={estilos.buscar} ayuda="Buscar…" />
          <Link href="/carrito" className={estilos.carrito} aria-label="Carrito de pedido">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" />
              <circle cx="9" cy="19" r="1.4" />
              <circle cx="17" cy="19" r="1.4" />
            </svg>
            <ContadorCarrito />
          </Link>
          {whatsapp && (
            <a className={estilos.whatsapp} href={whatsapp} target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">
              <IconoWhatsapp tamano={22} />
              <span>WhatsApp</span>
            </a>
          )}
          <MenuMovil className={estilos.menuMovil}>
            <div className={estilos.menuMovilPanel}>
              <Buscador id="buscar-menu" className={estilos.buscarMovil} />
              <nav aria-label="Secciones">{enlaces}</nav>
            </div>
          </MenuMovil>
        </div>
      </header>
    </>
  );
}

const PIE = [
  { texto: "Pedidos al por mayor", trazo: '<path d="M2 6h11v10H2Z"/><path d="M13 9h4l3 3v4h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>' },
  { texto: "Calidad garantizada", trazo: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>' },
  { texto: "Múltiples formas de pago", trazo: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>' },
  { texto: "Barquisimeto", trazo: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>' },
];

export function PiePublico() {
  return (
    <footer className={estilos.pie}>
      <ul className={estilos.pieVentajas}>
        {PIE.map((p) => (
          <li key={p.texto}>
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p.trazo }} />
            <span>{p.texto}</span>
          </li>
        ))}
      </ul>
      <div className={estilos.pieDatos}>
        <div>
          <p className={estilos.pieNombre}>{negocio.nombre}</p>
          <p>
            {negocio.razonSocial || negocio.nombre}
            {negocio.rif && ` · RIF ${negocio.rif}`}
          </p>
          {(negocio.direccion || negocio.ciudad) && <p>{[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}</p>}
          {negocio.horario && <p>{negocio.horario}</p>}
        </div>
        <nav className={estilos.pieEnlaces} aria-label="Más">
          <Link href="/productos">Productos</Link>
          <Link href="/ofertas">Ofertas</Link>
          <Link href="/carrito">Carrito</Link>
          <Link href="/#contacto">Contacto</Link>
          <Link href="/admin">Panel</Link>
        </nav>
      </div>
    </footer>
  );
}

/**
 * «Tasa BCV: Bs 857,89 por dólar · 29/09/2026». Un fin de semana, con la
 * del lunes: «Tasa BCV del lunes 05/10/2026: Bs 871,37 por dólar». Sin
 * tasa no se enseña nada.
 */
export function LineaTasa({ tasa, className }: { tasa: Tasa | null; className?: string }) {
  if (!tasa) return null;
  const adelantada = tasa.fecha_valor !== null && tasa.fecha_valor > hoy() ? tasa.fecha_valor : null;
  return (
    <p className={className}>
      {tasa.origen === "bcv" ? "Tasa BCV" : "Tasa"}
      {adelantada ? ` del ${diaDeLaSemana(adelantada)} ${fechaCorta(adelantada)}` : ""}: {bs(tasa.valor)} por dólar
      {adelantada ? "" : ` · ${fechaCorta(fechaDeLaBase(tasa.actualizada_en))}`}
    </p>
  );
}

type ConPrecios = { unidad: string; precio_usd: number | null; presentacion?: string; contenido?: string; precio_detal_usd?: number | null };

/**
 * La caja de precio de un producto: el precio al mayor, en bolívares si
 * hay tasa y en dólares debajo. Sin precio no se inventa: «Consulta el
 * precio del día». Con `desde`, es el más barato de varias marcas.
 */
export function PreciosProducto({ producto, tasa, desde = false }: { producto: ConPrecios; tasa: number | null; desde?: boolean }) {
  if (producto.precio_usd === null) {
    return <p className={estilos.precioPendiente}>Consulta el precio del día</p>;
  }
  const enBs = aBolivares(producto.precio_usd, tasa);
  return (
    <dl className={`${estilos.precios} ${producto.precio_detal_usd != null ? "" : estilos.preciosUno}`}>
      <div className={estilos.precioCaja}>
        <dt>Precio al mayor</dt>
        <dd className={estilos.precio}>
          {desde && <span className={estilos.desde}>desde </span>}
          {enBs !== null ? bs(enBs) : usd(producto.precio_usd)}
        </dd>
        <dd className={estilos.precioUsd}>
          {enBs !== null ? `${usd(producto.precio_usd)} ` : ""}por{" "}
          {producto.presentacion !== undefined ? porQueSeCobra({ unidad: producto.unidad, presentacion: producto.presentacion, contenido: producto.contenido ?? "" }) : unidadEnPalabras(producto.unidad)}
        </dd>
      </div>
      {producto.precio_detal_usd != null && (
        <div className={estilos.precioCaja}>
          <dt>Precio al detal</dt>
          <dd className={estilos.precio}>{aBolivares(producto.precio_detal_usd, tasa) !== null ? bs(aBolivares(producto.precio_detal_usd, tasa)!) : usd(producto.precio_detal_usd)}</dd>
          <dd className={estilos.precioUsd}>{aBolivares(producto.precio_detal_usd, tasa) !== null ? usd(producto.precio_detal_usd) : ""}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * El precio de una marca o presentación, en una línea: «Bs 310,25 (USD 8,50)
 * por kg · al mayor». Sin precio, lo de siempre.
 */
export function PreciosEnLinea({ precios, unidad, tasa }: { precios: { precio_usd: number | null }; unidad?: string; tasa: number | null }) {
  if (precios.precio_usd === null) return <p className={estilos.precioPendiente}>Consulta el precio del día</p>;
  const enBs = aBolivares(precios.precio_usd, tasa);
  return (
    <p className={estilos.preciosLinea}>
      <strong>{enBs !== null ? bs(enBs) : usd(precios.precio_usd)}</strong>
      {enBs !== null && <span className={estilos.precioUsd}> ({usd(precios.precio_usd)})</span>}
      <span className={estilos.precioUsd}>{unidad ? ` por ${unidadEnPalabras(unidad)}` : ""} · al mayor</span>
    </p>
  );
}

/** Las ventajas del producto, una por línea en el panel, como lista. */
export function ventajasDe(descripcion: string | null | undefined): string[] {
  return (descripcion ?? "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Datos de la página en el formato que leen Google y los demás buscadores
 * (JSON-LD). No se ve: va dentro de una etiqueta `<script>`. El `<` se
 * escapa para que un nombre de producto no pueda cerrar la etiqueta.
 */
export function DatosEstructurados({ datos }: { datos: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, "\\u003c") }}
    />
  );
}

/** La tienda, como la entienden los buscadores. */
export function datosDeLaTienda(): Record<string, unknown> {
  return {
    "@type": "Store",
    "@id": `${negocio.web}/#tienda`,
    name: negocio.nombre,
    legalName: negocio.razonSocial || undefined,
    description: negocio.descripcion,
    url: negocio.web,
    image: `${negocio.web}/opengraph-image`,
    logo: `${negocio.web}/marca/leon-negro.png`,
    telephone: negocio.whatsapp ? `+${negocio.whatsapp}` : undefined,
    email: negocio.correo || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: negocio.direccion,
      addressLocality: negocio.localidad,
      addressRegion: negocio.estado,
      addressCountry: negocio.pais,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: negocio.horarioSemanal.dias,
      opens: negocio.horarioSemanal.abre,
      closes: negocio.horarioSemanal.cierra,
    },
    currenciesAccepted: "USD, VES",
    paymentAccepted: "Pago móvil, transferencia, efectivo, Zelle, Binance",
  };
}
