import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustesDelFormulario, enLaZona, enlaceDeUbicacion, kmEntre, leerAjustesDeDelivery, precioDelDelivery, puntoDeLaTienda, textoKm } from "./delivery.ts";
import { leerDireccion } from "./direcciones.ts";
import { puntoDeCuadricula } from "./plano.ts";

const tienda = puntoDeLaTienda("Calle 38 entre carreras 30 y 31, local s/n, sector Centro");

test("la tienda está en el plano, en Barquisimeto", () => {
  assert.ok(tienda);
  assert.ok(enLaZona(tienda));
});

test("la distancia, en línea recta y en kilómetros con un decimal", () => {
  const lectura = leerDireccion("Calle 30 entre carreras 20 y 21");
  assert.ok(lectura.ubicada && tienda);
  // 8 calles y 10 carreras: unos 1,4 km en línea recta.
  const km = kmEntre(tienda, puntoDeCuadricula(lectura.ubicacion));
  assert.ok(km >= 1.2 && km <= 1.6, String(km));
  assert.equal(textoKm(3.25), "3,3 km");
  assert.equal(textoKm(2), "2 km");
});

test("fuera de Barquisimeto y Cabudare no se reparte (Quíbor, Caracas)", () => {
  assert.equal(enLaZona({ lat: 9.928, lon: -69.62 }), false);
  assert.equal(enLaZona({ lat: 10.48, lon: -66.9 }), false);
  // Cabudare sí.
  assert.equal(enLaZona({ lat: 10.03, lon: -69.26 }), true);
});

test("el precio: la primera tarifa que llega; más allá o sin tarifas, por confirmar; gratis desde un monto", () => {
  const ajustes = { tarifas: [{ hasta_km: 3, precio_usd: 1 }, { hasta_km: 6, precio_usd: 2 }], gratis_desde_usd: 50 };
  assert.equal(precioDelDelivery(1.4, ajustes), 1);
  assert.equal(precioDelDelivery(3, ajustes), 1);
  assert.equal(precioDelDelivery(3.1, ajustes), 2);
  assert.equal(precioDelDelivery(6.5, ajustes), null);
  assert.equal(precioDelDelivery(4, ajustes, 50), 0);
  assert.equal(precioDelDelivery(4, ajustes, 49.99), 2);
  // Gratis no alcanza más allá de la última tarifa: allí se confirma.
  assert.equal(precioDelDelivery(9, ajustes, 80), null);
  assert.equal(precioDelDelivery(1, { tarifas: [], gratis_desde_usd: null }), null);
});

test("lo guardado se revisa: desordenado, con basura o roto, queda lo que tiene sentido", () => {
  assert.deepEqual(leerAjustesDeDelivery(null), { tarifas: [], gratis_desde_usd: null });
  assert.deepEqual(leerAjustesDeDelivery("no es json"), { tarifas: [], gratis_desde_usd: null });
  assert.deepEqual(
    leerAjustesDeDelivery(JSON.stringify({ tarifas: [{ hasta_km: 6, precio_usd: 2 }, { hasta_km: 3, precio_usd: 1 }, { hasta_km: -1, precio_usd: 5 }, { hasta_km: "x" }], gratis_desde_usd: 0 })),
    { tarifas: [{ hasta_km: 3, precio_usd: 1 }, { hasta_km: 6, precio_usd: 2 }], gratis_desde_usd: null },
  );
});

test("el formulario del panel: filas vacías fuera, comas o puntos, y los errores con su fila", () => {
  const bien = ajustesDelFormulario(
    [
      { hasta_km: "6", precio_usd: "2,50" },
      { hasta_km: "", precio_usd: "" },
      { hasta_km: "3", precio_usd: "$1" },
    ],
    "40",
  );
  assert.deepEqual(bien, { ajustes: { tarifas: [{ hasta_km: 3, precio_usd: 1 }, { hasta_km: 6, precio_usd: 2.5 }], gratis_desde_usd: 40 } });
  assert.deepEqual(ajustesDelFormulario([{ hasta_km: "3", precio_usd: "" }], ""), { error: "En la fila 1 falta el precio." });
  assert.deepEqual(ajustesDelFormulario([{ hasta_km: "abc", precio_usd: "1" }], ""), { error: "En la fila 1, los kilómetros tienen que ser un número entre 0 y 100." });
  assert.deepEqual(ajustesDelFormulario([{ hasta_km: "3", precio_usd: "1" }, { hasta_km: "3", precio_usd: "2" }], ""), { error: "Hay dos tarifas con los mismos kilómetros." });
  assert.deepEqual(ajustesDelFormulario([], "0"), { error: "El monto para el delivery gratis tiene que ser un número de dólares mayor que 0, o quedar vacío." });
  // Sin nada: sin tarifas, todo por confirmar.
  assert.deepEqual(ajustesDelFormulario([{ hasta_km: "", precio_usd: "" }], ""), { ajustes: { tarifas: [], gratis_desde_usd: null } });
});

test("el enlace de la ubicación para el repartidor", () => {
  assert.equal(enlaceDeUbicacion({ lat: 10.0654321, lon: -69.3212345 }), "https://www.google.com/maps?q=10.065432,-69.321235");
});
