import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { negocio } from "@/config/negocio";
import { haySesion } from "@/lib/sesion";
import { salir } from "@/lib/acciones";
import { NavPanel, type GrupoDelPanel } from "@/components/nav-panel";
import { UnSoloEnvio } from "@/components/un-solo-envio";
import { AvisoDeCarga } from "@/components/aviso-de-carga";
import { contarAvisosSinLeer } from "@/lib/avisos";
import estilos from "./panel.module.css";

/** El panel se instala en el teléfono como app propia, con su manifiesto. */
export const metadata = {
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Panel", statusBarStyle: "default" as const },
};

// La barra del navegador, del verde de la cabecera del panel (la web pública va más oscura).
export const viewport: Viewport = { themeColor: "#163f28" };

/**
 * El menú, por lo que se quiere hacer y en el orden del día: primero vender, después cobrar, los clientes, la
 * mercancía, las facturas y la web. Cada grupo abre su primera pantalla y enseña debajo las demás. Una pantalla
 * nueva va en su grupo; lo que cuelga de otra (la ficha de una marca, de Productos) va en su `tambien`.
 */
const GRUPOS: readonly GrupoDelPanel[] = [
  {
    nombre: "Inicio",
    icono: "inicio",
    secciones: [
      { ruta: "/admin", nombre: "Resumen", tambien: ["/admin/copia", "/admin/copias", "/admin/app"] },
      { ruta: "/admin/avisos", nombre: "Avisos" },
      { ruta: "/admin/estadisticas", nombre: "Estadísticas", tambien: ["/admin/informe", "/admin/exportaciones"] },
      { ruta: "/admin/reparto", nombre: "Reparto del mes" },
      { ruta: "/admin/ayuda", nombre: "Cómo se usa" },
    ],
  },
  {
    nombre: "Vender",
    icono: "vender",
    secciones: [
      { ruta: "/admin/ventas", nombre: "Registrar venta", tambien: ["/admin/pos"] },
      { ruta: "/admin/pedidos", nombre: "Pedidos de la web" },
      { ruta: "/admin/despacho", nombre: "Despacho" },
      { ruta: "/admin/combos/etiquetas", nombre: "Etiquetas de combos" },
    ],
  },
  {
    nombre: "Cobrar",
    icono: "cobrar",
    secciones: [
      { ruta: "/admin/cuentas", nombre: "Lo que te deben", tambien: ["/admin/recordar"] },
      { ruta: "/admin/pagos", nombre: "Abonos" },
      { ruta: "/admin/banco", nombre: "Pago móvil" },
      { ruta: "/admin/caja", nombre: "Cierre del día" },
    ],
  },
  {
    nombre: "Clientes",
    icono: "clientes",
    secciones: [
      { ruta: "/admin/clientes", nombre: "Cartera", tambien: ["/admin/adjuntos"] },
      { ruta: "/admin/clientes/seguimiento", nombre: "Por llamar" },
      { ruta: "/admin/resenas", nombre: "Reseñas" },
      { ruta: "/admin/stickers", nombre: "Stickers" },
    ],
  },
  {
    nombre: "Mercancía",
    icono: "mercancia",
    secciones: [
      { ruta: "/admin/productos", nombre: "Productos", tambien: ["/admin/marcas", "/admin/familias", "/admin/tasas"] },
      { ruta: "/admin/inventario", nombre: "Inventario" },
      { ruta: "/admin/proveedores", nombre: "Proveedores", tambien: ["/admin/compras", "/admin/pagos-proveedor", "/admin/adjuntos-proveedor"] },
      { ruta: "/admin/compra", nombre: "Lista de compra" },
      { ruta: "/admin/detal", nombre: "Lista del detal" },
      { ruta: "/admin/codigos", nombre: "Códigos de barras" },
    ],
  },
  {
    nombre: "Facturas",
    icono: "facturas",
    secciones: [
      { ruta: "/admin/facturas", nombre: "Facturas" },
      { ruta: "/admin/facturas/compras", nombre: "Libro de compras" },
      { ruta: "/admin/facturas/control", nombre: "Números de control" },
    ],
  },
  {
    nombre: "La web",
    icono: "web",
    secciones: [
      { ruta: "/admin/ofertas", nombre: "Ofertas y combos" },
      { ruta: "/admin/fotos", nombre: "Fotos" },
      { ruta: "/admin/delivery", nombre: "Delivery" },
    ],
  },
];

/** Las clases del menú, nada más: es lo único de los estilos que viaja al navegador con él. */
const ESTILOS_DEL_MENU = { nav: estilos.nav, navGrupos: estilos.navGrupos, navGrupoActivo: estilos.navGrupoActivo, navSecciones: estilos.navSecciones };

/**
 * El grupo de rutas `(panel)` agrupa todo lo que exige sesión. La pantalla
 * de entrar queda fuera, en `/admin/entrar`, para que esta comprobación no
 * la mande a sí misma en bucle.
 */
export default async function LayoutPanel({ children }: { children: ReactNode }) {
  if (!(await haySesion())) redirect("/admin/entrar");
  // La campanita dice cuántos avisos hay sin leer.
  const sinLeer = await contarAvisosSinLeer();

  return (
    <div className={estilos.panel}>
      <header className={estilos.cabecera}>
        <div className={estilos.cabeceraFila}>
          <Link href="/admin" className={estilos.marca}>
            {negocio.nombre}
          </Link>
          <div className={estilos.cabeceraDerecha}>
            <Link href="/admin/avisos" className={estilos.campana} aria-label={sinLeer > 0 ? `Avisos: ${sinLeer} sin leer` : "Avisos"} title="Avisos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {sinLeer > 0 && <span className={estilos.campanaCuenta}>{sinLeer > 99 ? "99+" : sinLeer}</span>}
            </Link>
            <form action={salir}>
              <button type="submit" className={estilos.salir}>
                Salir
              </button>
            </form>
          </div>
        </div>
        <NavPanel grupos={GRUPOS} estilos={ESTILOS_DEL_MENU} />
      </header>
      <main className={estilos.contenido}>{children}</main>
      <UnSoloEnvio />
      <AvisoDeCarga />
    </div>
  );
}
