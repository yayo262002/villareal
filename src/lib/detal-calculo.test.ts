import { test } from "node:test";
import assert from "node:assert/strict";
import {
  costoEnDolares,
  enBolivares,
  leerLineasDeFactura,
  leerMonto,
  precioDetalUsd,
  precioMayorUsd,
  subirA,
  type ArticuloParaPrecio,
  type ReglasDelDetal,
} from "./detal-calculo.ts";

const REGLAS: ReglasDelDetal = { margen_pct: 20, margen_mayor_pct: null, iva_pct: 16, redondeo_bs: 5 };
const articulo = (cambios: Partial<ArticuloParaPrecio>): ArticuloParaPrecio => ({
  costo_bs: null,
  iva: "general",
  tasa_compra: null,
  margen_pct: null,
  precio_usd: null,
  precio_mayor_usd: null,
  ...cambios,
});

test("los bolívares se suben de 5 en 5, siempre a favor del negocio: 723 se cobra 725", () => {
  assert.equal(subirA(723, 5), 725);
  assert.equal(subirA(722.9964, 5), 725);
  assert.equal(subirA(725, 5), 725);
  assert.equal(subirA(725.01, 5), 730);
  assert.equal(subirA(720, 5), 720);
  // El ruido de la coma flotante no sube un paso de más.
  assert.equal(subirA(0.1 + 0.2, 0.1), 0.3);
  assert.equal(subirA(3 * 241.666666666667, 5), 725);
});

test("el ejemplo del dueño: 0,84 dólares que dan 723 bolívares se cobran 725", () => {
  assert.equal(enBolivares(0.84, 723 / 0.84, 5), 725);
  assert.equal(enBolivares(0.84, null, 5), null);
  assert.equal(enBolivares(null, 896.12, 5), null);
});

test("un producto gravado lleva el IVA antes del margen; uno exento no", () => {
  // Jugo Natulac: Bs 447,59 sin IVA, tasa 896,12 → con IVA 519,20 → 0,5794 $ → +20 % = 0,6953 → 0,70 $.
  const jugo = articulo({ costo_bs: 447.59, iva: "general", tasa_compra: 896.12 });
  assert.ok(Math.abs((costoEnDolares(jugo, 16) ?? 0) - 0.57937) < 0.0001);
  assert.equal(precioDetalUsd(jugo, REGLAS), 0.7);
  assert.equal(enBolivares(precioDetalUsd(jugo, REGLAS), 896.12, 5), 630);
  // Maíz de cotufa: Bs 875 exento → 0,97643 $ → +20 % = 1,1717 → 1,18 $.
  const maiz = articulo({ costo_bs: 875, iva: "exento", tasa_compra: 896.12 });
  assert.equal(precioDetalUsd(maiz, REGLAS), 1.18);
  assert.equal(enBolivares(1.18, 896.12, 5), 1060);
});

test("el precio en dólares se sube al centavo, nunca se baja", () => {
  // 1 Bs a tasa 1: costo 1 $, +20 % = 1,2 exacto: no sube.
  assert.equal(precioDetalUsd(articulo({ costo_bs: 1, iva: "exento", tasa_compra: 1 }), REGLAS), 1.2);
  // 1,001 $ + 20 % = 1,2012 → 1,21.
  assert.equal(precioDetalUsd(articulo({ costo_bs: 1.001, iva: "exento", tasa_compra: 1 }), REGLAS), 1.21);
});

test("el margen propio de un producto manda sobre el de las reglas", () => {
  const a = articulo({ costo_bs: 100, iva: "exento", tasa_compra: 100, margen_pct: 30 });
  assert.equal(precioDetalUsd(a, REGLAS), 1.3);
});

test("un precio escrito a mano en dólares manda sobre el costo; sin costo ni precio no hay precio", () => {
  assert.equal(precioDetalUsd(articulo({ costo_bs: 100, iva: "exento", tasa_compra: 100, precio_usd: 7.7 }), REGLAS), 7.7);
  assert.equal(precioDetalUsd(articulo({}), REGLAS), null);
  assert.equal(precioDetalUsd(articulo({ costo_bs: 100, iva: "exento" }), REGLAS), null);
});

