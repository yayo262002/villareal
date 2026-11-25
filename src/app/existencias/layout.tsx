import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Lo que ve la vendedora con su enlace: los buscadores no la indexan y no sale en el mapa del sitio. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DisposicionDeExistencias({ children }: { children: ReactNode }) {
  return children;
}
