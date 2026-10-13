import { test } from "node:test";
import assert from "node:assert/strict";
import { bs, usd } from "./dinero.ts";
import { textoDelAvisoDeLaManana } from "./aviso-manana.ts";

test("el aviso de la mañana dice el día, las entregas, los vencidos, el inventario, los clientes por llamar y la tasa", () => {
  const aviso = textoDelAvisoDeLaManana({
    fecha: "2026-10-12",
    entregasHoy: 2,
    entregasAtrasadas: 1,
    clientesVencidos: 6,
    vencidoUsd: 301.29,
    inventarioBajo: ["Mozzarella (3 días)"],
    tasa: 871.37,
    clientesPorLlamar: 4,
    ayer: { notas: 3, vendidoUsd: 154, cobradoUsd: 80.5 },
  });
  assert.equal(aviso.titulo, "Buenos días · lunes 12/10/2026");
  const lineas = aviso.cuerpo.split("\n");
  assert.equal(lineas[0], "Entregas: 2 para hoy y 1 atrasada.");
  assert.equal(lineas[1], `6 clientes con el plazo vencido: ${usd(301.29)}.`);
  assert.equal(lineas[2], "Queda poco: Mozzarella (3 días).");
  assert.equal(lineas[3], "4 clientes por llamar: una semana o más sin trato.");
  assert.equal(lineas[4], `Ayer: 3 notas por ${usd(154)}; entraron ${usd(80.5)}.`);
  assert.equal(lineas[5], `Tasa BCV: ${bs(871.37)} por dólar.`);
  assert.equal(aviso.url, "/admin");
  assert.equal(aviso.etiqueta, "manana");
});

test("un día tranquilo lo dice en pocas palabras y manda al despacho", () => {
  const aviso = textoDelAvisoDeLaManana({ fecha: "2026-10-11", entregasHoy: 0, entregasAtrasadas: 0, clientesVencidos: 0, vencidoUsd: 0, inventarioBajo: [], tasa: null, clientesPorLlamar: 0 });
  assert.equal(aviso.titulo, "Buenos días · domingo 11/10/2026");
  assert.equal(aviso.cuerpo, "Sin entregas pendientes.\nNadie con el plazo vencido.");
  const conAyerVacio = textoDelAvisoDeLaManana({ fecha: "2026-10-11", entregasHoy: 0, entregasAtrasadas: 0, clientesVencidos: 0, vencidoUsd: 0, inventarioBajo: [], tasa: null, clientesPorLlamar: 0, ayer: { notas: 0, vendidoUsd: 0, cobradoUsd: 0 } });
  assert.ok(!conAyerVacio.cuerpo.includes("Ayer"));
  assert.equal(aviso.url, "/admin/despacho");
});
