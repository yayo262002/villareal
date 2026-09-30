import { test } from "node:test";
import assert from "node:assert/strict";
import { usd } from "./dinero.ts";
import { compararNota, interpretarLectura, type NotaLeida } from "./nota-leida.ts";

// La nota de la panadería: 2 piezas de mozzarella a 7,70, importe 38,50, del 29/09/2026, firmada.
const panaderia: NotaLeida = {
  esNota: true,
  fecha: "2026-09-29",
  lineas: [{ descripcion: "Mozzarella cuadrada", precio: 7.7, importe: 38.5 }],
  total: 38.5,
  firmada: true,
};

test("interpreta el JSON del lector, aunque venga en una valla de código o con números con coma", () => {
  const texto = '```json\n{"es_nota": true, "fecha": "2026-09-29", "lineas": [{"descripcion": "Mozzarella cuadrada", "precio": "7,7", "importe": "38,5"}], "total": 38.5, "firmada": true}\n```';
  assert.deepEqual(interpretarLectura(texto), panaderia);
});

test("lo que no encaja se deja en null; lo que no es un JSON con es_nota, null del todo", () => {
  assert.deepEqual(interpretarLectura('{"es_nota": false, "fecha": "ayer", "lineas": "nada", "total": "?", "firmada": "sí"}'), {
    esNota: false,
    fecha: null,
    lineas: [],
    total: null,
    firmada: null,
  });
  assert.equal(interpretarLectura("No puedo leer la imagen."), null);
  assert.equal(interpretarLectura('{"fecha": "2026-09-29"}'), null);
  assert.equal(interpretarLectura("{roto"), null);
  // Lo guardado se vuelve a leer igual.
  assert.deepEqual(interpretarLectura(JSON.stringify(panaderia)), panaderia);
});

test("la nota de la panadería cuadra con lo anotado: nada que decir", () => {
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 38.5 }), []);
});

test("una foto que no es la nota se dice, y no se mira nada más", () => {
  const avisos = compararNota({ ...panaderia, esNota: false, fecha: "2020-01-01" }, { fecha: "2026-09-29", total: 1 });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /no parece una nota de entrega/);
});

test("la fecha: si no se lee se avisa; si es otra, se dicen las dos", () => {
  assert.deepEqual(compararNota({ ...panaderia, fecha: null }, { fecha: "2026-09-29", total: 38.5 }), ["En la foto no se lee la fecha de la nota."]);
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-30", total: 38.5 }), [
    "La nota dice 29/09/2026 y la fecha de despacho anotada es 30/09/2026.",
  ]);
});

test("la suma de la nota: las líneas contra el total escrito, y el total contra lo anotado", () => {
  // La segunda línea era de otra hoja: 38,50 + 50,60 no dan el total de 38,50.
  const conFantasma = { ...panaderia, lineas: [...panaderia.lineas, { descripcion: "Mozzarella", precio: 12.65, importe: 50.6 }] };
  assert.deepEqual(compararNota(conFantasma, { fecha: "2026-09-29", total: 38.5 }), [
    `En la nota las líneas suman ${usd(89.1)} y el total dice ${usd(38.5)}: revisa la suma.`,
  ]);
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 42 }), [`La nota dice un total de ${usd(38.5)} y lo anotado suma ${usd(42)}.`]);
  // Un centavo de redondeo no es una diferencia.
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 38.51 }), []);
});

test("sin total escrito, lo que suman las líneas hace de total", () => {
  const sinTotal = { ...panaderia, total: null };
  assert.deepEqual(compararNota(sinTotal, { fecha: "2026-09-29", total: 38.5 }), []);
  assert.deepEqual(compararNota(sinTotal, { fecha: "2026-09-29", total: 40 }), [`La nota dice un total de ${usd(38.5)} y lo anotado suma ${usd(40)}.`]);
  // Sin importes ni total no hay con qué comparar.
  assert.deepEqual(compararNota({ ...sinTotal, lineas: [] }, { fecha: "2026-09-29", total: 40 }), []);
});

test("sin la firma del cliente se avisa; si no se distingue, no", () => {
  assert.deepEqual(compararNota({ ...panaderia, firmada: false }, { fecha: "2026-09-29", total: 38.5 }), ["No se ve la firma del cliente en la nota."]);
  assert.deepEqual(compararNota({ ...panaderia, firmada: null }, { fecha: "2026-09-29", total: 38.5 }), []);
});

test("varios reparos salen todos, en orden: fecha, suma, total, firma", () => {
  const avisos = compararNota(
    { esNota: true, fecha: "2026-09-12", lineas: [{ descripcion: "Queso", precio: 5, importe: 10 }], total: 12, firmada: false },
    { fecha: "2026-09-16", total: 15 },
  );
  assert.equal(avisos.length, 4);
  assert.match(avisos[0], /La nota dice 12\/09\/2026/);
  assert.match(avisos[1], /revisa la suma/);
  assert.match(avisos[2], /lo anotado suma/);
  assert.match(avisos[3], /firma/);
});
