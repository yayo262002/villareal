import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { negocio, whatsappLegible } from "@/config/negocio";

/**
 * La imagen que sale en la vista previa cuando se comparte un enlace de la
 * web por WhatsApp, Facebook o Instagram. Es lo primero que ve quien
 * recibe el enlace, antes de abrirlo.
 *
 * Se dibuja con `next/og`, que solo entiende cajas flexibles y una parte
 * pequeña de CSS: cada caja con más de un hijo lleva `display: flex`, y los
 * textos van en una sola cadena.
 */

export const TAMANO_IMAGEN = { width: 1200, height: 630 };

const COLOR = {
  fondo: "#163f28",
  fondoOscuro: "#0d2a1a",
  oro: "#f3c84b",
  crema: "#fffdf7",
  cremaSuave: "#d9e2d6",
  tinta: "#0d2a1a",
};

const carpetaFuentes = path.join(process.cwd(), "src", "assets", "fuentes");

async function fuentes() {
  const [negra, media] = await Promise.all([
    readFile(path.join(carpetaFuentes, "ArchivoBlack-Regular.ttf")),
    readFile(path.join(carpetaFuentes, "Archivo-Medium.ttf")),
  ]);
  return [
    { name: "Archivo Black", data: negra, weight: 400 as const, style: "normal" as const },
    { name: "Archivo", data: media, weight: 500 as const, style: "normal" as const },
  ];
}

/** El león de la marca, como dato para ponerlo en un `<img>`. */
async function leon(): Promise<string> {
  const svg = await readFile(path.join(process.cwd(), "public", "marca", "leon.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/**
 * La foto de un producto para la vista previa, recortada en un cuadrado:
 * la que subió el dueño (los bytes de la base) o la de referencia (de
 * `public/productos/`). Va en JPEG, que es lo que entiende `next/og`. Si
 * no hay ninguna o no se puede leer, null: entonces sale el león.
 */
export async function fotoParaCompartir(origen: { datos?: ArrayBuffer | null; ruta?: string | null }): Promise<string | null> {
  try {
    const entrada = origen.datos
      ? Buffer.from(origen.datos)
      : origen.ruta
        ? await readFile(path.join(process.cwd(), "public", ...origen.ruta.split("?")[0].split("/").filter(Boolean)))
        : null;
    if (!entrada) return null;
    const jpeg = await sharp(entrada).resize(680, 680, { fit: "cover" }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function imagenSocial(datos: {
  /** La etiqueta pequeña de arriba: «El queso del pizzero». */
  antetitulo?: string;
  titulo: string;
  /** Una línea bajo el título: el precio o el lema. */
  detalle?: string;
  /** La foto de la derecha. Sin ella va el león en grande. */
  foto?: ReactElement;
}): Promise<ImageResponse> {
  const [tipos, logo] = await Promise.all([fuentes(), leon()]);
  const largo = datos.titulo.length;
  const cuerpoTitulo = largo > 22 ? 64 : largo > 16 ? 78 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          color: COLOR.crema,
          fontFamily: "Archivo",
          backgroundColor: COLOR.fondo,
          backgroundImage: `linear-gradient(135deg, ${COLOR.fondo} 0%, ${COLOR.fondoOscuro} 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={logo} width={58} height={92} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 22 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 34, color: COLOR.oro }}>{negocio.nombre}</div>
            <div style={{ fontSize: 24, color: COLOR.cremaSuave, letterSpacing: 2 }}>{negocio.lema.toUpperCase()}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: datos.foto ? 700 : 760 }}>
            {datos.antetitulo && (
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    backgroundColor: COLOR.oro,
                    color: COLOR.tinta,
                    fontSize: 26,
                    letterSpacing: 2,
                    padding: "8px 22px",
                    borderRadius: 999,
                  }}
                >
                  {datos.antetitulo.toUpperCase()}
                </div>
              </div>
            )}
            <div style={{ fontFamily: "Archivo Black", fontSize: cuerpoTitulo, lineHeight: 1.05, marginTop: 18 }}>
              {datos.titulo}
            </div>
            {datos.detalle && (
              <div style={{ fontSize: 40, color: COLOR.oro, marginTop: 18 }}>{datos.detalle}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 340, height: 340 }}>
            {datos.foto ?? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={logo} width={208} height={330} />
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `3px solid ${COLOR.oro}`,
            paddingTop: 20,
            fontSize: 27,
            color: COLOR.cremaSuave,
          }}
        >
          <div>{`Tienda física · ${negocio.direccion.split(",")[0]}, ${negocio.localidad}`}</div>
          <div style={{ color: COLOR.oro }}>{`WhatsApp ${whatsappLegible()}`}</div>
        </div>
      </div>
    ),
    { ...TAMANO_IMAGEN, fonts: tipos },
  );
}
