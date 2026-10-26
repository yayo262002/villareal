import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarParecidos, coincideParecido, distancia, puntuarParecido, simplificar } from "./parecido.ts";

test("simplificar junta lo que suena igual: tildes, mayúsculas, b/v, s/z/c, y/ll/i, h muda, letras repetidas; la ch aparte", () => {
  assert.equal(simplificar("Pizzería La Esquina"), "piseria la eskina");
  assert.equal(simplificar("Burguer Cleinderman"), "burger kleinderman");
  assert.equal(simplificar("Burger Cleiderman"), "burger kleiderman");
  assert.equal(simplificar("Hola, Vaca; cebolla y llave"), "ola baka seboia i iabe");
  assert.equal(simplificar("Cheo"), "xeo");
  assert.equal(simplificar("zzzz"), "ss");
  assert.equal(simplificar("0424-6343236"), "0424 6343236");
});

test("la distancia cuenta letras cambiadas, de más o de menos, y se corta en el tope", () => {
  assert.equal(distancia("kleinderman", "kleiderman", 2), 1);
  assert.equal(distancia("burger", "burger", 2), 0);
  assert.equal(distancia("pepitaso", "paraiso", 2), 3);
  assert.equal(distancia("abc", "xyz", 1), 2);
});

test("coincide con una letra equivocada, de más o de menos, pero no con cualquier cosa", () => {
  const cleiderman = "Burguer Cleinderman Burger Cleiderman 0414-1234567";
  assert.ok(coincideParecido("cleiderman", cleiderman)); // con una letra de menos
  assert.ok(coincideParecido("cleinderman", cleiderman));
  assert.ok(coincideParecido("kleiderman", cleiderman)); // c por k
  assert.ok(coincideParecido("burguer", cleiderman));
  assert.ok(coincideParecido("Burger Clei", cleiderman)); // dos palabras, la segunda a medias
  assert.ok(coincideParecido("clai", cleiderman)); // una letra cambiada al empezar a escribir
  assert.ok(!coincideParecido("pizzeria", cleiderman));
  assert.ok(!coincideParecido("zzzz", "Su queso · Sin nombre"));
  assert.ok(!coincideParecido("burger pizza", cleiderman)); // todas las palabras tienen que casar
  assert.ok(coincideParecido("pizeria", "Pizzería José Gregorio"));
  assert.ok(coincideParecido("jose gregorio", "Pizzería José Gregorio"));
  assert.ok(coincideParecido("gregori", "Pizzería José Gregorio"));
  assert.ok(coincideParecido("mosarela", "Mozzarella"));
  assert.ok(coincideParecido("huebos", "Huevos"));
});

test("las palabras muy cortas no se perdonan: «pe» no es «la»", () => {
  assert.ok(!coincideParecido("pe", "La flaca"));
  assert.ok(coincideParecido("fl", "La flaca"));
});

test("un teléfono escrito de corrido casa con el guardado con guion", () => {
  assert.ok(coincideParecido("04246343", "Villa Real 0424-6343236"));
  assert.ok(coincideParecido("6343236", "Villa Real 0424-6343236"));
  assert.ok(!coincideParecido("9999", "Villa Real 0424-6343236"));
});

test("los que empiezan igual van antes que los que solo se parecen", () => {
  const clientes = ["Cheo Hot Dog", "Burger Cleiderman", "Pizzería La Esquina", "Panadería Madeira"];
  assert.deepEqual(buscarParecidos("ch", clientes, (c) => c), ["Cheo Hot Dog"]);
  assert.deepEqual(buscarParecidos("pana", clientes, (c) => c), ["Panadería Madeira"]);
  // «clei» empieza igual que «Cleiderman»; «clai» solo se parece: el que empieza igual puntúa más.
  assert.ok(puntuarParecido("clei", "Burger Cleiderman") > puntuarParecido("clai", "Burger Cleiderman"));
  // «pizeria» y «Pizzería» suenan igual: se tratan como iguales.
  assert.equal(puntuarParecido("pizeria", "Pizzería La Esquina"), 3);
  assert.deepEqual(buscarParecidos("", clientes, (c) => c, 2), ["Cheo Hot Dog", "Burger Cleiderman"]);
  assert.deepEqual(buscarParecidos("zzz", clientes, (c) => c), []);
});
