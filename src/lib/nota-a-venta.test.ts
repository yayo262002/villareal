import { test } from "node:test";
import assert from "node:assert/strict";
import { usd } from "./dinero.ts";
import { ventaDeLaNota, type ArticuloDeLaNota } from "./nota-a-venta.ts";
import type { NotaLeida } from "./nota-leida.ts";

const catalogo: ArticuloDeLaNota[] = [
  { clave: "2", nombre: "Queso mozzarella", unidad: "kg" },
  { clave: "3", nombre: "Huevos", unidad: "carton" },
  { clave: "5-1", nombre: "Tocineta ahumada Plumrose", unidad: "kg" },
  { clave: "7", nombre: "Pecorino rallado Sortilegio 500 g", unidad: "unidad" },
];

// La nota de Nelson: 2 piezas de mozzarella (5 kg a 7,70), 2 cartones de huevos (solo con el importe) y una tocineta que el lector no supo cuál era.
const deNelson: NotaLeida = {
  esNota: true,
  cliente: { nombre: "Nelson", rif: null, direccion: null },
  fecha: "2026-11-14",
  lineas: [
    { descripcion: "Mozzarella", clave: "2", piezas: 2, cantidad: 5, precio: 7.7, importe: 38.5 },
    { descripcion: "Huevos", clave: "3", piezas: null, cantidad: null, precio: 3.4, importe: 6.8 },
    { descripcion: "tocineta", clave: null, piezas: null, cantidad: 1, precio: 9, importe: 9 },
  ],
  total: 54.3,
  firmada: true,
};

test("la nota se vuelve el carrito: cada línea con sus kilos, sus piezas y el precio de la nota", () => {
  const venta = ventaDeLaNota(deNelson, catalogo, "2026-11-14");
  assert.equal(venta.esNota, true);
  assert.equal(venta.fecha, "2026-11-14");
  assert.equal(venta.firmada, true);
  assert.equal(venta.total, 54.3);
  assert.deepEqual(venta.lineas, [
    { clave: "2", cantidad: 5, piezas: 2, precio: 7.7, descripcion: "Mozzarella", importe: 38.5 },
    // Sin la cantidad escrita, sale del importe entre el precio.
    { clave: "3", cantidad: 2, piezas: null, precio: 3.4, descripcion: "Huevos", importe: 6.8 },
  ]);
  // La tocineta queda para elegir, con la que se le parece.
  assert.deepEqual(venta.sinProducto, [{ renglon: 2, descripcion: "tocineta", cantidad: 1, piezas: null, precio: 9, importe: 9, parecidos: ["5-1"] }]);
  assert.deepEqual(venta.avisos, []);
});

test("sin precio en la nota, sale del importe; sin nada, va el de la caja (null) y sin cantidad se pide", () => {
  const venta = ventaDeLaNota(
    {
      ...deNelson,
      lineas: [
        { descripcion: "Mozzarella", clave: "2", piezas: 2, cantidad: 5, precio: null, importe: 38.5 },
        { descripcion: "Pecorino", clave: "7", piezas: 3, cantidad: null, precio: null, importe: null },
        { descripcion: "Huevos", clave: "3", piezas: null, cantidad: null, precio: null, importe: null },
      ],
      total: null,
    },
    catalogo,
    "2026-11-14",
  );
  assert.equal(venta.lineas[0].precio, 7.7);
  // Lo que va por unidad: las piezas son las unidades.
  assert.equal(venta.lineas[1].cantidad, 3);
  assert.equal(venta.lineas[1].precio, null);
  assert.equal(venta.lineas[2].cantidad, 0);
  assert.deepEqual(venta.avisos, ["No se lee cuánto de Huevos dice la nota: escríbelo en el carrito."]);
  // Sin total escrito, el total es lo que suman los renglones.
  assert.equal(venta.total, 38.5);
});

test("el mismo producto dos veces va en una sola línea, y se avisa", () => {
  const venta = ventaDeLaNota(
    {
      ...deNelson,
      lineas: [
        { descripcion: "Mozzarella", clave: "2", piezas: 1, cantidad: 2.5, precio: 7.7, importe: 19.25 },
        { descripcion: "Mozzarella", clave: "2", piezas: 1, cantidad: 2.4, precio: 7.5, importe: 18 },
      ],
      total: 37.25,
    },
    catalogo,
    "2026-11-14",
  );
  assert.equal(venta.lineas.length, 1);
  assert.equal(venta.lineas[0].cantidad, 4.9);
  assert.equal(venta.lineas[0].piezas, 2);
  assert.equal(venta.lineas[0].precio, 7.7);
  assert.deepEqual(venta.avisos, [
    `Queso mozzarella sale en la nota a ${usd(7.7)} y a ${usd(7.5)}: van juntas a ${usd(7.7)}. Revisa el precio.`,
    "Queso mozzarella sale 2 veces en la nota: va en una sola línea con todo junto.",
  ]);
});

test("la fecha de mañana, la que no se lee, la suma que no cuadra y la firma que falta se avisan", () => {
  const venta = ventaDeLaNota({ ...deNelson, fecha: "2026-11-20", total: 60, firmada: false }, catalogo, "2026-11-14");
  assert.equal(venta.fecha, null);
  assert.deepEqual(venta.avisos, [
    "La nota dice 20/11/2026, que todavía no ha llegado: queda la de hoy. Revisa la fecha.",
    `En la nota los renglones suman ${usd(54.3)} y el total dice ${usd(60)}: revisa la suma.`,
    "No se ve la firma del cliente en la nota.",
  ]);
  assert.match(ventaDeLaNota({ ...deNelson, fecha: null }, catalogo, "2026-11-14").avisos[0], /No se lee la fecha/);
  assert.match(ventaDeLaNota({ ...deNelson, lineas: [], total: null }, catalogo, "2026-11-14").avisos[0], /No se leyó ningún producto/);
});

test("una foto que no es una nota no llena nada", () => {
  const venta = ventaDeLaNota({ ...deNelson, esNota: false }, catalogo, "2026-11-14");
  assert.equal(venta.esNota, false);
  assert.deepEqual(venta.lineas, []);
  assert.match(venta.avisos[0], /no parece una nota de entrega/);
});
