/**
 * Todo lo que identifica al negocio vive aquí. Ninguna página escribe el
 * nombre, el teléfono o la dirección a mano: los lee de este archivo.
 *
 * Los campos marcados como PENDIENTE no se inventan. Mientras estén vacíos
 * la web no los muestra, y menos aún muestra uno falso.
 */
export const negocio = {
  // Como en el logo bordado: «Villa Real», en dos palabras.
  nombre: "Comercializadora Villa Real",
  lema: "Quesos al mayor y al detal",
  descripcion:
    "Vendemos queso amarillo, mozzarella y otros quesos para negocios y familias.",

  // Con código de país y sin el cero inicial: 0424-5541749 → 58424...
  whatsapp: "584245541749",
  correo: "comercializadoravillareal@gmail.com",

  // Domicilio fiscal según el RIF (SENIAT, 2016).
  ciudad: "Barquisimeto, estado Lara",
  direccion: "Calle 38 entre carreras 30 y 31, local s/n, sector Centro",

  // Registro Mercantil Segundo del estado Lara, N.º 58, tomo 73-A, 30 de
  // junio de 2016, expediente 365-40518.
  razonSocial: "Comercializadora Villa Real 08, C.A.",
  rif: "J-40806430-8",

  horario: "Lunes a viernes, de 9:00 a. m. a 6:00 p. m.",
} as const;

/** El número como se escribe en Venezuela: 0424-5541749. Vacío si no está configurado. */
export function whatsappLegible(): string {
  const n = negocio.whatsapp;
  if (!n.startsWith("58") || n.length !== 12) return n;
  return `0${n.slice(2, 5)}-${n.slice(5)}`;
}

/** Enlace de WhatsApp listo para usar, o null si el número no está configurado. */
export function enlaceWhatsapp(mensaje?: string): string | null {
  if (!negocio.whatsapp) return null;
  const base = `https://wa.me/${negocio.whatsapp}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
