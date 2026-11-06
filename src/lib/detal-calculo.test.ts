import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirCarga,
  variacionPct,
  costoEnDolares,
  enBolivares,
  leerDivisor,
  leerLineasDeCostos,
  leerLineasDeFactura,
  leerMonto,
  precioDetalUsd,
  precioMayorUsd,
  reglaDelDetal,
  reglasDesdeAjustes,
  subirA,
  type ArticuloParaPrecio,
  type ReglasDelDetal,
} from "./detal-calculo.ts";

const REGLAS: ReglasDelDetal = { margen_pct: 20, margen_mayor_pct: null, charcuteria_divisor: 0.8, charcuteria_mayor_pct: 10, iva_pct: 16, redondeo_bs: 5 };
const articulo = (cambios: Partial<ArticuloParaPrecio>): ArticuloParaPrecio => ({
  categoria: "viveres",
  costo_bs: null,
  costo_usd: null,
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

test("la charcutería: al detal el costo entre 0,80 y al mayor el costo más un 10 %, del costo en dólares tal cual", () => {
  // Lo que cobra el proveedor, en dólares: no se le suma IVA.
  const jamon = articulo({ categoria: "charcuteria", costo_usd: 6, iva: "exento" });
  assert.equal(costoEnDolares(jamon, 16), 6);
  assert.equal(precioDetalUsd(jamon, REGLAS), 7.5);
  assert.equal(precioMayorUsd(jamon, REGLAS), 6.6);
  // 5,37 entre 0,80 = 6,7125 → 6,72; más un 10 % = 5,907 → 5,91. Siempre hacia arriba.
  const queso = articulo({ categoria: "charcuteria", costo_usd: 5.37, iva: "exento" });
  assert.equal(precioDetalUsd(queso, REGLAS), 6.72);
  assert.equal(precioMayorUsd(queso, REGLAS), 5.91);
  // En bolívares, a la tasa de hoy y de 5 en 5: 7,50 × 896,1225 = 6.720,92 → 6.725.
  assert.equal(enBolivares(7.5, 896.1225, 5), 6725);
  // El mismo costo en víveres sigue con el 20 % y sin precio al mayor.
  assert.equal(precioDetalUsd({ ...jamon, categoria: "viveres" }, REGLAS), 7.2);
  assert.equal(precioMayorUsd({ ...jamon, categoria: "viveres" }, REGLAS), null);
  // Con (G), al costo en dólares se le suma el IVA: 5 × 1,16 = 5,80 → 7,25.
  assert.equal(precioDetalUsd(articulo({ categoria: "charcuteria", costo_usd: 5, iva: "general" }), REGLAS), 7.25);
  // Un margen propio manda también en la charcutería; un precio a mano, sobre todo.
  assert.deepEqual(reglaDelDetal({ ...jamon, margen_pct: 30 }, REGLAS), { forma: "margen", pct: 30, propio: true });
  assert.equal(precioDetalUsd({ ...jamon, margen_pct: 30 }, REGLAS), 7.8);
  assert.equal(precioDetalUsd({ ...jamon, precio_usd: 8 }, REGLAS), 8);
  assert.deepEqual(reglaDelDetal(jamon, REGLAS), { forma: "entre", divisor: 0.8 });
  // Sin margen al mayor de la charcutería, no hay precio al mayor.
  assert.equal(precioMayorUsd(jamon, { ...REGLAS, charcuteria_mayor_pct: null }), null);
  // Un costo de factura en bolívares de un producto de la charcutería sigue su regla: 896,12 Bs exento a 896,12 = 1 $ → 1,25.
  assert.equal(precioDetalUsd(articulo({ categoria: "charcuteria", costo_bs: 896.12, iva: "exento", tasa_compra: 896.12 }), REGLAS), 1.25);
});

test("las reglas guardadas: lo que falta vale lo de por defecto, y el mayor de la charcutería se apaga dejándolo vacío", () => {
  const de = (guardado: Record<string, string>) => reglasDesdeAjustes((clave) => guardado[clave], 16);
  assert.deepEqual(de({}), REGLAS);
  assert.equal(de({ detal_charcuteria_mayor_pct: "" }).charcuteria_mayor_pct, null);
  assert.equal(de({ detal_charcuteria_mayor_pct: "12" }).charcuteria_mayor_pct, 12);
  assert.equal(de({ detal_charcuteria_divisor: "0.75" }).charcuteria_divisor, 0.75);
  // Un divisor que no tiene sentido vale el de por defecto.
  assert.equal(de({ detal_charcuteria_divisor: "3" }).charcuteria_divisor, 0.8);
  assert.equal(de({ detal_margen_mayor_pct: "8", detal_margen_pct: "abc" }).margen_mayor_pct, 8);
  assert.equal(de({ detal_margen_pct: "abc" }).margen_pct, 20);
});

test("el divisor se escribe como lo dice el dueño: 0,80, 0.8 u 80", () => {
  assert.equal(leerDivisor("0,80"), 0.8);
  assert.equal(leerDivisor("0.8"), 0.8);
  assert.equal(leerDivisor("80"), 0.8);
  assert.equal(leerDivisor("1"), 1);
  assert.equal(leerDivisor("0,2"), null);
  assert.equal(leerDivisor("150"), null);
  assert.equal(leerDivisor("ochenta"), null);
});

test("una lista de costos en dólares: el nombre y el costo al final, con su unidad si la dice", () => {
  const { lineas, sinEntender } = leerLineasDeCostos(
    [
      "Jamón de espalda 5,20",
      "Queso amarillo: $6,80 el kilo",
      "Mozzarella 5.5 kg",
      "Salchichas 1 kg 3,10 c/u",
      "Pechuga de pavo - 7,30$",
      "Tocineta 8 $/kg",
      "Queso de año (G) 9,00",
      "",
      "Lista del 06/11",
      "Sin precio",
    ].join("\n"),
  );
  assert.deepEqual(lineas, [
    { nombre: "Jamón de espalda", costo_usd: 5.2, unidad: null, iva: "exento" },
    { nombre: "Queso amarillo", costo_usd: 6.8, unidad: "kg", iva: "exento" },
    { nombre: "Mozzarella", costo_usd: 5.5, unidad: "kg", iva: "exento" },
    { nombre: "Salchichas 1 kg", costo_usd: 3.1, unidad: "unidad", iva: "exento" },
    { nombre: "Pechuga de pavo", costo_usd: 7.3, unidad: null, iva: "exento" },
    { nombre: "Tocineta", costo_usd: 8, unidad: "kg", iva: "exento" },
    { nombre: "Queso de año", costo_usd: 9, unidad: null, iva: "general" },
  ]);
  assert.deepEqual(sinEntender, ["Lista del 06/11", "Sin precio"]);
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

test("una factura vieja cargada tarde no pisa el costo de una más nueva: queda de referencia", () => {
  const guardadas = { fecha_compra: "2026-11-06", fecha_compra_anterior: "2026-10-22" };
  assert.equal(decidirCarga(guardadas, "2026-11-10"), "actual");
  assert.equal(decidirCarga(guardadas, "2026-11-06"), "mismo_dia");
  assert.equal(decidirCarga(guardadas, "2026-10-30"), "anterior");
  assert.equal(decidirCarga(guardadas, "2026-10-22"), "anterior");
  assert.equal(decidirCarga(guardadas, "2026-10-16"), "nada");
  // Un producto puesto a mano, sin compra: la primera compra es la actual; sin anterior, cualquiera más vieja queda de referencia.
  assert.equal(decidirCarga({ fecha_compra: null, fecha_compra_anterior: null }, "2026-10-16"), "actual");
  assert.equal(decidirCarga({ fecha_compra: "2026-11-06", fecha_compra_anterior: null }, "2026-10-16"), "anterior");
});

test("cuánto cambió el costo, en %", () => {
  assert.equal(variacionPct(1.1, 1), 10);
  assert.equal(variacionPct(0.9, 1), -10);
  assert.equal(variacionPct(0.6798, 0.6612), 2.8);
  assert.equal(variacionPct(1, null), null);
  assert.equal(variacionPct(null, 1), null);
});
