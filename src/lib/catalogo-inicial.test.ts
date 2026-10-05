import { test } from "node:test";
import assert from "node:assert/strict";
import { BORRADORES, BORRADORES_RETIRADOS, FAMILIAS_INICIALES, OFERTAS_INICIALES, familiasPorNombre, mismoNombre } from "./catalogo-inicial.ts";
import { aSlug } from "./enlaces.ts";

const slugs = new Set(FAMILIAS_INICIALES.map((f) => f.slug));

test("las familias iniciales: once, con su slug sacado del nombre, sin repetir y en orden", () => {
  assert.equal(FAMILIAS_INICIALES.length, 11);
  assert.equal(slugs.size, 11);
  for (const f of FAMILIAS_INICIALES) assert.equal(f.slug, aSlug(f.nombre), f.nombre);
  assert.deepEqual(
    FAMILIAS_INICIALES.map((f) => f.orden),
    FAMILIAS_INICIALES.map((_, i) => i + 1),
  );
});

test("cada borrador una sola vez, en familias que existen, sin repetir la principal entre las relacionadas", () => {
  const nombres = BORRADORES.map((x) => aSlug(x.nombre));
  assert.equal(new Set(nombres).size, nombres.length);
  for (const x of BORRADORES) {
    assert.ok(slugs.has(x.familia), x.nombre);
    for (const r of x.relacionadas) assert.ok(slugs.has(r) && r !== x.familia, `${x.nombre}: ${r}`);
  }
  // La tocineta va en Embutidos y sale también en Burger y en Pizzería; no se repite.
  const tocineta = BORRADORES.filter((x) => mismoNombre(x.nombre, "tocineta"));
  assert.equal(tocineta.length, 1);
  assert.deepEqual(tocineta[0], { nombre: "Tocineta", familia: "embutidos", relacionadas: ["burger", "pizzeria"], unidad: "kg", secciones: { burger: "Proteínas" } });
  // Los que ya existen no se vuelven a crear.
  for (const ya of ["Queso amarillo", "Queso mozzarella", "Huevos", "Queso pecorino rallado", "Huevos por cartón", "Suero"]) {
    assert.ok(!BORRADORES.some((x) => mismoNombre(x.nombre, ya)), ya);
  }
  // Una sección en otra familia solo donde sale.
  for (const x of BORRADORES) for (const slug of Object.keys(x.secciones ?? {})) assert.ok(x.relacionadas.includes(slug), `${x.nombre}: ${slug}`);
});

test("una presentación no es un tipo: los borradores retirados ya no se preparan", () => {
  for (const r of BORRADORES_RETIRADOS) assert.ok(!BORRADORES.some((x) => mismoNombre(x.nombre, r.nombre)), r.nombre);
  for (const o of OFERTAS_INICIALES) for (const p of o.productos) assert.ok(!BORRADORES_RETIRADOS.some((r) => mismoNombre(r.nombre, p)), `${o.nombre}: ${p}`);
});

test("los combos nombran productos que hay o que se preparan", () => {
  const conocidos = [...BORRADORES.map((x) => x.nombre), "Queso amarillo", "Queso mozzarella"];
  for (const o of OFERTAS_INICIALES) {
    for (const p of o.productos) assert.ok(conocidos.some((c) => mismoNombre(c, p)), `${o.nombre}: ${p}`);
  }
});

test("los productos que ya había van a su familia por el nombre", () => {
  assert.deepEqual(familiasPorNombre("Queso amarillo"), { principal: "quesos", relacionadas: ["burger"] });
  assert.deepEqual(familiasPorNombre("Queso mozzarella"), { principal: "quesos", relacionadas: ["pizzeria", "burger"] });
  assert.deepEqual(familiasPorNombre("Queso pecorino rallado"), { principal: "quesos", relacionadas: ["pizzeria"] });
  assert.deepEqual(familiasPorNombre("Huevos"), { principal: "huevos", relacionadas: [] });
  assert.deepEqual(familiasPorNombre("Suero de leche"), { principal: "lacteos", relacionadas: [] });
  assert.deepEqual(familiasPorNombre("Crema de leche"), { principal: "lacteos", relacionadas: [] });
  assert.deepEqual(familiasPorNombre("Mantequilla"), { principal: "otros-productos", relacionadas: [] });
});
