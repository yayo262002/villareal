import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Las cuentas de los proveedores son privadas: los buscadores no las indexan y no salen en el mapa del sitio. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DisposicionDeProveedor({ children }: { children: ReactNode }) {
  return children;
}
