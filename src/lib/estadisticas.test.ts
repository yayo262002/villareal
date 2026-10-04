import { test } from "node:test";
import assert from "node:assert/strict";
import { periodoDe, porCliente, porDia, porDiaDeLaSemana, porMetodo, porProducto, resumenDe, todosLosMovimientos } from "./estadisticas.ts";
import type { MovimientosCompletos } from "./movimientos.ts";

const linea = (venta_id: number, producto_nombre: string, unidad: string, cantidad: number, precio: number, id = venta_id * 10) => ({
  id,
  venta_id,
  producto_id: 1,
  variante_id: null,
  cantidad,
  precio_unitario_usd: precio,
  subtotal_usd: Math.round(cantidad * precio * 100) / 100,
  piezas: null,
  producto_nombre,
  variante_nombre: null,
  unidad,
});

// Septiembre de 2026: dos notas de la pizzería (martes 1 y domingo 20), una de la bodega (martes 15); dos abonos; una compra y un pago al proveedor.
const movimientos: MovimientosCompletos = {
  ventas: [
    { id: 1, cliente_id: 7, fecha: "2026-09-01", cliente_nombre: "Pizzería 33", total_usd: 38.5, nota: "", lineas: [linea(1, "Queso mozzarella", "kg", 5, 7.7)] },
    { id: 2, cliente_id: 9, fecha: "2026-09-15", cliente_nombre: "Bodega Ana", total_usd: 16.8, nota: "", lineas: [linea(2, "Queso amarillo Kemmental", "kg", 1, 10), linea(2, "Huevos", "carton", 2, 3.4, 21)] },
    { id: 3, cliente_id: 7, fecha: "2026-09-20", cliente_nombre: "Pizzería 33", total_usd: 77, nota: "", lineas: [linea(3, "Queso mozzarella", "kg", 10, 7.7)] },
  ],
  abonos: [
    { id: 1, cliente_id: 7, fecha: "2026-09-10", cliente_nombre: "Pizzería 33", metodo: "pago_movil", moneda: "VES", monto: 1460, tasa: 36.5, monto_usd: 40, referencia: "4471", nota: "" },
    { id: 2, cliente_id: 7, fecha: "2026-09-20", cliente_nombre: "Pizzería 33", metodo: "zelle", moneda: "USD", monto: 20, tasa: null, monto_usd: 20, referencia: "", nota: "" },
  ],
  compras: [{ id: 1, fecha: "2026-09-05", proveedor_nombre: "Quesos del Tocuyo", descripcion: "100 kg de mozzarella", total_usd: 680, nota: "" }],
  pagos: [{ id: 1, fecha: "2026-09-12", proveedor_nombre: "Quesos del Tocuyo", metodo: "transferencia", moneda: "VES", monto: 10950, tasa: 36.5, monto_usd: 300, referencia: "", nota: "" }],
};

test("los períodos de un toque, contados desde hoy", () => {
  assert.deepEqual(periodoDe("mes", "2026-10-04"), { desde: "2026-10-01", hasta: "2026-10-04" });
  assert.deepEqual(periodoDe("mes-pasado", "2026-10-04"), { desde: "2026-09-01", hasta: "2026-09-30" });
  assert.deepEqual(periodoDe("mes-pasado", "2026-01-15"), { desde: "2025-12-01", hasta: "2025-12-31" });
  assert.deepEqual(periodoDe("30", "2026-10-04"), { desde: "2026-09-05", hasta: "2026-10-04" });
  assert.deepEqual(periodoDe("90", "2026-10-04"), { desde: "2026-07-07", hasta: "2026-10-04" });
  assert.deepEqual(periodoDe("ano", "2026-10-04"), { desde: "2026-01-01", hasta: "2026-10-04" });
  assert.deepEqual(periodoDe("todo", "2026-10-04"), { desde: null, hasta: null });
});

