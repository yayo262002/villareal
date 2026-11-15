import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clavesDelPagador,
  fechaDelEncabezado,
  leerAvisoDelBanco,
  leerMontoBs,
  mismaReferencia,
  montoCuadra,
  montosParecidos,
  nombreParecido,
  referenciaUtil,
  separarAvisos,
  vieneDelBanco,
} from "./banco-calculo.ts";

const CON_TELEFONO = "Recibiste un PagomovilBDV por Bs.57.158,84 del 0424-5550199 Ref: 012345678094 en fecha 14-11-26 hora: 08:30.";
const CON_NOMBRE = "Recibiste un PagomovilBDV de PEDRO ANTONIO GOMEZ RIVAS por Bs.2.500,00 bajo el numero de operacion 008000123554";

test("el aviso del BDV con teléfono, referencia, fecha y hora", () => {
  const l = leerAvisoDelBanco(CON_TELEFONO);
  assert.equal(l.leido, true);
  if (!l.leido) return;
  assert.deepEqual(l.movimiento, {
    banco: "BDV",
    metodo: "pago_movil",
    monto_bs: 57158.84,
    telefono: "0424-5550199",
    titular: "",
    referencia: "012345678094",
    fecha: "2026-11-14",
    hora: "08:30",
  });
});

test("el aviso del BDV con el nombre de quien pagó y el número de operación, sin fecha", () => {
  const l = leerAvisoDelBanco(CON_NOMBRE);
  assert.equal(l.leido, true);
  if (!l.leido) return;
  assert.deepEqual(l.movimiento, {
    banco: "BDV",
    metodo: "pago_movil",
    monto_bs: 2500,
    telefono: "",
    titular: "PEDRO ANTONIO GOMEZ RIVAS",
    referencia: "008000123554",
    fecha: null,
    hora: null,
  });
});

test("con el título de la notificación delante y saltos de línea, se lee igual", () => {
  const l = leerAvisoDelBanco(`BDVapp\nPago Móvil recibido\n${CON_TELEFONO}`);
  assert.equal(l.leido, true);
  if (l.leido) assert.equal(l.movimiento.monto_bs, 57158.84);
});

test("lo que no es un pago recibido no se lee", () => {
  for (const texto of [
    "Realizaste un PagomovilBDV por Bs.1.000,00 al 0414-1234567 Ref: 123456789012",
    "Tu clave de operaciones especiales es 482913. No la compartas.",
    "Disfruta de la nueva BDVapp",
    "",
  ]) {
    assert.equal(leerAvisoDelBanco(texto).leido, false, texto);
  }
});

test("un pago recibido sin monto no se lee", () => {
  const l = leerAvisoDelBanco("Recibiste un PagomovilBDV del 0424-5550199");
  assert.equal(l.leido, false);
});

test("una transferencia recibida también", () => {
  const l = leerAvisoDelBanco("Recibiste una Transferencia BDV de PANADERIA TUTTO PAN CA por Bs.12.345,67 Ref: 99887766");
  assert.equal(l.leido, true);
  if (!l.leido) return;
  assert.equal(l.movimiento.metodo, "transferencia");
  assert.equal(l.movimiento.monto_bs, 12345.67);
  assert.equal(l.movimiento.titular, "PANADERIA TUTTO PAN CA");
  assert.equal(l.movimiento.referencia, "99887766");
});

test("los montos como los escribe el banco", () => {
  assert.equal(leerMontoBs("57.158,84"), 57158.84);
  assert.equal(leerMontoBs("2.500,00"), 2500);
  assert.equal(leerMontoBs("2500,5"), 2500.5);
  assert.equal(leerMontoBs("2,500.00"), 2500);
  assert.equal(leerMontoBs("2500.00"), 2500);
  assert.equal(leerMontoBs("2.500"), 2500);
  assert.equal(leerMontoBs("1.234.567,89"), 1234567.89);
  assert.equal(leerMontoBs("0,00"), null);
  assert.equal(leerMontoBs("abc"), null);
});

test("una fecha que no existe no se toma", () => {
  const l = leerAvisoDelBanco("Recibiste un PagomovilBDV por Bs.10,00 del 0424-5550199 Ref: 1234 en fecha 31-02-26 hora: 08:30");
  assert.equal(l.leido, true);
  if (l.leido) assert.equal(l.movimiento.fecha, null);
});

