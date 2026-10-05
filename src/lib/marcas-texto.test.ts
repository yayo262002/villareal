import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparEnSecciones, marcasDelFiltro, mismaMarca, nombreDeArticulo, presentacionYContenido, separarMarcaYContenido } from "./marcas-texto.ts";

test("el nombre de un artículo: la marca primero, después la presentación y el contenido", () => {
  assert.equal(nombreDeArticulo({ marca: "Sortilegio", presentacion: "", contenido: "500 g" }), "Sortilegio 500 g");
  assert.equal(nombreDeArticulo({ marca: "Guaralact", presentacion: "Bolsa", contenido: "1 kg" }), "Guaralact bolsa de 1 kg");
  assert.equal(nombreDeArticulo({ marca: "Kemmental", presentacion: "", contenido: "" }), "Kemmental");
  assert.equal(nombreDeArticulo({ marca: "", presentacion: "Bloque cuadrado", contenido: "" }), "Bloque cuadrado");
  assert.equal(nombreDeArticulo({ marca: "  El   Legado ", presentacion: " ", contenido: "" }), "El Legado");
  assert.equal(nombreDeArticulo({ marca: "", presentacion: "", contenido: "" }), "");
  assert.equal(presentacionYContenido({ presentacion: "Bolsa", contenido: "2,5 kg" }), "Bolsa de 2,5 kg");
});

test("los nombres de antes se separan en marca y tamaño", () => {
  assert.deepEqual(separarMarcaYContenido("Sortilegio 500 g"), { marca: "Sortilegio", contenido: "500 g" });
  assert.deepEqual(separarMarcaYContenido("Guaralac 500 g"), { marca: "Guaralac", contenido: "500 g" });
  assert.deepEqual(separarMarcaYContenido("Kemmental"), { marca: "Kemmental", contenido: "" });
  assert.deepEqual(separarMarcaYContenido("El Legado"), { marca: "El Legado", contenido: "" });
  assert.deepEqual(separarMarcaYContenido("Guaralact 2,5 kg"), { marca: "Guaralact", contenido: "2,5 kg" });
  assert.deepEqual(separarMarcaYContenido("Pepsi 1 L"), { marca: "Pepsi", contenido: "1 L" });
  // Un número que no es un tamaño se queda en la marca.
  assert.deepEqual(separarMarcaYContenido("Villa 32"), { marca: "Villa 32", contenido: "" });
});

test("la misma marca se escriba como se escriba; otra letra es otra marca", () => {
  assert.equal(mismaMarca("guaralact", "  GuaraLact "), true);
  assert.equal(mismaMarca("Lácteos Ávila", "lacteos avila"), true);
  assert.equal(mismaMarca("Guaralac", "Guaralact"), false);
});

test("el filtro de marcas: limpio, sin repetir y con un tope", () => {
  assert.deepEqual(marcasDelFiltro(undefined), []);
  assert.deepEqual(marcasDelFiltro("El Legado"), ["el-legado"]);
  assert.deepEqual(marcasDelFiltro(["guaralact", "Guaralact", "", "<x>"]), ["guaralact", "x"]);
  assert.equal(marcasDelFiltro(Array.from({ length: 50 }, (_, i) => `m${i}`)).length, 20);
});

test("las secciones: la sin título primero, las demás por el orden de su primer producto, y cada producto en la suya", () => {
  const grupos = agruparEnSecciones([
    { item: "queso amarillo", seccion: "Quesos", orden: 3 },
    { item: "tocineta", seccion: "Proteínas", orden: 6 },
    { item: "carne", seccion: "proteínas", orden: 100 },
    { item: "ketchup", seccion: "Salsas y aderezos", orden: 7 },
    { item: "kit", seccion: "", orden: 50 },
    { item: "mozzarella", seccion: "Quesos", orden: 3 },
  ]);
  assert.deepEqual(grupos, [
    { titulo: "", items: ["kit"] },
    { titulo: "Quesos", items: ["queso amarillo", "mozzarella"] },
    { titulo: "Proteínas", items: ["tocineta", "carne"] },
    { titulo: "Salsas y aderezos", items: ["ketchup"] },
  ]);
});
