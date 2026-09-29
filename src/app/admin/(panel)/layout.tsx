import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { negocio } from "@/config/negocio";
import { haySesion } from "@/lib/sesion";
import { salir } from "@/lib/acciones";
import { NavPanel } from "@/components/nav-panel";
import estilos from "./panel.module.css";

const SECCIONES = [
  { ruta: "/admin", nombre: "Resumen" },
  { ruta: "/admin/clientes", nombre: "Clientes" },
  { ruta: "/admin/ventas", nombre: "Ventas" },
  { ruta: "/admin/pagos", nombre: "Abonos" },
  { ruta: "/admin/despacho", nombre: "Despacho" },
  { ruta: "/admin/cuentas", nombre: "Cuentas" },
  { ruta: "/admin/informe", nombre: "Informe" },
  { ruta: "/admin/productos", nombre: "Productos" },
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
