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

/** El tamaño de la portada de una familia: apaisada, como su tarjeta en la web. */
export const PORTADA = { ancho: 960, alto: 720 };

/**
 * La portada de una familia (una foto de comida, no un paquete): se recorta
 * en 4:3 quedándose con lo que más llama la atención y se guarda como JPEG.
 */
export async function normalizarPortada(datos: Uint8Array, tipo: string): Promise<{ datos: Uint8Array; tipo: string }> {
  try {
    const salida = await sharp(datos).rotate().resize(PORTADA.ancho, PORTADA.alto, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer();
    return { datos: new Uint8Array(salida), tipo: "image/jpeg" };
  } catch {
    return { datos, tipo };
  }
}
