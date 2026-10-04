import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustePorRecuento, existenciasDe } from "./stock.ts";
import type { Vendible } from "./catalogo.ts";

const mozzarella: Vendible = { clave: "2", producto_id: 2, variante_id: null, nombre: "Queso mozzarella", unidad: "kg", precio_usd: 7.7 };
const kemmental: Vendible = { clave: "1-10", producto_id: 1, variante_id: 10, nombre: "Queso amarillo Kemmental", unidad: "kg", precio_usd: 8.5 };
const huevos: Vendible = { clave: "3", producto_id: 3, variante_id: null, nombre: "Huevos", unidad: "carton", precio_usd: 3.4 };

test("la existencia es lo comprado menos lo vendido más los ajustes, con piezas y días que dura", () => {
  const [m] = existenciasDe(
    [mozzarella],
    new Map([["2", 100]]),
    new Map([["2", 62.5]]),
    new Map([["2", -2.5]]),
    new Map([["2", 30]]),
    new Map([["2", { peso: 2.5, muestras: 8 }]]),
    new Map([["2", 6.8]]),
  );
  assert.equal(m.existencia, 35);
  assert.equal(m.piezas, 14);
  assert.equal(m.diasQueDura, 35);
  assert.equal(m.ultimoCosto, 6.8);
  assert.equal(m.seguido, true);
  assert.equal(m.estado, "bien");
});

test("sin compras ni recuentos el producto no se sigue; sin existencia o con poca, se avisa", () => {
  const [sinSeguir, sin, poco] = existenciasDe(
    [huevos, kemmental, mozzarella],
    new Map([
      ["1-10", 10],
      ["2", 10],
    ]),
    new Map([
      ["3", 5],
      ["1-10", 12],
      ["2", 8],
    ]),
    new Map(),
    new Map([["2", 15]]),
    new Map(),
    new Map(),
  );
  assert.equal(sinSeguir.estado, "sin_seguir");
  assert.equal(sinSeguir.existencia, -5);
  assert.equal(sin.estado, "sin");
  assert.equal(sin.existencia, -2);
  // Quedan 2 kg y se venden 15 al mes: 4 días.
  assert.equal(poco.existencia, 2);
  assert.equal(poco.diasQueDura, 4);
  assert.equal(poco.estado, "poco");
  assert.equal(poco.piezas, null);
});

test("un recuento solo también sigue el producto, y el ajuste es lo contado menos lo que había", () => {
  const [m] = existenciasDe([mozzarella], new Map(), new Map([["2", 3]]), new Map([["2", 23]]), new Map(), new Map(), new Map());
  assert.equal(m.seguido, true);
  assert.equal(m.existencia, 20);
  assert.equal(m.diasQueDura, null);
  assert.equal(ajustePorRecuento(20, 18.5), -1.5);
  assert.equal(ajustePorRecuento(-2, 10), 12);
});
