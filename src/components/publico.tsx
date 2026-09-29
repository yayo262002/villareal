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

type ConPrecios = { unidad: string; precio_usd: number | null; precio_mayor_usd: number | null };

/**
 * Las cajas de precio de un producto: al detal y al mayor, en bolívares si
 * hay tasa y en dólares debajo. Con un solo precio la caja se llama «Precio».
 * Sin ninguno, no se inventa: «Consulta el precio del día».
 */
export function PreciosProducto({ producto, tasa }: { producto: ConPrecios; tasa: number | null }) {
  const precios = [
    { nombre: "Al detal", usd: producto.precio_usd },
    { nombre: "Al mayor", usd: producto.precio_mayor_usd },
  ].filter((x): x is { nombre: string; usd: number } => x.usd !== null);

  if (precios.length === 0) {
    return <p className={estilos.precioPendiente}>Consulta el precio del día</p>;
  }
  return (
    <dl className={`${estilos.precios} ${precios.length === 1 ? estilos.preciosUno : ""}`}>
      {precios.map((precio) => {
        const enBs = aBolivares(precio.usd, tasa);
        return (
          <div
            key={precio.nombre}
            className={`${estilos.precioCaja} ${precio.nombre === "Al mayor" ? estilos.precioCajaMayor : ""}`}
          >
            <dt>{precios.length === 1 ? "Precio" : precio.nombre}</dt>
            <dd className={estilos.precio}>{enBs !== null ? bs(enBs) : usd(precio.usd)}</dd>
            <dd className={estilos.precioUsd}>
              {enBs !== null ? `${usd(precio.usd)} ` : ""}por {nombreUnidad(producto.unidad)}
            </dd>
          </div>
        );
      })}
    </dl>
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
