import { test } from "node:test";
import assert from "node:assert/strict";
import { redondearTasa, revisarTasa } from "./tasa.ts";

test("la tasa se guarda con cuatro decimales, como la publica el BCV", () => {
  assert.equal(redondearTasa(857.88764), 857.8876);
  assert.equal(redondearTasa(36.5), 36.5);
});

test("sin tasa anterior se acepta cualquier número válido", () => {
  assert.deepEqual(revisarTasa(null, 857.8876), { aceptada: true, valor: 857.8876 });
  assert.deepEqual(revisarTasa(null, "857,8876"), { aceptada: true, valor: 857.8876 });
});

test("lo que no es un número mayor que cero se rechaza", () => {
  for (const malo of [null, undefined, "", "abc", 0, -5, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
    assert.equal(revisarTasa(850, malo).aceptada, false, String(malo));
  }
});

test("un cambio normal de un día para otro se acepta", () => {
  assert.deepEqual(revisarTasa(850, 857.8876), { aceptada: true, valor: 857.8876 });
  assert.deepEqual(revisarTasa(850, 845), { aceptada: true, valor: 845 });
});

test("un salto demasiado grande se rechaza y dice por qué", () => {
  const revision = revisarTasa(36.5, 857.8876);
  assert.equal(revision.aceptada, false);
  assert.match(revision.aceptada ? "" : revision.motivo, /cambia un \d+ %/);
  assert.equal(revisarTasa(850, 85).aceptada, false);
});

test("si la tasa vigente lleva días sin tocarse, el margen crece", () => {
  // Un 40 % en un día es sospechoso; tras tres días sin actualizar, no.
  assert.equal(revisarTasa(100, 140, 1).aceptada, false);
  assert.equal(revisarTasa(100, 140, 3).aceptada, true);
});
