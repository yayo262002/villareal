import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { firmaValida, leerWebhook, momentoDe, textoDelMensaje } from "./whatsapp-calculo.ts";

const NEGOCIO = { display_phone_number: "584246343236", phone_number_id: "111" };

test("la firma de Meta se comprueba con la clave secreta de la app; sin clave o con otra, no vale", () => {
  const cuerpo = '{"entry":[]}';
  const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
  assert.equal(firmaValida(cuerpo, firma, "secreto"), true);
  assert.equal(firmaValida(cuerpo + " ", firma, "secreto"), false);
  assert.equal(firmaValida(cuerpo, firma, "otro"), false);
  assert.equal(firmaValida(cuerpo, firma, ""), false);
  assert.equal(firmaValida(cuerpo, null, "secreto"), false);
  assert.equal(firmaValida(cuerpo, "sha256=abc", "secreto"), false);
});

test("el mensaje de un cliente: su teléfono, su nombre de WhatsApp, el texto y la hora", () => {
  const leido = leerWebhook({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: NEGOCIO,
              contacts: [{ profile: { name: "Nelson" }, wa_id: "584121234567" }],
              messages: [
                { from: "584121234567", id: "wamid.1", timestamp: "1763749805", type: "text", text: { body: "¿A cuánto la mozzarella?" } },
                { from: "584121234567", id: "wamid.2", timestamp: "1763749810", type: "image", image: { caption: "el pago" } },
              ],
              statuses: [{ id: "wamid.x", status: "read" }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(leido.mensajes.length, 2);
  assert.deepEqual(leido.mensajes[0], {
    wamid: "wamid.1",
    telefono: "584121234567",
    nombre: "Nelson",
    direccion: "entrante",
    origen: "cliente",
    tipo: "text",
    texto: "¿A cuánto la mozzarella?",
    momento: "2025-11-21 18:30:05",
  });
  assert.equal(leido.mensajes[1].texto, "Foto: el pago");
});

test("lo que el dueño contesta desde el teléfono llega como eco, hacia el cliente", () => {
  const leido = leerWebhook({
    entry: [{ changes: [{ field: "smb_message_echoes", value: { metadata: NEGOCIO, message_echoes: [{ from: "584246343236", to: "584121234567", id: "wamid.3", timestamp: "1763749900", type: "text", text: { body: "A 8,36 el kilo" } }] } }] }],
  });
  assert.equal(leido.mensajes[0].direccion, "saliente");
  assert.equal(leido.mensajes[0].origen, "telefono");
  assert.equal(leido.mensajes[0].telefono, "584121234567");
  assert.equal(leido.mensajes[0].texto, "A 8,36 el kilo");
});

test("el historial: cada chat con sus mensajes, de un lado y del otro; y si el cliente no lo dejó compartir, el error", () => {
  const leido = leerWebhook({
    entry: [
      {
        changes: [
          {
            field: "history",
            value: {
              metadata: NEGOCIO,
              history: [
                {
                  metadata: { phase: 0 },
                  threads: [
                    {
                      id: "584121234567",
                      messages: [
                        { from: "584121234567", id: "h.1", timestamp: "1763000000", type: "text", text: { body: "Hola" } },
                        { from: "584246343236", id: "h.2", timestamp: "1763000100", type: "text", text: { body: "Buenas" } },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { field: "history", value: { history: [{ errors: [{ code: 2593109, title: "History sharing declined" }] }] } },
        ],
      },
    ],
  });
  assert.deepEqual(
    leido.mensajes.map((m) => [m.wamid, m.direccion, m.origen]),
    [
      ["h.1", "entrante", "historial"],
      ["h.2", "saliente", "historial"],
    ],
  );
  assert.deepEqual(leido.erroresDelHistorial, ["2593109 History sharing declined"]);
});

test("los avisos de la cuenta se anotan, y lo que no se entiende no rompe nada", () => {
  assert.deepEqual(leerWebhook({ entry: [{ changes: [{ field: "account_update", value: { event: "PARTNER_ADDED" } }] }] }).eventos, ["PARTNER_ADDED"]);
  assert.deepEqual(leerWebhook(null), { mensajes: [], eventos: [], erroresDelHistorial: [] });
  assert.deepEqual(leerWebhook({ entry: [{ changes: [{ field: "messages", value: { messages: [{ type: "text" }] } }] }] }).mensajes, []);
});

test("cada tipo de mensaje se lee como se diría", () => {
  assert.equal(textoDelMensaje({ type: "audio", audio: { voice: true } }), "Nota de voz");
  assert.equal(textoDelMensaje({ type: "location", location: { latitude: 10.06, longitude: -69.32 } }), "Ubicación: 10.06, -69.32");
  assert.equal(textoDelMensaje({ type: "document", document: { filename: "lista.pdf" } }), "Documento: lista.pdf");
  assert.equal(textoDelMensaje({ type: "interactive", interactive: { button_reply: { title: "Sí" } } }), "Sí");
  assert.equal(textoDelMensaje({ type: "unsupported" }), "Mensaje que la API no enseña (unsupported)");
  assert.equal(momentoDe("no", new Date("2026-11-21T12:00:00Z")), "2026-11-21 12:00:00");
});
