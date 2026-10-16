import { test } from "node:test";
import assert from "node:assert/strict";
import { faltaPorPagar, revisarCobro, skuPropuesto, totalesDe } from "./pos-calculo.ts";

const mozzarella = { clave: "2", producto_id: 2, variante_id: null, nombre: "Mozzarella", unidad: "kg" as const, cantidad: 10, precio_usd: 7.7 };
const huevos = { clave: "3", producto_id: 3, variante_id: null, nombre: "Huevos", unidad: "carton" as const, cantidad: 2, precio_usd: 6.25 };

test("los totales: subtotal, descuento acotado, total y bolívares a la tasa", () => {
  const t = totalesDe([mozzarella, huevos], 5, 866.56);
  assert.equal(t.subtotal, 89.5);
  assert.equal(t.descuento, 5);
  assert.equal(t.total, 84.5);
  assert.equal(t.totalBs, 73224.32);
  assert.equal(totalesDe([mozzarella], 1000, null).descuento, 77);
  assert.equal(totalesDe([mozzarella], -3, null).descuento, 0);
  assert.equal(totalesDe([], 0, null).totalBs, null);
});

test("un cobro bien hecho no tiene motivos; uno mixto que cuadra, tampoco", () => {
  assert.deepEqual(revisarCobro({ lineas: [mozzarella], descuento_usd: 0, pagos: [{ metodo: "efectivo_usd", monto_usd: 77 }], tasa: 866.56, metodosEnBolivares: ["pago_movil", "transferencia", "efectivo_bs", "tarjeta"] }), []);
  assert.deepEqual(
    revisarCobro({ lineas: [mozzarella], descuento_usd: 7, pagos: [{ metodo: "efectivo_usd", monto_usd: 50 }, { metodo: "pago_movil", monto_usd: 20 }], tasa: 866.56, metodosEnBolivares: ["pago_movil"] }),
    [],
  );
});

test("lo que no deja cobrar: sin productos, cantidades malas, pagos que no cuadran, bolívares sin tasa", () => {
  const metodosEnBolivares = ["pago_movil" as const];
  assert.ok(revisarCobro({ lineas: [], descuento_usd: 0, pagos: [], tasa: null, metodosEnBolivares }).some((m) => m.includes("ningún producto")));
  const mal = revisarCobro({ lineas: [{ ...huevos, cantidad: 1.5 }, { ...mozzarella, cantidad: 0 }], descuento_usd: 0, pagos: [{ metodo: "efectivo_usd", monto_usd: 9 }], tasa: 10, metodosEnBolivares });
  assert.ok(mal.some((m) => m.includes("Huevos") && m.includes("sin decimales")));
  assert.ok(mal.some((m) => m.includes("Mozzarella") && m.includes("mayor que cero")));
  const faltan = revisarCobro({ lineas: [mozzarella], descuento_usd: 0, pagos: [{ metodo: "efectivo_usd", monto_usd: 50 }], tasa: 10, metodosEnBolivares });
  assert.ok(faltan.some((m) => m.includes("faltan USD 27.00")));
  const sobran = revisarCobro({ lineas: [mozzarella], descuento_usd: 0, pagos: [{ metodo: "efectivo_usd", monto_usd: 80 }], tasa: 10, metodosEnBolivares });
  assert.ok(sobran.some((m) => m.includes("se pasan del total por USD 3.00")));
  const sinTasa = revisarCobro({ lineas: [mozzarella], descuento_usd: 0, pagos: [{ metodo: "pago_movil", monto_usd: 77 }], tasa: null, metodosEnBolivares });
  assert.ok(sinTasa.some((m) => m.includes("tasa del día")));
  assert.equal(faltaPorPagar(84.5, [{ monto_usd: 50 }, { monto_usd: 34.5 }]), 0);
});

test("el SKU propuesto sale del tipo, la marca y el contenido, sin tildes", () => {
  assert.equal(skuPropuesto("Mozzarella", "Kemmental", "2,5 kg"), "MOZ-KEM-25KG");
  assert.equal(skuPropuesto("Tocineta", "", "1 kg"), "TOC-1KG");
  assert.equal(skuPropuesto("Jamón", "El Drago", ""), "JAM-ELD");
  assert.equal(skuPropuesto("Huevos", "", ""), "HUE");
});
