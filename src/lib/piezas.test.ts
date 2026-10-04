import { test } from "node:test";
import assert from "node:assert/strict";
import { pesoTipico, revisarPesoPorPieza } from "./piezas.ts";

test("el peso típico es la mediana de los kilos por pieza, y hace falta ver al menos tres notas", () => {
  assert.equal(pesoTipico([2.5, 2.6]), null);
  assert.deepEqual(pesoTipico([2.5, 2.6, 2.4]), { peso: 2.5, muestras: 3 });
  // Una nota rara no lo mueve.
  assert.deepEqual(pesoTipico([2.5, 2.5, 2.6, 2.4, 9]), { peso: 2.5, muestras: 5 });
  assert.deepEqual(pesoTipico([2, 3, 0, -1, Number.NaN]), null);
  assert.deepEqual(pesoTipico([2, 3, 2.5, 2.7]), { peso: 2.6, muestras: 4 });
});

test("dos piezas y cinco kilos cuadran con 2,5 por pieza; dos piezas y ocho kilos, no", () => {
  const tipico = { peso: 2.5, muestras: 12 };
  assert.equal(revisarPesoPorPieza("Queso mozzarella", 2, 5, tipico), null);
  assert.equal(revisarPesoPorPieza("Queso mozzarella", 2, 5.6, tipico), null);
  assert.equal(
    revisarPesoPorPieza("Queso mozzarella", 2, 8, tipico),
    "Queso mozzarella: cada pieza suele pesar 2,5 kg (en tus últimas 12 notas) y hoy anotaste 2 piezas y 8 kg, que son 4 kg por pieza. Revisa los kilos o las piezas.",
  );
  assert.match(revisarPesoPorPieza("Queso mozzarella", 1, 1, tipico) ?? "", /1 pieza y 1 kg/);
  assert.equal(revisarPesoPorPieza("Queso mozzarella", 0, 5, tipico), null);
});
