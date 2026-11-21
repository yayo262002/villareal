import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lo que Meta manda a `/api/whatsapp` desde que el número del negocio está conectado con coexistencia (el número sigue
 * en WhatsApp Business del teléfono y, a la vez, en la API): cada mensaje que escribe un cliente (`messages`), cada uno
 * que el dueño contesta desde el teléfono (`smb_message_echoes`) y, una sola vez al conectar, los chats de los últimos
 * seis meses (`history`). Aquí solo se leen y se comprueba la firma: puro, con pruebas. Guardarlos, en
 * `whatsapp-api.ts`.
 */

/** La versión de la API de Meta con la que se habla (la del ejemplo de Meta en noviembre de 2026). */
export const VERSION_GRAPH = "v27.0";

export type DireccionMensaje = "entrante" | "saliente";
/** De dónde salió: lo escribió el cliente, lo contestó el dueño en el teléfono, o vino con el historial al conectar. */
export type OrigenMensaje = "cliente" | "telefono" | "historial";

export type MensajeLeido = {
  /** El id del mensaje en WhatsApp: el mismo mensaje dos veces es uno. */
  wamid: string;
  /** Las cifras del teléfono del cliente, como las da WhatsApp: «584121234567». */
  telefono: string;
  /** El nombre con que el cliente sale en WhatsApp, si llegó. */
  nombre: string;
  direccion: DireccionMensaje;
  origen: OrigenMensaje;
  /** text, image, audio… como lo dice WhatsApp. */
  tipo: string;
  /** Lo que se lee del mensaje: el texto, o «Foto: …», «Nota de voz»… */
  texto: string;
  /** En hora UTC, como `datetime('now')`: «2026-11-21 18:30:05». */
  momento: string;
};

export type WebhookLeido = {
  mensajes: MensajeLeido[];
  /** Avisos de la cuenta (`account_update`): «PARTNER_ADDED», «PARTNER_REMOVED»… */
  eventos: string[];
  /** El cliente no dejó compartir el historial al conectar (error 2593109), u otro error del historial. */
  erroresDelHistorial: string[];
};

/**
 * Si la petición viene de verdad de Meta: lleva la cabecera `X-Hub-Signature-256` («sha256=…»), la firma del cuerpo
 * con la clave secreta de la app. Sin clave o sin firma, no.
 */
