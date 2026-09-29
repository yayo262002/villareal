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
  nombreCorto: "Villa Real",
  lema: "Quesos al mayor y al detal",
  descripcion:
    "Queso mozzarella para pizza, queso amarillo, pecorino rallado y huevos, al mayor y al detal. Tienda física en el centro de Barquisimeto.",

  // La dirección de la web. Si se compra un dominio propio, se cambia aquí y
  // con ella cambian los enlaces que se comparten, el mapa del sitio y las
  // vistas previas de WhatsApp.
  web: "https://villareal-green.vercel.app",

  // Con código de país y sin el cero inicial: 0424-5541749 → 58424...
  whatsapp: "584245541749",
  correo: "comercializadoravillareal@gmail.com",

  // Domicilio fiscal según el RIF (SENIAT, 2016).
  ciudad: "Barquisimeto, estado Lara",
  direccion: "Calle 38 entre carreras 30 y 31, local s/n, sector Centro",
  // Lo mismo por partes, para los buscadores.
  localidad: "Barquisimeto",
  estado: "Lara",
  pais: "VE",

  // Registro Mercantil Segundo del estado Lara, N.º 58, tomo 73-A, 30 de
  // junio de 2016, expediente 365-40518.
  razonSocial: "Comercializadora Villa Real 08, C.A.",
  rif: "J-40806430-8",

  horario: "Lunes a viernes, de 9:00 a. m. a 6:00 p. m.",
  // El mismo horario para los buscadores: días en inglés, horas de 24.
  horarioSemanal: {
    dias: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    abre: "09:00",
    cierra: "18:00",
  },
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

/**
 * Enlace para compartir un texto por WhatsApp con quien se quiera: abre
 * WhatsApp y deja elegir el contacto. No lleva número.
 */
export function enlaceCompartir(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

/** Una dirección de la web completa, para compartirla: `/producto/2` → `https://…/producto/2`. */
export function direccionCompleta(ruta: string): string {
  return new URL(ruta, negocio.web).toString();
}

/**
 * Enlace a Google Maps con la dirección de la tienda, o null si no hay
 * dirección. Busca por el texto de la dirección: no hay coordenadas
 * guardadas, así que no se inventa un punto en el mapa.
 */
export function enlaceMapa(): string | null {
  if (!negocio.direccion) return null;
  // «local s/n» y «sector Centro» despistan al buscador de mapas.
  const calle = negocio.direccion.split(",")[0];
  const consulta = [calle, negocio.localidad, negocio.estado, "Venezuela"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
