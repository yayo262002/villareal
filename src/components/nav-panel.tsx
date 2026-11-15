"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Una pantalla del menú. `tambien`: otras direcciones que son de ella (la ficha de una marca es de Productos). */
export type SeccionDelPanel = { ruta: string; nombre: string; tambien?: readonly string[] };
export type IconoDeGrupo = "inicio" | "vender" | "cobrar" | "clientes" | "mercancia" | "facturas" | "web";
/** Un grupo del menú: lo que se quiere hacer («Cobrar»), con sus pantallas. Tocar el grupo abre la primera. */
export type GrupoDelPanel = { nombre: string; icono: IconoDeGrupo; secciones: readonly SeccionDelPanel[] };

/** Si la dirección es de esa ruta. El Resumen solo lo es en `/admin` justo. */
function esDe(ruta: string, pagina: string): boolean {
  if (ruta === "/admin") return pagina === "/admin";
  return pagina === ruta || pagina.startsWith(ruta + "/");
}

/**
 * La pantalla del menú en la que se está: la que mejor casa (la ruta más larga), así «Por llamar»
 * (/admin/clientes/seguimiento) gana a «Cartera» (/admin/clientes). Null si la página no es de ninguna.
 */
export function seccionAbierta(grupos: readonly GrupoDelPanel[], pagina: string): { grupo: GrupoDelPanel; seccion: SeccionDelPanel } | null {
  let mejor: { grupo: GrupoDelPanel; seccion: SeccionDelPanel; largo: number } | null = null;
  for (const grupo of grupos) {
    for (const seccion of grupo.secciones) {
      for (const ruta of [seccion.ruta, ...(seccion.tambien ?? [])]) {
        if (esDe(ruta, pagina) && (!mejor || ruta.length > mejor.largo)) mejor = { grupo, seccion, largo: ruta.length };
      }
    }
  }
  return mejor ? { grupo: mejor.grupo, seccion: mejor.seccion } : null;
}

const TRAZOS: Record<IconoDeGrupo, ReactNode> = {
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  vender: (
    <>
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </>
  ),
  cobrar: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.6c1.8.7 3 2.4 3.5 5.4" />
    </>
  ),
  mercancia: (
    <>
      <path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9Z" />
      <path d="M3.5 7.5 12 12.2l8.5-4.7M12 12.2v9" />
    </>
  ),
  facturas: (
    <>
      <path d="M6 2.8h12v18.4l-3-1.8-3 1.8-3-1.8-3 1.8Z" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.7 3.8 5.7 3.8 9s-1.2 6.3-3.8 9c-2.6-2.7-3.8-5.7-3.8-9S9.4 5.7 12 3Z" />
    </>
  ),
};

/**
 * El menú del panel en dos pisos, para que cualquiera lo entienda sin saberse el panel: arriba, lo que se quiere
 * hacer (Inicio, Vender, Cobrar, Clientes, Mercancía, Facturas, La web), en el orden del día; debajo, solo las
 * pantallas de ese grupo, con la abierta marcada. En el teléfono los grupos van en una cuadrícula con su dibujo, sin
 * desplazarse a los lados. Es un componente cliente solo para saber en qué página se está (también se pinta en el
 * servidor): sin JavaScript funciona igual.
 */
export function NavPanel({ grupos, estilos }: { grupos: readonly GrupoDelPanel[]; estilos: Record<string, string> }) {
  const pagina = usePathname();
  const abierta = seccionAbierta(grupos, pagina);

  return (
    <nav aria-label="Secciones del panel" className={estilos.nav}>
      <ul className={estilos.navGrupos}>
        {grupos.map((g) => {
          const activo = abierta?.grupo === g;
          return (
            <li key={g.nombre}>
              <Link href={g.secciones[0].ruta} className={activo ? estilos.navGrupoActivo : undefined} aria-current={activo ? "true" : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {TRAZOS[g.icono]}
                </svg>
                <span>{g.nombre}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {abierta && abierta.grupo.secciones.length > 1 && (
        <ul className={estilos.navSecciones} aria-label={abierta.grupo.nombre}>
          {abierta.grupo.secciones.map((s) => (
            <li key={s.ruta}>
              <Link href={s.ruta} aria-current={abierta.seccion === s ? "page" : undefined}>
                {s.nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
