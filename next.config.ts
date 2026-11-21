import type { NextConfig } from "next";

/** Cabeceras de seguridad para todas las páginas. */
const CABECERAS_DE_SEGURIDAD = [
  // Que el navegador no adivine el tipo de un archivo: una foto es una foto.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Que ninguna otra web pueda meter esta dentro de un marco para engañar con ella.
  { key: "X-Frame-Options", value: "DENY" },
  // Al salir hacia otra web se dice de qué sitio se viene, no de qué página.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El micrófono, cerrado. La ubicación, solo para la propia web: el carrito la pide para el delivery («Usar mi
  // ubicación»). La cámara, también solo la propia web, para las fotos de las notas.
  { key: "Permissions-Policy", value: "geolocation=(self), microphone=(), camera=(self)" },
];

/**
 * Qué puede cargar y ejecutar cada página: solo lo de la propia web (revisión de seguridad del 14/11/2026). Si algún día
 * se colara un texto con código, el navegador no cargaría nada de fuera ni mandaría datos a otro sitio. Next mete sus
 * propios scripts en la página, por eso «unsafe-inline»; «unsafe-eval» solo con `next dev`, que lo necesita. Con
 * `facebook`, la de la pantalla WhatsApp del panel, que además deja cargar el SDK de Facebook y abrir sus marcos: lo
 * necesita la ventana de Meta para conectar el número (21/11/2026). Ninguna otra página lo tiene.
 */
function politicaDeContenido({ facebook = false } = {}): { key: string; value: string } {
  const deFacebook = facebook ? " https://connect.facebook.net https://*.facebook.com" : "";
  return {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}${facebook ? " https://connect.facebook.net" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${deFacebook}`,
      "font-src 'self' data:",
      `connect-src 'self'${deFacebook}`,
      ...(facebook ? ["frame-src https://*.facebook.com https://connect.facebook.net"] : []),
      "worker-src 'self'",
      "manifest-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}

/** La pantalla del panel que conecta el WhatsApp con Meta: la única con la política que deja cargar Facebook. */
const PANTALLA_CON_FACEBOOK = "/admin/whatsapp";

const nextConfig: NextConfig = {
  // Las vistas previas de cada producto leen su foto de referencia de `public/productos/`; en Vercel esos archivos
  // no viajan con la función si no se dice. Las demás páginas los sirven tal cual.
  outputFileTracingIncludes: {
    "/producto/**/opengraph-image*": ["./public/productos/**/*"],
  },
  // Lo que no es de la web (los carteles, los sellos, los guiones, la base y las copias del ordenador) no viaja nunca con
  // las funciones: Vercel guarda las funciones de cada versión publicada y el plan gratuito tiene 10 GB para eso.
  outputFileTracingExcludes: {
    "*": ["./publicidad/**/*", "./sellos/**/*", "./scripts/**/*", "./datos/**/*", "./copias/**/*", "./listas/**/*", "./exportaciones/**/*", "./material/**/*"],
  },
  experimental: {
    serverActions: {
      // Las fotos de las notas suben por una acción del servidor. El
      // formulario las reduce antes de enviarlas; 5 MB deja margen sin
      // pasarse del límite de Vercel (4,5 MB por petición).
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      { source: "/:ruta*", headers: CABECERAS_DE_SEGURIDAD },
      // La política de contenido va aparte: dos políticas en la misma página se suman y manda la más estricta.
      { source: "/((?!admin/whatsapp$).*)", headers: [politicaDeContenido()] },
      { source: PANTALLA_CON_FACEBOOK, headers: [politicaDeContenido({ facebook: true })] },
      {
        // Las fotos de la web que vienen en public/ (la portada, las familias, las de referencia, el león, las
        // miniaturas): un día en el teléfono y en Vercel, y una semana más mientras se comprueba si cambió. Sin esto se
        // preguntaban otra vez en cada visita. No es «para siempre» porque pueden cambiar con el mismo nombre (una foto de
        // referencia nueva).
        source: "/:carpeta(portada|familias|productos|marca|miniaturas)/:archivo+",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // El panel y las tareas no son para los buscadores.
        source: "/(admin|api)/:ruta*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
