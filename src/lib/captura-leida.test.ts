import { test } from "node:test";
import assert from "node:assert/strict";
import { bs, usd } from "./dinero.ts";
import { compararCaptura, describirCaptura, interpretarCaptura, propuestaDesdeCaptura, type CapturaLeida } from "./captura-leida.ts";

// Un pago móvil de Banesco: Bs 3.650,00 el 21/09/2026, referencia 004512.
const pagoMovil: CapturaLeida = {
  esComprobante: true,
  metodo: "pago_movil",
  moneda: "VES",
  monto: 3650,
  fecha: "2026-09-21",
  referencia: "004512",
  banco: "Banesco",
};

test("interpreta el JSON del lector, con el monto escrito a la venezolana y la referencia como número", () => {
  const texto = 'Aquí va:\n{"es_comprobante": true, "metodo": "Pago Movil", "moneda": "Bs", "monto": "3.650,00", "fecha": "2026-09-21", "referencia": 4512, "banco": "Banesco"}';
  assert.deepEqual(interpretarCaptura(texto), { ...pagoMovil, referencia: "4512" });
  assert.equal(interpretarCaptura("no veo nada"), null);
  assert.equal(interpretarCaptura('{"monto": 5}'), null);
  // Lo guardado se vuelve a leer igual.
  assert.deepEqual(interpretarCaptura(JSON.stringify(pagoMovil)), pagoMovil);
});

test("la propuesta: bolívares a dólares con la tasa de hoy, y la fecha de la captura", () => {
  const propuesta = propuestaDesdeCaptura(pagoMovil, 36.5, "2026-09-23");
  assert.deepEqual(propuesta, { metodo: "pago_movil", moneda: "VES", monto: 3650, fecha: "2026-09-21", referencia: "004512", tasa: 36.5, monto_usd: 100 });
  assert.equal(describirCaptura(pagoMovil, propuesta!), `Leí la captura: ${bs(3650)} por pago móvil del 21/09/2026, ref. 004512 (Banesco). A la tasa de hoy (${bs(36.5)} por dólar) son ${usd(100)}.`);
});

test("sin tasa no se inventa el equivalente; una fecha de mañana no vale; sin monto no hay propuesta", () => {
  const sinTasa = propuestaDesdeCaptura(pagoMovil, null, "2026-09-23")!;
  assert.equal(sinTasa.monto_usd, null);
  assert.match(describirCaptura(pagoMovil, sinTasa), /Falta la tasa del día/);
  assert.equal(propuestaDesdeCaptura({ ...pagoMovil, fecha: "2026-09-30" }, 36.5, "2026-09-23")!.fecha, "2026-09-23");
  assert.equal(propuestaDesdeCaptura({ ...pagoMovil, monto: null }, 36.5, "2026-09-23"), null);
  assert.equal(propuestaDesdeCaptura({ ...pagoMovil, esComprobante: false }, 36.5, "2026-09-23"), null);
});

test("el método y la moneda se cuadran: un Zelle es en dólares, un pago en bolívares sin método es transferencia", () => {
  const zelle = propuestaDesdeCaptura({ ...pagoMovil, metodo: "zelle", moneda: null, monto: 20 }, 36.5, "2026-09-23")!;
  assert.deepEqual([zelle.metodo, zelle.moneda, zelle.monto_usd, zelle.tasa], ["zelle", "USD", 20, null]);
  const binance = propuestaDesdeCaptura({ ...pagoMovil, metodo: "binance", moneda: null, monto: 15 }, 36.5, "2026-09-23")!;
  assert.deepEqual([binance.metodo, binance.moneda, binance.monto_usd], ["binance", "USD", 15]);
  const enBs = propuestaDesdeCaptura({ ...pagoMovil, metodo: "otro", moneda: "VES" }, 36.5, "2026-09-23")!;
  assert.deepEqual([enBs.metodo, enBs.moneda], ["transferencia", "VES"]);
  const enUsd = propuestaDesdeCaptura({ ...pagoMovil, metodo: "pago_movil", moneda: "USD", monto: 20 }, 36.5, "2026-09-23")!;
  assert.deepEqual([enUsd.metodo, enUsd.moneda], ["otro", "USD"]);
});

test("comparar: lo que cuadra no dice nada; el monto, la moneda y la fecha distintos se avisan", () => {
  assert.deepEqual(compararCaptura(pagoMovil, { monto: 3650, moneda: "VES", fecha: "2026-09-21" }), []);
  assert.deepEqual(compararCaptura(pagoMovil, { monto: 3650, moneda: "VES", fecha: "2026-09-21", metodo: "pago_movil" }), []);
  assert.deepEqual(compararCaptura(pagoMovil, { monto: 3650, moneda: "VES", fecha: "2026-09-21", metodo: "transferencia" }), [
    "La captura parece un pago por pago móvil y elegiste Transferencia.",
  ]);
  assert.deepEqual(compararCaptura({ ...pagoMovil, metodo: "binance", moneda: "USD", monto: 10 }, { monto: 10, moneda: "USD", fecha: "2026-09-21", metodo: "zelle" }), [
    "La captura parece un pago por Binance y elegiste Zelle.",
  ]);
  assert.deepEqual(compararCaptura(pagoMovil, { monto: 3000, moneda: "VES", fecha: "2026-09-22" }), [
    `La captura dice ${bs(3650)} y escribiste ${bs(3000)}.`,
    "La captura es del 21/09/2026 y la fecha anotada es 22/09/2026.",
  ]);
  assert.deepEqual(compararCaptura(pagoMovil, { monto: 100, moneda: "USD", fecha: "2026-09-21" }), ["La captura está en bolívares y el método elegido es en dólares."]);
  assert.deepEqual(compararCaptura({ ...pagoMovil, esComprobante: false }, { monto: 3650, moneda: "VES", fecha: "2026-09-21" }), [
    "Esa foto no parece el comprobante de un pago (la captura del pago móvil o de la transferencia).",
  ]);
});
