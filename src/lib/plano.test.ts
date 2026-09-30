import { test } from "node:test";
import assert from "node:assert/strict";
import { cuadrasEntre } from "./ruta.ts";
import {
  cuadriculaDePunto,
  estaEnLosAlrededores,
  metrosEntre,
  puntoDeCuadricula,
  puntoParaElMapa,
} from "./plano.ts";

const TIENDA = { calle: 38, carrera: 30.5 };

test("la tienda cae en el centro de Barquisimeto", () => {
  const p = puntoDeCuadricula(TIENDA);
  assert.ok(Math.abs(p.lat - 10.0765) < 0.001, String(p.lat));
  assert.ok(Math.abs(p.lon + 69.3299) < 0.001, String(p.lon));
  assert.equal(estaEnLosAlrededores(p), true);
});

test("una cuadra mide en torno a cien metros, de calle a calle y de carrera a carrera", () => {
  const calle = metrosEntre(puntoDeCuadricula({ calle: 38, carrera: 30 }), puntoDeCuadricula({ calle: 39, carrera: 30 }));
  const carrera = metrosEntre(puntoDeCuadricula({ calle: 38, carrera: 30 }), puntoDeCuadricula({ calle: 38, carrera: 31 }));
  assert.ok(calle > 95 && calle < 120, String(calle));
  assert.ok(carrera > 95 && carrera < 120, String(carrera));
});

test("del mapa a la cuadrícula y vuelta se llega al mismo sitio", () => {
  for (const u of [TIENDA, { calle: 25, carrera: 19 }, { calle: 42, carrera: 18 }, { calle: 10, carrera: 5 }]) {
    const vuelta = cuadriculaDePunto(puntoDeCuadricula(u));
    assert.ok(Math.abs(vuelta.calle - u.calle) < 1e-6 && Math.abs(vuelta.carrera - u.carrera) < 1e-6, JSON.stringify(vuelta));
  }
});

test("un lugar con nombre se mide en cuadras desde la tienda, aunque esté fuera del centro", () => {
  // El C.C. Terepaima, en Cabudare, según OpenStreetMap.
  const terepaima = cuadriculaDePunto({ lat: 10.0329393, lon: -69.2583231 });
  const cuadras = cuadrasEntre(TIENDA, terepaima);
  // Está a unos diez u once kilómetros por carretera: entre 90 y 140 cuadras.
  assert.ok(cuadras > 90 && cuadras < 140, String(cuadras));
  // Hacia el este y el sur: números de calle y carrera por debajo de la cuadrícula.
  assert.ok(terepaima.calle < 8 && terepaima.carrera < 5, JSON.stringify(terepaima));

  // El Sambil, mucho más cerca.
  const sambil = cuadriculaDePunto({ lat: 10.0715736, lon: -69.2934301 });
  assert.ok(cuadrasEntre(TIENDA, sambil) < cuadras);
  assert.ok(cuadrasEntre(TIENDA, sambil) > 20, String(cuadrasEntre(TIENDA, sambil)));
});

test("la distancia en línea recta entre dos puntos del mapa", () => {
  assert.equal(Math.round(metrosEntre({ lat: 10.07, lon: -69.33 }, { lat: 10.07, lon: -69.33 })), 0);
  // Un grado de latitud son unos 111 km.
  assert.ok(Math.abs(metrosEntre({ lat: 10, lon: -69.33 }, { lat: 11, lon: -69.33 }) - 111195) < 200);
});

test("un punto fuera de los alrededores no vale, y el punto se escribe como lo lee Google Maps", () => {
  assert.equal(estaEnLosAlrededores({ lat: 10.5, lon: -66.9 }), false);
  assert.equal(estaEnLosAlrededores({ lat: 10.0329393, lon: -69.2583231 }), true);
  assert.equal(puntoParaElMapa({ lat: 10.0329393, lon: -69.2583231 }), "10.032939,-69.258323");
});