test("el resumen del período: vendido, cobrado, kilos, ticket medio, clientes, y lo que entró neto", () => {
  assert.deepEqual(resumenDe(movimientos), {
    vendido: 132.3,
    notas: 3,
    cobrado: 60,
    abonos: 2,
    kilos: 16,
    ticketMedio: 44.1,
    clientesQueCompraron: 2,
    comprado: 680,
    pagadoProveedores: 300,
    entroNeto: -240,
  });
  assert.equal(resumenDe({ ventas: [], abonos: [], compras: [], pagos: [] }).ticketMedio, 0);
});

test("por producto y marca, de más a menos vendido, con su parte del total", () => {
  assert.deepEqual(porProducto(movimientos), [
    { producto: "Queso mozzarella", unidad: "kg", cantidad: 15, vendido: 115.5, parte: 87 },
    { producto: "Queso amarillo Kemmental", unidad: "kg", cantidad: 1, vendido: 10, parte: 8 },
    { producto: "Huevos", unidad: "carton", cantidad: 2, vendido: 6.8, parte: 5 },
  ]);
});

test("por cliente: lo comprado y lo abonado, de más a menos comprado", () => {
  assert.deepEqual(porCliente(movimientos), [
    { cliente_id: 7, cliente: "Pizzería 33", ventas: 2, vendido: 115.5, abonado: 60 },
    { cliente_id: 9, cliente: "Bodega Ana", ventas: 1, vendido: 16.8, abonado: 0 },
  ]);
});

test("por método de cobro, en su moneda y en dólares", () => {
  assert.deepEqual(porMetodo(movimientos), [
    { metodo: "pago_movil", nombre: "Pago móvil", moneda: "VES", abonos: 1, monto: 1460, usd: 40 },
    { metodo: "zelle", nombre: "Zelle", moneda: "USD", abonos: 1, monto: 20, usd: 20 },
  ]);
});

test("por día de la semana, de lunes a domingo", () => {
  const dias = porDiaDeLaSemana(movimientos);
  assert.equal(dias.length, 7);
  assert.deepEqual(dias[1], { dia: 1, nombre: "Martes", ventas: 2, vendido: 55.3 });
  assert.deepEqual(dias[6], { dia: 6, nombre: "Domingo", ventas: 1, vendido: 77 });
  assert.equal(dias[0].ventas, 0);
});

test("por día, del más antiguo al más nuevo, con ventas y cobros", () => {
  assert.deepEqual(porDia(movimientos), [
    { fecha: "2026-09-01", ventas: 1, vendido: 38.5, cobrado: 0 },
    { fecha: "2026-09-10", ventas: 0, vendido: 0, cobrado: 40 },
    { fecha: "2026-09-15", ventas: 1, vendido: 16.8, cobrado: 0 },
    { fecha: "2026-09-20", ventas: 1, vendido: 77, cobrado: 20 },
  ]);
});

test("todos los movimientos en una lista, del más reciente al más antiguo, con quién y con qué", () => {
  const lista = todosLosMovimientos(movimientos);
  assert.deepEqual(
    lista.map((m) => [m.fecha, m.tipo, m.quien, m.usd]),
    [
      ["2026-09-20", "Venta", "Pizzería 33", 77],
      ["2026-09-20", "Abono", "Pizzería 33", 20],
      ["2026-09-15", "Venta", "Bodega Ana", 16.8],
      ["2026-09-12", "Pago a proveedor", "Quesos del Tocuyo", 300],
      ["2026-09-10", "Abono", "Pizzería 33", 40],
      ["2026-09-05", "Compra", "Quesos del Tocuyo", 680],
      ["2026-09-01", "Venta", "Pizzería 33", 38.5],
    ],
  );
  assert.equal(lista[2].detalle, "Nota 000002 · 1 kg Queso amarillo Kemmental · 2 cartón Huevos");
  assert.equal(lista[2].enlace, "/admin/ventas/2/nota");
  assert.equal(lista[4].detalle, "Pago móvil · Bs 1.460 a 36,5 · ref. 4471");
  assert.equal(lista[3].detalle, "Transferencia · Bs 10.950");
});
