import "server-only";
import { interpretarLectura, type NotaLeida } from "./nota-leida";

/**
 * Lee la foto de una nota de papel con un modelo que ve imágenes (Claude),
 * para comprobar que es una nota, qué fecha lleva y si la suma cuadra. Es
 * una ayuda, no un juez: lo que lee vuelve como avisos que el dueño
 * confirma o corrige (`nota-leida.ts`).
 *
 * Hace falta `ANTHROPIC_API_KEY`. Sin ella no se lee nada y todo sigue
 * funcionando como antes. Cada lectura cuesta una fracción de centavo.
 */

const MODELO_POR_DEFECTO = "claude-sonnet-5-5";
const ESPERA_MAXIMA_MS = 25_000;

/** Con esta variable, en las pruebas, la «lectura» viene escrita dentro de la propia imagen. */
const FALSO = "LECTOR_DE_NOTAS_FALSO";

const INSTRUCCIONES = `Eres el lector de notas de entrega de una quesería de Barquisimeto (Venezuela).
Te llega la foto de una hoja de talonario escrita a mano: arriba «Sello» y las casillas DIA / MES / AÑO y N.º; luego «Señor(es)», «Dirección» y «RIF»; una tabla con las columnas CANT., DESCRIPCIÓN, P.Unit. e IMPORTE; abajo SUB TOTAL, TOTAL y «FIRMA DEL CLIENTE».
Contesta SOLO con un JSON con esta forma exacta, sin texto alrededor:
{"es_nota": true, "fecha": "AAAA-MM-DD", "lineas": [{"descripcion": "...", "precio": 7.7, "importe": 38.5}], "total": 38.5, "firmada": true}
Reglas:
- "es_nota" es true solo si la foto es una nota o factura de este tipo (una hoja con tabla de cantidades e importes). Otra cosa (una persona, un producto, una pantalla, un papel distinto) es false.
- "fecha" sale de las casillas DIA / MES / AÑO. Un año de dos cifras es 20AA. Si no se lee, null.
- "lineas": una por renglón escrito de la tabla, con el precio unitario y el importe como números (la coma es el decimal: «38,5» es 38.5). Lo que no se lea, null.
- Ignora lo que se transparenta de otras hojas, los sellos y lo tachado.
- "total" es el número de la casilla TOTAL (o SUB TOTAL si TOTAL está vacío). Si no se lee, null.
- "firmada" es true si hay una firma sobre «FIRMA DEL CLIENTE», false si ese sitio está vacío, null si no se ve.
- Si dudas de un dato, pon null. No inventes.`;

export type FotoParaLeer = { tipo: string; datos: Uint8Array };

export function lectorDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env[FALSO]);
}

/** El lector de las pruebas: busca la lectura escrita dentro de la imagen; sin ella, no se pudo leer. */
function leerFalso(foto: FotoParaLeer): NotaLeida | null {
  const texto = Buffer.from(foto.datos).toString("latin1");
  const inicio = texto.indexOf('{"es_nota"');
  return inicio < 0 ? null : interpretarLectura(texto.slice(inicio));
}

/**
 * Lee la nota. Devuelve null si no hay lector, si no contesta a tiempo o
 * si contesta algo que no se entiende: nunca frena una venta por eso.
 */
export async function leerNota(foto: FotoParaLeer): Promise<NotaLeida | null> {
  if (process.env[FALSO]) return leerFalso(foto);
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return null;

  try {
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": clave, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      body: JSON.stringify({
        model: process.env.MODELO_LECTOR_DE_NOTAS || MODELO_POR_DEFECTO,
        max_tokens: 800,
        temperature: 0,
        system: INSTRUCCIONES,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: foto.tipo, data: Buffer.from(foto.datos).toString("base64") } },
              { type: "text", text: "Lee esta nota y contesta con el JSON." },
            ],
          },
        ],
      }),
    });
    if (!respuesta.ok) {
      console.error(`El lector de notas contestó ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
      return null;
    }
    const cuerpo = (await respuesta.json()) as { content?: { type: string; text?: string }[] };
    const texto = cuerpo.content?.find((b) => b.type === "text")?.text ?? "";
    const nota = interpretarLectura(texto);
    if (!nota) console.error(`El lector de notas contestó algo que no se entiende: ${texto.slice(0, 300)}`);
    return nota;
  } catch (error) {
    console.error("No se pudo leer la nota:", error instanceof Error ? error.message : error);
    return null;
  }
}
