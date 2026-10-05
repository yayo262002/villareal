import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BORRADORES } from "./catalogo-inicial.ts";
import { FOTOS_REFERENCIALES, fotoDeCombo, fotoReferencialDe, imagenDeProducto } from "./fotos-referenciales.ts";

const foto = (nombre: string) => fotoReferencialDe(nombre)?.replace(/^\/productos\/|\.webp$/g, "");

test("los productos de hoy llevan una foto de lo que son", () => {
  assert.equal(foto("Queso amarillo"), "queso-amarillo");
  assert.equal(foto("Queso mozzarella"), "mozzarella");
  assert.equal(foto("Huevos"), "huevos");
  assert.equal(foto("Queso pecorino rallado"), "queso-rallado");
  assert.equal(foto("Queso parmesano"), "parmesano");
  // Del suero no hay foto de referencia buena: lleva la de su marca (ver abajo) o el fondo neutro.
  assert.equal(fotoReferencialDe("Suero de leche"), null);
});

test("lo más concreto gana: la salsa cheddar no es un queso, ni la caja una pizza", () => {
  assert.equal(foto("Salsa cheddar"), "salsa-cheddar");
  assert.equal(foto("Queso cheddar"), "queso-cheddar");
  assert.equal(foto("Mozzarella rallada"), "queso-rallado");
  assert.equal(foto("Cajas para pizza"), "cajas-pizza");
  assert.equal(foto("Salsa para pizza"), "salsa-pizza");
  assert.equal(foto("Harina para pizza"), "harina");
  assert.equal(foto("Pan de hamburguesa"), "pan-hamburguesa");
  assert.equal(foto("Carne para hamburguesa"), "carne-hamburguesa");
  assert.equal(foto("Aros de cebolla"), "aros-de-cebolla");
  assert.equal(foto("Papas ralladas"), "hash-browns");
  assert.equal(foto("Papas fritas congeladas"), "papas-fritas");
});

test("sin tildes, en plural o en singular, y solo palabras enteras", () => {
  assert.equal(foto("JAMÓN ahumado"), "jamon");
  assert.equal(foto("Champiñones laminados"), "champinones");
  assert.equal(foto("Aceituna negra"), "aceitunas");
  assert.equal(foto("Piña en almíbar"), "pina");
  // «espinaca» lleva «pina» dentro, pero no es piña.
  assert.equal(fotoReferencialDe("Espinaca"), null);
  assert.equal(fotoReferencialDe("Servilletas"), null);
});

test("todos los productos del catálogo inicial tienen foto, y cada foto existe", () => {
  const sinFoto = BORRADORES.filter((b) => !fotoReferencialDe(b.nombre)).map((b) => b.nombre);
  assert.deepEqual(sinFoto, []);
  const carpeta = path.join(process.cwd(), "public", "productos");
  const faltan = [...FOTOS_REFERENCIALES.map((f) => f.foto), "ingredientes"].filter((f) => !fs.existsSync(path.join(carpeta, `${f}.webp`)));
  assert.deepEqual(faltan, []);
});

test("la foto que sube el dueño va primero; la de referencia lo dice; sin ninguna, nada", () => {
  assert.deepEqual(imagenDeProducto("/foto-producto/3?v=1", "Huevos"), { src: "/foto-producto/3?v=1", referencial: false });
  assert.deepEqual(imagenDeProducto(null, "Huevos"), { src: "/productos/huevos.webp", referencial: true });
  assert.equal(imagenDeProducto(null, "Servilletas"), null);
  // Con una sola marca con foto, la de la marca: es el producto de verdad.
  assert.deepEqual(imagenDeProducto(null, "Suero de leche", "/foto-variante/5?v=1"), { src: "/foto-variante/5?v=1", referencial: false });
  assert.deepEqual(imagenDeProducto("/foto-producto/5?v=2", "Suero de leche", "/foto-variante/5?v=1"), { src: "/foto-producto/5?v=2", referencial: false });
});

test("los combos llevan la foto de lo suyo", () => {
  assert.equal(fotoDeCombo("Pack Pizzería"), "/familias/pizzeria.webp");
  assert.equal(fotoDeCombo("Pack Burger"), "/familias/burger.webp");
  assert.equal(fotoDeCombo("Pack Emprendedor"), "/productos/ingredientes.webp");
});
