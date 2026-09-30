import { test } from "node:test";
import assert from "node:assert/strict";
import { bs, usd } from "./dinero.ts";
import {
  enlaceWhatsappA,
  esSoloUnTelefono,
  mensajeAbono,
  mensajeEnCamino,
  mensajeNota,
  mensajePedirResena,
  mensajeRecordatorio,
  mismoTelefono,
  numeroWhatsapp,
  telefonoLegible,
} from "./whatsapp.ts";

test("el teléfono se guarda siempre escrito igual", () => {
  assert.equal(telefonoLegible("04121234567"), "0412-1234567");
  assert.equal(telefonoLegible("+58 412 123.45.67"), "0412-1234567");
  assert.equal(telefonoLegible("412 1234567"), "0412-1234567");
  // Un fijo o un número a medias se deja como vino.
  assert.equal(telefonoLegible("  564 8335 "), "564 8335");
  assert.equal(telefonoLegible(""), "");
});

test("dos teléfonos con las mismas cifras son el mismo", () => {
  assert.equal(mismoTelefono("0412-1234567", "+58 412 1234567"), true);
  assert.equal(mismoTelefono("0412-1234567", "04121234567"), true);
  assert.equal(mismoTelefono("0412-1234567", "0412-1234568"), false);
  assert.equal(mismoTelefono("5648335", "564-8335"), true);
  assert.equal(mismoTelefono("", ""), false);
  assert.equal(mismoTelefono("123", "123"), false);
});

test("al cliente sin nombre no se le saluda por el teléfono", () => {
  assert.equal(esSoloUnTelefono("0412-1234567"), true);
  assert.equal(esSoloUnTelefono("Bodega Ana"), false);
  assert.equal(esSoloUnTelefono("Pizzería 2000"), false);
  const texto = mensajeRecordatorio({ negocio: "Villa Real", cliente: "0412-1234567", saldo_usd: 5, pendientes: [] });
  assert.match(texto, /^Hola, le saluda Villa Real\./);
});

test("los teléfonos venezolanos se normalizan al formato de wa.me", () => {
  assert.equal(numeroWhatsapp("0412-1234567"), "584121234567");
  assert.equal(numeroWhatsapp("0412 123.45.67"), "584121234567");
  assert.equal(numeroWhatsapp("+58 412 1234567"), "584121234567");
  assert.equal(numeroWhatsapp("4121234567"), "584121234567");
  assert.equal(numeroWhatsapp("584121234567"), "584121234567");
});

test("un teléfono incompleto o vacío no da enlace", () => {
  assert.equal(numeroWhatsapp(""), null);
  assert.equal(numeroWhatsapp("123"), null);
  assert.equal(numeroWhatsapp("0251-564833"), null);
  assert.equal(enlaceWhatsappA("", "hola"), null);
});

test("el enlace lleva el número y el mensaje codificado", () => {
  assert.equal(enlaceWhatsappA("0412-1234567", "Hola, ¿qué tal?"), "https://wa.me/584121234567?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F");
});

test("el recordatorio enumera las notas pendientes y lo que queda de cada una", () => {
  const texto = mensajeRecordatorio({
    negocio: "Comercializadora Villa Real",
    cliente: "Bodega Ana",
    saldo_usd: 18,
    pendientes: [{ fecha: "2026-09-15", total_usd: 23, pendiente_usd: 18 }],
  });
  assert.match(texto, /^Hola Bodega Ana, le saluda Comercializadora Villa Real\./);
  assert.match(texto, /Tiene pendiente USD 18,00:/);
  assert.match(texto, /• Nota del 15\/09\/2026: USD 23,00 \(quedan USD 18,00\)/);
  assert.match(texto, /Gracias/);
});

test("con tasa, el recordatorio y la nota llevan el monto en bolívares", () => {
  const recordatorio = mensajeRecordatorio({
    negocio: "Villa Real",
    cliente: "Ana",
    saldo_usd: 18,
    pendientes: [],
    tasa: 36.5,
  });
  assert.match(recordatorio, /Tiene pendiente USD 18,00 \(Bs 657,00\):/);
  assert.match(recordatorio, /a Bs 36,50 por dólar/);
  const nota = mensajeNota({ negocio: "X", cliente: "Y", fecha: "2026-09-15", lineas: [], total_usd: 23, saldo_usd: 0, tasa: 36.5 });
  assert.match(nota, /Total: USD 23,00 \(Bs 839,50\)/);
});

