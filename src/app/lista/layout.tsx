import type { Metadata } from "next";
import type { ReactNode } from "react";

/** La lista de precios del detal es para la familia: los buscadores no la indexan y no sale en el mapa del sitio. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DisposicionDeLista({ children }: { children: ReactNode }) {
  return children;
}
