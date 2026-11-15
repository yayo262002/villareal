import Link from "next/link";
import { GRUPOS_DE_STICKERS, STICKERS, stickersDeSiempre, stickersDelGrupo, type GrupoDeSticker, type Sticker } from "@/lib/stickers";
import estilos from "../panel.module.css";
import { exigirPanel } from "@/lib/panel";

export const metadata = { title: "Stickers para WhatsApp" };

/**
 * Los stickers de Villa Real para responder a los clientes por WhatsApp:
 * se guardan en el teléfono desde aquí y en WhatsApp se convierten en
 * sticker con la foto. Los dibuja `scripts/stickers.ts`.
 */
function Stickers({ lista }: { lista: Sticker[] }) {
  return (
    <ul className={estilos.stickers}>
      {lista.map((s) => (
        <li key={s.slug} className={estilos.sticker}>
          <a href={`/stickers/${s.slug}.png`} download title={s.lineas.join(" ")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/stickers/${s.slug}.png`} alt={s.lineas.join(" ")} width={512} height={512} loading="lazy" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaStickers() {
  await exigirPanel();
  const grupos = (Object.keys(GRUPOS_DE_STICKERS) as GrupoDeSticker[]).filter((g) => stickersDelGrupo(g).length > 0);
  const deSiempre = stickersDeSiempre();
  const otros = STICKERS.length - deSiempre.length;
  return (
    <>
      <div>
        <p>
          <Link href="/admin">← Resumen</Link>
        </p>
        <h1 className={estilos.titulo}>Stickers para WhatsApp</h1>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Los de todos los días</h2>
        <Stickers lista={deSiempre} />
      </section>

      <section className="tarjeta">
        <p className={estilos.ayuda}>
          Tienen el fondo transparente, su borde blanco y el tamaño de los stickers de WhatsApp. Guárdalos desde aquí, no con una captura de pantalla: la
          captura trae el fondo blanco de la página y en el chat sale un cuadro blanco alrededor.
        </p>
        <h2 className={estilos.subtituloPequeno}>Cómo ponerlos en tu WhatsApp (iPhone)</h2>
        <ol className={estilos.pasos}>
          <li>Mantén pulsado el sticker que quieras y toca «Guardar en Fotos» (o «Guardar imagen»): queda en Fotos.</li>
          <li>En WhatsApp, abre un chat y toca el «+» de al lado del mensaje → «Sticker».</li>
          <li>Elige la imagen de Fotos y toca «Añadir». Ya queda entre tus stickers para siempre.</li>
        </ol>
        <h2 className={estilos.subtituloPequeno}>En Android</h2>
        <ol className={estilos.pasos}>
          <li>Mantén pulsado el sticker y toca «Descargar imagen».</li>
          <li>En WhatsApp, en un chat, toca el emoji → stickers → «Crear» (o el «+»), elige la imagen y guárdala.</li>
        </ol>
        <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
          Para el computador:{" "}
          <a href="/stickers/stickers-villa-real.zip" download>
            descargar todos (ZIP)
          </a>
          .
        </p>
      </section>

      <details className="tarjeta">
        <summary>
          <strong>Otros stickers ({otros})</strong>: saludos, productos, horario y más
        </summary>
        {grupos.map((grupo) => (
          <div key={grupo}>
            <h2 className={estilos.subtitulo}>{GRUPOS_DE_STICKERS[grupo]}</h2>
            <Stickers lista={stickersDelGrupo(grupo)} />
          </div>
        ))}
      </details>
    </>
  );
}
