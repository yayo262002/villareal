import { test } from "node:test";
import assert from "node:assert/strict";
import { usd } from "./dinero.ts";
import { compararNota, interpretarLectura, nombraElProducto, type LineaAnotada, type NotaLeida } from "./nota-leida.ts";

// La nota de la panadería: 2 piezas (5 kg) de mozzarella a 7,70, importe 38,50, del 29/09/2026, firmada.
const panaderia: NotaLeida = {
  esNota: true,
  fecha: "2026-09-29",
  lineas: [{ descripcion: "Mozzarella cuadrada", clave: "2", piezas: 2, cantidad: 5, precio: 7.7, importe: 38.5 }],
  total: 38.5,
  firmada: true,
};

// Lo que se anotó en el pedido.
const mozzarella: LineaAnotada = { clave: "2", nombre: "Queso mozzarella", unidad: "kg", piezas: 2, cantidad: 5, precio: 7.7, importe: 38.5 };
const huevos: LineaAnotada = { clave: "3", nombre: "Huevos", unidad: "carton", cantidad: 2, precio: 3.4, importe: 6.8 };
const pedido = { fecha: "2026-09-29", total: 38.5, lineas: [mozzarella] };

test("interpreta el JSON del lector, aunque venga en una valla de código o con números con coma", () => {
  const texto =
    '```json\n{"es_nota": true, "fecha": "2026-09-29", "lineas": [{"descripcion": "Mozzarella cuadrada", "clave": 2, "piezas": "2", "cantidad": "5", "precio": "7,7", "importe": "38,5"}], "total": 38.5, "firmada": true}\n```';
  assert.deepEqual(interpretarLectura(texto), panaderia);
});

test("lo que no encaja se deja en null; lo que no es un JSON con es_nota, null del todo", () => {
  assert.deepEqual(interpretarLectura('{"es_nota": false, "fecha": "ayer", "lineas": [{"clave": "mozzarella"}], "total": "?", "firmada": "sí"}'), {
    esNota: false,
    fecha: null,
    lineas: [{ descripcion: "", clave: null, piezas: null, cantidad: null, precio: null, importe: null }],
    total: null,
    firmada: null,
  });
  assert.equal(interpretarLectura("No puedo leer la imagen."), null);
  assert.equal(interpretarLectura('{"fecha": "2026-09-29"}'), null);
  assert.equal(interpretarLectura("{roto"), null);
  // Lo guardado se vuelve a leer igual.
  assert.deepEqual(interpretarLectura(JSON.stringify(panaderia)), panaderia);
});

test("la nota de la panadería cuadra con lo anotado: nada que decir, se acepta", () => {
  assert.deepEqual(compararNota(panaderia, pedido), []);
  // Sin saber qué se anotó, solo la fecha, el total y la firma.
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 38.5 }), []);
});

test("una foto que no es la nota se dice, y no se mira nada más", () => {
  const avisos = compararNota({ ...panaderia, esNota: false, fecha: "2020-01-01" }, { fecha: "2026-09-29", total: 1 });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /no parece una nota de entrega/);
});

test("la fecha: si no se lee se avisa; si es otra, se dicen las dos", () => {
  assert.deepEqual(compararNota({ ...panaderia, fecha: null }, pedido), ["En la foto no se lee la fecha de la nota."]);
  assert.deepEqual(compararNota(panaderia, { ...pedido, fecha: "2026-09-30" }), ["La nota dice 29/09/2026 y anotaste 30/09/2026 como fecha de la nota."]);
});

test("línea a línea: los kilos, el precio, el importe o las piezas que no coinciden se dicen con nombre", () => {
  // Se anotaron 4 kilos y la nota dice 5.
  const cuatroKilos = { ...pedido, total: 30.8, lineas: [{ ...mozzarella, cantidad: 4, importe: 30.8 }] };
  assert.deepEqual(compararNota(panaderia, cuatroKilos), [
    "En la nota Queso mozzarella son 5 kg y anotaste 4 kg.",
    `En la nota Queso mozzarella importa ${usd(38.5)} y lo anotado da ${usd(30.8)}.`,
  ]);
  // Otro precio.
  const otroPrecio = { ...pedido, total: 40, lineas: [{ ...mozzarella, precio: 8, importe: 40 }] };
  assert.deepEqual(compararNota(panaderia, otroPrecio), [
    `En la nota Queso mozzarella va a ${usd(7.7)} y anotaste ${usd(8)}.`,
    `En la nota Queso mozzarella importa ${usd(38.5)} y lo anotado da ${usd(40)}.`,
  ]);
  // Otras piezas; sin piezas anotadas no se compara.
  assert.deepEqual(compararNota(panaderia, { ...pedido, lineas: [{ ...mozzarella, piezas: 3 }] }), ["En la nota Queso mozzarella son 2 piezas y anotaste 3."]);
  assert.deepEqual(compararNota(panaderia, { ...pedido, lineas: [{ ...mozzarella, piezas: null }] }), []);
});

