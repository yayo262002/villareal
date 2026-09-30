import { test } from "node:test";
import assert from "node:assert/strict";
import { cruceParaElMapa, describirUbicacion, explicarMotivo, leerDireccion } from "./direcciones.ts";

test("el motivo se dice en una frase entera", () => {
  assert.equal(explicarMotivo("no tiene dirección"), "No tiene dirección.");
  assert.equal(explicarMotivo("falta la carrera"), "A la dirección le falta la carrera.");
  assert.equal(explicarMotivo("no dice calle ni carrera"), "La dirección no dice calle ni carrera.");
});

function ubicacion(direccion: string) {
  const lectura = leerDireccion(direccion);
  return lectura.ubicada ? lectura.ubicacion : lectura.motivo;
}

test("la dirección de la tienda", () => {
  assert.deepEqual(ubicacion("Calle 38 entre carreras 30 y 31, local s/n, sector Centro"), { calle: 38, carrera: 30.5 });
});

test("las formas corrientes de escribir un cruce", () => {
  assert.deepEqual(ubicacion("Carrera 19 con calle 25"), { calle: 25, carrera: 19 });
  assert.deepEqual(ubicacion("calle 25 con carrera 19"), { calle: 25, carrera: 19 });
  assert.deepEqual(ubicacion("Carrera 22 entre calles 30 y 31"), { calle: 30.5, carrera: 22 });
  assert.deepEqual(ubicacion("CARRERA 22 ENTRE CALLES 30 Y 31, EDIF. LARA, PISO 2"), { calle: 30.5, carrera: 22 });
  assert.deepEqual(ubicacion("Calle 42 esquina carrera 18"), { calle: 42, carrera: 18 });
});

test("sin repetir la palabra: «entre 30 y 31» y «con 25» son del otro eje", () => {
  assert.deepEqual(ubicacion("Calle 38 entre 30 y 31"), { calle: 38, carrera: 30.5 });
  assert.deepEqual(ubicacion("Carrera 19 con 25"), { calle: 25, carrera: 19 });
  assert.deepEqual(ubicacion("Carrera 19 c/ 25"), { calle: 25, carrera: 19 });
  assert.deepEqual(ubicacion("Cra 21 esq 33"), { calle: 33, carrera: 21 });
});

test("abreviaturas y la avenida 20, que es la carrera 20", () => {
  assert.deepEqual(ubicacion("Cra. 24 c/ Cll 30"), { calle: 30, carrera: 24 });
  assert.deepEqual(ubicacion("Av. 20 con calle 28"), { calle: 28, carrera: 20 });
  assert.deepEqual(ubicacion("Avenida 20 entre calles 28 y 29"), { calle: 28.5, carrera: 20 });
});

test("una dirección a medias no se adivina: se dice qué falta, y se guarda lo que sí se entendió", () => {
  assert.equal(ubicacion("Calle 38"), "falta la carrera");
  const aMedias = leerDireccion("Av. Libertador con calle 30");
  assert.deepEqual(aMedias, { ubicada: false, motivo: "falta la carrera", parcial: { calle: 30 } });
  assert.deepEqual(leerDireccion("Carrera 19, frente a la plaza"), { ubicada: false, motivo: "falta la calle", parcial: { carrera: 19 } });
  assert.equal(ubicacion("Carrera 19, frente a la plaza"), "falta la calle");
  assert.equal(ubicacion("Frente a la plaza Bolívar"), "no dice calle ni carrera");
  assert.equal(ubicacion(""), "no tiene dirección");
  assert.equal(ubicacion("   "), "no tiene dirección");
});

test("una avenida con nombre no es un número de la cuadrícula", () => {
  assert.equal(ubicacion("Av. Venezuela con calle 30"), "falta la carrera");
  assert.equal(ubicacion("Avenida Vargas"), "no dice calle ni carrera");
});

test("urbanizaciones y barrios quedan fuera: su «calle 3» no es la del centro", () => {
  for (const direccion of ["Urb. Del Este, calle 3 con carrera 2", "Barrio Unión calle 5 carrera 1", "Km 5 vía Quíbor", "Zona Industrial I, carrera 2 con calle 4"]) {
    assert.match(String(ubicacion(direccion)), /fuera de la cuadrícula/, direccion);
  }
});

test("números imposibles se ignoran", () => {
  assert.equal(ubicacion("Calle 0 con carrera 19"), "falta la calle");
  assert.equal(ubicacion("Calle 380 con carrera 19"), "falta la calle");
});

test("la ubicación dicha en palabras y para el mapa", () => {
  assert.equal(describirUbicacion({ calle: 38, carrera: 30.5 }), "calle 38, entre carreras 30 y 31");
  assert.equal(describirUbicacion({ calle: 30.5, carrera: 22 }), "carrera 22, entre calles 30 y 31");
  assert.equal(describirUbicacion({ calle: 25, carrera: 19 }), "carrera 19 con calle 25");
  assert.equal(describirUbicacion({ calle: 25.5, carrera: 19.5 }), "entre carreras 19 y 20, entre calles 25 y 26");
  assert.equal(cruceParaElMapa({ calle: 38, carrera: 30.5 }, "Barquisimeto, Lara, Venezuela"), "Calle 38 con Carrera 30, Barquisimeto, Lara, Venezuela");
});
