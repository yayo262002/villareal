import { test } from "node:test";
import assert from "node:assert/strict";
import { DIAS_SIN_TRATO, describirTrato, estudiarCliente } from "./seguimiento.ts";

const HOY = "2026-10-12";

test("el último trato es el más reciente entre alta, compra, abono, recordatorio y contacto", () => {
  const t = estudiarCliente(
    {
      alta: "2026-09-01 14:00:00",
      ventas: [{ fecha: "2026-09-20", total_usd: 38.5 }],
      abonos: [{ fecha: "2026-10-01" }],
      ultimoRecordatorio: "2026-09-28",
      ultimoContacto: "2026-10-03",
    },
    HOY,
  );
  assert.equal(t.ultimoTrato, "2026-10-03");
  assert.equal(t.diasSinTrato, 9);
  assert.equal(t.porLlamar, true);
  assert.equal(t.ultimaCompra, "2026-09-20");
  assert.equal(t.ultimoAbono, "2026-10-01");
});

test(`con menos de ${DIAS_SIN_TRATO} días sin trato no hay que llamar; sin ningún trato, sí`, () => {
  const reciente = estudiarCliente({ alta: null, ventas: [{ fecha: "2026-10-08", total_usd: 10 }], abonos: [], ultimoRecordatorio: null, ultimoContacto: null }, HOY);
  assert.equal(reciente.diasSinTrato, 4);
  assert.equal(reciente.porLlamar, false);
  const nunca = estudiarCliente({ alta: null, ventas: [], abonos: [], ultimoRecordatorio: null, ultimoContacto: null }, HOY);
  assert.equal(nunca.diasSinTrato, null);
  assert.equal(nunca.porLlamar, true);
  assert.equal(describirTrato(nunca), "Sin ningún trato anotado");
  assert.equal(describirTrato(reciente), "Sin trato desde hace 4 días");
});

test("cada cuántos días compra, cuándo le tocaría y lo que más compra", () => {
  const t = estudiarCliente(
    {
      alta: "2026-09-01",
      ventas: [
        { fecha: "2026-09-10", total_usd: 38.5, lineas: [{ producto_nombre: "Mozzarella", cantidad: 5 }] },
        { fecha: "2026-09-20", total_usd: 77, lineas: [{ producto_nombre: "Mozzarella", cantidad: 10 }, { producto_nombre: "Huevos", cantidad: 2 }] },
        { fecha: "2026-09-30", total_usd: 38.5, lineas: [{ producto_nombre: "Mozzarella", cantidad: 5 }, { producto_nombre: "Suero", cantidad: 3 }] },
      ],
      abonos: [],
      ultimoRecordatorio: null,
      ultimoContacto: null,
    },
    HOY,
  );
  assert.equal(t.cadaCuantosDias, 10);
  assert.equal(t.proximaCompra, "2026-10-10");
  assert.deepEqual(t.loQueCompra, ["Mozzarella", "Suero", "Huevos"]);
  assert.equal(t.compras, 3);
  assert.equal(t.compradoUsd, 154);
  // Los últimos 30 días contando hoy: desde el 13/09.
  assert.equal(t.comprado30Usd, 115.5);
});

test("una sola compra no da ritmo; dos ventas el mismo día cuentan como una fecha", () => {
  const una = estudiarCliente({ alta: null, ventas: [{ fecha: "2026-10-01", total_usd: 5 }], abonos: [], ultimoRecordatorio: null, ultimoContacto: null }, HOY);
  assert.equal(una.cadaCuantosDias, null);
  assert.equal(una.proximaCompra, null);
  const mismoDia = estudiarCliente(
    { alta: null, ventas: [{ fecha: "2026-10-01", total_usd: 5 }, { fecha: "2026-10-01", total_usd: 5 }], abonos: [], ultimoRecordatorio: null, ultimoContacto: null },
    HOY,
  );
  assert.equal(mismoDia.cadaCuantosDias, null);
});
