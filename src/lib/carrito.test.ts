import { test } from "node:test";
import assert from "node:assert/strict";
import { bs, usd } from "./dinero.ts";
import {
  agregarAlCarrito,
  cantidadValida,
  claveDeOferta,
  cuantoDe,
  leerCarrito,
  mensajeDePedido,
  ponerCantidad,
  totalesDelCarrito,
  type ProductoDelCarrito,
} from "./carrito.ts";

const mozzarella: ProductoDelCarrito = { clave: "2", nombre: "Queso mozzarella", porQue: "kilo", unidad: "kg", precio_usd: 7.7, ruta: "/producto/2", foto: null };
const huevos: ProductoDelCarrito = { clave: "3", nombre: "Huevos", porQue: "cartón", unidad: "carton", precio_usd: 6.25, ruta: "/producto/3", foto: null };
const papas: ProductoDelCarrito = { clave: "9", nombre: "Papas fritas congeladas", porQue: "bolsa de 2,5 kg", unidad: "unidad", precio_usd: null, ruta: "/producto/9", foto: null };
const packBurger: ProductoDelCarrito = { clave: "o1", nombre: "Pack Burger", porQue: "combo", unidad: "combo", precio_usd: 40, ruta: "/ofertas#oferta-1", foto: null };

test("lo guardado en el teléfono se lee sin fiarse: solo líneas con forma de línea, sin repetir", () => {
  assert.deepEqual(leerCarrito(null), []);
  assert.deepEqual(leerCarrito("no es json"), []);
  assert.deepEqual(leerCarrito('{"clave":"2"}'), []);
  assert.deepEqual(
    leerCarrito('[{"clave":"2","cantidad":1.5},{"clave":"1-7","cantidad":2},{"clave":"<script>","cantidad":1},{"clave":"2","cantidad":9},{"clave":"3","cantidad":-1},{"clave":"4","cantidad":5000}]'),
    [
      { clave: "2", cantidad: 1.5 },
      { clave: "1-7", cantidad: 2 },
    ],
  );
});

test("las cantidades: por kilo de medio en medio, lo demás de uno en uno; cero es quitarlo", () => {
  assert.equal(cantidadValida(1.3, "kg"), 1.5);
  assert.equal(cantidadValida(0.2, "kg"), 0.5);
  assert.equal(cantidadValida(2.4, "carton"), 2);
  assert.equal(cantidadValida(0.4, "unidad"), 1);
  assert.equal(cantidadValida(0, "kg"), 0);
  assert.equal(cantidadValida(Number.NaN, "kg"), 0);
  assert.equal(cantidadValida(5000, "unidad"), 999);
});

test("agregar suma a lo que había; poner cambia la cantidad; con cero se quita", () => {
  let lineas = agregarAlCarrito([], "2", 1, "kg");
  lineas = agregarAlCarrito(lineas, "3", 1, "carton");
  lineas = agregarAlCarrito(lineas, "2", 1.5, "kg");
  assert.deepEqual(lineas, [
    { clave: "2", cantidad: 2.5 },
    { clave: "3", cantidad: 1 },
  ]);
  lineas = ponerCantidad(lineas, "3", 4, "carton");
  assert.deepEqual(lineas[1], { clave: "3", cantidad: 4 });
  assert.deepEqual(ponerCantidad(lineas, "2", 0, "kg"), [{ clave: "3", cantidad: 4 }]);
});

test("los totales cuentan lo que tiene precio; lo que no, va aparte, y lo que ya no está no entra", () => {
  const lineas = [
    { clave: "2", cantidad: 2 },
    { clave: "3", cantidad: 3 },
    { clave: "9", cantidad: 1 },
    { clave: "77", cantidad: 1 },
  ];
  const t = totalesDelCarrito(lineas, [mozzarella, huevos, papas], 100);
  assert.equal(t.total_usd, 34.15);
  assert.equal(t.total_bs, 3415);
  assert.equal(t.sinPrecio, 1);
  assert.equal(t.noDisponibles, 1);
  assert.equal(t.lineas[0].subtotal_usd, 15.4);
  assert.equal(t.lineas[2].subtotal_usd, null);
  assert.equal(totalesDelCarrito(lineas, [mozzarella], null).total_bs, null);
});

test("cuánto se pide, con las palabras de cada producto", () => {
  assert.equal(cuantoDe(2, mozzarella), "2 kilos");
  assert.equal(cuantoDe(1, mozzarella), "1 kilo");
  assert.equal(cuantoDe(1.5, mozzarella), "1,5 kilos");
  assert.equal(cuantoDe(3, huevos), "3 cartones");
  assert.equal(cuantoDe(2, papas), "2 × bolsa de 2,5 kg");
  assert.equal(cuantoDe(1, packBurger), "1 combo");
  assert.equal(cuantoDe(2, packBurger), "2 combos");
});

test("un combo entra en el carrito con su clave, de uno en uno, y sale en el mensaje", () => {
  assert.equal(claveDeOferta(1), "o1");
  assert.deepEqual(leerCarrito('[{"clave":"o1","cantidad":2},{"clave":"ox","cantidad":1},{"clave":"o-1","cantidad":1}]'), [{ clave: "o1", cantidad: 2 }]);
  assert.deepEqual(agregarAlCarrito([], "o1", 1, "combo"), [{ clave: "o1", cantidad: 1 }]);
  assert.equal(cantidadValida(1.5, "combo"), 2);
  const mensaje = mensajeDePedido({ negocio: "Villa Real", totales: totalesDelCarrito([{ clave: "o1", cantidad: 2 }], [packBurger], null), tasa: null });
  assert.ok(mensaje.includes(`• 2 combos de Pack Burger: ${usd(40)} por combo = ${usd(80)}`), mensaje);
});

test("el mensaje del pedido: cada producto con su precio, el total en dólares y bolívares, y quién pide", () => {
  const totales = totalesDelCarrito(
    [
      { clave: "2", cantidad: 2 },
      { clave: "9", cantidad: 1 },
    ],
    [mozzarella, papas],
    100,
  );
  const mensaje = mensajeDePedido({ negocio: "Comercializadora Villa Real", totales, tasa: 100, nombre: "Ana", negocioDelCliente: "Pizzería 33" });
  assert.equal(
    mensaje,
    [
      "Hola Comercializadora Villa Real, quiero hacer este pedido:",
      `• 2 kilos de Queso mozzarella: ${usd(7.7)} por kilo = ${usd(15.4)}`,
      "• 1 × bolsa de 2,5 kg de Papas fritas congeladas (precio por confirmar)",
      `Total estimado: ${usd(15.4)} (${bs(1540)} a la tasa BCV de hoy, ${bs(100)} por dólar), más lo que está por confirmar.`,
      "A nombre de: Ana, Pizzería 33.",
      "¿Me confirman disponibilidad y el total? ¡Gracias!",
    ].join("\n"),
  );
  // Sin tasa ni nombre, el mensaje no lo inventa.
  const corto = mensajeDePedido({ negocio: "Villa Real", totales: totalesDelCarrito([{ clave: "3", cantidad: 1 }], [huevos], null), tasa: null });
  assert.match(corto, /Total estimado: USD 6,25\.\n/);
  assert.doesNotMatch(corto, /A nombre de|Bs/);
});
