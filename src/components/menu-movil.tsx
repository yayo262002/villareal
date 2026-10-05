"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * El menú del teléfono: un desplegable que funciona sin JavaScript
 * (`<details>`); con él, además, se cierra solo al ir a otra página.
 */
export function MenuMovil({ className, children }: { className?: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const ruta = usePathname();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [ruta]);
  return (
    <details ref={menu} className={className}>
      <summary aria-label="Menú">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
