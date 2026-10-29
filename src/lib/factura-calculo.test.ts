import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisoDePeriodo,
  calcularFactura,
  descripcionDeLinea,
  filasDelLibro,
  numeroDeFactura,
  totalesDelLibro,
  type DocumentoDelLibro,
  type LineaParaFacturar,
} from "./factura-calculo.ts";

const mozzarella: LineaParaFacturar = {
  descripcion: "Mozzarella",
  cantidad: 2,
  unidad: "kg",
  precio_unitario_usd: 7.7,
  importe_usd: 15.4,
  iva: "general",
};
const huevos: LineaParaFacturar = {
  descripcion: "Huevos",
  cantidad: 1,
  unidad: "carton",
  precio_unitario_usd: 6.25,
  importe_usd: 6.25,
  iva: "exento",
};

test("una venta con un producto gravado y otro exento: la base sale del precio con IVA incluido", () => {
  const f = calcularFactura({
    lineas: [mozzarella, huevos],
    descuento_usd: 0,
    iva_pct: 16,
    tasa: 36.5,
  });
  assert.equal(f.subtotal_usd, 21.65);
  assert.equal(f.exento_usd, 6.25);
  assert.equal(f.base_imponible_usd, 13.28); // 15,40 / 1,16
  assert.equal(f.iva_usd, 2.12);
  assert.equal(f.total_usd, 21.65);
  assert.equal(f.lineas[0].precio_sin_iva_usd, 6.64);
  assert.equal(f.lineas[0].base_usd, 13.28);
  assert.equal(f.lineas[1].base_usd, 6.25);
  assert.equal(f.lineas[1].iva_usd, 0);
  // Los bolívares: las tres partes suman el total exacto.
  assert.equal(f.total_bs, 790.22);
  assert.equal(f.exento_bs! + f.base_imponible_bs! + f.iva_bs!, f.total_bs);
});

test("el descuento se reparte en proporción y el total sigue siendo el de la nota", () => {
  const f = calcularFactura({
    lineas: [mozzarella, huevos],
    descuento_usd: 1.65,
    iva_pct: 16,
    tasa: null,
  });
  assert.equal(f.descuento_usd, 1.65);
  assert.equal(f.total_usd, 20);
  assert.equal(f.lineas[0].neto_usd + f.lineas[1].neto_usd, 20);
  assert.equal(f.exento_usd + f.base_imponible_usd + f.iva_usd, 20);
  assert.equal(f.total_bs, null);
});

test("todo exento: sin IVA", () => {
  const f = calcularFactura({
    lineas: [huevos, { ...huevos, cantidad: 3, importe_usd: 18.75 }],
    descuento_usd: 0,
    iva_pct: 16,
    tasa: 40,
  });
  assert.equal(f.iva_usd, 0);
  assert.equal(f.base_imponible_usd, 0);
  assert.equal(f.exento_usd, 25);
  assert.equal(f.total_usd, 25);
  assert.equal(f.total_bs, 1000);
});

test("un descuento mayor que el subtotal se recorta, y uno negativo no cuenta", () => {
  assert.equal(
    calcularFactura({
      lineas: [huevos],
      descuento_usd: 100,
      iva_pct: 16,
      tasa: null,
    }).total_usd,
    0,
  );
  assert.equal(
    calcularFactura({
      lineas: [huevos],
      descuento_usd: -5,
      iva_pct: 16,
      tasa: null,
    }).total_usd,
    6.25,
  );
});

test("muchas líneas con céntimos: lo exento, la base y el IVA siempre suman el total", () => {
  const lineas: LineaParaFacturar[] = [];
  for (let i = 1; i <= 9; i++) {
    lineas.push({
      descripcion: `Artículo ${i}`,
      cantidad: i,
      unidad: "kg",
      precio_unitario_usd: 1.37 * i,
      importe_usd: Math.round(1.37 * i * i * 100) / 100,
      iva: i % 3 === 0 ? "exento" : "general",
    });
  }
  const f = calcularFactura({
    lineas,
    descuento_usd: 2.33,
    iva_pct: 16,
    tasa: 37.1234,
  });
  assert.equal(Math.round((f.exento_usd + f.base_imponible_usd + f.iva_usd) * 100) / 100, f.total_usd);
  assert.equal(f.total_usd, Math.round((f.subtotal_usd - 2.33) * 100) / 100);
  assert.equal(Math.round((f.exento_bs! + f.base_imponible_bs! + f.iva_bs!) * 100) / 100, f.total_bs);
});

