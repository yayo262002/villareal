"use client";

import { useEffect, useRef, useState } from "react";
import { aBolivares, bs, usd } from "@/lib/dinero";

/**
 * El total de la nota mientras se escribe, para cotejarlo con el papel
 * antes de guardar. Lee los kilos y el precio de cada producto del propio
 * formulario. Necesita JavaScript; sin él no sale nada y el total lo
 * calcula el servidor al guardar, como siempre.
 */
export function TotalDeVenta({
  claves,
  tasa,
  rotulo = "Total de la nota",
  campoExtra,
}: {
  claves: string[];
  tasa: number | null;
  rotulo?: string;
  /** Un campo suelto en dólares que también suma (las «otras cosas» de una compra). */
  campoExtra?: string;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const sitio = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const formulario = sitio.current?.closest("form");
    if (!formulario) return;
    const leer = (nombre: string) => {
      const campo = formulario.elements.namedItem(nombre) as HTMLInputElement | null;
      const n = Number((campo?.value ?? "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };
    const calcular = () => {
      const suma = claves.reduce((s, clave) => s + leer(`cantidad_${clave}`) * leer(`precio_${clave}`), 0) + (campoExtra ? leer(campoExtra) : 0);
      setTotal(suma > 0 ? Math.round(suma * 100) / 100 : null);
    };
    calcular();
    formulario.addEventListener("input", calcular);
    return () => formulario.removeEventListener("input", calcular);
  }, [claves, campoExtra]);

  const enBs = total !== null ? aBolivares(total, tasa) : null;
  return (
    <p ref={sitio} aria-live="polite" style={{ minHeight: 24, fontWeight: 700, fontSize: 18 }}>
      {total !== null && (
        <>
          {rotulo}: {usd(total)}
          {enBs !== null && <span style={{ fontWeight: 400 }}> · {bs(enBs)}</span>}
        </>
      )}
    </p>
  );
}
