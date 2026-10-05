import sharp from "sharp";

/**
 * Deja la foto de un producto lista para la web: le quita el fondo liso que
 * sobra alrededor (el blanco de una foto de catálogo), centra el producto
 * en un cuadrado con un poco de aire y la guarda como JPEG. Así todas las
 * fotos salen del mismo tamaño y el producto llena su sitio, venga la foto
 * como venga. Si la imagen no se deja (muy pequeña, rota), se guarda como
 * vino.
 */

/** El lado del cuadrado que se guarda. El teléfono ya reduce la foto antes de subirla. */
export const LADO_DE_LA_FOTO = 800;
/** Lo que queda de aire alrededor del producto. */
const AIRE = 30;
/**
 * Cuánto puede diferir un píxel del color del borde para seguir siendo fondo.
 * Poco: un producto claro (una bolsa de suero blanca) no puede tomarse por
 * fondo y salir cortado. Si el fondo no es liso, mejor no recortar de más.
 */
const TOLERANCIA_DEL_FONDO = 15;

export async function normalizarFotoDeProducto(datos: Uint8Array, tipo: string): Promise<{ datos: Uint8Array; tipo: string }> {
  try {
    // Primero sin transparencia y bien orientada; después se recorta el fondo que sobra.
    const plana = await sharp(datos).rotate().flatten({ background: "#ffffff" }).toBuffer();
    const recortada = await sharp(plana).trim({ threshold: TOLERANCIA_DEL_FONDO }).toBuffer();
    const salida = await sharp(recortada)
      .resize(LADO_DE_LA_FOTO - 2 * AIRE, LADO_DE_LA_FOTO - 2 * AIRE, { fit: "contain", background: "#ffffff" })
      .extend({ top: AIRE, bottom: AIRE, left: AIRE, right: AIRE, background: "#ffffff" })
      .jpeg({ quality: 86 })
      .toBuffer();
    return { datos: new Uint8Array(salida), tipo: "image/jpeg" };
  } catch {
    return { datos, tipo };
  }
}