test("la nota de venta detalla las líneas, el total y el saldo", () => {
  const texto = mensajeNota({
    negocio: "Comercializadora Villa Real",
    cliente: "Bodega Ana",
    fecha: "2026-09-15",
    lineas: [
      { cantidad: 2.5, unidad: "kg", producto_nombre: "Queso amarillo", precio_unitario_usd: 6, subtotal_usd: 15 },
      { cantidad: 1, unidad: "kg", producto_nombre: "Queso mozzarella", precio_unitario_usd: 8, subtotal_usd: 8 },
    ],
    total_usd: 23,
    saldo_usd: 18,
  });
  assert.match(texto, /Nota del 15\/09\/2026/);
  assert.match(texto, /2,5 kg Queso amarillo × USD 6,00 = USD 15,00/);
  assert.match(texto, /Total: USD 23,00/);
  assert.match(texto, /Saldo pendiente: USD 18,00/);

  const alDia = mensajeNota({ negocio: "X", cliente: "Y", fecha: "2026-09-15", lineas: [], total_usd: 0, saldo_usd: 0 });
  assert.match(alDia, /Cuenta al día/);
});

test("el recibo de un abono en bolívares dice el monto, la tasa y cómo queda la cuenta", () => {
  const texto = mensajeAbono({
    negocio: "Villa Real",
    cliente: "Bodega Ana",
    fecha: "2026-09-20",
    metodo: "Pago móvil",
    monto: 146,
    moneda: "VES",
    tasa: 36.5,
    monto_usd: 4,
    referencia: "1234",
    saldo_usd: 6,
    tasaDelDia: 40,
  });
  assert.deepEqual(texto.split("\n"), [
    "Hola Bodega Ana, le saluda Villa Real.",
    "Recibimos su abono del 20/09/2026.",
    `Monto: ${bs(146)} (${usd(4)} a ${bs(36.5)} por dólar)`,
    "Método: Pago móvil",
    "Referencia: 1234",
    `Saldo pendiente a hoy: ${usd(6)} (${bs(240)})`,
    "¡Gracias!",
  ]);
});

test("el recibo de un abono en dólares, sin referencia, con la cuenta al día o a favor", () => {
  const abono = {
    negocio: "Villa Real",
    cliente: "0412-1234567",
    fecha: "2026-09-20",
    metodo: "Zelle",
    monto: 20,
    moneda: "USD" as const,
    tasa: null,
    monto_usd: 20,
    referencia: "",
  };
  assert.deepEqual(mensajeAbono({ ...abono, saldo_usd: 0 }).split("\n"), [
    "Hola, le saluda Villa Real.",
    "Recibimos su abono del 20/09/2026.",
    `Monto: ${usd(20)}`,
    "Método: Zelle",
    "Su cuenta queda al día.",
    "¡Gracias!",
  ]);
  assert.ok(mensajeAbono({ ...abono, saldo_usd: -5 }).includes(`Queda a su favor: ${usd(5)}`));
});

test("el aviso de que el pedido va en camino dice lo que se lleva", () => {
  const texto = mensajeEnCamino({
    negocio: "Villa Real",
    cliente: "Pizzería La Esquina",
    lineas: [
      { cantidad: 5, unidad: "kg", producto_nombre: "Queso mozzarella" },
      { cantidad: 2, unidad: "carton", producto_nombre: "Huevos" },
    ],
    total_usd: 50,
    tasa: 40,
  });
  assert.deepEqual(texto.split("\n"), [
    "Hola Pizzería La Esquina, le saluda Villa Real.",
    "Vamos en camino con su pedido:",
    "• 5 kg Queso mozzarella",
    "• 2 cartón Huevos",
    `Total: ${usd(50)} (${bs(2000)})`,
  ]);
  assert.equal(
    mensajeEnCamino({ negocio: "Villa Real", cliente: "Ana", lineas: [], total_usd: 0 }),
    "Hola Ana, le saluda Villa Real.\nVamos en camino con su pedido.",
  );
});

test("pedir una reseña: pregunta por el producto y pide permiso para publicarla", () => {
  const texto = mensajePedirResena({
    negocio: "Villa Real",
    cliente: "Pizzería 33",
    producto: "Queso mozzarella",
    enlace: "https://ejemplo.test/producto/2-queso-mozzarella",
  });
  assert.deepEqual(texto.split("\n"), [
    "Hola Pizzería 33, le saluda Villa Real.",
    "Nos gustaría conocer su opinión sobre este producto: queso mozzarella.",
    "¿Nos cuenta en un mensaje qué le ha parecido? Con su permiso, publicaremos su comentario en nuestra web con el nombre de su negocio.",
    "Aquí saldría: https://ejemplo.test/producto/2-queso-mozzarella",
    "¡Gracias!",
  ]);
});

test("pedir una reseña sin saber a quién: saluda sin nombre y no inventa enlace", () => {
  const texto = mensajePedirResena({ negocio: "Villa Real", producto: "Huevos" });
  assert.match(texto, /^Hola, le saluda Villa Real\./);
  assert.match(texto, /este producto: huevos\./);
  assert.doesNotMatch(texto, /Aquí saldría/);
  assert.match(mensajePedirResena({ negocio: "Villa Real", cliente: "0412-1234567", producto: "Huevos" }), /^Hola, le saluda/);
});
