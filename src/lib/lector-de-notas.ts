import "server-only";
import { interpretarLectura, type NotaLeida } from "./nota-leida";
import { interpretarCaptura, type CapturaLeida } from "./captura-leida";

/**
 * Lee fotos con un modelo que ve imágenes (Claude): la nota de papel
 * firmada (que sea una nota, su fecha, su suma) y la captura de un pago
 * (monto, fecha, referencia). Es una ayuda, no un juez: lo que lee vuelve
 * como propuesta o como avisos que el dueño confirma o corrige
 * (`nota-leida.ts`, `captura-leida.ts`).
 *
 * Hace falta `ANTHROPIC_API_KEY`. Sin ella no se lee nada y todo sigue
 * funcionando como antes. Cada lectura cuesta una fracción de centavo.
 */

const MODELO_POR_DEFECTO = "claude-sonnet-5-5";
const ESPERA_MAXIMA_MS = 25_000;

/** Con esta variable, en las pruebas, la «lectura» viene escrita dentro de la propia imagen. */
const FALSO = "LECTOR_DE_NOTAS_FALSO";

const INSTRUCCIONES_NOTA = `Eres el lector de notas de entrega de una quesería de Barquisimeto (Venezuela).
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

const INSTRUCCIONES_CAPTURA = `Eres el lector de comprobantes de pago de una quesería de Barquisimeto (Venezuela).
Te llega la captura de pantalla de un pago: un pago móvil o una transferencia de un banco venezolano (Banesco, Mercantil, Provincial, Banco de Venezuela, Bancamiga, BNC, Bancaribe, BBVA, Banplus…), o un pago en dólares (Zelle, Binance).
Contesta SOLO con un JSON con esta forma exacta, sin texto alrededor:
{"es_comprobante": true, "metodo": "pago_movil", "moneda": "VES", "monto": 3650.00, "fecha": "AAAA-MM-DD", "referencia": "004512", "banco": "Banesco"}
Reglas:
- "es_comprobante" es true solo si la imagen es el comprobante de un pago o transferencia (un recibo o una pantalla con monto, fecha y referencia). Otra cosa es false.
- "metodo": "pago_movil" si dice pago móvil o P2P; "transferencia" si es una transferencia bancaria; "zelle" si es Zelle; "otro" en cualquier otro caso.
- "moneda": "VES" si el monto está en bolívares (Bs, Bs.S, VES); "USD" si está en dólares ($, USD). Si no se sabe, null.
- "monto": el monto pagado, como número. En Venezuela el punto separa los miles y la coma los decimales: «3.650,00» es 3650.00.
- "fecha": la fecha del pago en AAAA-MM-DD. En Venezuela se escribe día/mes/año: «21/09/2026» es 2026-09-21. Si no se lee, null.
- "referencia": el número de referencia u operación completo, como texto, sin espacios. Si no se lee, null.
- "banco": el banco que emite el comprobante, si se ve; si no, null.
- Si dudas de un dato, pon null. No inventes.`;

export type FotoParaLeer = { tipo: string; datos: Uint8Array };

export function lectorDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env[FALSO]);
}

/** El lector de las pruebas: busca la lectura escrita dentro de la imagen; sin ella, no se pudo leer. */
function textoFalso(foto: FotoParaLeer, marca: string): string | null {
  const texto = Buffer.from(foto.datos).toString("latin1");
  const inicio = texto.indexOf(marca);
  return inicio < 0 ? null : texto.slice(inicio);
}

/** Le enseña la foto al modelo con unas instrucciones y devuelve lo que contesta, o null si no contesta o falla. */
async function preguntar(instrucciones: string, foto: FotoParaLeer, que: string): Promise<string | null> {
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
        system: instrucciones,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: foto.tipo, data: Buffer.from(foto.datos).toString("base64") } },
              { type: "text", text: `Lee ${que} y contesta con el JSON.` },
            ],
          },
        ],
      }),
    });
    if (!respuesta.ok) {
      console.error(`El lector contestó ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
      return null;
    }
    const cuerpo = (await respuesta.json()) as { content?: { type: string; text?: string }[] };
    return cuerpo.content?.find((b) => b.type === "text")?.text ?? "";
  } catch (error) {
    console.error(`No se pudo leer ${que}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Lee la nota de papel. Devuelve null si no hay lector, si no contesta a
 * tiempo o si contesta algo que no se entiende: nunca frena una venta.
 */
export async function leerNota(foto: FotoParaLeer): Promise<NotaLeida | null> {
  const texto = process.env[FALSO] ? textoFalso(foto, '{"es_nota"') : await preguntar(INSTRUCCIONES_NOTA, foto, "esta nota");
  if (texto === null) return null;
  const nota = interpretarLectura(texto);
  if (!nota && !process.env[FALSO]) console.error(`El lector de notas contestó algo que no se entiende: ${texto.slice(0, 300)}`);
  return nota;
}

/** Lee la captura de un pago. Igual que la nota: si no se puede, null y el abono sigue. */
export async function leerCaptura(foto: FotoParaLeer): Promise<CapturaLeida | null> {
  const texto = process.env[FALSO] ? textoFalso(foto, '{"es_comprobante"') : await preguntar(INSTRUCCIONES_CAPTURA, foto, "este comprobante de pago");
  if (texto === null) return null;
  const captura = interpretarCaptura(texto);
  if (!captura && !process.env[FALSO]) console.error(`El lector de capturas contestó algo que no se entiende: ${texto.slice(0, 300)}`);
  return captura;
}
