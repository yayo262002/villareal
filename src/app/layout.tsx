import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { negocio } from "@/config/negocio";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: negocio.nombre,
    template: `%s · ${negocio.nombre}`,
  },
  description: negocio.descripcion,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5f3a",
};

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