test("lo que se anotó y la nota no trae, y lo que la nota trae y no se anotó", () => {
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 45.3, lineas: [mozzarella, huevos] }), [
    "Anotaste 2 cartón de Huevos y en la nota no aparece.",
  ]);
  const conAmarillo: NotaLeida = {
    ...panaderia,
    lineas: [...panaderia.lineas, { descripcion: "Queso amarillo", clave: null, piezas: null, cantidad: 2, precio: 8.5, importe: 17 }],
    total: 55.5,
  };
  assert.deepEqual(compararNota(conAmarillo, pedido), [`En la nota hay «Queso amarillo» por ${usd(17)} que no anotaste.`]);
});

test("sin clave del lector, la línea se reconoce por el nombre aunque esté mal escrito; una marca distinta no se confunde", () => {
  const sinClave: NotaLeida = { ...panaderia, lineas: [{ ...panaderia.lineas[0], clave: null, descripcion: "mozarela cuadrada" }] };
  assert.deepEqual(compararNota(sinClave, pedido), []);
  assert.equal(nombraElProducto("Queso mozzarella", "Mozarela cuadrada"), true);
  assert.equal(nombraElProducto("Huevos", "cartón de huevos"), true);
  assert.equal(nombraElProducto("Queso pecorino rallado Sortilegio 500 g", "pecorino"), true);
  assert.equal(nombraElProducto("Queso amarillo Kemmental", "pecorino rallado"), false);
  // El lector dijo que es otra marca: no se da por la anotada.
  const otraMarca: NotaLeida = { ...panaderia, lineas: [{ ...panaderia.lineas[0], clave: "1-4", descripcion: "queso amarillo" }] };
  const legado: LineaAnotada = { clave: "1-3", nombre: "Queso amarillo El Legado", unidad: "kg", cantidad: 5, precio: 7.7, importe: 38.5 };
  assert.deepEqual(compararNota(otraMarca, { fecha: "2026-09-29", total: 38.5, lineas: [legado] }), [
    "Anotaste 5 kg de Queso amarillo El Legado y en la nota no aparece.",
    `En la nota hay «queso amarillo» por ${usd(38.5)} que no anotaste.`,
  ]);
});

test("la suma de la nota: las líneas contra el total escrito, y el total contra lo anotado", () => {
  // La segunda línea era de otra hoja: 38,50 + 50,60 no dan el total de 38,50.
  const conFantasma = { ...panaderia, lineas: [...panaderia.lineas, { descripcion: "Mozzarella", clave: null, piezas: null, cantidad: null, precio: 12.65, importe: 50.6 }] };
  assert.deepEqual(compararNota(conFantasma, { fecha: "2026-09-29", total: 38.5 }), [
    `En la nota las líneas suman ${usd(89.1)} y el total dice ${usd(38.5)}: revisa la suma.`,
  ]);
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 42 }), [`La nota dice un total de ${usd(38.5)} y lo anotado suma ${usd(42)}.`]);
  // Un centavo de redondeo no es una diferencia.
  assert.deepEqual(compararNota(panaderia, { fecha: "2026-09-29", total: 38.51 }), []);
  // Si ya se dijo qué línea no cuadra, el total no se repite.
  const cuatroKilos = { ...pedido, total: 30.8, lineas: [{ ...mozzarella, cantidad: 4, importe: 30.8 }] };
  assert.ok(!compararNota(panaderia, cuatroKilos).some((a) => a.includes("lo anotado suma")));
});

test("sin total escrito, lo que suman las líneas hace de total", () => {
  const sinTotal = { ...panaderia, total: null };
  assert.deepEqual(compararNota(sinTotal, { fecha: "2026-09-29", total: 38.5 }), []);
  assert.deepEqual(compararNota(sinTotal, { fecha: "2026-09-29", total: 40 }), [`La nota dice un total de ${usd(38.5)} y lo anotado suma ${usd(40)}.`]);
  // Sin importes ni total no hay con qué comparar.
  assert.deepEqual(compararNota({ ...sinTotal, lineas: [] }, { fecha: "2026-09-29", total: 40, lineas: [mozzarella] }), []);
});

test("sin la firma del cliente se avisa; si no se distingue, no", () => {
  assert.deepEqual(compararNota({ ...panaderia, firmada: false }, pedido), ["No se ve la firma del cliente en la nota."]);
  assert.deepEqual(compararNota({ ...panaderia, firmada: null }, pedido), []);
});

test("varios reparos salen todos, en orden: fecha, líneas, suma, firma", () => {
  const avisos = compararNota(
    { esNota: true, fecha: "2026-09-12", lineas: [{ descripcion: "Queso", clave: "2", piezas: null, cantidad: 2, precio: 5, importe: 10 }], total: 12, firmada: false },
    { fecha: "2026-09-16", total: 15, lineas: [{ ...mozzarella, cantidad: 3, precio: 5, importe: 15 }] },
  );
  assert.equal(avisos.length, 5);
  assert.match(avisos[0], /La nota dice 12\/09\/2026/);
  assert.match(avisos[1], /son 2 kg y anotaste 3 kg/);
  assert.match(avisos[2], /importa/);
  assert.match(avisos[3], /revisa la suma/);
  assert.match(avisos[4], /firma/);
});
