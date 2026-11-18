import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMBOS_DEL_DETAL,
  claveDeNombreDetal,
  costoDelCombo,
  cuantoLleva,
  desgloseDelCombo,
  faltanParaElCombo,
  precioDelCombo,
  precioEstimadoDelDetal,
  skuDelCombo,
} from "./combos-detal.ts";

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

test("el combo de recortes no lleva peso ni precio fijos: lo que lleva varía, y en la caja se cobra a mano", () => {
  assert.equal(combo("recortes").n, 15);
  assert.equal(skuDelCombo(combo("recortes")), "COMBO-15");
  assert.ok(!/[0-9]/.test(combo("recortes").detalle));
  // Aunque en la lista hubiera precio para todo, no sale ninguno; y no le falta nada en la lista.
  assert.equal(precioDelCombo(combo("recortes"), () => 4.4), null);
  assert.deepEqual(faltanParaElCombo(combo("recortes"), () => null), []);
});

test("lo que cuesta un combo es lo que suman sus productos al costo de la lista; sin un costo, o a mano, no se estima", () => {
  const combo = COMBOS_DEL_DETAL.find((c) => c.clave === "espalda-mozzarella")!;
  const costos: Record<string, number> = { "Jamón de espalda Drago": 4.9, Mozzarella: 7.6 };
  const costo = costoDelCombo(combo, (nombre) => costos[nombre] ?? null);
  assert.equal(Math.round(costo! * 100) / 100, 2.5);
  assert.equal(costoDelCombo(combo, (nombre) => (nombre === "Mozzarella" ? 7.6 : null)), null);
  const recortes = COMBOS_DEL_DETAL.find((c) => c.precioAMano)!;
  assert.equal(costoDelCombo(recortes, () => 1), null);
});

test("los especiales son del solidario en adelante, como en las hojas", () => {
  assert.deepEqual(
    COMBOS_DEL_DETAL.filter((c) => c.especial).map((c) => c.n),
    [10, 11, 12, 13, 14, 15],
  );
});

test("lo que lleva cada producto se dice como en la charcutería", () => {
  assert.equal(cuantoLleva("Jamón de espalda Drago", "kg", 0.2), "200 g");
  assert.equal(cuantoLleva("Huevos (cartón de 30)", "unidad", 6 / 30), "6 huevos");
  assert.equal(cuantoLleva("Salchichas calibre 17 (paquete de 20)", "unidad", 6 / 20), "6 salchichas");
  assert.equal(cuantoLleva("Mortadela especial Alibal 1 kg", "unidad", 0.25), "250 g");
  assert.equal(cuantoLleva("Suero San Pedro bolsa 800 ml", "unidad", 1), "1 unidad");
  // Lo que no está en la lista (el queso paisa), en gramos.
  assert.equal(cuantoLleva("Queso paisa", "", 0.2), "200 g");
});

test("el desglose: cada producto con su precio y lo que pone, y el total de la caja", () => {
  const lista: Record<string, { unidad: string; precio: number | null }> = {
    "jamon de espalda drago": { unidad: "kg", precio: 6.13 },
    mozzarella: { unidad: "kg", precio: 9.5 },
    "pan blanco enriquecido viva mejor 500 g": { unidad: "unidad", precio: 1.69 },
    "pechuga de pavo ahumada drago": { unidad: "kg", precio: 7.63 },
  };
  const enLaLista = (nombre: string) => lista[claveDeNombreDetal(nombre)] ?? null;
  const tercero = desgloseDelCombo(combo("espalda-mozzarella"), enLaLista, 0.8);
  assert.deepEqual(
    tercero.partes.map((p) => [p.cuanto, p.nombre, p.precio, p.porKilo, p.estimado]),
    [
      ["200 g", "Jamón de espalda Drago", 6.13, true, false],
      ["200 g", "Mozzarella", 9.5, true, false],
    ],
  );
  assert.ok(Math.abs((tercero.partes[0].importe ?? 0) - 1.226) < 1e-9);
  // La misma cuenta que la caja: 1,226 + 1,90 = 3,126 → 3,13.
  assert.equal(tercero.total, 3.13);
  assert.deepEqual(tercero.faltan, []);
  // El queso paisa no está en la lista: su costo estimado (10 $) entre 0,80 = 12,50 el kilo, marcado estimado.
  const sandwichero = desgloseDelCombo(combo("sandwichero"), enLaLista, 0.8);
  const paisa = sandwichero.partes.find((p) => p.nombre === "Queso paisa")!;
  assert.deepEqual([paisa.cuanto, paisa.precio, paisa.porKilo, paisa.estimado], ["200 g", 12.5, true, true]);
  // 1,69 + 2,50 + 1,526 = 5,716 → 5,72.
  assert.equal(sandwichero.total, 5.72);
  assert.equal(precioEstimadoDelDetal("queso PAISA", 0.8), 12.5);
  // Lo que no está ni estimado deja el combo sin precio y se dice.
  const sinJamon = desgloseDelCombo(combo("espalda-mozzarella"), (n) => (claveDeNombreDetal(n) === "mozzarella" ? lista.mozzarella : null), 0.8);
  assert.equal(sinJamon.total, null);
  assert.deepEqual(sinJamon.faltan, ["Jamón de espalda Drago"]);
  // Los recortes: sin partes y sin precio.
  const recortes = desgloseDelCombo(combo("recortes"), enLaLista, 0.8);
  assert.deepEqual([recortes.partes.length, recortes.total], [0, null]);
});

test("los nombres del detal se buscan sin tildes, mayúsculas ni espacios de más", () => {
  assert.equal(claveDeNombreDetal("  Jamón de  ESPALDA Drago "), "jamon de espalda drago");
});
