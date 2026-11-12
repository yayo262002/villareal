import { test } from "node:test";
import assert from "node:assert/strict";
import { leerDocumento, problemaDelDocumento } from "./documento.ts";

test("una cédula se escribe como venga y queda con su letra y sin puntos", () => {
  for (const escrito of ["12345678", "12.345.678", "V12345678", "v-12.345.678", " V 12345678 "]) {
    assert.deepEqual(leerDocumento(escrito), { letra: "V", texto: "V-12345678", clave: "V-12345678" }, escrito);
  }
  assert.equal(leerDocumento("E-8123456")?.texto, "E-8123456");
  assert.equal(leerDocumento("e 81.234.567")?.texto, "E-81234567");
  // Los ceros de delante no cuentan.
  assert.equal(leerDocumento("V-0987654")?.texto, "V-987654");
});

test("el RIF lleva ocho números y su dígito; la cédula y el RIF de la misma persona son la misma clave", () => {
  assert.deepEqual(leerDocumento("J-40806430-8"), { letra: "J", texto: "J-40806430-8", clave: "J-40806430" });
  assert.equal(leerDocumento("j408064308")?.texto, "J-40806430-8");
  assert.equal(leerDocumento("G-20000001-4")?.texto, "G-20000001-4");
  const rif = leerDocumento("V-12345678-9");
  assert.equal(rif?.texto, "V-12345678-9");
  assert.equal(rif?.clave, leerDocumento("12345678")?.clave);
  // Una cédula de siete números con su RIF: el RIF la rellena con un cero.
  assert.equal(leerDocumento("V-01234567-2")?.clave, leerDocumento("1234567")?.clave);
});

test("un pasaporte, con su P", () => {
  assert.deepEqual(leerDocumento("P-AB123456"), { letra: "P", texto: "P-AB123456", clave: "P-AB123456" });
  assert.equal(leerDocumento("pab123456")?.texto, "P-AB123456");
});

test("lo que no es una cédula ni un RIF no vale, y se dice por qué", () => {
  for (const escrito of ["", "abc", "123", "J-40806430", "V-123456789012", "X-12345678"]) assert.equal(leerDocumento(escrito), null, escrito);
  assert.equal(problemaDelDocumento(""), "");
  assert.equal(problemaDelDocumento("12345678"), "");
  assert.match(problemaDelDocumento("J-40806430"), /último número/);
  assert.match(problemaDelDocumento("abc"), /no es una cédula/);
});
