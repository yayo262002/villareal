import { test } from "node:test";
import assert from "node:assert/strict";
import { ivaDeLasCompras, ivaDeLasVentas, ivaMesAMes } from "./iva-del-mes.ts";
import type { DocumentoDelLibro } from "./factura-calculo.ts";

const factura = (cambios: Partial<DocumentoDelLibro>): DocumentoDelLibro => ({
  tipo: "factura",
  numero: 1,
  numero_control: "",
  fecha: "2026-11-02",
  cliente_nombre: "Pizzería",
  cliente_rif: "J-40806430-8",
  factura_afectada: null,
  venta_id: 1,
  exento_usd: 0,
  base_imponible_usd: 100,
  iva_pct: 16,
  iva_usd: 16,
  total_usd: 116,
  tasa: 400,
  estado: "emitida",
  ...cambios,
});

test("el IVA de las ventas en bolívares: cada factura a su tasa, la nota de crédito resta, sin tasa aparte", () => {
  const ventas = ivaDeLasVentas([
    factura({}),
    factura({ numero: 2, tasa: 410, base_imponible_usd: 50, iva_usd: 8, total_usd: 58 }),
    factura({ tipo: "nota_credito", numero: 1, factura_afectada: 2, tasa: 410, base_imponible_usd: 50, iva_usd: 8, total_usd: 58 }),
    factura({ numero: 3, tasa: null }),
  ]);
  assert.equal(ventas.iva_bs, 6400);
  assert.equal(ventas.base_bs, 40000);
  assert.equal(ventas.total_bs, 46400);
  assert.equal(ventas.documentos, 3);
  assert.equal(ventas.sin_tasa, 1);
});

test("el IVA de las compras suma lo que viene impreso", () => {
  assert.deepEqual(ivaDeLasCompras([{ exento_bs: 100, base_bs: 1000, iva_bs: 160, total_bs: 1260 }, { exento_bs: 0, base_bs: 500, iva_bs: 80, total_bs: 580 }]), {
    documentos: 2,
    exento_bs: 100,
    base_bs: 1500,
    iva_bs: 240,
    total_bs: 1840,
  });
});

test("mes a mes: se paga la diferencia, o el excedente de crédito pasa al mes siguiente", () => {
  const meses = ivaMesAMes([
    { mes: "2026-11", debito_bs: 5000, credito_bs: 1000 },
    { mes: "2026-10", debito_bs: 1000, credito_bs: 3000 },
  ]);
  assert.deepEqual(meses, [
    { mes: "2026-10", debito_bs: 1000, credito_bs: 3000, excedente_anterior_bs: 0, a_pagar_bs: 0, excedente_siguiente_bs: 2000 },
    { mes: "2026-11", debito_bs: 5000, credito_bs: 1000, excedente_anterior_bs: 2000, a_pagar_bs: 2000, excedente_siguiente_bs: 0 },
  ]);
});
