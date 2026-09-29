import { test } from "node:test";
import assert from "node:assert/strict";
import { cuadrasEntre, distanciaLegible, enlacesDeRuta, ordenarRuta } from "./ruta.ts";

const TIENDA = { calle: 38, carrera: 30.5 };
const parada = (dato: string, calle: number, carrera: number) => ({ dato, ubicacion: { calle, carrera } });
const nombres = (ruta: { paradas: { dato: string }[] }) => ruta.paradas.map((p) => p.dato);

test("las cuadras se cuentan como se anda por la cuadrícula", () => {
  assert.equal(cuadrasEntre(TIENDA, { calle: 38, carrera: 30.5 }), 0);
  assert.equal(cuadrasEntre(TIENDA, { calle: 40, carrera: 30.5 }), 2);
  assert.equal(cuadrasEntre(TIENDA, { calle: 35, carrera: 25.5 }), 8);
});

test("sin paradas no hay ruta", () => {
  assert.deepEqual(ordenarRuta(TIENDA, []), { paradas: [], cuadras: 0, cuadrasDeVuelta: 0 });
});

test("clientes en la misma calle se visitan seguidos, sin ir y volver", () => {
  const ruta = ordenarRuta(TIENDA, [
    parada("lejos", 38, 20),
    parada("cerca", 38, 28),
    parada("medio", 38, 24),
  ]);
  // Ir hasta el fondo y volver: 10,5 cuadras de ida y 10,5 de vuelta.
  assert.equal(ruta.cuadras, 21);
  // Ir o volver mide lo mismo: se empieza por el más cercano, que así espera menos.
  assert.deepEqual(nombres(ruta), ["cerca", "medio", "lejos"]);
});

test("a igualdad de cuadras, primero el que está más cerca", () => {
  // Los tres quedan hacia el mismo lado: cualquier orden «de paso» mide 49 cuadras.
  const ruta = ordenarRuta(TIENDA, [
    parada("lejos", 25, 19),
    parada("cerca", 38, 28),
    parada("medio", 30.5, 22),
  ]);
  assert.equal(ruta.cuadras, 49);
  assert.deepEqual(nombres(ruta), ["cerca", "medio", "lejos"]);
  assert.deepEqual(ruta.paradas.map((p) => p.cuadrasDesdeLaAnterior), [2.5, 13.5, 8.5]);
  assert.equal(ruta.cuadrasDeVuelta, 24.5);
});

test("el desempate también vale con muchas paradas", () => {
  // Doce clientes en fila en la misma calle, dados en desorden.
  const fila = [9, 3, 12, 1, 7, 5, 11, 2, 8, 4, 10, 6].map((n) => parada(`c${n}`, 38, 30.5 - n));
  const ruta = ordenarRuta(TIENDA, fila);
  assert.equal(ruta.cuadras, 24);
  assert.deepEqual(nombres(ruta), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `c${n}`));
});

test("la ruta es una vuelta: no cruza la ciudad de lado a lado dos veces", () => {
  // Cuatro clientes en las esquinas de un cuadrado alrededor de la tienda.
  const ruta = ordenarRuta(TIENDA, [
    parada("noreste", 43, 35.5),
    parada("suroeste", 33, 25.5),
    parada("noroeste", 43, 25.5),
    parada("sureste", 33, 35.5),
  ]);
  // La mejor vuelta recorre el borde del cuadrado: 10 + 10 + 10 + 10 y la ida y vuelta al borde.
  assert.equal(ruta.cuadras, 50);
  const orden = nombres(ruta);
  // Nunca se va de una esquina a la opuesta.
  const opuesta: Record<string, string> = { noreste: "suroeste", suroeste: "noreste", noroeste: "sureste", sureste: "noroeste" };
  for (let i = 1; i < orden.length; i++) assert.notEqual(orden[i], opuesta[orden[i - 1]], orden.join(" "));
});

