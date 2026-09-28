/**
 * Todo lo que identifica al negocio vive aquí. Ninguna página escribe el
 * nombre, el teléfono o la dirección a mano: los lee de este archivo.
 *
 * Los campos marcados como PENDIENTE no se inventan. Mientras estén vacíos
 * la web no los muestra, y menos aún muestra uno falso.
 */
export const negocio = {
  nombre: "Comercializadora Villareal",
  lema: "Quesos al mayor y al detal",
  descripcion:
    "Vendemos queso amarillo, mozzarella y otros quesos para negocios y familias.",

  // PENDIENTE: número con código de país, solo dígitos. Ejemplo: "584121234567".
  whatsapp: "",

  // PENDIENTE: ciudad y dirección del local que dejó el papá.
  ciudad: "",
  direccion: "",

  // PENDIENTE: registro mercantil y RIF cuando estén.
  razonSocial: "",
  rif: "",

  horario: "",
} as const;

/** Enlace de WhatsApp listo para usar, o null si el número no está configurado. */
export function enlaceWhatsapp(mensaje?: string): string | null {
  if (!negocio.whatsapp) return null;
  const base = `https://wa.me/${negocio.whatsapp}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
