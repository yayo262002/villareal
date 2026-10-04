import { test } from "node:test";
import assert from "node:assert/strict";
import { usd } from "./dinero.ts";
import { lineaRellena, revisarFecha, revisarLinea, revisarVenta, type LineaEscrita } from "./venta-sensata.ts";

const mozzarella: LineaEscrita = {
  producto: "Queso mozzarella",
  cantidad: 5,
  piezas: 2,
  precio: 7.7,
  unidad: "kg",
  precioDeLista: 7.7,
  ultimoPrecio: null,
};

test("la nota de la panadería: 2 piezas, 5 kilos a 7,70. Nada que decir", () => {
  assert.deepEqual(revisarLinea(mozzarella), { errores: [], avisos: [] });
});

test("sin kilos o sin precio no se guarda, y se dice qué falta", () => {
  assert.deepEqual(revisarLinea({ ...mozzarella, cantidad: null }).errores, ["Queso mozzarella: escribe los kilos."]);
  assert.deepEqual(revisarLinea({ ...mozzarella, precio: null }).errores, ["Queso mozzarella: escribe el precio en dólares."]);
  assert.deepEqual(revisarLinea({ ...mozzarella, cantidad: 0 }).errores, ["Queso mozzarella: los kilos tienen que ser más de cero."]);
  assert.deepEqual(revisarLinea({ ...mozzarella, precio: 0 }).errores, ["Queso mozzarella: el precio tiene que ser más de cero."]);
});

test("los huevos van por cartones y las piezas son opcionales", () => {
  const huevos: LineaEscrita = { ...mozzarella, producto: "Huevos", unidad: "carton", piezas: null, cantidad: null, precio: 5.5, precioDeLista: 5.5 };
  assert.deepEqual(revisarLinea(huevos).errores, ["Huevos: escribe los cartones."]);
  assert.deepEqual(revisarLinea({ ...huevos, cantidad: 3 }), { errores: [], avisos: [] });
});

test("cantidades imposibles: 5000 kilos, 0 piezas, piezas con decimales, un precio de mil dólares", () => {
  assert.match(revisarLinea({ ...mozzarella, cantidad: 5000 }).errores[0], /5\.000 kilos no puede ser/);
  assert.match(revisarLinea({ ...mozzarella, piezas: 0 }).errores[0], /piezas son un número entero/);
  assert.match(revisarLinea({ ...mozzarella, piezas: 2.5 }).errores[0], /piezas son un número entero/);
  assert.match(revisarLinea({ ...mozzarella, piezas: 999 }).errores[0], /999 piezas no puede ser/);
  assert.match(revisarLinea({ ...mozzarella, precio: 1500 }).errores[0], /por kilo no puede ser/);
});

test("un precio muy lejos de la lista avisa: 77 en vez de 7,70, o 0,77", () => {
  const caro = revisarLinea({ ...mozzarella, precio: 77 });
  assert.deepEqual(caro.errores, []);
  assert.equal(caro.avisos.length, 1);
  assert.match(caro.avisos[0], /Queso mozzarella a .*77,00 se sale de lo normal: en la lista está a .*7,70\./);
  assert.equal(revisarLinea({ ...mozzarella, precio: 0.77 }).avisos.length, 1);
  // Un descuento razonable no avisa.
  assert.deepEqual(revisarLinea({ ...mozzarella, precio: 6.5 }).avisos, []);
  assert.deepEqual(revisarLinea({ ...mozzarella, precio: 12 }).avisos, []);
});

test("sin precio de lista, se compara con lo que se le cobró la última vez", () => {
  const sinLista = { ...mozzarella, precioDeLista: null, ultimoPrecio: 7 };
  assert.match(revisarLinea({ ...sinLista, precio: 20 }).avisos[0], /la última vez le cobraste .*7,00/);
  assert.deepEqual(revisarLinea({ ...sinLista, precio: 7.5 }).avisos, []);
  // Con las dos referencias se dicen las dos.
  assert.match(revisarLinea({ ...mozzarella, ultimoPrecio: 7, precio: 20 }).avisos[0], /en la lista está a .*7,70 y la última vez le cobraste .*7,00/);
  // Sin ninguna referencia no hay con qué comparar: no avisa.
  assert.deepEqual(revisarLinea({ ...mozzarella, precioDeLista: null, ultimoPrecio: null, precio: 50 }).avisos, []);
});

test("un importe muy grande en una sola línea pide confirmación aunque el precio sea el de la lista", () => {
  const grande = revisarLinea({ ...mozzarella, cantidad: 200 });
  assert.deepEqual(grande.errores, []);
  assert.match(grande.avisos[0], new RegExp(`200 kilos a .*7,70 son ${usd(1540).replace(/\\s/g, ".")}`));
});

test("una nota entera: sin líneas es un error; una línea vacía se ignora; los avisos se juntan", () => {
  const vacia = { ...mozzarella, cantidad: null, piezas: null, precio: null };
  assert.equal(lineaRellena(vacia), false);
  assert.equal(lineaRellena({ ...vacia, piezas: 2 }), true);
  assert.deepEqual(revisarVenta([vacia, vacia]).errores, ["Escribe los kilos y el precio de al menos un producto."]);
  const revision = revisarVenta([vacia, mozzarella, { ...mozzarella, producto: "Queso amarillo", precio: 80, precioDeLista: 8.5 }]);
  assert.deepEqual(revision.errores, []);
  assert.equal(revision.avisos.length, 1);
  assert.match(revision.avisos[0], /^Queso amarillo/);
  // Una línea con solo las piezas cuenta como rellena: le faltan los kilos y el precio.
  assert.equal(revisarVenta([{ ...vacia, piezas: 2 }]).errores.length, 2);
});

test("la fecha de la nota puede ser de días atrás, nunca de mañana", () => {
  assert.equal(revisarFecha("2026-09-25", "2026-09-30"), null);
  assert.equal(revisarFecha("2026-09-30", "2026-09-30"), null);
  assert.match(String(revisarFecha("2026-10-01", "2026-09-30")), /no puede ser de mañana/);
  assert.match(String(revisarFecha("", "2026-09-30")), /Falta la fecha/);
  assert.match(String(revisarFecha("30/09/2026", "2026-09-30")), /Falta la fecha/);
});

test("vender más de lo que hay en inventario, o unas piezas que no casan con su peso, avisa pero no frena", () => {
  const tipico = { peso: 2.5, muestras: 6 };
  const r = revisarLinea({ ...mozzarella, cantidad: 8, piezas: 2, existencia: 5, pesoTipico: tipico });
  assert.equal(r.errores.length, 0);
  assert.match(r.avisos[0], /anotaste 8 kilos y en el inventario hay 5/);
  assert.match(r.avisos[1], /cada pieza suele pesar 2,5 kg \(en tus últimas 6 notas\)/);
  assert.deepEqual(revisarLinea({ ...mozzarella, cantidad: 5, piezas: 2, existencia: 5, pesoTipico: tipico }).avisos, []);
  assert.match(revisarLinea({ ...mozzarella, existencia: 0 }).avisos[0], /no queda nada/);
  // Sin inventario que seguir ni peso aprendido, nada cambia.
  assert.deepEqual(revisarLinea({ ...mozzarella, existencia: null, pesoTipico: null }).avisos, []);
});
