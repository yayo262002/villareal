import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Anton } from "next/font/google";
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

// La letra de los títulos de la web. Next la descarga al compilar y la sirve
// desde la propia web: el teléfono del cliente no le pide nada a Google.
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", variable: "--fuente-anton" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // El color de la cabecera: en el teléfono la barra del navegador se funde con ella.
  themeColor: "#0e2c1b",
};

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es-VE" className={anton.variable}>
      <body>{children}</body>
    </html>
  );
}
