import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarPagos, movimientosDeCuenta } from "./cuentas.ts";

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

test("estado de cuenta: cada movimiento en su orden, con el saldo que deja", () => {
  const abonos = [
    { id: 2, fecha: "2026-09-20", monto_usd: 25 },
    { id: 1, fecha: "2026-09-05", monto_usd: 4 },
  ];
  assert.deepEqual(
    movimientosDeCuenta(ventas, abonos).map((m) => [m.tipo, m.id, m.cargo_usd, m.abono_usd, m.saldo_usd]),
    [
      ["venta", 1, 10, 0, 10],
      ["abono", 1, 0, 4, 6],
      ["venta", 2, 20, 0, 26],
      // El mismo día, primero la venta y después el abono.
      ["venta", 3, 30, 0, 56],
      ["abono", 2, 0, 25, 31],
    ],
  );
});

test("estado de cuenta: el último saldo es lo comprado menos lo abonado", () => {
  const abonos = [{ id: 1, fecha: "2026-09-02", monto_usd: 12.34 }];
  const movimientos = movimientosDeCuenta(ventas, abonos);
  assert.equal(movimientos.at(-1)?.saldo_usd, 47.66);
  assert.equal(aplicarPagos(ventas, 12.34).reduce((s, v) => s + v.pendiente_usd, 0).toFixed(2), "47.66");
});

test("estado de cuenta: quien paga de más queda con saldo a favor", () => {
  const movimientos = movimientosDeCuenta([{ id: 1, fecha: "2026-09-01", total_usd: 10 }], [{ id: 1, fecha: "2026-09-01", monto_usd: 15 }]);
  assert.deepEqual(movimientos.map((m) => m.saldo_usd), [10, -5]);
  assert.deepEqual(movimientosDeCuenta([], []), []);
});

test("el orden de entrada se respeta y el resultado no modifica las ventas originales", () => {
  const copia = ventas.map((v) => ({ ...v }));
  const cuentas = aplicarPagos(ventas, 5);
  assert.deepEqual(cuentas.map((v) => v.id), [3, 1, 2]);
  assert.deepEqual(ventas, copia);
});
