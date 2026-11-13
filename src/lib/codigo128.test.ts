import { test } from "node:test";
import assert from "node:assert/strict";
import { barrasCode128, tablaCode128, valoresCode128 } from "./codigo128.ts";

test("la tabla del Code 128 está entera: 107 patrones distintos, de 11 módulos (la parada, de 13)", () => {
  const tabla = tablaCode128();
  assert.equal(tabla.length, 107);
  assert.equal(new Set(tabla).size, 107);
  tabla.forEach((p, i) => {
    const suma = [...p].reduce((s, c) => s + Number(c), 0);
    assert.equal(suma, i === 106 ? 13 : 11, `patrón ${i}`);
  });
});

test("el código lleva el inicio B, los datos, su dígito de control y la parada", () => {
  // «COMBO-3»: C=35, O=47, M=45, B=34, O=47, -=13, 3=19.
  const valores = valoresCode128("COMBO-3");
  const datos = [35, 47, 45, 34, 47, 13, 19];
  const control = (104 + datos.reduce((s, v, i) => s + v * (i + 1), 0)) % 103;
  assert.deepEqual(valores, [104, ...datos, control, 106]);
  // 104 + 35 + 94 + 135 + 136 + 235 + 78 + 133 = 950; 950 mod 103 = 23.
  assert.equal(control, 23);
});

test("las barras: empiezan en barra, terminan en la barra final de la parada, y miden lo que suman los patrones", () => {
  const { barras, ancho } = barrasCode128("COMBO-3");
  // Inicio + 7 caracteres + control = 9 × 11 módulos, y la parada, 13.
  assert.equal(ancho, 9 * 11 + 13);
  assert.equal(barras[0].x, 0);
  const ultima = barras[barras.length - 1];
  assert.equal(ultima.x + ultima.ancho, ancho);
  assert.throws(() => valoresCode128("ñ"));
});
