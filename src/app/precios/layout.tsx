import type { Metadata } from "next";
import type { ReactNode } from "react";

/** «Mis precios» es del dueño (lleva los costos): los buscadores no la indexan y no sale en el mapa del sitio. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DisposicionDeMisPrecios({ children }: { children: ReactNode }) {
  return children;
}
