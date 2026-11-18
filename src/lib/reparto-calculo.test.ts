import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARTES_INICIALES,
  calcularReparto,
  cuentaDeLaVenta,
  margenSobreElCosto,
  mensajeDelReparto,
  partesDelFormulario,
  partesDesdeAjuste,
  repartirPorPuntos,
  type AbonoDelReparto,
  type LineaDelReparto,
  type VentaDelReparto,
} from "./reparto-calculo.ts";
import { usd } from "./dinero.ts";

const venta = (id: number, fecha: string, total: number, cliente = 1): VentaDelReparto => ({ id, cliente_id: cliente, fecha, total_usd: total });
const linea = (venta_id: number, cantidad: number, precio: number, costo: number | null, producto = "Mozzarella"): LineaDelReparto => ({
  venta_id,
  producto,
  cantidad,
  subtotal_usd: Math.round(cantidad * precio * 100) / 100,
  costo_unitario_usd: costo,
});
const abono = (id: number, fecha: string, monto: number, cliente = 1): AbonoDelReparto => ({ id, cliente_id: cliente, fecha, monto_usd: monto });
const reparto = (datos: Partial<Parameters<typeof calcularReparto>[0]>) =>
  calcularReparto({ mes: "2026-11", ventas: [], lineas: [], abonos: [], descuentos: [], partes: PARTES_INICIALES, ...datos });

test("10 kg de mozzarella que costaba 7,60 y se vendió a 8,36, cobrados en el mes: 7,60 de ganancia, 2 de cada 10 para el hermano", () => {
  const r = reparto({ ventas: [venta(1, "2026-11-20", 83.6)], lineas: [linea(1, 10, 8.36, 7.6)], abonos: [abono(1, "2026-11-20", 83.6)] });
  assert.equal(r.vendido.total, 83.6);
  assert.equal(r.vendido.ganancia, 7.6);
  assert.equal(r.cobrado.total, 83.6);
  assert.equal(r.cobrado.ganancia, 7.6);
  assert.equal(r.aRepartir, 7.6);
  assert.equal(r.puntos, 10);
  assert.deepEqual(
    r.partes.map((p) => [p.nombre, p.monto]),
    [
      ["Fondo de previsión", 1.52],
      ["Cuota del préstamo", 0.76],
      ["Yo", 2.28],
      ["Papá", 1.52],
      ["Mi hermano", 1.52],
    ],
  );
});

test("lo vendido y no cobrado no se reparte: entra en el mes en que se cobre", () => {
  const noviembre = reparto({ ventas: [venta(1, "2026-11-28", 83.6)], lineas: [linea(1, 10, 8.36, 7.6)] });
  assert.equal(noviembre.vendido.ganancia, 7.6);
  assert.equal(noviembre.cobrado.ganancia, 0);
  assert.equal(noviembre.aRepartir, 0);
  assert.ok(noviembre.partes.every((p) => p.monto === 0));

  const diciembre = calcularReparto({
    mes: "2026-12",
    ventas: [venta(1, "2026-11-28", 83.6)],
    lineas: [linea(1, 10, 8.36, 7.6)],
    abonos: [abono(1, "2026-12-03", 83.6)],
    descuentos: [],
    partes: PARTES_INICIALES,
  });
  assert.equal(diciembre.vendido.notas, 0);
  assert.equal(diciembre.cobrado.ganancia, 7.6);
  assert.equal(diciembre.aRepartir, 7.6);
});

test("un abono de la mitad trae la mitad de la ganancia de la nota", () => {
  const r = reparto({ ventas: [venta(1, "2026-11-10", 83.6)], lineas: [linea(1, 10, 8.36, 7.6)], abonos: [abono(1, "2026-11-15", 41.8)] });
  assert.equal(r.cobrado.ganancia, 3.8);
});