export function firmaValida(cuerpo: string, cabecera: string | null, secreto: string): boolean {
  if (!secreto || !cabecera?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpo, "utf8").digest();
  const recibida = Buffer.from(cabecera.slice(7), "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Objeto) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const cifras = (v: unknown): string => texto(v).replace(/\D/g, "");

/** «1763749805» (segundos) → «2026-11-21 18:30:05», en UTC. Sin una hora creíble, la de ahora. */
export function momentoDe(segundos: unknown, ahora = new Date()): string {
  const n = Number(texto(segundos));
  const fecha = Number.isFinite(n) && n > 1_500_000_000 ? new Date(n * 1000) : ahora;
  return fecha.toISOString().slice(0, 19).replace("T", " ");
}

/** Lo que se lee de un mensaje, sea del tipo que sea. Lo que no se sabe leer lo dice, no se calla. */
export function textoDelMensaje(m: Objeto): string {
  const tipo = texto(m.type);
  const con = (etiqueta: string, pie: unknown) => (texto(pie).trim() ? `${etiqueta}: ${texto(pie).trim()}` : etiqueta);
  switch (tipo) {
    case "text":
      return texto(objeto(m.text).body);
    case "image":
      return con("Foto", objeto(m.image).caption);
    case "video":
      return con("Video", objeto(m.video).caption);
    case "audio":
      return objeto(m.audio).voice === false ? "Audio" : "Nota de voz";
    case "document":
      return con("Documento", objeto(m.document).caption || objeto(m.document).filename);
    case "sticker":
      return "Sticker";
    case "location": {
      const l = objeto(m.location);
      const donde = [texto(l.name), texto(l.address)].filter(Boolean).join(", ");
      return donde ? `Ubicación: ${donde}` : `Ubicación: ${texto(l.latitude)}, ${texto(l.longitude)}`;
    }
    case "contacts":
      return con("Contacto", lista(m.contacts).map((c) => texto(objeto(objeto(c).name).formatted_name)).filter(Boolean).join(", "));
    case "reaction":
      return con("Reacción", objeto(m.reaction).emoji);
    case "button":
      return texto(objeto(m.button).text);
    case "interactive": {
      const i = objeto(m.interactive);
      return texto(objeto(i.button_reply).title) || texto(objeto(i.list_reply).title) || "Respuesta a un botón";
    }
    case "order":
      return "Pedido desde el catálogo de WhatsApp";
    default:
      return tipo ? `Mensaje que la API no enseña (${tipo})` : "Mensaje que la API no enseña";
  }
}

/**
 * Todo lo que trae un aviso de Meta: los mensajes de los clientes, lo que el dueño contestó desde el teléfono y el
 * historial, cada uno con su teléfono, su dirección y su texto. Lo demás (los «entregado», «leído») no se guarda.
 */
export function leerWebhook(cuerpo: unknown, ahora = new Date()): WebhookLeido {
  const salida: WebhookLeido = { mensajes: [], eventos: [], erroresDelHistorial: [] };
  for (const entrada of lista(objeto(cuerpo).entry)) {
    for (const cambio of lista(objeto(entrada).changes)) {
      const campo = texto(objeto(cambio).field);
      const valor = objeto(objeto(cambio).value);
      const delNegocio = cifras(objeto(valor.metadata).display_phone_number);
      if (campo === "messages") {
        const nombres = new Map(lista(valor.contacts).map((c) => [cifras(objeto(c).wa_id), texto(objeto(objeto(c).profile).name)]));
        for (const m of lista(valor.messages).map(objeto)) {
          const telefono = cifras(m.from);
          if (!texto(m.id) || !telefono) continue;
          salida.mensajes.push({
            wamid: texto(m.id),
            telefono,
            nombre: nombres.get(telefono) ?? "",
            direccion: "entrante",
            origen: "cliente",
            tipo: texto(m.type),
            texto: textoDelMensaje(m),
            momento: momentoDe(m.timestamp, ahora),
          });
        }
      } else if (campo === "smb_message_echoes") {
        for (const m of lista(valor.message_echoes).map(objeto)) {
          const telefono = cifras(m.to);
          if (!texto(m.id) || !telefono) continue;
          salida.mensajes.push({ wamid: texto(m.id), telefono, nombre: "", direccion: "saliente", origen: "telefono", tipo: texto(m.type), texto: textoDelMensaje(m), momento: momentoDe(m.timestamp, ahora) });
        }
      } else if (campo === "history") {
        for (const parte of lista(valor.history).map(objeto)) {
          for (const e of lista(parte.errors).map(objeto)) salida.erroresDelHistorial.push(`${texto(e.code)} ${texto(e.title) || texto(e.message)}`.trim());
          for (const hilo of lista(parte.threads).map(objeto)) {
            const cliente = cifras(hilo.id);
            for (const m of lista(hilo.messages).map(objeto)) {
              if (!texto(m.id) || !cliente) continue;
              const saliente = delNegocio ? cifras(m.from) === delNegocio : cifras(m.from) !== cliente;
              salida.mensajes.push({ wamid: texto(m.id), telefono: cliente, nombre: "", direccion: saliente ? "saliente" : "entrante", origen: "historial", tipo: texto(m.type), texto: textoDelMensaje(m), momento: momentoDe(m.timestamp, ahora) });
            }
          }
        }
      } else if (campo === "account_update") {
        const evento = texto(valor.event);
        if (evento) salida.eventos.push(evento);
      }
    }
  }
  return salida;
}
