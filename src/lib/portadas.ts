/**
 * Las familias iniciales que traen su portada en `public/familias/<slug>.webp`
 * (fotos de comida con licencia libre; ver `public/familias/CREDITOS.md`).
 * Una familia nueva sin portada subida lleva su icono.
 */
export const PORTADAS_INCLUIDAS: ReadonlySet<string> = new Set<string>([
  "burger",
  "pizzeria",
  "quesos",
  "lacteos",
  "huevos",
  "embutidos",
  "salsas-y-aderezos",
  "papas-y-congelados",
  "bebidas",
  "complementos-gastronomicos",
  "otros-productos",
]);

/**
 * La miniatura de una foto incluida en la web (de public/familias/ o public/productos/), para un círculo pequeño como
 * los atajos de la portada: 128 × 128, en public/miniaturas/ con el mismo nombre (npm run miniaturas). Una foto subida en
 * el panel (/foto-familia/…) va tal cual.
 */
export function miniatura(src: string): string {
  return /^\/(familias|productos)\/[a-z0-9-]+\.webp$/.test(src) ? `/miniaturas${src}` : src;
}

/**
 * La portada incluida de una familia (/familias/quesos.webp) a 480 × 360, para una tarjeta pequeña (srcset): en
 * public/miniaturas/familias-480/ (npm run miniaturas). Una portada subida en el panel no tiene: null.
 */
export function portadaMediana(src: string): string | null {
  return /^\/familias\/[a-z0-9-]+\.webp$/.test(src) ? src.replace("/familias/", "/miniaturas/familias-480/") : null;
}
