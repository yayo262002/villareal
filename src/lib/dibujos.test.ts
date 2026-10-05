import { test } from "node:test";
import assert from "node:assert/strict";
import { dibujoComoDato, interiorDelDibujo, tipoDeDibujo } from "./dibujos.ts";

test("cada producto lleva el dibujo que le toca por su nombre", () => {
  assert.equal(tipoDeDibujo("Queso amarillo"), "queso");
  assert.equal(tipoDeDibujo("Queso mozzarella"), "mozzarella");
  assert.equal(tipoDeDibujo("Queso Mozarella"), "mozzarella");
  assert.equal(tipoDeDibujo("Queso pecorino rallado"), "rallado");
  assert.equal(tipoDeDibujo("Queso pecorino"), "curado");
  assert.equal(tipoDeDibujo("Queso parmesano"), "curado");
  assert.equal(tipoDeDibujo("Huevos"), "huevos");
  assert.equal(tipoDeDibujo("Cartón de huevos"), "huevos");
  assert.equal(tipoDeDibujo("Suero de leche"), "suero");
  assert.equal(tipoDeDibujo("Suero Guaralac"), "suero");
  assert.equal(tipoDeDibujo("Mantequilla"), "generico");
});

test("el dibujo es SVG bien cerrado, sin nada que no sea dibujo", () => {
  for (const nombre of ["Queso amarillo", "Queso mozzarella", "Queso pecorino rallado", "Queso pecorino", "Huevos", "Suero de leche", "Mantequilla"]) {
    const interior = interiorDelDibujo(nombre);
    assert.ok(interior.startsWith("<circle"), nombre);
    assert.doesNotMatch(interior, /<script|on[a-z]+=|javascript:/i, nombre);
    assert.doesNotMatch(interior, /NaN|undefined/, nombre);
    // Cada etiqueta que se abre se cierra: las sueltas acaban en «/>» y los grupos en «</g>».
    const abiertas = (interior.match(/<g[ >]/g) ?? []).length;
    const cerradas = (interior.match(/<\/g>/g) ?? []).length;
    assert.equal(abiertas, cerradas, nombre);
  }
});

test("como imagen suelta es un SVG completo", () => {
  const dato = dibujoComoDato("Huevos");
  assert.ok(dato.startsWith("data:image/svg+xml;base64,"));
  const svg = Buffer.from(dato.split(",")[1], "base64").toString("utf8");
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'));
  assert.ok(svg.endsWith("</svg>"));
});
