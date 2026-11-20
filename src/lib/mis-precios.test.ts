import { test } from "node:test";
import assert from "node:assert/strict";
import { filasDeMisPrecios, type ProductoDeMisPrecios, type VarianteDeMisPrecios } from "./mis-precios.ts";

const producto = (p: Partial<ProductoDeMisPrecios> & Pick<ProductoDeMisPrecios, "id" | "nombre">): ProductoDeMisPrecios => ({
  unidad: "unidad",
  costo_usd: null,
  precio_usd: null,
  activo: 1,
  borrador: 0,
  familia_id: 1,
  marca: "",
  presentacion: "",
  contenido: "",
  combo_detal: null,
  ...p,
});
const familias = [
  { id: 2, nombre: "Desechables", orden: 10 },
  { id: 1, nombre: "Burger", orden: 1 },
];

test("un tipo con artículos da una fila por artículo publicado, con lo que deja", () => {
  const variantes: VarianteDeMisPrecios[] = [
    { id: 7, producto_id: 34, nombre: "Minco paquete de 5 × 56 g", costo_usd: 1.464, precio_usd: 1.61, activo: 1 },
    { id: 8, producto_id: 34, nombre: "Escondido", costo_usd: 1, precio_usd: 2, activo: 0 },
  ];
  const [grupo] = filasDeMisPrecios([producto({ id: 34, nombre: "Carne para hamburguesa" })], variantes, familias, 900);
  assert.equal(grupo.familia, "Burger");
  assert.equal(grupo.filas.length, 1);
  const f = grupo.filas[0];
  assert.equal(f.detalle, "Minco paquete de 5 × 56 g");
  assert.equal(f.bs, 1449);
  assert.equal(f.deja, 0.15);
  assert.equal(f.margenPct, 10);
});

test("sin artículos, la fila es el tipo con su presentación; sin tasa no hay bolívares", () => {
  const [grupo] = filasDeMisPrecios(
    [producto({ id: 77, nombre: "Caja térmica CT2/P1", familia_id: 2, presentacion: "Paquete", contenido: "20 unidades", costo_usd: 1.926, precio_usd: 2.12 })],
    [],
    familias,
    null,
  );
  assert.equal(grupo.filas[0].detalle, "Paquete de 20 unidades");
  assert.equal(grupo.filas[0].bs, null);
  assert.equal(grupo.filas[0].deja, 0.19);
});

test("no salen borradores, escondidos ni los combos del detal; las familias van en su orden", () => {
  const grupos = filasDeMisPrecios(
    [
      producto({ id: 1, nombre: "Borrador", borrador: 1, activo: 0 }),
      producto({ id: 2, nombre: "Escondido", activo: 0 }),
      producto({ id: 3, nombre: "Combo jamón + queso", combo_detal: "combo-1", precio_usd: 3 }),
      producto({ id: 4, nombre: "Servilletas", familia_id: 2, precio_usd: 1.03 }),
      producto({ id: 5, nombre: "Mayonesa", familia_id: 1, precio_usd: 2.35, costo_usd: null }),
    ],
    [],
    familias,
    900,
  );
  assert.deepEqual(
    grupos.map((g) => [g.familia, g.filas.map((f) => f.tipo)]),
    [
      ["Burger", ["Mayonesa"]],
      ["Desechables", ["Servilletas"]],
    ],
  );
  assert.equal(grupos[0].filas[0].deja, null);
});
