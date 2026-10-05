/**
 * Las familias iniciales que traen su portada en `public/familias/<slug>.webp`
 * (fotos de comida con licencia libre; ver `public/familias/CREDITOS.md`).
 * Una familia nueva sin portada subida lleva su icono.
 */
export const PORTADAS_INCLUIDAS: ReadonlySet<string> = new Set<string>([
  "burger",
  "pizzeria",
  "quesos",
  "huevos",
  "embutidos",
  "salsas-y-aderezos",
  "papas-y-congelados",
  "bebidas",
  "complementos-gastronomicos",
  "otros-productos",
]);
