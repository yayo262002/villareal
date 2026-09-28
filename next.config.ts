import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos de las notas suben por una acción del servidor. El
      // formulario las reduce antes de enviarlas; 5 MB deja margen sin
      // pasarse del límite de Vercel (4,5 MB por petición).
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
