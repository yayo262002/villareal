import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarPagos } from "./cuentas.ts";

const ventas = [
  { id: 3, fecha: "2026-09-20", total_usd: 30 },
  { id: 1, fecha: "2026-09-01", total_usd: 10 },
  { id: 2, fecha: "2026-09-10", total_usd: 20 },
];

function resumen(totalPagado: number) {
  return aplicarPagos(ventas, totalPagado).map((v) => [v.id, v.estado, v.pagado_usd, v.pendiente_usd]);
}

test("sin pagos, todas las ventas están por pagar", () => {
  assert.deepEqual(resumen(0), [
    [3, "por_pagar", 0, 30],
    [1, "por_pagar", 0, 10],
    [2, "por_pagar", 0, 20],
  ]);
});

test("los pagos cubren primero las ventas más antiguas", () => {
  assert.deepEqual(resumen(25), [
    [3, "por_pagar", 0, 30],
    [1, "pagada", 10, 0],
    [2, "parcial", 15, 5],
  ]);
});

test("con todo pagado no queda nada pendiente, y el sobrante no inventa deuda negativa", () => {
  assert.deepEqual(resumen(60), [
    [3, "pagada", 30, 0],
    [1, "pagada", 10, 0],
    [2, "pagada", 20, 0],
  ]);
  assert.deepEqual(resumen(100).map((v) => v[3]), [0, 0, 0]);
});

test("lo pendiente suma exactamente el saldo del cliente", () => {
  const cuentas = aplicarPagos(ventas, 12.34);
  const pendiente = cuentas.reduce((s, v) => s + v.pendiente_usd, 0);
  assert.equal(Math.round(pendiente * 100) / 100, 60 - 12.34);
});

test("el orden de entrada se respeta y el resultado no modifica las ventas originales", () => {
  const copia = ventas.map((v) => ({ ...v }));
  const cuentas = aplicarPagos(ventas, 5);
  assert.deepEqual(cuentas.map((v) => v.id), [3, 1, 2]);
  assert.deepEqual(ventas, copia);
});
