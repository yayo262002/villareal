import { test } from "node:test";
import assert from "node:assert/strict";
import { enlaceAlMapa, planDeDespacho } from "./despacho.ts";

const TIENDA = { direccion: "Calle 38 entre carreras 30 y 31, local s/n, sector Centro", ciudad: "Barquisimeto, Lara, Venezuela" };
const cliente = (id: number, direccion: string) => ({ id, direccion });

test("los clientes salen en el orden de la mejor vuelta desde la tienda", () => {
  const plan = planDeDespacho(TIENDA, [
    cliente(1, "Carrera 20 con calle 38"),
    cliente(2, "Calle 38 con carrera 28"),
    cliente(3, "Calle 38 entre carreras 24 y 25"),
  ]);
  assert.deepEqual(plan.tienda, { calle: 38, carrera: 30.5 });
  assert.equal(plan.sinUbicar.length, 0);
  assert.deepEqual(plan.ruta.paradas.map((p) => p.dato.id), [2, 3, 1]);
  assert.equal(plan.ruta.cuadras, 21);
});

test("quien no tiene una dirección que se entienda queda aparte, con el motivo", () => {
  const plan = planDeDespacho(TIENDA, [
    cliente(1, "Carrera 19 con calle 25"),
    cliente(2, ""),
    cliente(3, "Urb. Del Este, calle 3"),
    cliente(4, "Calle 30"),
  ]);
  assert.deepEqual(plan.ruta.paradas.map((p) => p.dato.id), [1]);
  assert.deepEqual(plan.sinUbicar.map((s) => [s.cliente.id, s.motivo]), [
    [2, "no tiene dirección"],
    [3, "parece una urbanización o un barrio, fuera de la cuadrícula del centro"],
    [4, "falta la carrera"],
  ]);
});

test("el enlace de Google Maps lleva los cruces en el orden de la ruta", () => {
  const plan = planDeDespacho(TIENDA, [cliente(1, "Carrera 19 con calle 25"), cliente(2, "Carrera 22 entre calles 30 y 31")]);
  assert.equal(plan.enlaces.length, 1);
  const url = new URL(plan.enlaces[0].enlace);
  assert.equal(url.searchParams.get("origin"), "Calle 38 con Carrera 30, Barquisimeto, Lara, Venezuela");
  assert.equal(url.searchParams.get("destination"), "Calle 38 con Carrera 30, Barquisimeto, Lara, Venezuela");
  const paradas = url.searchParams.get("waypoints")!.split("|");
  assert.equal(paradas.length, 2);
  assert.ok(paradas.includes("Calle 25 con Carrera 19, Barquisimeto, Lara, Venezuela"));
  assert.ok(paradas.includes("Calle 30 con Carrera 22, Barquisimeto, Lara, Venezuela"));
});

test("sin clientes ubicados no hay ruta ni enlaces", () => {
  const plan = planDeDespacho(TIENDA, [cliente(1, "")]);
  assert.equal(plan.ruta.paradas.length, 0);
  assert.equal(plan.ruta.cuadras, 0);
  assert.deepEqual(plan.enlaces, []);
});

test("si la dirección de la tienda no se entiende, nadie entra en la ruta", () => {
  const plan = planDeDespacho({ direccion: "Centro", ciudad: "Barquisimeto" }, [cliente(1, "Carrera 19 con calle 25")]);
  assert.equal(plan.tienda, null);
  assert.equal(plan.sinUbicar.length, 1);
});

test("el mapa de una dirección suelta", () => {
  assert.equal(enlaceAlMapa("", "Barquisimeto"), null);
  assert.match(enlaceAlMapa("Carrera 19 con calle 25", "Barquisimeto")!, /query=Calle\+25\+con\+Carrera\+19%2C\+Barquisimeto|query=Calle%2025%20con%20Carrera%2019%2C%20Barquisimeto/);
  assert.match(enlaceAlMapa("Urb. Del Este, casa 4", "Barquisimeto")!, /Urb/);
});
