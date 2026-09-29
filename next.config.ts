import type { NextConfig } from "next";

/** Cabeceras de seguridad para todas las páginas. */
const CABECERAS_DE_SEGURIDAD = [
  // Que el navegador no adivine el tipo de un archivo: una foto es una foto.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Que ninguna otra web pueda meter esta dentro de un marco para engañar con ella.
  { key: "X-Frame-Options", value: "DENY" },
  // Al salir hacia otra web se dice de qué sitio se viene, no de qué página.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La web no usa ubicación ni micrófono: se cierran. La cámara sí, para las fotos de las notas.
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(self)" },
];

const nextConfig: NextConfig = {
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
        // El panel y las tareas no son para los buscadores.
        source: "/(admin|api)/:ruta*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
