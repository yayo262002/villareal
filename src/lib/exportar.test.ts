import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CABECERA_DE_MOVIMIENTOS,
  CABECERA_POR_DIA,
  aCsv,
  celda,
  filasDeMovimientos,
  filasPorDia,
  leerFecha,
  leerPeriodo,
  nombreDelArchivo,
  numeroParaExcel,
  type Movimientos,
} from "./exportar.ts";

const movimientos: Movimientos = {
  ventas: [
    {
      id: 12,
      fecha: "2026-09-20",
      cliente_nombre: "Pizzería 33",
      total_usd: 50.5,
      nota: "Entregar antes de las 11",
      lineas: [
        { cantidad: 5, unidad: "kg", producto_nombre: "Queso mozzarella" },
        { cantidad: 2, unidad: "carton", producto_nombre: "Huevos" },
      ],
    },
    { id: 3, fecha: "2026-09-01", cliente_nombre: "Bodega; la de Ana", total_usd: 10, nota: "", lineas: [{ cantidad: 0.25, unidad: "kg", producto_nombre: "Queso amarillo" }] },
  ],
  abonos: [
    { id: 7, fecha: "2026-09-20", cliente_nombre: "Pizzería 33", metodo: "pago_movil", moneda: "VES", monto: 146, tasa: 36.5, monto_usd: 4, referencia: "4471", nota: "" },
    { id: 8, fecha: "2026-09-20", cliente_nombre: "Pizzería 33", metodo: "zelle", moneda: "USD", monto: 20, tasa: null, monto_usd: 20, referencia: "", nota: "" },
  ],
  compras: [{ id: 2, fecha: "2026-09-15", proveedor_nombre: "Quesos del Tocuyo", descripcion: "100 kg de mozzarella a 6,80", total_usd: 680, nota: "Factura 1188" }],
  pagos: [{ id: 1, fecha: "2026-09-20", proveedor_nombre: "Quesos del Tocuyo", metodo: "transferencia", moneda: "VES", monto: 300000, tasa: 857.8876, monto_usd: 349.7, referencia: "9921", nota: "" }],
};

test("los números van con coma decimal y sin separador de miles, como los lee Excel en castellano", () => {
  assert.equal(numeroParaExcel(10.5), "10,50");
  assert.equal(numeroParaExcel(300000), "300000,00");
  assert.equal(numeroParaExcel(857.8876, 4), "857,8876");
  assert.equal(numeroParaExcel(0), "0,00");
  assert.equal(numeroParaExcel(null), "");
  assert.equal(numeroParaExcel(undefined), "");
  assert.equal(numeroParaExcel(Number.NaN), "");
});

test("una celda con punto y coma, comillas o salto de línea va entre comillas", () => {
  assert.equal(celda("Pizzería 33"), "Pizzería 33");
  assert.equal(celda("Bodega; la de Ana"), '"Bodega; la de Ana"');
  assert.equal(celda('La "33"'), '"La ""33"""');
  assert.equal(celda("dos\nlíneas"), '"dos\nlíneas"');
  assert.equal(celda(null), "");
  assert.equal(celda(7), "7");
});

test("el archivo empieza con la marca de UTF-8 y separa con punto y coma", () => {
  const csv = aCsv(["A", "B"], [["1", "x;y"]]);
  assert.equal(csv, '﻿A;B\r\n1;"x;y"\r\n');
});

test("una fila por movimiento, del día más antiguo al más nuevo y en orden dentro del día", () => {
  const filas = filasDeMovimientos(movimientos);
  assert.deepEqual(
    filas.map((f) => [f[0], f[1], f[3]]),
    [
      ["01/09/2026", "Venta", "Bodega; la de Ana"],
      ["15/09/2026", "Compra", "Quesos del Tocuyo"],
      ["20/09/2026", "Venta", "Pizzería 33"],
      ["20/09/2026", "Abono", "Pizzería 33"],
      ["20/09/2026", "Abono", "Pizzería 33"],
      ["20/09/2026", "Pago a proveedor", "Quesos del Tocuyo"],
    ],
  );
  for (const fila of filas) assert.equal(fila.length, CABECERA_DE_MOVIMIENTOS.length);
});

