import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claveDe,
  esEstadoDeProducto,
  estaVigente,
  estadoDeProducto,
  nombreDeVenta,
  porQueSeCobra,
  precioPublicado,
  presentacionDe,
  vendiblesDe,
  type VarianteDeCatalogo,
} from "./catalogo.ts";

const amarillo = { id: 1, nombre: "Queso amarillo", unidad: "kg", activo: 1, precio_usd: 8.5 };
const mozzarella = { id: 2, nombre: "Queso mozzarella", unidad: "kg", activo: 1, precio_usd: 7.7 };
const pecorino = { id: 3, nombre: "Queso pecorino rallado", unidad: "unidad", activo: 1, precio_usd: null };
const oculto = { id: 4, nombre: "Huevos", unidad: "carton", activo: 0, precio_usd: 9 };

const kemmental: VarianteDeCatalogo = { id: 10, producto_id: 1, nombre: "Kemmental", activo: 1, precio_usd: 9 };
const legado: VarianteDeCatalogo = { id: 11, producto_id: 1, nombre: "El Legado", activo: 1, precio_usd: 8.5 };
const sortilegio: VarianteDeCatalogo = { id: 12, producto_id: 3, nombre: "Sortilegio 500 g", activo: 1, precio_usd: 4 };
const guaralac: VarianteDeCatalogo = { id: 13, producto_id: 3, nombre: "Guaralac 500 g", activo: 1, precio_usd: 3.5 };

test("sin variantes, el producto publica su propio precio", () => {
  assert.deepEqual(precioPublicado(amarillo, []), { precio_usd: 8.5, desde: false, variantes: 0 });
  // Las variantes escondidas no cuentan.
  assert.deepEqual(precioPublicado(amarillo, [{ ...kemmental, activo: 0 }]), { precio_usd: 8.5, desde: false, variantes: 0 });
});

test("con dos variantes con precio, «desde» el más barato", () => {
  assert.deepEqual(precioPublicado(amarillo, [kemmental, legado]), { precio_usd: 8.5, desde: true, variantes: 2 });
});

test("con una sola variante activa es su precio, sin «desde»", () => {
  assert.deepEqual(precioPublicado(amarillo, [kemmental, { ...legado, activo: 0 }]), { precio_usd: 9, desde: false, variantes: 1 });
});

test("con variantes pero ninguna con precio, no hay precio: no se inventa el del producto", () => {
  const sinPrecio = [{ ...kemmental, precio_usd: null }, { ...legado, precio_usd: null }];
  assert.deepEqual(precioPublicado(amarillo, sinPrecio), { precio_usd: null, desde: false, variantes: 2 });
  // Con una sola con precio, es ese precio y todavía no es «desde».
  assert.deepEqual(precioPublicado(amarillo, [kemmental, { ...legado, precio_usd: null }]), { precio_usd: 9, desde: false, variantes: 2 });
});

test("las filas de la venta: los productos sin variantes y, de los que las tienen, cada variante activa", () => {
  const filas = vendiblesDe([amarillo, mozzarella, pecorino, oculto], [sortilegio, guaralac, { ...kemmental, activo: 0 }]);
  assert.deepEqual(
    filas.map((f) => [f.clave, f.nombre, f.precio_usd]),
    [
      ["1", "Queso amarillo", 8.5],
      ["2", "Queso mozzarella", 7.7],
      ["3-12", "Queso pecorino rallado Sortilegio 500 g", 4],
      ["3-13", "Queso pecorino rallado Guaralac 500 g", 3.5],
    ],
  );
  assert.deepEqual(filas[2], { clave: "3-12", producto_id: 3, variante_id: 12, nombre: "Queso pecorino rallado Sortilegio 500 g", unidad: "unidad", precio_usd: 4 });
});

test("la clave y el nombre de venta", () => {
  assert.equal(claveDe(3, null), "3");
  assert.equal(claveDe(3, 12), "3-12");
  assert.equal(nombreDeVenta("Queso amarillo", "Kemmental"), "Queso amarillo Kemmental");
  assert.equal(nombreDeVenta("Queso amarillo", null), "Queso amarillo");
});

test("el estado de un producto: borrador, en la web u oculto", () => {
  assert.equal(estadoDeProducto({ activo: 0, borrador: 1 }), "borrador");
  assert.equal(estadoDeProducto({ activo: 1, borrador: 0 }), "activo");
  assert.equal(estadoDeProducto({ activo: 0, borrador: 0 }), "inactivo");
  assert.equal(esEstadoDeProducto("borrador"), true);
  assert.equal(esEstadoDeProducto("publicado"), false);
});

test("la presentación y por qué se cobra: por kilo, por cartón o por su presentación", () => {
  assert.equal(presentacionDe({ presentacion: "Bolsa", contenido: "2,5 kg" }), "Bolsa de 2,5 kg");
  assert.equal(presentacionDe({ presentacion: "", contenido: "12 unidades" }), "12 unidades");
  assert.equal(presentacionDe({ presentacion: " ", contenido: "" }), "");
  assert.equal(porQueSeCobra({ unidad: "kg", presentacion: "Pieza", contenido: "2,5 kg" }), "kilo");
  assert.equal(porQueSeCobra({ unidad: "unidad", presentacion: "Bolsa", contenido: "2,5 kg" }), "bolsa de 2,5 kg");
  assert.equal(porQueSeCobra({ unidad: "carton", presentacion: "", contenido: "" }), "cartón");
  assert.equal(porQueSeCobra({ unidad: "unidad", presentacion: "", contenido: "" }), "unidad");
});

test("una oferta sale en la web si está activa y dentro de sus fechas", () => {
  const hoy = "2026-10-05";
  assert.equal(estaVigente({ estado: "activa", desde: null, hasta: null }, hoy), true);
  assert.equal(estaVigente({ estado: "activa", desde: "2026-10-01", hasta: "2026-10-05" }, hoy), true);
  assert.equal(estaVigente({ estado: "activa", desde: "2026-10-06", hasta: null }, hoy), false);
  assert.equal(estaVigente({ estado: "activa", desde: null, hasta: "2026-10-04" }, hoy), false);
  assert.equal(estaVigente({ estado: "borrador", desde: null, hasta: null }, hoy), false);
  assert.equal(estaVigente({ estado: "inactiva", desde: null, hasta: null }, hoy), false);
});