test("el abono paga primero la nota más antigua del cliente, aunque sea de otro mes", () => {
  const ventas = [venta(1, "2026-10-30", 50), venta(2, "2026-11-05", 83.6)];
  const lineas = [linea(1, 10, 5, 4.5, "Jamón"), linea(2, 10, 8.36, 7.6)];
  const r = reparto({ ventas, lineas, abonos: [abono(1, "2026-11-10", 50)] });
  // Los 50 pagan la nota de octubre (deja 5), no la mozzarella de noviembre.
  assert.equal(r.cobrado.ganancia, 5);
  assert.equal(r.vendido.total, 83.6);
});

test("lo que se vendió sin costo guardado no entra en la ganancia: se dice aparte", () => {
  const r = reparto({
    ventas: [venta(1, "2026-11-10", 133.6)],
    lineas: [linea(1, 10, 8.36, 7.6), linea(1, 10, 5, null, "Jamón viejo")],
    abonos: [abono(1, "2026-11-10", 133.6)],
  });
  assert.equal(r.cobrado.ganancia, 7.6);
  assert.equal(r.cobrado.sinCosto, 50);
  assert.equal(r.vendido.sinCosto, 50);
  assert.deepEqual(r.sinCosto, [{ producto: "Jamón viejo", vendido: 50 }]);
  assert.deepEqual(r.productos, [{ producto: "Mozzarella", vendido: 83.6, costo: 76, ganancia: 7.6 }]);
});

test("el descuento de la caja baja la ganancia, repartido entre las líneas", () => {
  // 10 kg a 8,36 = 83,60 con 3,60 de descuento: se cobran 80 por lo que costó 76.
  const c = cuentaDeLaVenta(venta(1, "2026-11-10", 80), [linea(1, 10, 8.36, 7.6)]);
  assert.equal(Math.round(c.ganancia * 100) / 100, 4);
  assert.equal(Math.round(c.sinCosto * 100) / 100, 0);
});

test("lo que se paga antes (la comisión de la vendedora) se resta y se reparte lo que queda", () => {
  const r = reparto({
    ventas: [venta(1, "2026-11-20", 836)],
    lineas: [linea(1, 100, 8.36, 7.6)],
    abonos: [abono(1, "2026-11-20", 836)],
    descuentos: [{ id: 1, concepto: "Comisión de Marisol", monto_usd: 16 }],
  });
  assert.equal(r.cobrado.ganancia, 76);
  assert.equal(r.totalDescuentos, 16);
  assert.equal(r.aRepartir, 60);
  assert.equal(r.partes.find((p) => p.nombre === "Mi hermano")?.monto, 12);
});

test("si lo que se paga antes es más que la ganancia, no se reparte nada", () => {
  const r = reparto({
    ventas: [venta(1, "2026-11-20", 83.6)],
    lineas: [linea(1, 10, 8.36, 7.6)],
    abonos: [abono(1, "2026-11-20", 83.6)],
    descuentos: [{ id: 1, concepto: "Comisión", monto_usd: 10 }],
  });
  assert.equal(r.aRepartir, -2.4);
  assert.ok(r.partes.every((p) => p.monto === 0));
});

test("lo que sobra de un abono, sin nota que pagar, queda a cuenta y no es ganancia", () => {
  const r = reparto({ ventas: [venta(1, "2026-11-20", 83.6)], lineas: [linea(1, 10, 8.36, 7.6)], abonos: [abono(1, "2026-11-20", 100)] });
  assert.equal(r.cobrado.total, 100);
  assert.equal(r.cobrado.aCuenta, 16.4);
  assert.equal(r.cobrado.ganancia, 7.6);
});

test("cada cliente paga sus notas: el abono de uno no cobra las del otro", () => {
  const r = reparto({
    ventas: [venta(1, "2026-11-10", 83.6, 1), venta(2, "2026-11-10", 83.6, 2)],
    lineas: [linea(1, 10, 8.36, 7.6), linea(2, 10, 8.36, 7.6)],
    abonos: [abono(1, "2026-11-12", 200, 2)],
  });
  assert.equal(r.cobrado.ganancia, 7.6);
  assert.equal(r.cobrado.aCuenta, 116.4);
});

