import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizar, ventaCoincide } from "./buscar.ts";

const venta = { id: 26, fecha: "2026-09-30", cliente_nombre: "Pizzería José", nota: "Entregar antes de las 11" };

test("sin tildes ni mayúsculas ni espacios de más", () => {
  assert.equal(normalizar("  Pizzería JOSÉ "), "pizzeria jose");
  assert.equal(normalizar("Ñandú"), "nandu");
  assert.equal(normalizar(""), "");
});

test("con la búsqueda vacía valen todas", () => {
  assert.equal(ventaCoincide(venta, ""), true);
  assert.equal(ventaCoincide(venta, "   "), true);
});

test("por el nombre del cliente, se escriba como se escriba", () => {
  assert.equal(ventaCoincide(venta, "jose"), true);
  assert.equal(ventaCoincide(venta, "PIZZERIA"), true);
  assert.equal(ventaCoincide(venta, "panadería"), false);
});

test("por el número de la nota, con ceros o sin ellos", () => {
  assert.equal(ventaCoincide(venta, "26"), true);
  assert.equal(ventaCoincide(venta, "000026"), true);
  assert.equal(ventaCoincide(venta, "n.º 26"), true);
  assert.equal(ventaCoincide(venta, "N° 26"), true);
  // «2» no es la 26: un número busca esa nota, no las que lo contienen.
  assert.equal(ventaCoincide(venta, "2"), false);
  assert.equal(ventaCoincide(venta, "27"), false);
});

test("por la fecha como se lee y por la observación", () => {
  assert.equal(ventaCoincide(venta, "30/09"), true);
  assert.equal(ventaCoincide(venta, "30/09/2026"), true);
  assert.equal(ventaCoincide(venta, "29/09"), false);
  assert.equal(ventaCoincide(venta, "antes de las 11"), true);
});
