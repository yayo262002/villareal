import { test } from "node:test";
import assert from "node:assert/strict";
import { enlaceWhatsappA, mensajeNota, mensajeRecordatorio, numeroWhatsapp } from "./whatsapp.ts";

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
