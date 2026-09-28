import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aDolares,
  esMetodoPago,
  fechaCorta,
  monedaDelMetodo,
  redondear,
} from "./dinero.ts";

test("un pago en dólares se guarda tal cual, redondeado a centavos", () => {
  assert.equal(aDolares(10, "USD", null), 10);
  assert.equal(aDolares(10.005, "USD", null), 10.01);
});

test("un pago en bolívares se convierte con la tasa", () => {
  assert.equal(aDolares(3600, "VES", 36), 100);
  assert.equal(aDolares(1000, "VES", 36.5), 27.4);
});

test("un pago en bolívares sin tasa no se acepta", () => {
  assert.throws(() => aDolares(1000, "VES", null), /tasa/);
  assert.throws(() => aDolares(1000, "VES", 0), /tasa/);
  assert.throws(() => aDolares(1000, "VES", -5), /tasa/);
});

test("pago móvil, transferencia y efectivo en bolívares van en bolívares", () => {
  assert.equal(monedaDelMetodo("pago_movil"), "VES");
  assert.equal(monedaDelMetodo("transferencia"), "VES");
  assert.equal(monedaDelMetodo("efectivo_bs"), "VES");
  assert.equal(monedaDelMetodo("efectivo_usd"), "USD");
  assert.equal(monedaDelMetodo("zelle"), "USD");
  assert.equal(monedaDelMetodo("binance"), "USD");
});

test("solo se reconocen los métodos definidos", () => {
  assert.equal(esMetodoPago("zelle"), true);
  assert.equal(esMetodoPago("paypal"), false);
  assert.equal(esMetodoPago(""), false);
});

test("redondear deja dos decimales sin arrastrar errores de coma flotante", () => {
  assert.equal(redondear(0.1 + 0.2), 0.3);
  assert.equal(redondear(2.675), 2.68);
});

test("las fechas se muestran día/mes/año", () => {
  assert.equal(fechaCorta("2026-09-28"), "28/09/2026");
  assert.equal(fechaCorta("2026-09-28T10:00:00Z"), "28/09/2026");
});