test("las líneas exentas van marcadas con (E)", () => {
  assert.equal(descripcionDeLinea({ descripcion: "Huevos", iva: "exento" }), "Huevos (E)");
  assert.equal(descripcionDeLinea({ descripcion: "Mozzarella", iva: "general" }), "Mozzarella");
  assert.equal(numeroDeFactura(7), "000007");
});

const documentos: DocumentoDelLibro[] = [
  {
    tipo: "factura",
    numero: 1,
    numero_control: "00-00000101",
    fecha: "2026-10-05",
    cliente_nombre: "Pizzería Napoli, C.A.",
    cliente_rif: "J-12345678-9",
    factura_afectada: null,
    venta_id: 12,
    exento_usd: 6.25,
    base_imponible_usd: 13.28,
    iva_pct: 16,
    iva_usd: 2.12,
    total_usd: 21.65,
    tasa: 36.5,
    estado: "anulada",
  },
  {
    tipo: "nota_credito",
    numero: 1,
    numero_control: "",
    fecha: "2026-10-06",
    cliente_nombre: "Pizzería Napoli, C.A.",
    cliente_rif: "J-12345678-9",
    factura_afectada: 1,
    venta_id: 12,
    exento_usd: 6.25,
    base_imponible_usd: 13.28,
    iva_pct: 16,
    iva_usd: 2.12,
    total_usd: 21.65,
    tasa: 36.5,
    estado: "emitida",
  },
  {
    tipo: "factura",
    numero: 2,
    numero_control: "",
    fecha: "2026-10-07",
    cliente_nombre: "Luis",
    cliente_rif: "V-12345678",
    factura_afectada: null,
    venta_id: 13,
    exento_usd: 0,
    base_imponible_usd: 100,
    iva_pct: 16,
    iva_usd: 16,
    total_usd: 116,
    tasa: null,
    estado: "emitida",
  },
];

test("el libro de ventas: una fila por documento, la nota de crédito en negativo y los bolívares a su tasa", () => {
  const filas = filasDelLibro(documentos);
  assert.equal(filas.length, 3);
  assert.deepEqual(filas[0].slice(0, 8), ["05/10/2026", "Factura", "000001", "00-00000101", "Pizzería Napoli, C.A.", "J-12345678-9", "", "790,22"]);
  assert.equal(filas[0][17], "Anulada");
  assert.equal(filas[0][18], "000012");
  assert.deepEqual(filas[1].slice(1, 3), ["Nota de crédito", "000001"]);
  assert.equal(filas[1][6], "000001");
  assert.equal(filas[1][7], "-790,22");
  assert.equal(filas[1][13], "-21,65");
  // Sin tasa, las columnas en bolívares quedan vacías: no se inventa.
  assert.equal(filas[2][7], "");
  assert.equal(filas[2][12], "");
  assert.equal(filas[2][13], "116,00");
});

test("los totales del libro restan las notas de crédito", () => {
  const t = totalesDelLibro(documentos);
  assert.equal(t.facturas, 2);
  assert.equal(t.notas_credito, 1);
  assert.equal(t.total_usd, 116);
  assert.equal(t.iva_usd, 16);
  assert.equal(t.exento_usd, 0);
  assert.equal(t.base_imponible_usd, 100);
});

test("facturar una nota de otro mes avisa; del mismo mes, no", () => {
  assert.equal(avisoDePeriodo("2026-10-28", "2026-10-28"), null);
  assert.match(avisoDePeriodo("2026-09-30", "2026-10-01") ?? "", /mismo mes/);
});
