import { test } from "node:test";
import assert from "node:assert/strict";
import {
  usdConSigno,
  usd,
  aBolivares,
  aDolares,
  precioDeVenta,
  precioParaCliente,
  esMetodoPago,
  fechaCorta,
  fechaDeLaBase,
  fechaEnVenezuela,
  fechaIso,
  mesLegible,
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

test("la fecha del formulario es la local, aunque en UTC ya sea mañana", () => {
  // Las 21:30 del 28 de septiembre en hora local. En Venezuela (UTC-4) son
  // la 01:30 UTC del 29, y toISOString() daría 2026-09-29.
  assert.equal(fechaIso(new Date(2026, 8, 28, 21, 30)), "2026-09-28");
  assert.equal(fechaIso(new Date(2026, 0, 5, 0, 0)), "2026-01-05");
});

test("la fecha es la de Venezuela aunque el servidor vaya en UTC", () => {
  // Las 21:30 del 28 en Venezuela son la 01:30 UTC del 29.
  assert.equal(fechaEnVenezuela(new Date("2026-09-29T01:30:00Z")), "2026-09-28");
  assert.equal(fechaEnVenezuela(new Date("2026-09-29T04:00:00Z")), "2026-09-29");
  assert.equal(fechaEnVenezuela(new Date("2027-01-01T03:59:59Z")), "2026-12-31");
});

test("los momentos que guarda la base, en UTC, se leen con la fecha de Venezuela", () => {
  assert.equal(fechaDeLaBase("2026-09-30 01:30:00"), "2026-09-29");
  assert.equal(fechaDeLaBase("2026-09-30 10:00:00"), "2026-09-30");
  assert.equal(fechaDeLaBase("2026-09-30T01:30:00Z"), "2026-09-29");
  assert.equal(fechaDeLaBase("2026-09-30"), "2026-09-30");
});

test("el mes del informe se escribe con nombre", () => {
  assert.equal(mesLegible("2026-09"), "Septiembre 2026");
  assert.equal(mesLegible("2026-01"), "Enero 2026");
});

test("el precio de venta es el costo más el margen", () => {
  assert.equal(precioDeVenta(6.8, 25), 8.5);
  assert.equal(precioDeVenta(6.8, 0), 6.8);
  assert.equal(precioDeVenta(10, 33.333), 13.33);
  assert.equal(precioDeVenta(null, 25), null);
  assert.equal(precioDeVenta(6.8, null), null);
  assert.equal(precioDeVenta(-1, 25), null);
});

test("al mayorista se le cobra al mayor y a los demás al detal", () => {
  const dos = { precio_usd: 8.5, precio_mayor_usd: 7.48 };
  assert.equal(precioParaCliente(dos, "mayor"), 7.48);
  assert.equal(precioParaCliente(dos, "detal"), 8.5);
  // Sin precio al mayor, el mayorista paga el de detal.
  assert.equal(precioParaCliente({ precio_usd: 8.5, precio_mayor_usd: null }, "mayor"), 8.5);
  assert.equal(precioParaCliente({ precio_usd: 8.5 }, "mayor"), 8.5);
  assert.equal(precioParaCliente({ precio_usd: null, precio_mayor_usd: null }, "detal"), null);
});

test("el precio en bolívares usa la tasa del día", () => {
  assert.equal(aBolivares(8.5, 36.5), 310.25);
  assert.equal(aBolivares(8.5, null), null);
  assert.equal(aBolivares(8.5, 0), null);
});

test("las fechas se muestran día/mes/año", () => {
  assert.equal(fechaCorta("2026-09-28"), "28/09/2026");
  assert.equal(fechaCorta("2026-09-28T10:00:00Z"), "28/09/2026");
});

test("un monto negativo lleva el signo delante, no pegado a la cifra", () => {
  assert.equal(usdConSigno(239.7), usd(239.7));
  assert.equal(usdConSigno(0), usd(0));
  assert.equal(usdConSigno(-239.7), "−" + usd(239.7));
});