test("cada parada dice cuántas cuadras hay desde la anterior", () => {
  const ruta = ordenarRuta(TIENDA, [parada("a", 40, 30.5), parada("b", 40, 28.5)]);
  assert.equal(ruta.cuadras, 8);
  assert.equal(ruta.paradas.reduce((s, p) => s + p.cuadrasDesdeLaAnterior, 0) + ruta.cuadrasDeVuelta, ruta.cuadras);
});

test("dos clientes en el mismo sitio van uno detrás de otro", () => {
  const ruta = ordenarRuta(TIENDA, [parada("a", 30, 20), parada("otro", 45, 33), parada("b", 30, 20)]);
  const orden = nombres(ruta);
  assert.equal(Math.abs(orden.indexOf("a") - orden.indexOf("b")), 1, orden.join(" "));
});

test("con muchas paradas la ruta mejorada no es peor que ir siempre al más cercano", () => {
  // Treinta clientes repartidos por el centro, siempre los mismos.
  let semilla = 7;
  const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
  const muchas = Array.from({ length: 30 }, (_, i) => parada(`c${i}`, 20 + Math.floor(azar() * 35), 14 + Math.floor(azar() * 22)));
  const ruta = ordenarRuta(TIENDA, muchas);

  assert.equal(ruta.paradas.length, 30);
  assert.equal(new Set(nombres(ruta)).size, 30, "cada cliente sale una sola vez");

  // La vuelta de ir siempre al más cercano, calculada aparte.
  const pendientes = [...muchas];
  let actual = TIENDA;
  let ingenua = 0;
  while (pendientes.length) {
    pendientes.sort((a, b) => cuadrasEntre(actual, a.ubicacion) - cuadrasEntre(actual, b.ubicacion));
    const siguiente = pendientes.shift()!;
    ingenua += cuadrasEntre(actual, siguiente.ubicacion);
    actual = siguiente.ubicacion;
  }
  ingenua += cuadrasEntre(actual, TIENDA);
  assert.ok(ruta.cuadras <= ingenua, `${ruta.cuadras} > ${ingenua}`);
});

test("la distancia se dice en cuadras y, si es larga, en kilómetros", () => {
  assert.equal(distanciaLegible(1), "1 cuadra");
  assert.equal(distanciaLegible(8), "8 cuadras");
  assert.equal(distanciaLegible(21), "21 cuadras (unos 2,1 km)");
});

test("el enlace de Google Maps sale de la tienda, pasa por todos y vuelve", () => {
  const [unico, ...mas] = enlacesDeRuta("Tienda", ["A", "B", "C"]);
  assert.equal(mas.length, 0);
  const url = new URL(unico.enlace);
  assert.equal(url.origin + url.pathname, "https://www.google.com/maps/dir/");
  assert.equal(url.searchParams.get("origin"), "Tienda");
  assert.equal(url.searchParams.get("destination"), "Tienda");
  assert.equal(url.searchParams.get("waypoints"), "A|B|C");
  assert.deepEqual([unico.desde, unico.hasta], [1, 3]);
});

test("con más de nueve paradas la ruta se parte en tramos seguidos", () => {
  const paradas = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
  const tramos = enlacesDeRuta("Tienda", paradas);
  assert.equal(tramos.length, 2);

  const primero = new URL(tramos[0].enlace);
  assert.equal(primero.searchParams.get("origin"), "Tienda");
  assert.equal(primero.searchParams.get("destination"), "P9");
  assert.equal(primero.searchParams.get("waypoints"), "P1|P2|P3|P4|P5|P6|P7|P8");

  const segundo = new URL(tramos[1].enlace);
  assert.equal(segundo.searchParams.get("origin"), "P9");
  assert.equal(segundo.searchParams.get("destination"), "Tienda");
  assert.equal(segundo.searchParams.get("waypoints"), "P10|P11|P12");
  assert.deepEqual(tramos.map((t) => [t.desde, t.hasta]), [[1, 9], [10, 12]]);
});