test("cada monto en dólares va en su columna, y el abono en bolívares lleva su tasa", () => {
  const columna = (nombre: string) => CABECERA_DE_MOVIMIENTOS.indexOf(nombre);
  const filas = filasDeMovimientos(movimientos);
  const venta = filas[2];
  assert.equal(venta[columna("Nota n.º")], "000012");
  assert.equal(venta[columna("Detalle")], "5 kg Queso mozzarella · 2 cartón Huevos");
  assert.equal(venta[columna("Vendido USD")], "50,50");
  assert.equal(venta[columna("Entró USD")], "");
  assert.equal(venta[columna("Observación")], "Entregar antes de las 11");

  const abono = filas[3];
  assert.equal(abono[columna("Método")], "Pago móvil");
  assert.equal(abono[columna("Monto")], "146,00");
  assert.equal(abono[columna("Moneda")], "Bs");
  assert.equal(abono[columna("Tasa")], "36,5000");
  assert.equal(abono[columna("Entró USD")], "4,00");
  assert.equal(abono[columna("Referencia")], "4471");
  assert.equal(filas[4][columna("Moneda")], "USD");
  assert.equal(filas[4][columna("Tasa")], "");

  const compra = filas[1];
  assert.equal(compra[columna("Comprado USD")], "680,00");
  assert.equal(compra[columna("Detalle")], "100 kg de mozzarella a 6,80");
  const pago = filas[5];
  assert.equal(pago[columna("Salió USD")], "349,70");
  assert.equal(pago[columna("Monto")], "300000,00");
});

test("el resumen por día suma cada cosa y separa lo que entró en bolívares y en dólares", () => {
  const columna = (nombre: string) => CABECERA_POR_DIA.indexOf(nombre);
  const filas = filasPorDia(movimientos);
  assert.deepEqual(filas.map((f) => f[0]), ["01/09/2026", "15/09/2026", "20/09/2026"]);
  const dia20 = filas[2];
  assert.equal(dia20[columna("Notas")], "1");
  assert.equal(dia20[columna("Vendido USD")], "50,50");
  assert.equal(dia20[columna("Abonos")], "2");
  assert.equal(dia20[columna("Entró USD")], "24,00");
  assert.equal(dia20[columna("Entró en bolívares")], "146,00");
  assert.equal(dia20[columna("Entró en dólares")], "20,00");
  assert.equal(dia20[columna("Salió USD")], "349,70");
  assert.equal(dia20[columna("Entró menos salió USD")], "-325,70");
  assert.equal(filas[1][columna("Comprado USD")], "680,00");
  for (const fila of filas) assert.equal(fila.length, CABECERA_POR_DIA.length);
});

test("sin movimientos no hay filas", () => {
  const nada: Movimientos = { ventas: [], abonos: [], compras: [], pagos: [] };
  assert.deepEqual(filasDeMovimientos(nada), []);
  assert.deepEqual(filasPorDia(nada), []);
});

test("las fechas del formulario: solo valen las de verdad, y el periodo se pone en orden", () => {
  assert.equal(leerFecha("2026-09-30"), "2026-09-30");
  assert.equal(leerFecha("30/09/2026"), null);
  assert.equal(leerFecha("2026-13-45"), null);
  assert.equal(leerFecha(""), null);
  assert.equal(leerFecha(null), null);
  assert.deepEqual(leerPeriodo("2026-09-30", "2026-09-01"), { desde: "2026-09-01", hasta: "2026-09-30" });
  assert.deepEqual(leerPeriodo("2026-09-01", ""), { desde: "2026-09-01", hasta: null });
  assert.deepEqual(leerPeriodo("x", "y"), { desde: null, hasta: null });
});

test("el nombre del archivo dice de qué fechas es", () => {
  assert.equal(nombreDelArchivo("movimientos", "2026-09-01", "2026-09-30"), "movimientos-2026-09-01-a-2026-09-30.csv");
  assert.equal(nombreDelArchivo("movimientos", "2026-09-30", "2026-09-30"), "movimientos-2026-09-30.csv");
  assert.equal(nombreDelArchivo("resumen-por-dia", null, null), "resumen-por-dia-todo.csv");
  assert.equal(nombreDelArchivo("movimientos", "2026-09-01", null), "movimientos-desde-2026-09-01.csv");
  assert.equal(nombreDelArchivo("movimientos", null, "2026-09-30"), "movimientos-hasta-2026-09-30.csv");
});
