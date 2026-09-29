import { test } from "node:test";
import assert from "node:assert/strict";
import { aSlug, idDeRuta, rutaProducto } from "./enlaces.ts";

test("el nombre se convierte en una dirección limpia", () => {
  assert.equal(aSlug("Queso Mozzarella"), "queso-mozzarella");
  assert.equal(aSlug("Huevos (cartón)"), "huevos-carton");
  assert.equal(aSlug("  Queso   añejo  "), "queso-anejo");
  assert.equal(aSlug("¡¡!!"), "");
});

test("la dirección del producto lleva el número y el nombre", () => {
  assert.equal(rutaProducto({ id: 2, nombre: "Queso mozzarella" }), "/producto/2-queso-mozzarella");
  assert.equal(rutaProducto({ id: 7, nombre: "¡¡!!" }), "/producto/7");
});

test("de la dirección se saca el número, aunque el nombre haya cambiado", () => {
  assert.equal(idDeRuta("2-queso-mozzarella"), 2);
  assert.equal(idDeRuta("2-otro-nombre"), 2);
  assert.equal(idDeRuta("15"), 15);
  assert.equal(idDeRuta("queso"), null);
  assert.equal(idDeRuta("0-nada"), null);
  assert.equal(idDeRuta("2abc"), null);
  assert.equal(idDeRuta(""), null);
});
