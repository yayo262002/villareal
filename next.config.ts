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