test("de una captura, solo la fecha del aviso: la de lo que se ve detrás no cuenta", () => {
  // Una transferencia (sin fecha) con el historial del panel detrás: no es del 20/10, vale el día en que llegó.
  const conHistorial = leerAvisoDelBanco(
    "Recibiste una transferencia BDV de PEDRO ANTONIO GOMEZ RIVAS por Bs.158.193,41 bajo el numero de operacion 008000123554 VENTA Nota N.° 000088 20/10/2026 42,5 kg Mozzarella Pagada",
  );
  assert.equal(conHistorial.leido, true);
  if (conHistorial.leido) assert.equal(conHistorial.movimiento.fecha, null);
  // Una transferencia con el título del aviso siguiente detrás sigue siendo transferencia.
  const conTitulo = leerAvisoDelBanco('Recibiste una transferencia BDV de PEDRO ANTONIO GOMEZ RIVAS por Bs.70.686,22 bajo el numero de operacion 008000123554" PagomóvilBDV recibido mié, 19:27');
  if (conTitulo.leido) assert.equal(conTitulo.movimiento.metodo, "transferencia");
  // Con su «en fecha», esa, aunque detrás haya otra.
  const conFecha = leerAvisoDelBanco(`${CON_TELEFONO} Nota N.° 000088 20/10/2026`);
  if (conFecha.leido) assert.equal(conFecha.movimiento.fecha, "2026-11-14");
});

test("la referencia escrita a mano suele ser solo el final", () => {
  assert.equal(mismaReferencia("012345678094", "8094"), true);
  assert.equal(mismaReferencia("8094", "012345678094"), true);
  assert.equal(mismaReferencia("012345678094", "Ref. 678094"), true);
  assert.equal(mismaReferencia("012345678094", "8095"), false);
  assert.equal(mismaReferencia("012345678094", "094"), false, "con tres cifras no basta");
  assert.equal(mismaReferencia("", ""), false);
  assert.equal(referenciaUtil("ref 12"), false);
  assert.equal(referenciaUtil("…8094"), true);
});

test("montos parecidos, con y sin margen", () => {
  assert.equal(montosParecidos(2500, 2500), true);
  assert.equal(montosParecidos(2500, 2500.01), true);
  assert.equal(montosParecidos(2500, 2501), false);
  assert.equal(montosParecidos(2500, 2510, 0.005), true);
  assert.equal(montosParecidos(2500, 2530, 0.005), false);
});

test("a quien paga se le recuerda por su teléfono y por su nombre en el banco", () => {
  assert.deepEqual(clavesDelPagador({ telefono: "0424-5550199", titular: "" }), ["tel:584245550199"]);
  assert.deepEqual(clavesDelPagador({ telefono: "", titular: "PEDRO ANTONIO  GÓMEZ RIVAS" }), ["nombre:pedro antonio gomez rivas"]);
  assert.deepEqual(clavesDelPagador({ telefono: "", titular: "CARLOS" }), [], "un nombre solo no basta");
});

test("un cliente con un nombre parecido al del banco se propone", () => {
  assert.equal(nombreParecido("PEDRO ANTONIO GOMEZ RIVAS", ["Pedro Gómez"]), true);
  assert.equal(nombreParecido("PEDRO ANTONIO GOMEZ RIVAS", ["", "Pedro Gómez Rivas"]), true);
  assert.equal(nombreParecido("PEDRO ANTONIO GOMEZ RIVAS", ["Pedro"]), false, "una palabra sola no basta");
  assert.equal(nombreParecido("PEDRO ANTONIO GOMEZ RIVAS", ["Pedro Pérez"]), false);
  assert.equal(nombreParecido("PANADERIA TUTTO PAN CA", ["Panadería Tutto Pan"]), true, "«panadería» no cuenta, pero «tutto» y «pan» sí");
  assert.equal(nombreParecido("PANADERIA LA ESPIGA CA", ["Panadería Tutto Pan"]), false);
});

test("el monto cuadra con lo que debe o con una nota", () => {
  assert.equal(montoCuadra(248.5, [248.52]), true);
  assert.equal(montoCuadra(250, [248.52]), true, "un 1 % de margen por la tasa");
  assert.equal(montoCuadra(260, [248.52]), false);
  assert.equal(montoCuadra(10, [0, -5]), false);
});

