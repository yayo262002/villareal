"use client";

import { useState, type ChangeEvent } from "react";

const LADO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.82;
const TAMANO_SIN_TOCAR = 600 * 1024;

/**
 * El único componente con JavaScript del panel. Una foto del teléfono pesa
 * 3 o 4 MB; reducirla aquí a 1600 px y JPEG la deja en unos 300 KB, que sube
 * rápido con mala señal y cabe en el límite de Vercel. Si el script no
 * carga, el formulario sigue funcionando: sube la foto tal cual y el
 * servidor la rechaza solo si pasa de 4 MB.
 */
type Props = {
  nombre: string;
  id: string;
  /** Sin esto, el campo se puede dejar vacío. */
  opcional?: boolean;
  /** Solo fotos, y de la galería o de la cámara, a elegir: para la foto de una reseña. */
  soloFoto?: boolean;
  /** A cuántos píxeles de lado se reduce. Las fotos pequeñas (una cara, un local) no necesitan 1600. */
  ladoMaximo?: number;
};

export function EntradaFoto({ nombre, id, opcional = false, soloFoto = false, ladoMaximo = LADO_MAXIMO }: Props) {
  const [aviso, setAviso] = useState("");

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const entrada = evento.currentTarget;
    const archivo = entrada.files?.[0];
    setAviso("");
    if (!archivo || !archivo.type.startsWith("image/")) return;
    if (archivo.size <= TAMANO_SIN_TOCAR && ladoMaximo >= LADO_MAXIMO) return;

    try {
      const reducida = await reducirImagen(archivo, ladoMaximo);
      const transferencia = new DataTransfer();
      transferencia.items.add(reducida);
      entrada.files = transferencia.files;
      setAviso(`Foto reducida a ${Math.round(reducida.size / 1024)} KB.`);
    } catch {
      // Si el navegador no puede, se sube la original.
    }
  }

  return (
    <>
      <input
        id={id}
        name={nombre}
        type="file"
        accept={soloFoto ? "image/*" : "image/*,application/pdf"}
        capture={soloFoto ? undefined : "environment"}
        required={!opcional}
        onChange={alElegir}
      />
      {aviso && <span className="ayuda">{aviso}</span>}
    </>
  );
}

async function reducirImagen(archivo: File, ladoMaximo: number): Promise<File> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("Sin canvas");
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", CALIDAD_JPEG));
  if (!blob) throw new Error("No se pudo codificar");
  const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], nombre, { type: "image/jpeg" });
}