test("al repartir no se pierde ni se inventa un centavo", () => {
  const partes = [
    { nombre: "A", puntos: 1 },
    { nombre: "B", puntos: 1 },
    { nombre: "C", puntos: 1 },
  ];
  assert.deepEqual(
    repartirPorPuntos(100.01, partes).map((p) => p.monto),
    [33.34, 33.34, 33.33],
  );
  const conMedios = repartirPorPuntos(123.45, [
    { nombre: "Fondo", puntos: 2 },
    { nombre: "Yo", puntos: 2.5 },
    { nombre: "Papá", puntos: 2.5 },
    { nombre: "Hermano", puntos: 2 },
  ]);
  assert.equal(Math.round(conMedios.reduce((s, p) => s + p.monto, 0) * 100) / 100, 123.45);
});

test("lo que deja sobre el costo: 7,60 → 8,36 es un 10 %", () => {
  assert.equal(Math.round(margenSobreElCosto(7.6, 76)! * 100) / 100, 10);
  assert.equal(margenSobreElCosto(1, 0), null);
});

test("las partes guardadas: lo que no se entiende vuelve a las de siempre", () => {
  assert.deepEqual(partesDesdeAjuste(undefined), [...PARTES_INICIALES]);
  assert.deepEqual(partesDesdeAjuste("no es json"), [...PARTES_INICIALES]);
  assert.deepEqual(partesDesdeAjuste("[]"), [...PARTES_INICIALES]);
  assert.deepEqual(partesDesdeAjuste('[{"nombre":"Yo","puntos":5},{"nombre":"","puntos":2}]'), [{ nombre: "Yo", puntos: 5 }]);
});

test("las partes del formulario: filas vacías no cuentan, y lo que falta se dice", () => {
  assert.deepEqual(
    partesDelFormulario([
      { nombre: "Fondo de previsión", puntos: "2" },
      { nombre: "", puntos: "" },
      { nombre: " Papá ", puntos: "2,5" },
    ]),
    { partes: [{ nombre: "Fondo de previsión", puntos: 2 }, { nombre: "Papá", puntos: 2.5 }] },
  );
  assert.ok("error" in partesDelFormulario([{ nombre: "Papá", puntos: "" }]));
  assert.ok("error" in partesDelFormulario([{ nombre: "", puntos: "2" }]));
  assert.ok("error" in partesDelFormulario([{ nombre: "Papá", puntos: "0" }]));
  assert.ok("error" in partesDelFormulario([{ nombre: "Papá", puntos: "2" }, { nombre: "papá", puntos: "1" }]));
  assert.ok("error" in partesDelFormulario([{ nombre: "", puntos: "" }]));
});

test("el resumen para WhatsApp dice lo cobrado, la ganancia y lo de cada uno, con sus puntos", () => {
  const r = reparto({
    ventas: [venta(1, "2026-11-20", 836)],
    lineas: [linea(1, 100, 8.36, 7.6)],
    abonos: [abono(1, "2026-11-20", 836)],
    descuentos: [{ id: 1, concepto: "Comisión de Marisol", monto_usd: 16 }],
  });
  const m = mensajeDelReparto(r, "Noviembre 2026", "Villa Real");
  assert.match(m, /\*Reparto de Noviembre 2026\* · Villa Real/);
  assert.ok(m.includes(`Cobrado en el mes: ${usd(836)}`));
  assert.ok(m.includes(`Ganancia de lo cobrado: ${usd(76)}`));
  assert.ok(m.includes(`Antes de repartir, Comisión de Marisol: −${usd(16)}`));
  assert.ok(m.includes(`Mi hermano (2 de 10): ${usd(12)}`));
  assert.ok(m.includes("el día de cada venta"));

  const vacio = mensajeDelReparto(reparto({}), "Noviembre 2026", "Villa Real");
  assert.ok(vacio.includes("Este mes no queda ganancia para repartir."));
});
