import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Anton, Fraunces, Manrope } from "next/font/google";
import { negocio } from "@/config/negocio";
import "./globals.css";

/**
 * Lo que ven los buscadores y lo que sale al compartir un enlace. Cada
 * página puede afinar lo suyo; la imagen de la vista previa sale de los
 * archivos `opengraph-image.tsx`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(negocio.web),
  title: {
    default: `${negocio.nombre} · ${negocio.lema} en ${negocio.localidad}`,
    template: `%s · ${negocio.nombre}`,
  },
  description: negocio.descripcion,
  applicationName: negocio.nombre,
  // En iPhone, puesta en la pantalla de inicio, abre a pantalla completa.
  appleWebApp: { capable: true, title: negocio.nombreCorto, statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "es_VE",
    siteName: negocio.nombre,
    title: `${negocio.nombre} · ${negocio.lema}`,
    description: negocio.descripcion,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  // El teléfono de la tienda ya lleva su enlace a WhatsApp: que el
  // navegador no convierta en enlace cualquier número, como el RIF.
  formatDetection: { telephone: false },
};

// Las letras de la web. Next las descarga al compilar y las sirve desde la
// propia web: el teléfono del cliente no le pide nada a Google. Anton, la de
// los títulos de la lista del detal; Fraunces (con su eje «SOFT», que la
// redondea) para los títulos de la web, y Manrope para leer y los precios.
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", variable: "--fuente-anton" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", axes: ["SOFT"], variable: "--fuente-fraunces" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--fuente-manrope" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // El color de la cabecera: en el teléfono la barra del navegador se funde con ella.
  themeColor: "#0a2416",
};

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es-VE" className={`${anton.variable} ${fraunces.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
