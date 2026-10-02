import { test } from "node:test";
import assert from "node:assert/strict";
import { cargaDe, numeroDeNota, pedidosPorCliente, resumenDeLineas } from "./entregas.ts";

const mozzarella = { producto_id: 2, producto_nombre: "Queso mozzarella", unidad: "kg" };
const amarillo = { producto_id: 1, producto_nombre: "Queso amarillo", unidad: "kg" };
const huevos = { producto_id: 3, producto_nombre: "Huevos", unidad: "carton" };

const pedidos = [
  { id: 8, cliente_id: 1, fecha: "2026-09-29", lineas: [{ ...mozzarella, cantidad: 5 }, { ...huevos, cantidad: 2 }] },
  { id: 5, cliente_id: 2, fecha: "2026-09-28", lineas: [{ ...mozzarella, cantidad: 2.5 }, { ...amarillo, cantidad: 1 }] },
  { id: 9, cliente_id: 1, fecha: "2026-09-29", lineas: [{ ...huevos, cantidad: 1 }] },
  { id: 3, cliente_id: 1, fecha: "2026-09-30", lineas: [{ ...amarillo, cantidad: 0.25 }] },
];

test("la carga suma cada producto de todos los pedidos, en el orden del panel", () => {
  assert.deepEqual(cargaDe(pedidos), [
    { producto_id: 1, variante_id: null, producto: "Queso amarillo", unidad: "kg", cantidad: 1.25 },
    { producto_id: 2, variante_id: null, producto: "Queso mozzarella", unidad: "kg", cantidad: 7.5 },
    { producto_id: 3, variante_id: null, producto: "Huevos", unidad: "carton", cantidad: 3 },
  ]);
});

test("cada marca se carga aparte: dos quesos amarillos distintos no se suman", () => {
  const kemmental = { producto_id: 1, variante_id: 10, producto_nombre: "Queso amarillo Kemmental", unidad: "kg" };
  const legado = { producto_id: 1, variante_id: 11, producto_nombre: "Queso amarillo El Legado", unidad: "kg" };
  const carga = cargaDe([
    { id: 1, cliente_id: 1, fecha: "2026-09-01", lineas: [{ ...kemmental, cantidad: 2 }, { ...legado, cantidad: 1 }] },
    { id: 2, cliente_id: 2, fecha: "2026-09-01", lineas: [{ ...kemmental, cantidad: 0.5 }] },
  ]);
  assert.deepEqual(carga, [
    { producto_id: 1, variante_id: 10, producto: "Queso amarillo Kemmental", unidad: "kg", cantidad: 2.5 },
    { producto_id: 1, variante_id: 11, producto: "Queso amarillo El Legado", unidad: "kg", cantidad: 1 },
  ]);
});

test("sumar gramos no inventa decimales", () => {
  const gramos = [0.1, 0.2, 0.3].map((cantidad, i) => ({
    id: i + 1,
    cliente_id: 1,
    fecha: "2026-09-29",
    lineas: [{ ...mozzarella, cantidad }],
  }));
  assert.equal(cargaDe(gramos)[0].cantidad, 0.6);
});

test("sin pedidos no hay nada que cargar", () => {
  assert.deepEqual(cargaDe([]), []);
  assert.equal(pedidosPorCliente([]).size, 0);
});

test("la carga no toca los pedidos originales", () => {
  const copia = structuredClone(pedidos);
  cargaDe(pedidos);
  assert.deepEqual(pedidos, copia);
});

test("los pedidos de cada cliente, del más antiguo al más nuevo", () => {
  const porCliente = pedidosPorCliente(pedidos);
  assert.deepEqual([...porCliente.keys()].sort(), [1, 2]);
  assert.deepEqual(porCliente.get(1)?.map((p) => p.id), [8, 9, 3]);
  assert.deepEqual(porCliente.get(2)?.map((p) => p.id), [5]);
});

test("lo que lleva una venta, en una línea", () => {
  assert.equal(resumenDeLineas(pedidos[0].lineas), "5 kg Queso mozzarella · 2 cartón Huevos");
  assert.equal(resumenDeLineas([{ ...amarillo, cantidad: 0.25 }]), "0,25 kg Queso amarillo");
  assert.equal(resumenDeLineas([]), "");
});

test("el número de la nota lleva ceros delante", () => {
  assert.equal(numeroDeNota(12), "000012");
  assert.equal(numeroDeNota(1234567), "1234567");
});
