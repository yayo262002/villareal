import { test } from "node:test";
import assert from "node:assert/strict";
import { LARGO_MAXIMO_DEL_TEXTO, ejemplosPara, iniciales, leerResena } from "./resenas-texto.ts";

function leida(escrito: Partial<{ autor: string; detalle: string; texto: string }>) {
  const lectura = leerResena({ autor: "Pizzería La Esquina", detalle: "", texto: "Gratina muy bien y no se quema.", ...escrito });
  return lectura.valida ? lectura.datos : lectura.motivo;
}

test("una reseña bien escrita se guarda tal cual", () => {
  assert.deepEqual(leida({ detalle: "Pizzería en el centro" }), {
    autor: "Pizzería La Esquina",
    detalle: "Pizzería en el centro",
    texto: "Gratina muy bien y no se quema.",
  });
});

test("se quitan los espacios de más y los saltos de línea, no las palabras", () => {
  assert.deepEqual(leida({ autor: "  Luis   Pérez ", texto: "  Gratina muy bien\n y  no se quema.  " }), {
    autor: "Luis Pérez",
    detalle: "",
    texto: "Gratina muy bien y no se quema.",
  });
});

test("las comillas de los extremos sobran: la web pone las suyas", () => {
  for (const texto of ['"Gratina muy bien y no se quema."', "«Gratina muy bien y no se quema.»", "“Gratina muy bien y no se quema.”"]) {
    assert.equal((leida({ texto }) as { texto: string }).texto, "Gratina muy bien y no se quema.", texto);
  }
  // Las de dentro son del cliente y se quedan.
  assert.equal((leida({ texto: 'La llaman "la que no se quema" en la cocina' }) as { texto: string }).texto, 'La llaman "la que no se quema" en la cocina');
});

test("sin autor o sin comentario no vale, y se dice qué falta", () => {
  assert.match(String(leida({ autor: "   " })), /quién lo dice/);
  assert.match(String(leida({ texto: "" })), /comentario del cliente/);
  assert.match(String(leida({ texto: "Bueno" })), /comentario del cliente/);
});

test("un comentario demasiado largo se rechaza diciendo cuánto mide", () => {
  const largo = "a".repeat(LARGO_MAXIMO_DEL_TEXTO + 1);
  assert.match(String(leida({ texto: largo })), new RegExp(`${LARGO_MAXIMO_DEL_TEXTO + 1} letras`));
  assert.equal(typeof leida({ texto: "a".repeat(LARGO_MAXIMO_DEL_TEXTO) }), "object");
  assert.match(String(leida({ autor: "a".repeat(81) })), /nombre es demasiado largo/);
});

test("las iniciales del autor, sin contar «de» ni «la»", () => {
  assert.equal(iniciales("Pizzería La Esquina"), "PE");
  assert.equal(iniciales("Panadería de la Plaza"), "PP");
  assert.equal(iniciales("luis"), "L");
  assert.equal(iniciales("Élite Pizza 2000"), "ÉP");
  assert.equal(iniciales("Restaurante El Fogón, C.A."), "RF");
  assert.equal(iniciales("0412-1234567"), "");
  assert.equal(iniciales(""), "");
});

test("cada producto tiene reseñas de ejemplo de lo que es", () => {
  assert.match(ejemplosPara("Queso mozzarella")[0].texto, /Gratina/);
  assert.match(ejemplosPara("Queso pecorino rallado")[0].texto, /rallado/);
  assert.match(ejemplosPara("Huevos")[0].texto, /huevos/);
  assert.match(ejemplosPara("Queso amarillo")[0].texto, /Funde/);
  assert.equal(ejemplosPara("Mantequilla").length, 1);
});

test("las reseñas de ejemplo no se pueden confundir con un cliente de verdad y son válidas", () => {
  for (const producto of ["Queso mozzarella", "Queso pecorino rallado", "Queso pecorino", "Huevos", "Queso amarillo", "Mantequilla"]) {
    for (const ejemplo of ejemplosPara(producto)) {
      assert.match(ejemplo.autor, /de ejemplo$/, `${producto}: ${ejemplo.autor}`);
      assert.deepEqual(leerResena(ejemplo), { valida: true, datos: ejemplo }, `${producto}: ${ejemplo.texto}`);
    }
  }
});

test("pedir los ejemplos dos veces da copias: cambiar una no cambia la otra", () => {
  const primera = ejemplosPara("Huevos");
  primera[0].texto = "cambiado";
  assert.notEqual(ejemplosPara("Huevos")[0].texto, "cambiado");
});
