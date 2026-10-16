import { test } from "node:test";
import assert from "node:assert/strict";
import { cambioDe, cuentaDespues, describirSaldo, faltaPorPagar, revisarVentaPos, skuPropuesto, totalesDe } from "./pos-calculo.ts";
import { usd } from "./dinero.ts";

const mozzarella = { clave: "2", producto_id: 2, variante_id: null, nombre: "Mozzarella", unidad: "kg" as const, cantidad: 10, precio_usd: 7.7 };
const huevos = { clave: "3", producto_id: 3, variante_id: null, nombre: "Huevos", unidad: "carton" as const, cantidad: 2, precio_usd: 6.25 };
const metodosEnBolivares = ["pago_movil", "transferencia", "efectivo_bs", "tarjeta"] as const;
const base = { lineas: [mozzarella], descuento_usd: 0, tasa: 866.56, metodosEnBolivares: [...metodosEnBolivares], esMostrador: false };

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

test("pagar todo ahora: cuadra con un pago o con varios; no cuadra si faltan o sobran", () => {
  assert.deepEqual(revisarVentaPos({ ...base, modo: "ahora", pagos: [{ metodo: "efectivo_usd", monto_usd: 77 }] }), []);
  assert.deepEqual(revisarVentaPos({ ...base, descuento_usd: 7, modo: "ahora", pagos: [{ metodo: "efectivo_usd", monto_usd: 50 }, { metodo: "pago_movil", monto_usd: 20 }] }), []);
  const faltan = revisarVentaPos({ ...base, modo: "ahora", pagos: [{ metodo: "efectivo_usd", monto_usd: 50 }] });
  assert.ok(faltan.some((m) => m.includes("faltan " + usd(27)) && m.includes("Paga una parte")));
  const sobran = revisarVentaPos({ ...base, modo: "ahora", pagos: [{ metodo: "efectivo_usd", monto_usd: 80 }] });
  assert.ok(sobran.some((m) => m.includes("se pasan")));
  assert.ok(revisarVentaPos({ ...base, modo: "ahora", pagos: [] }).some((m) => m.includes("cómo pagó")));
  assert.equal(faltaPorPagar(77, [{ monto_usd: 50 }, { monto_usd: 27 }]), 0);
});

test("lo que no deja guardar: sin productos, cantidades malas, bolívares sin tasa, descuento de más", () => {
  assert.ok(revisarVentaPos({ ...base, lineas: [], modo: "ahora", pagos: [] }).some((m) => m.includes("ningún producto")));
  const mal = revisarVentaPos({ ...base, lineas: [{ ...huevos, cantidad: 1.5 }, { ...mozzarella, cantidad: 0 }], modo: "ahora", pagos: [{ metodo: "efectivo_usd", monto_usd: 9 }], tasa: 10 });
  assert.ok(mal.some((m) => m.includes("Huevos") && m.includes("sin decimales")));
  assert.ok(mal.some((m) => m.includes("Mozzarella") && m.includes("mayor que cero")));
  const sinTasa = revisarVentaPos({ ...base, modo: "ahora", pagos: [{ metodo: "pago_movil", monto_usd: 77 }], tasa: null });
  assert.ok(sinTasa.some((m) => m.includes("tasa del día")));
  assert.ok(revisarVentaPos({ ...base, descuento_usd: 100, modo: "credito", pagos: [] }).some((m) => m.includes("mayor que el subtotal")));
});

test("una parte ahora y el resto en la cuenta; o todo pendiente. El mostrador paga en el momento", () => {
  assert.deepEqual(revisarVentaPos({ ...base, modo: "parte", pagos: [{ metodo: "efectivo_usd", monto_usd: 30 }] }), []);
  assert.deepEqual(revisarVentaPos({ ...base, modo: "credito", pagos: [] }), []);
  // En «credito» los pagos escritos se ignoran: no se cobran.
  assert.deepEqual(revisarVentaPos({ ...base, modo: "credito", pagos: [{ metodo: "efectivo_usd", monto_usd: 30 }] }), []);
  assert.ok(revisarVentaPos({ ...base, modo: "parte", pagos: [] }).some((m) => m.includes("Queda pendiente")));
  assert.ok(revisarVentaPos({ ...base, modo: "parte", pagos: [{ metodo: "efectivo_usd", monto_usd: 77 }] }).some((m) => m.includes("Paga todo ahora")));
  assert.ok(revisarVentaPos({ ...base, esMostrador: true, modo: "credito", pagos: [] }).some((m) => m.includes("mostrador")));
  assert.ok(revisarVentaPos({ ...base, esMostrador: true, modo: "parte", pagos: [{ metodo: "efectivo_usd", monto_usd: 30 }] }).some((m) => m.includes("mostrador")));
});

test("cómo queda la cuenta del cliente: lo que debía más lo que queda de esta venta", () => {
  assert.deepEqual(cuentaDespues(235.4, 51.15, []), { saldoAnterior: 235.4, pagado: 0, pendiente: 51.15, saldoNuevo: 286.55 });
  assert.deepEqual(cuentaDespues(235.4, 51.15, [{ monto_usd: 30 }]), { saldoAnterior: 235.4, pagado: 30, pendiente: 21.15, saldoNuevo: 256.55 });
  assert.deepEqual(cuentaDespues(-20, 51.15, [{ monto_usd: 51.15 }]), { saldoAnterior: -20, pagado: 51.15, pendiente: 0, saldoNuevo: -20 });
  // Un pago que se pasa no deja la venta «a favor»: la cuenta sigue en lo que estaba.
  assert.equal(cuentaDespues(0, 50, [{ monto_usd: 60 }]).saldoNuevo, 0);
  assert.equal(cambioDe(60, 55), 5);
  assert.equal(cambioDe(50, 55), 0);
});

test("el saldo se dice con sus palabras: debe, al día o a favor", () => {
  assert.deepEqual(describirSaldo(235.4), { texto: `Debe ${usd(235.4)}`, tono: "debe" });
  assert.deepEqual(describirSaldo(0), { texto: "Al día", tono: "al_dia" });
  assert.deepEqual(describirSaldo(0.004), { texto: "Al día", tono: "al_dia" });
  assert.deepEqual(describirSaldo(-20), { texto: `A favor ${usd(20)}`, tono: "a_favor" });
});

test("el SKU propuesto sale del tipo, la marca y el contenido, sin tildes", () => {
  assert.equal(skuPropuesto("Mozzarella", "Kemmental", "2,5 kg"), "MOZ-KEM-25KG");
  assert.equal(skuPropuesto("Queso amarillo / Cheddar", "El Legado", ""), "QUE-ELL");
  assert.equal(skuPropuesto("Huevos", "", ""), "HUE");
  assert.equal(skuPropuesto("Pecorino", "Sortilegio", "500 g"), "PEC-SOR-500G");
});
