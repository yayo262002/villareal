import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarPagos } from "./cuentas.ts";
import {
  DIAS_DE_CREDITO_POR_DEFECTO,
  conVencimiento,
  describirVencimiento,
  diasEntre,
  leerDiasDeCredito,
  resumenDeVencimiento,
  sumarDias,
} from "./credito.ts";

test("sumar días a una fecha, también pasando de mes y de año", () => {
  assert.equal(sumarDias("2026-09-25", 7), "2026-10-02");
  assert.equal(sumarDias("2026-12-30", 7), "2027-01-06");
  assert.equal(sumarDias("2026-09-25", 0), "2026-09-25");
  assert.equal(sumarDias("2026-09-25 10:30:00", 1), "2026-09-26");
  assert.equal(sumarDias("no es fecha", 3), "no es fecha");
});

test("días entre dos fechas, en los dos sentidos", () => {
  assert.equal(diasEntre("2026-09-01", "2026-09-29"), 28);
  assert.equal(diasEntre("2026-09-29", "2026-09-01"), -28);
  assert.equal(diasEntre("2026-09-29", "2026-09-29"), 0);
  assert.equal(diasEntre("x", "2026-09-29"), 0);
});

test("los días de crédito del formulario: 7 si no se dice, y nunca un disparate", () => {
  assert.equal(DIAS_DE_CREDITO_POR_DEFECTO, 7);
  assert.equal(leerDiasDeCredito(null), 7);
  assert.equal(leerDiasDeCredito(undefined), 7);
  assert.equal(leerDiasDeCredito(15), 15);
  assert.equal(leerDiasDeCredito(0), 0);
  assert.equal(leerDiasDeCredito(2.6), 3);
  assert.equal(leerDiasDeCredito(-3), 7);
  assert.equal(leerDiasDeCredito(9999), 7);
  assert.equal(leerDiasDeCredito(Number.NaN), 7);
});

const ventas = [
  { id: 1, fecha: "2026-09-01", total_usd: 10 },
  { id: 2, fecha: "2026-09-20", total_usd: 20 },
  { id: 3, fecha: "2026-09-28", total_usd: 30 },
];

test("cada nota vence a los días de crédito de su fecha; solo cuenta si queda algo por pagar", () => {
  const cuentas = conVencimiento(aplicarPagos(ventas, 10), 7, "2026-09-29");
  assert.deepEqual(
    cuentas.map((c) => [c.id, c.vence, c.atraso, c.vencida]),
    [
      [1, "2026-09-08", 21, false], // pagada: no está vencida aunque el plazo pasó
      [2, "2026-09-27", 2, true],
      [3, "2026-10-05", -6, false],
    ],
  );
});

test("el resumen separa lo vencido de lo que está en plazo", () => {
  const resumen = resumenDeVencimiento(aplicarPagos(ventas, 15), 7, "2026-09-29");
  assert.deepEqual(resumen, { vencido_usd: 15, en_plazo_usd: 30, mayor_atraso: 2, proximo_vencimiento: "2026-10-05" });
});

test("sin deuda no hay nada vencido ni próximo vencimiento", () => {
  assert.deepEqual(resumenDeVencimiento(aplicarPagos(ventas, 60), 7, "2026-09-29"), {
    vencido_usd: 0,
    en_plazo_usd: 0,
    mayor_atraso: 0,
    proximo_vencimiento: null,
  });
  assert.deepEqual(resumenDeVencimiento([], 7, "2026-09-29").vencido_usd, 0);
});

test("con cero días de crédito, la nota vence el mismo día y está vencida al siguiente", () => {
  const [hoy] = conVencimiento(aplicarPagos([ventas[2]], 0), 0, "2026-09-28");
  assert.equal(hoy.vencida, false);
  assert.equal(hoy.atraso, 0);
  const [manana] = conVencimiento(aplicarPagos([ventas[2]], 0), 0, "2026-09-29");
  assert.equal(manana.vencida, true);
});

test("el vencimiento dicho en palabras", () => {
  assert.equal(describirVencimiento(21), "Vencida hace 21 días");
  assert.equal(describirVencimiento(1), "Vencida desde ayer");
  assert.equal(describirVencimiento(0), "Vence hoy");
  assert.equal(describirVencimiento(-1), "Vence mañana");
  assert.equal(describirVencimiento(-6), "Vence en 6 días");
});
