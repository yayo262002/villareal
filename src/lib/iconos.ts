/**
 * Los iconos de las familias y de la portada, dibujados a trazo (24 × 24,
 * del color del texto). Son texto que escribe el código, no el dueño: se
 * pueden meter tal cual en la página. Puro.
 */

export const ICONOS = {
  burger: {
    nombre: "Hamburguesa",
    trazo: '<path d="M4 11h16a8 8 0 0 0-16 0Z"/><path d="M3.5 14.5c1.5-1 2.8-1 4.2 0s2.8 1 4.3 0 2.8-1 4.3 0 2.7 1 4.2 0"/><rect x="4" y="16.5" width="16" height="3.5" rx="1.7"/>',
  },
  pizza: {
    nombre: "Pizza",
    trazo: '<path d="M12 21 3.5 6.5a17 17 0 0 1 17 0Z"/><path d="M5 9a14 14 0 0 1 14 0"/><circle cx="12" cy="11.5" r="1.3"/><circle cx="9.5" cy="15" r="1"/><circle cx="14.3" cy="15.2" r="1"/>',
  },
  queso: {
    nombre: "Queso",
    trazo: '<path d="M3 17.5 21 11v7.5H3Z"/><path d="M3 17.5 15 7l6 4"/><circle cx="9" cy="15.3" r="1.2"/><circle cx="15" cy="14.8" r="1.4"/>',
  },
  huevo: {
    nombre: "Huevo",
    trazo: '<path d="M12 3c3.6 0 6.5 6 6.5 10.2A6.5 6.5 0 0 1 5.5 13.2C5.5 9 8.4 3 12 3Z"/>',
  },
  embutido: {
    nombre: "Embutido",
    trazo: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.1"/><circle cx="14.5" cy="10" r="1"/><circle cx="11" cy="14.5" r="1.2"/><circle cx="15.5" cy="14.8" r=".9"/>',
  },
  tocineta: {
    nombre: "Tocineta",
    trazo: '<path d="M3 8c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/><path d="M3 12c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/><path d="M3 16c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
  },
  salsa: {
    nombre: "Salsa",
    trazo: '<path d="M10 3h4l.5 3h-5Z"/><path d="M9 6h6l1 3v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9Z"/><path d="M8 13h8"/>',
  },
  papas: {
    nombre: "Papas",
    trazo: '<path d="M6 10h12l-1.6 10.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8Z"/><path d="M8 10 7 4M11 10V3M14 10l.5-6M17 10l1-5"/>',
  },
  bebida: {
    nombre: "Bebida",
    trazo: '<path d="M6 7h12l-1.4 13.1a1 1 0 0 1-1 .9H8.4a1 1 0 0 1-1-.9Z"/><path d="M12 7l2-4h3"/><path d="M6.6 12h10.8"/>',
  },
  refresco: {
    nombre: "Refresco",
    trazo: '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M7 8h10M7 16h10"/>',
  },
  complementos: {
    nombre: "Complementos",
    trazo: '<path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M12 12c0-3 1.5-5.5 4.5-6.5-.2 3-1.8 5.5-4.5 6.5ZM12 12c0-2.5-1.3-4.5-3.8-5.3.2 2.5 1.5 4.5 3.8 5.3Z"/>',
  },
  otros: {
    nombre: "Caja",
    trazo: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  },
} as const;

export type ClaveDeIcono = keyof typeof ICONOS;

export function esIcono(valor: string): valor is ClaveDeIcono {
  return Object.hasOwn(ICONOS, valor);
}
