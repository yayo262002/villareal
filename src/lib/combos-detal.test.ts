import { test } from "node:test";
import assert from "node:assert/strict";
import { COMBOS_DEL_DETAL, claveDeNombreDetal, faltanParaElCombo, precioDelCombo, skuDelCombo } from "./combos-detal.ts";

const combo = (clave: string) => COMBOS_DEL_DETAL.find((c) => c.clave === clave)!;

test("los catorce combos, en el orden de las hojas, con claves y números que no se repiten", () => {
  assert.equal(COMBOS_DEL_DETAL.length, 14);
  assert.deepEqual(
    COMBOS_DEL_DETAL.map((c) => c.n),
    Array.from({ length: 14 }, (_, i) => i + 1),
  );
  assert.equal(new Set(COMBOS_DEL_DETAL.map((c) => c.clave)).size, 14);
  assert.equal(combo("espalda-mozzarella").n, 3);
  assert.equal(combo("pavo-cheddar").n, 7);
  assert.equal(skuDelCombo(combo("solidario")), "COMBO-10");
});

test("el precio del combo es lo que suman sus productos al precio del detal, subido al centavo", () => {
  // Los precios del detal del 12/11 (por kilo, salvo lo que se vende por unidad).
  const precios: Record<string, number> = {
    "jamon de espalda drago": 6.13,
    mozzarella: 9.5,
    "suero san pedro bolsa 800 ml": 1.17,
    "huevos (carton de 30)": 6.0,
    "mortadela especial alibal 1 kg": 3.23,
  };
  const precioDe = (nombre: string) => precios[claveDeNombreDetal(nombre)] ?? null;
  // 0,2 × 6,13 + 0,2 × 9,50 = 3,126 → 3,13.
  assert.equal(precioDelCombo(combo("espalda-mozzarella"), precioDe), 3.13);
  // 1,17 + 6/30 × 6 + 0,25 × 3,23 = 3,1775 → 3,18.
  assert.equal(precioDelCombo(combo("solidario"), precioDe), 3.18);
  assert.deepEqual(faltanParaElCombo(combo("espalda-mozzarella"), precioDe), []);
});

test("si a un producto del combo le falta el precio, el combo queda sin precio y se dice cuál falta", () => {
  const precioDe = (nombre: string) => (claveDeNombreDetal(nombre) === "queso paisa" ? null : 2);
  assert.equal(precioDelCombo(combo("sandwichero"), precioDe), null);
  assert.deepEqual(faltanParaElCombo(combo("sandwichero"), precioDe), ["Queso paisa"]);
});

test("los nombres del detal se buscan sin tildes, mayúsculas ni espacios de más", () => {
  assert.equal(claveDeNombreDetal("  Jamón de  ESPALDA Drago "), "jamon de espalda drago");
});
