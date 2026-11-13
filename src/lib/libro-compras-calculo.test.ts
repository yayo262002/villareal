import { test } from "node:test";
import assert from "node:assert/strict";
import { CABECERA_DEL_LIBRO_DE_COMPRAS, filasDelLibroDeCompras, revisarFacturaDeCompra, totalesDeLineas, totalesDelLibroDeCompras, type FacturaDeCompra } from "./libro-compras-calculo.ts";

test("los totales de una factura del detal salen de sus líneas: lo exento aparte, la base con su IVA", () => {
  const t = totalesDeLineas(
    [
      { cantidad: 12, costo_bs: 447.59, nombre: "Jugo Natulac Pera 200 ml", iva: "general" },
      { cantidad: 2, costo_bs: 1000, nombre: "Harina", iva: "exento" },
    ],
    16,
  );
  // 12 × 447,59 = 5.371,08 de base; su IVA, 859,37; 2.000 exentos.
  assert.deepEqual(t, { exento_bs: 2000, base_bs: 5371.08, iva_bs: 859.37, total_bs: 8230.45 });
});

test("una factura de compra necesita fecha, proveedor, número y un total que cuadre con lo exento, la base y el IVA", () => {
  const buena = { fecha: "2026-11-12", proveedor: "El Drago", numero: "12081", exento_bs: 0, base_bs: 1000, iva_bs: 160, total_bs: 1160 };
  assert.deepEqual(revisarFacturaDeCompra(buena, "2026-11-12"), []);
  assert.deepEqual(revisarFacturaDeCompra({ ...buena, total_bs: 1160.6 }, "2026-11-12"), [], "un redondeo de la factura no es un error");
  assert.match(revisarFacturaDeCompra({ ...buena, total_bs: 1300 }, "2026-11-12").join(" "), /suman 1\.160,00/);
  assert.match(revisarFacturaDeCompra({ ...buena, fecha: "2026-11-13" }, "2026-11-12").join(" "), /de mañana/);
  assert.match(revisarFacturaDeCompra({ ...buena, numero: " " }, "2026-11-12").join(" "), /número de la factura/);
  assert.match(revisarFacturaDeCompra({ ...buena, proveedor: "" }, "2026-11-12").join(" "), /proveedor/);
});

test("el libro de compras: una fila por factura, en orden de fecha, con coma decimal y sus totales", () => {
  const base: FacturaDeCompra = {
    id: 1,
    fecha: "2026-11-12",
    proveedor: "Inv. Granos de Oro",
    rif: "J-12345678-9",
    numero: "12081",
    numero_control: "00-12081",
    exento_bs: 95564.12,
    base_bs: 0,
    iva_pct: 16,
    iva_bs: 0,
    total_bs: 95564.12,
    tasa: 904.45,
    origen: "detal",
    nota: "",
  };
  const otra: FacturaDeCompra = { ...base, id: 2, fecha: "2026-11-02", proveedor: "Cecosesola", numero: "777", exento_bs: 0, base_bs: 1000, iva_bs: 160, total_bs: 1160, tasa: null };
  const filas = filasDelLibroDeCompras([base, otra]);
  assert.equal(filas.length, 2);
  assert.equal(filas[0][1], "Cecosesola", "la del 2 va antes que la del 12");
  assert.equal(filas[1][5], "95564,12");
  assert.equal(filas[1][11], "105,66", "el total en dólares, a la tasa de la factura");
  assert.equal(filas[0][11], "", "sin tasa, sin dólares");
  assert.equal(CABECERA_DEL_LIBRO_DE_COMPRAS.length, filas[0].length);
  assert.deepEqual(totalesDelLibroDeCompras([base, otra]), { facturas: 2, exento_bs: 95564.12, base_bs: 1000, iva_bs: 160, total_bs: 96724.12 });
});
