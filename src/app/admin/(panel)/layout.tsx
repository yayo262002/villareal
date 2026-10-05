import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { negocio } from "@/config/negocio";
import { haySesion } from "@/lib/sesion";
import { salir } from "@/lib/acciones";
import { NavPanel } from "@/components/nav-panel";
import estilos from "./panel.module.css";

/** El panel se instala en el teléfono como app propia, con su manifiesto. */
export const metadata = {
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Panel", statusBarStyle: "default" as const },
};

// La barra del navegador, del verde de la cabecera del panel (la web pública va más oscura).
export const viewport: Viewport = { themeColor: "#163f28" };

const SECCIONES = [
  { ruta: "/admin", nombre: "Resumen" },
  { ruta: "/admin/clientes", nombre: "Clientes" },
  { ruta: "/admin/ventas", nombre: "Ventas" },
  { ruta: "/admin/pagos", nombre: "Abonos" },
  { ruta: "/admin/despacho", nombre: "Despacho" },
  { ruta: "/admin/cuentas", nombre: "Te deben" },
  { ruta: "/admin/estadisticas", nombre: "Estadísticas" },
  { ruta: "/admin/productos", nombre: "Productos" },
  { ruta: "/admin/inventario", nombre: "Inventario" },
  { ruta: "/admin/resenas", nombre: "Reseñas" },
  { ruta: "/admin/proveedores", nombre: "Proveedores" },
] as const;

/**
 * El grupo de rutas `(panel)` agrupa todo lo que exige sesión. La pantalla
 * de entrar queda fuera, en `/admin/entrar`, para que esta comprobación no
 * la mande a sí misma en bucle.
 */
export default async function LayoutPanel({ children }: { children: ReactNode }) {
  if (!(await haySesion())) redirect("/admin/entrar");

  return (
    <div className={estilos.panel}>
      <header className={estilos.cabecera}>
        <div className={estilos.cabeceraFila}>
          <Link href="/admin" className={estilos.marca}>
            {negocio.nombre}
          </Link>
          <form action={salir}>
            <button type="submit" className={estilos.salir}>
              Salir
            </button>
          </form>
        </div>
        <NavPanel secciones={SECCIONES} className={estilos.nav} />
      </header>
      <main className={estilos.contenido}>{children}</main>
    </div>
  );
}
