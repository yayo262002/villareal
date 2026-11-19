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
  const m = /^(\/(familias|productos)\/[a-z0-9-]+\.webp)(\?v=[\w-]+)?$/.exec(src);
  return m ? `/miniaturas${m[1]}${m[3] ?? ""}` : src;
}

/**
 * La versión de las fotos que trae la web (public/portada/, public/familias/): va en su dirección como «?v=». El
 * teléfono las guarda un día; al rehacerlas (npm run fotos-web) se cambia aquí, y todos ven la nueva en el momento.
 */
export const VERSION_DE_LAS_FOTOS = "20261119";

/**
 * La portada incluida de una familia (/familias/quesos.webp) a 480 × 360, para una tarjeta pequeña (srcset): en
 * public/miniaturas/familias-480/ (npm run miniaturas). Una portada subida en el panel no tiene: null.
 */
export function portadaMediana(src: string): string | null {
  const m = /^\/familias\/([a-z0-9-]+\.webp)(\?v=[\w-]+)?$/.exec(src);
  return m ? `/miniaturas/familias-480/${m[1]}${m[2] ?? ""}` : null;
}
