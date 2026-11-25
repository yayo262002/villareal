import { test } from "node:test";
import assert from "node:assert/strict";
import { existenciasDe, type Existencia } from "./stock.ts";
import type { Vendible } from "./catalogo.ts";
import type { ProductoDeMisPrecios, VarianteDeMisPrecios } from "./mis-precios.ts";
import {
  FUERA_DE_LA_WEB,
  cantidadLegible,
  estadoParaVendedora,
  existenciasPorFamilia,
  leerCantidadContada,
  leerRecuento,
} from "./existencias-por-familia.ts";

const producto = (p: Partial<ProductoDeMisPrecios> & Pick<ProductoDeMisPrecios, "id" | "nombre">): ProductoDeMisPrecios => ({
  unidad: "kg",
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
  { id: 2, nombre: "Embutidos", orden: 2 },
  { id: 1, nombre: "Quesos", orden: 1 },
];
const vendible = (clave: string, nombre: string, unidad = "kg"): Vendible => {
  const [p, v] = clave.split("-").map(Number);
  return { clave, producto_id: p, variante_id: v ?? null, nombre, unidad, precio_usd: null, codigo_barras: "", sku: "", marca: "", presentacion: "", contenido: "" };
};

/** Las existencias con sus sumas: comprado, vendido y ajustado de cada clave. */
function existencias(filas: { clave: string; nombre: string; comprado?: number; vendido?: number; ajustado?: number; unidad?: string }[]): Map<string, Existencia> {
  const mapa = (campo: "comprado" | "vendido" | "ajustado") =>
    new Map(filas.filter((f) => f[campo] !== undefined).map((f) => [f.clave, f[campo]!] as [string, number]));
  const lista = existenciasDe(
    filas.map((f) => vendible(f.clave, f.nombre, f.unidad)),
    mapa("comprado"),
    mapa("vendido"),
    mapa("ajustado"),
    new Map(),
    new Map(),
    new Map(),
  );
  return new Map(lista.map((e) => [e.clave, e]));
}

test("lo publicado va por familias, en su orden, y cada tipo con marcas da una fila por artículo", () => {
  const productos = [producto({ id: 2, nombre: "Mozzarella" }), producto({ id: 15, nombre: "Jamón de espalda", familia_id: 2 })];
  const variantes: VarianteDeMisPrecios[] = [
    { id: 39, producto_id: 15, nombre: "El Drago espalda cocida", costo_usd: 5, precio_usd: 5.5, activo: 1 },
    { id: 40, producto_id: 15, nombre: "Escondida", costo_usd: 5, precio_usd: 5.5, activo: 0 },
  ];
  const mapa = existencias([
    { clave: "2", nombre: "Mozzarella", ajustado: 50 },
    { clave: "15-39", nombre: "Jamón de espalda El Drago espalda cocida" },
  ]);
  const grupos = existenciasPorFamilia(productos, variantes, familias, mapa, { conEscondidos: false });
  assert.deepEqual(
    grupos.map((g) => [g.familia, g.filas.map((f) => f.clave)]),
    [
      ["Quesos", ["2"]],
      ["Embutidos", ["15-39"]],
    ],
  );
  assert.equal(grupos[1].filas[0].detalle, "El Drago espalda cocida");
});

test("lo escondido de la web solo entra en el recuento, y solo si tiene existencia o ventas", () => {
  const productos = [
    producto({ id: 2, nombre: "Mozzarella" }),
    producto({ id: 8, nombre: "Queso arepero", borrador: 1 }),
    producto({ id: 9, nombre: "Salsa BBQ", borrador: 1 }),
    producto({ id: 50, nombre: "Combo 3", combo_detal: "3" }),
  ];
  const mapa = existencias([
    { clave: "2", nombre: "Mozzarella" },
    { clave: "8", nombre: "Queso arepero", vendido: 5 },
    { clave: "9", nombre: "Salsa BBQ" },
    { clave: "50", nombre: "Combo 3", vendido: 2 },
  ]);
  const paraElRecuento = existenciasPorFamilia(productos, [], familias, mapa, { conEscondidos: true });
  assert.deepEqual(
    paraElRecuento.map((g) => [g.familia, g.filas.map((f) => f.tipo)]),
    [
      ["Quesos", ["Mozzarella"]],
      [FUERA_DE_LA_WEB, ["Queso arepero"]],
    ],
  );
  const paraLaVendedora = existenciasPorFamilia(productos, [], familias, mapa, { conEscondidos: false });
  assert.deepEqual(paraLaVendedora.map((g) => g.familia), ["Quesos"]);
});

test("un tipo apagado no sale, aunque tenga existencia", () => {
  const productos = [producto({ id: 3, nombre: "Kemmental", activo: 0 })];
  assert.deepEqual(existenciasPorFamilia(productos, [], familias, new Map(), { conEscondidos: true }), []);
});

test("la vendedora ve si hay, si queda poco, si se acabó o si no se ha contado", () => {
  const mapa = existencias([
    { clave: "1", nombre: "Sin contar", vendido: 3 },
    { clave: "2", nombre: "Hay", ajustado: 20 },
    { clave: "3", nombre: "Se vendió más de lo contado", ajustado: 5, vendido: 8 },
  ]);
  assert.equal(estadoParaVendedora(mapa.get("1")!), "sin_contar");
  assert.equal(estadoParaVendedora(mapa.get("2")!), "hay");
  assert.equal(estadoParaVendedora(mapa.get("3")!), "agotado");
  assert.equal(estadoParaVendedora({ ...mapa.get("2")!, estado: "poco" }), "poco");
});

test("la cantidad contada se escribe con coma o con punto", () => {
  assert.equal(leerCantidadContada("12,5"), 12.5);
  assert.equal(leerCantidadContada(" 12.5 "), 12.5);
  assert.equal(leerCantidadContada("0"), 0);
  assert.equal(leerCantidadContada("1 200"), 1200);
  assert.equal(leerCantidadContada("-3"), null);
  assert.equal(leerCantidadContada("1.234,5"), null);
  assert.equal(leerCantidadContada("dos"), null);
});

test("el recuento anota lo contado menos lo que decía el sistema; las vacías no se tocan y lo que no se entiende se dice", () => {
  const mapa = existencias([
    { clave: "2", nombre: "Mozzarella", comprado: 300, vendido: 979.33 },
    { clave: "15-39", nombre: "Jamón de espalda El Drago espalda cocida", ajustado: 10 },
    { clave: "7", nombre: "Pecorino Sortilegio 500 g", unidad: "unidad" },
    { clave: "8", nombre: "Huevos", unidad: "carton" },
  ]);
  const { cambios, errores } = leerRecuento(
    [
      ["2", "42,5"],
      ["15-39", "10"],
      ["7", ""],
      ["8", "treinta"],
      ["99", "4"],
    ],
    mapa,
  );
  assert.deepEqual(
    cambios.map((c) => [c.clave, c.antes, c.contado, c.cambio]),
    [
      ["2", -679.33, 42.5, 721.83],
      ["15-39", 10, 10, 0],
    ],
  );
  assert.deepEqual(errores, ["Huevos («treinta»)"]);
});

test("una cantidad imposible no se guarda", () => {
  const mapa = existencias([{ clave: "2", nombre: "Mozzarella" }]);
  const { cambios, errores } = leerRecuento([["2", "250000"]], mapa);
  assert.equal(cambios.length, 0);
  assert.equal(errores.length, 1);
});

test("lo que hay se dice con su unidad, en singular o en plural", () => {
  assert.equal(cantidadLegible(23.5, "kg"), "23,5 kg");
  assert.equal(cantidadLegible(1, "unidad"), "1 unidad");
  assert.equal(cantidadLegible(12, "unidad"), "12 unidades");
  assert.equal(cantidadLegible(1, "carton"), "1 cartón");
  assert.equal(cantidadLegible(3, "carton"), "3 cartones");
  assert.equal(cantidadLegible(-679.333, "kg"), "-679,33 kg");
});
