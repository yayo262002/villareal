import { test } from "node:test";
import assert from "node:assert/strict";
import { COMBOS_DEL_DETAL, claveDeNombreDetal, faltanParaElCombo, precioDelCombo, skuDelCombo } from "./combos-detal.ts";

const combo = (clave: string) => COMBOS_DEL_DETAL.find((c) => c.clave === clave)!;

test("los quince combos, en el orden de las hojas, con claves y números que no se repiten", () => {
  assert.equal(COMBOS_DEL_DETAL.length, 15);
  assert.deepEqual(
    COMBOS_DEL_DETAL.map((c) => c.n),
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
  assert.equal(new Set(COMBOS_DEL_DETAL.map((c) => c.clave)).size, 15);
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

test("el combo de recortes es una bandeja de 200 g al precio por kilo de «Recortes» en la lista del detal", () => {
  assert.equal(combo("recortes").n, 15);
  assert.equal(skuDelCombo(combo("recortes")), "COMBO-15");
  // Mientras no esté en la lista, sin precio: se escribe a mano en la caja.
  assert.equal(precioDelCombo(combo("recortes"), () => null), null);
  assert.deepEqual(faltanParaElCombo(combo("recortes"), () => null), ["Recortes"]);
  // Con 4,40 $ el kilo: 0,2 × 4,40 = 0,88.
  assert.equal(precioDelCombo(combo("recortes"), (nombre) => (claveDeNombreDetal(nombre) === "recortes" ? 4.4 : null)), 0.88);
});

test("los nombres del detal se buscan sin tildes, mayúsculas ni espacios de más", () => {
  assert.equal(claveDeNombreDetal("  Jamón de  ESPALDA Drago "), "jamon de espalda drago");
});