test("el día del encabezado de la notificación: hoy, ayer, el día de la semana pasada o la fecha", () => {
  // El sábado 14/11/2026.
  const hoy = "2026-11-14";
  assert.deepEqual(fechaDelEncabezado("PagomovilBDV recibido 8:30", hoy), { fecha: "2026-11-14", hora: "08:30" });
  assert.deepEqual(fechaDelEncabezado("… PagomóvilBDV recibido ayer, 18:25", hoy), { fecha: "2026-11-13", hora: "18:25" });
  assert.deepEqual(fechaDelEncabezado("Transferencia BDV recibida mié, 20:45", hoy), { fecha: "2026-11-11", hora: "20:45" });
  assert.deepEqual(fechaDelEncabezado("PagomóvilBDV recibido jue, 13:33", hoy), { fecha: "2026-11-12", hora: "13:33" });
  // El mismo día de la semana que hoy es la semana pasada (el de hoy sale solo con la hora).
  assert.deepEqual(fechaDelEncabezado("PagomóvilBDV recibido sáb, 09:10", hoy), { fecha: "2026-11-07", hora: "09:10" });
  assert.deepEqual(fechaDelEncabezado("PagomóvilBDV recibido 9/11", hoy), { fecha: "2026-11-09", hora: null });
  // Sin encabezado, nada.
  assert.equal(fechaDelEncabezado("Ajustes Calculadora Contactos", hoy), null);
});

test("una captura con varios avisos: cada uno con el día de su notificación", () => {
  const captura =
    "19:10 Transferencia BDV recibida mié, 20:45 \"Recibiste una transferencia BDV de PEDRO ANTONIO GOMEZ RIVAS por Bs.70.686,22 bajo el numero de operacion 008000123554\" " +
    "PagomóvilBDV recibido mié, 19:21 Recibiste un PagomovilBDV por Bs.17.852,03 del 0424-5550199 Ref: 012345678094 en fecha 11-11-26 hora: 19:20.";
  const avisos = separarAvisos(captura, "2026-11-14");
  assert.equal(avisos.length, 2);
  assert.deepEqual(avisos[0].encabezado, { fecha: "2026-11-11", hora: "20:45" });
  assert.match(avisos[0].aviso, /^Recibiste una transferencia/);
  assert.deepEqual(avisos[1].encabezado, { fecha: "2026-11-11", hora: "19:21" });
  // El aviso pegado sin encabezado sigue valiendo.
  assert.deepEqual(separarAvisos("Recibiste un PagomovilBDV por Bs.10,00 del 0424-5550199 Ref: 1234", "2026-11-14")[0].encabezado, null);
});

test("en una captura, lo que no lleva delante el encabezado del BDV no se abona solo (un WhatsApp que lo imite)", () => {
  const real = "Recibiste un PagomovilBDV por Bs.1.000,00 del 0424-5550199 Ref: 012345678094 en fecha 14-11-26 hora: 08:30.";
  // Una captura con una notificación del BDV y, debajo, un mensaje de WhatsApp que copia el aviso.
  const captura = `19:10 PagomóvilBDV recibido 8:30 ${real} WhatsApp Juan: ${real.replace("1.000,00", "9.000,00")}`;
  const avisos = separarAvisos(captura, "2026-11-14");
  assert.equal(avisos.length, 2);
  assert.equal(avisos[0].confiable, true);
  assert.equal(avisos[1].confiable, false);
  // El aviso que manda solo el teléfono (MacroDroid con su título, o el SMS) sí.
  assert.equal(separarAvisos(`BDVapp ${real}`, "2026-11-14")[0].confiable, true);
  assert.equal(separarAvisos(`PagomóvilBDV recibido ${real}`, "2026-11-14")[0].confiable, true);
  assert.equal(separarAvisos(real, "2026-11-14")[0].confiable, true);
  // Una captura con solo el mensaje falso, tampoco.
  assert.equal(separarAvisos(`WhatsApp Juan: ${real}`, "2026-11-14")[0].confiable, false);
  assert.equal(vieneDelBanco("… Transferencia BDV recibida mié, 20:45 \""), true);
});
