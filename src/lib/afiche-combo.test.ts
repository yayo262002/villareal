import { test } from "node:test";
import assert from "node:assert/strict";
import { fotoParaElCombo, piezasDelAfiche, precioDeLaEtiqueta, type PiezaDeCombo } from "./afiche-combo.ts";

test("la foto de un producto del combo: la suya, o la de su única marca", () => {
  assert.equal(fotoParaElCombo("/foto-producto/2?v=1", []), "/foto-producto/2?v=1");
  assert.equal(fotoParaElCombo("/foto-producto/2?v=1", ["/foto-variante/9?v=1", null]), "/foto-producto/2?v=1");
  assert.equal(fotoParaElCombo(null, ["/foto-variante/9?v=1"]), "/foto-variante/9?v=1");
  assert.equal(fotoParaElCombo(null, [null]), null);
  assert.equal(fotoParaElCombo(null, []), null);
});

test("con dos marcas a la venta no se pone la foto de ninguna: el combo de perros lleva Alimex, no Purolomo", () => {
  assert.equal(fotoParaElCombo(null, ["/foto-variante/22?v=1", null]), null);
  assert.equal(fotoParaElCombo(null, ["/foto-variante/22?v=1", "/foto-variante/54?v=1"]), null);
});

const pieza = (producto_id: number, foto: string | null): PiezaDeCombo => ({ producto_id, nombre: `P${producto_id}`, cantidad: "1", foto });

test("van con foto las que la tienen (cuatro como mucho) y con letra las demás, en el orden del combo", () => {
  const { fotos, letras } = piezasDelAfiche([pieza(1, "/a"), pieza(2, null), pieza(3, "/c")]);
  assert.deepEqual(fotos.map((p) => p.producto_id), [1, 3]);
  assert.deepEqual(letras.map((p) => p.producto_id), [2]);
  const muchas = piezasDelAfiche([1, 2, 3, 4, 5].map((i) => pieza(i, `/f${i}`)));
  assert.equal(muchas.fotos.length, 4);
  assert.deepEqual(muchas.letras.map((p) => p.producto_id), [5]);
  assert.deepEqual(piezasDelAfiche([]), { fotos: [], letras: [] });
});

test("el precio de la etiqueta va en dólares con coma; sin precio, ninguno", () => {
  assert.equal(precioDeLaEtiqueta(7.05), "7,05");
  assert.equal(precioDeLaEtiqueta(10.69), "10,69");
  assert.equal(precioDeLaEtiqueta(12), "12,00");
  assert.equal(precioDeLaEtiqueta(1234.5), "1.234,50");
  assert.equal(precioDeLaEtiqueta(null), null);
  assert.equal(precioDeLaEtiqueta(0), null);
  assert.equal(precioDeLaEtiqueta(Number.NaN), null);
});
