"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Seccion = { ruta: string; nombre: string };

/** Si la página abierta es de esta sección. El resumen solo lo es en `/admin` justo. */
function estaEn(seccion: Seccion, pagina: string): boolean {
  if (seccion.ruta === "/admin") return pagina === "/admin";
  return pagina === seccion.ruta || pagina.startsWith(seccion.ruta + "/");
}

/**
 * El menú del panel, con la sección abierta marcada. Es un componente
 * cliente porque solo el navegador sabe en qué página está: el layout del
 * servidor no se vuelve a pintar al cambiar de página. Sin JavaScript el
 * menú funciona igual; solo falta la marca.
 *
 * En el teléfono el menú se desplaza a los lados: la sección abierta se
 * trae a la vista para que no quede escondida.
 */
export function NavPanel({ secciones, className }: { secciones: readonly Seccion[]; className?: string }) {
  const pagina = usePathname();
  const menu = useRef<HTMLElement>(null);

  useEffect(() => {
    const abierta = menu.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!abierta || !menu.current) return;
    // Se mueve solo el menú, no la página entera.
    const centro = abierta.offsetLeft - (menu.current.clientWidth - abierta.offsetWidth) / 2;
    menu.current.scrollTo({ left: Math.max(0, centro) });
  }, [pagina]);

  return (
    <nav ref={menu} aria-label="Secciones del panel" className={className}>
      {secciones.map((s) => (
        <Link key={s.ruta} href={s.ruta} aria-current={estaEn(s, pagina) ? "page" : undefined}>
          {s.nombre}
        </Link>
      ))}
    </nav>
  );
}
