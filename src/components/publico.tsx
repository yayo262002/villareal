import Link from "next/link";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import type { Tasa } from "@/lib/ajustes";
import { aBolivares, bs, fechaCorta, fechaDeLaBase, nombreUnidad, usd } from "@/lib/dinero";
import estilos from "./publico.module.css";

/**
 * Lo que comparten las páginas públicas: la cabecera con el león y el botón
 * de WhatsApp, el pie con la razón social, las cajas de precio y los datos
 * para los buscadores.
 */

export function CabeceraPublica() {
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");
  return (
    <>
      {/* Para quien navega con teclado o lector de pantalla: salta la cabecera. */}
      <a href="#contenido" className={estilos.saltar}>
        Saltar al contenido
      </a>
      <header className={estilos.cabecera}>
        <div className={estilos.contenido}>
          <Link href="/" className={estilos.marca}>
            {/* El león coronado de la marca. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/leon.svg" alt="" width={33} height={52} className={estilos.leon} />
            <span>
              <span className={estilos.logo}>{negocio.nombre}</span>
              <span className={estilos.lema}>{negocio.lema}</span>
            </span>
          </Link>
          {whatsapp && (
            <a className="boton boton--acento" href={whatsapp} target="_blank" rel="noopener">
              WhatsApp
            </a>
          )}
        </div>
      </header>
    </>
  );
}

export function PiePublico() {
  return (
    <footer className={estilos.pie}>
      <div className={estilos.contenido}>
        <p>
          {negocio.razonSocial || negocio.nombre}
          {negocio.rif && ` · RIF ${negocio.rif}`}
        </p>
        <Link href="/admin">Panel</Link>
      </div>
    </footer>
  );
}

/** «Tasa BCV: Bs 857,89 por dólar · 29/09/2026». Sin tasa no se enseña nada. */
export function LineaTasa({ tasa, className }: { tasa: Tasa | null; className?: string }) {
  if (!tasa) return null;
  return (
    <p className={className}>
      {tasa.origen === "bcv" ? "Tasa BCV" : "Tasa"}: {bs(tasa.valor)} por dólar ·{" "}
      {fechaCorta(fechaDeLaBase(tasa.actualizada_en))}
    </p>
  );
}

type ConPrecios = { unidad: string; precio_usd: number | null };

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
    <dl className={`${estilos.precios} ${estilos.preciosUno}`}>
      <div className={estilos.precioCaja}>
        <dt>Precio al mayor</dt>
        <dd className={estilos.precio}>
          {desde && <span className={estilos.desde}>desde </span>}
          {enBs !== null ? bs(enBs) : usd(producto.precio_usd)}
        </dd>
        <dd className={estilos.precioUsd}>
          {enBs !== null ? `${usd(producto.precio_usd)} ` : ""}por {nombreUnidad(producto.unidad)}
        </dd>
      </div>
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
      <span className={estilos.precioUsd}>{unidad ? ` por ${nombreUnidad(unidad)}` : ""} · al mayor</span>
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
