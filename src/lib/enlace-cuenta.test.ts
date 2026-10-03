import { test } from "node:test";
import assert from "node:assert/strict";
import { LARGO_DEL_ENLACE, direccionDeCuenta, esEnlaceValido, nuevoEnlace } from "./enlace-cuenta.ts";

test("un enlace nuevo tiene catorce letras o números de los que se dictan sin confundir", () => {
  const enlace = nuevoEnlace();
  assert.equal(enlace.length, LARGO_DEL_ENLACE);
  assert.match(enlace, /^[a-hj-km-np-z2-9]+$/);
  assert.ok(esEnlaceValido(enlace));
});

test("dos enlaces nuevos no coinciden", () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 200; i++) vistos.add(nuevoEnlace());
  assert.equal(vistos.size, 200);
});

test("lo que no es un enlace no vale: corto, largo, con mayúsculas, con letras que no se usan", () => {
  assert.equal(esEnlaceValido("abc"), false);
  assert.equal(esEnlaceValido("abcdefghjkmnpqr"), false);
  assert.equal(esEnlaceValido("ABCDEFGHJKMNPQ"), false);
  assert.equal(esEnlaceValido("abcdefghjkmnp0"), false);
  assert.equal(esEnlaceValido("abcdefghjkmnpq"), true);
  assert.equal(esEnlaceValido(""), false);
});

test("la dirección completa lleva la web del negocio", () => {
  assert.match(direccionDeCuenta("abcdefghjkmnpq"), /^https:\/\/.+\/cuenta\/abcdefghjkmnpq$/);
});