test("el precio al mayor: sin margen del mayor no hay, salvo el escrito a mano", () => {
  const a = articulo({ costo_bs: 100, iva: "exento", tasa_compra: 100 });
  assert.equal(precioMayorUsd(a, REGLAS), null);
  assert.equal(precioMayorUsd(a, { ...REGLAS, margen_mayor_pct: 10 }), 1.1);
  assert.equal(precioMayorUsd({ ...a, precio_mayor_usd: 0.99 }, REGLAS), 0.99);
});

test("los montos como se escriben aquí", () => {
  assert.equal(leerMonto("1.378,88"), 1378.88);
  assert.equal(leerMonto("447,59"), 447.59);
  assert.equal(leerMonto("447.59"), 447.59);
  assert.equal(leerMonto("12.519,00"), 12519);
  assert.equal(leerMonto("1.450"), 1450);
  assert.equal(leerMonto("875"), 875);
  assert.equal(leerMonto("abc"), null);
});

test("las líneas de una factura: una por producto, con su IVA", () => {
  const { lineas, sinEntender } = leerLineasDeFactura(`
    12 x 447,59 Jugo Natulac Pera 200 ml (G)
    6x Bs 875,00 Maíz de Cotufa El Maizalito 400 g (E)
    6 × 1.378,88 Encurtido Eureka 200 g G
  `);
  assert.deepEqual(sinEntender, []);
  assert.deepEqual(lineas, [
    { cantidad: 12, costo_bs: 447.59, nombre: "Jugo Natulac Pera 200 ml", iva: "general" },
    { cantidad: 6, costo_bs: 875, nombre: "Maíz de Cotufa El Maizalito 400 g", iva: "exento" },
    { cantidad: 6, costo_bs: 1378.88, nombre: "Encurtido Eureka 200 g", iva: "general" },
  ]);
});

test("las líneas como salen en el papel: la cantidad encima, el importe al final, y sin cantidad es una unidad", () => {
  const { lineas, sinEntender } = leerLineasDeFactura(`
12xBs 447,59
 Jugo Natulac Pera 200ml (G)        Bs 5.371,08
Galleta Soda Carabobo 250gr (G)     Bs 1.112,07
6x Bs 1.756,00
 Aceite el Rey 800ml (E)            Bs 10.536,00
`);
  assert.deepEqual(sinEntender, []);
  assert.deepEqual(lineas, [
    { cantidad: 12, costo_bs: 447.59, nombre: "Jugo Natulac Pera 200ml", iva: "general" },
    { cantidad: 1, costo_bs: 1112.07, nombre: "Galleta Soda Carabobo 250gr", iva: "general" },
    { cantidad: 6, costo_bs: 1756, nombre: "Aceite el Rey 800ml", iva: "exento" },
  ]);
});

test("lo que no se entiende no se adivina: sin (E) o (G), sin precio o sin nombre", () => {
  const { lineas, sinEntender } = leerLineasDeFactura(`
6 x 760,00 Sal Bahía 1 kg
Arroz 900 g (E)
6 x 625,10
12 x 1.295,00 Margarina Mavesa 250 g (E)
`);
  assert.deepEqual(
    lineas.map((l) => l.nombre),
    ["Margarina Mavesa 250 g"],
  );
  assert.deepEqual(sinEntender, ["6 x 760,00 Sal Bahía 1 kg", "Arroz 900 g (E)", "6 x 625,10"]);
});

test("una unidad que termina en g minúscula no se toma por la marca de IVA", () => {
  const { lineas, sinEntender } = leerLineasDeFactura("6 x 814,66 Jabón Protex Fresh 75 g");
  assert.equal(lineas.length, 0);
  assert.equal(sinEntender.length, 1);
});
