import { test } from "node:test";
import assert from "node:assert/strict";
import { SIN_PROVEEDOR, agruparCompra, cuentaDeCompra, esTipoDeCompra, nombreDelTipo, type ArticuloDeCompra } from "./lista-compra-calculo.ts";

const art = (id: number, nombre: string, categoria: string, donde: string, listo = false, orden = id): ArticuloDeCompra => ({
  id,
  nombre,
  categoria,
  donde,
  precio_usd: null,
  nota: "",
  listo,
  orden,
});

const LISTA = [
  art(1, "Pan Hot Burguer grande", "hamburguesas", "Lusi"),
  art(2, "Salsa BBQ Fritz", "hamburguesas", "PRODISA", true),
  art(3, "Mozzarella", "pizza", "Donde siempre"),
  art(4, "Guantes desechables", "desechables", ""),
  art(5, "Refresco Sun", "bebidas", "PRODISA"),
  art(6, "Algo raro", "inventado", "Otro proveedor"),
];

test("por tipo: en el orden de los tipos, y lo que no es de ninguno en «Otros»", () => {
  const grupos = agruparCompra(LISTA, "tipo", false);
  assert.deepEqual(
    grupos.map((g) => g.titulo),
    ["Hamburguesas", "Pizza", "Refrescos y bebidas", "Desechables y empaques", "Otros"],
  );
  assert.deepEqual(grupos[0].articulos.map((a) => a.id), [1, 2]);
  assert.equal(grupos[0].faltan, 1);
});

test("por proveedor: los de siempre en su orden, los demás después y lo que no dice dónde al final", () => {
  const grupos = agruparCompra(LISTA, "proveedor", false);
  assert.deepEqual(
    grupos.map((g) => g.titulo),
    ["Lusi", "PRODISA", "Donde siempre", "Otro proveedor", SIN_PROVEEDOR],
  );
  assert.deepEqual(grupos[1].articulos.map((a) => a.nombre), ["Salsa BBQ Fritz", "Refresco Sun"]);
});

test("solo lo que falta: sin lo tachado, y un grupo completo no sale", () => {
  const lista = [...LISTA, art(7, "Salsa de maíz Fritz", "hamburguesas", "PRODISA", true)];
  const grupos = agruparCompra(lista, "proveedor", true);
  assert.deepEqual(grupos.find((g) => g.clave === "PRODISA")?.articulos.map((a) => a.id), [5]);
  const soloTachado = agruparCompra([art(1, "Pan", "hamburguesas", "Lusi", true)], "tipo", true);
  assert.deepEqual(soloTachado, []);
});

test("dentro de cada grupo, por su orden y después por su número", () => {
  const grupos = agruparCompra([art(3, "C", "pizza", "", false, 2), art(1, "A", "pizza", "", false, 5), art(2, "B", "pizza", "", false, 2)], "tipo", false);
  assert.deepEqual(grupos[0].articulos.map((a) => a.nombre), ["B", "C", "A"]);
});

test("la cuenta: cuántos hay y cuántos faltan", () => {
  assert.deepEqual(cuentaDeCompra(LISTA), { total: 6, faltan: 5 });
  assert.deepEqual(cuentaDeCompra([]), { total: 0, faltan: 0 });
});

test("los tipos: solo los de la lista valen, y cualquier otro se llama «Otros»", () => {
  assert.equal(esTipoDeCompra("pizza"), true);
  assert.equal(esTipoDeCompra("PIZZA"), false);
  assert.equal(esTipoDeCompra("constructor"), false);
  assert.equal(nombreDelTipo("desechables"), "Desechables y empaques");
  assert.equal(nombreDelTipo("toString"), "Otros");
});
