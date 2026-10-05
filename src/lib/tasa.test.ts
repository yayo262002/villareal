import { test } from "node:test";
import assert from "node:assert/strict";
import { esFinDeSemana, esLaDelLunes, leerTasaDelBcv, lunesDespuesDe, redondearTasa, revisarTasa, sabadoDe } from "./tasa.ts";

test("la tasa se guarda con cuatro decimales, como la publica el BCV", () => {
  assert.equal(redondearTasa(857.88764), 857.8876);
  assert.equal(redondearTasa(36.5), 36.5);
});

test("sin tasa anterior se acepta cualquier número válido", () => {
  assert.deepEqual(revisarTasa(null, 857.8876), { aceptada: true, valor: 857.8876 });
  assert.deepEqual(revisarTasa(null, "857,8876"), { aceptada: true, valor: 857.8876 });
});

test("lo que no es un número mayor que cero se rechaza", () => {
  for (const malo of [null, undefined, "", "abc", 0, -5, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
    assert.equal(revisarTasa(850, malo).aceptada, false, String(malo));
  }
});

test("un cambio normal de un día para otro se acepta", () => {
  assert.deepEqual(revisarTasa(850, 857.8876), { aceptada: true, valor: 857.8876 });
  assert.deepEqual(revisarTasa(850, 845), { aceptada: true, valor: 845 });
});

test("un salto demasiado grande se rechaza y dice por qué", () => {
  const revision = revisarTasa(36.5, 857.8876);
  assert.equal(revision.aceptada, false);
  assert.match(revision.aceptada ? "" : revision.motivo, /cambia un \d+ %/);
  assert.equal(revisarTasa(850, 85).aceptada, false);
});

test("si la tasa vigente lleva días sin tocarse, el margen crece", () => {
  // Un 40 % en un día es sospechoso; tras tres días sin actualizar, no.
  assert.equal(revisarTasa(100, 140, 1).aceptada, false);
  assert.equal(revisarTasa(100, 140, 3).aceptada, true);
});

test("el sábado y el domingo son fin de semana; el lunes que les sigue, aunque cambie el año", () => {
  assert.equal(esFinDeSemana("2026-10-03"), true);
  assert.equal(esFinDeSemana("2026-10-04"), true);
  assert.equal(esFinDeSemana("2026-10-02"), false);
  assert.equal(esFinDeSemana("2026-10-05"), false);
  assert.equal(lunesDespuesDe("2026-10-03"), "2026-10-05");
  assert.equal(lunesDespuesDe("2026-10-04"), "2026-10-05");
  assert.equal(lunesDespuesDe("2027-01-02"), "2027-01-04");
  assert.equal(sabadoDe("2026-10-04"), "2026-10-03");
  assert.equal(sabadoDe("2026-10-03"), "2026-10-03");
});

// Así viene la tasa en la página del BCV (recortada).
const PAGINA_DEL_BCV = `
<div id="euro" class="col-sm-12 col-xs-12 "><div class="field-content"><div class="row recuadrotsmc">
<div class="col-sm-6 col-xs-6 centrado textp"> <strong class="strong-tb">1.012,45610000</strong>  </div></div></div></div>
<div id="dolar" class="col-sm-12 col-xs-12 ">
<div class="field-content"><div class="row recuadrotsmc"><div class="col-sm-6 col-xs-6">
<img src="/sites/default/files/dollar-04_2.png" class="icono_bss_blanco1"> <span> USD</span> </div>
<div class="col-sm-6 col-xs-6 centrado textp"> <strong class="strong-tb">871,36890000</strong>  </div>
</div></div></div>
<div class="pull-right dinpro center">
Fecha Valor: <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-10-05T00:00:00-04:00">Lunes, 05 Octubre  2026</span>
</div>`;

test("de la página del BCV sale el dólar (no el euro) y su fecha valor; si no está, nada", () => {
  assert.deepEqual(leerTasaDelBcv(PAGINA_DEL_BCV), { valor: 871.3689, fechaValor: "2026-10-05" });
  assert.deepEqual(leerTasaDelBcv(PAGINA_DEL_BCV.replace("871,36890000", "1.234,56780000")), { valor: 1234.5678, fechaValor: "2026-10-05" });
  assert.equal(leerTasaDelBcv(PAGINA_DEL_BCV.replace('id="dolar"', 'id="otra"')), null);
  assert.equal(leerTasaDelBcv(PAGINA_DEL_BCV.replace("871,36890000", "0,00000000")), null);
  assert.equal(leerTasaDelBcv("<html>Servicio no disponible</html>"), null);
});

test("el fin de semana vale la del lunes (o la del martes si el lunes es feriado), no la del viernes", () => {
  assert.equal(esLaDelLunes("2026-10-05", "2026-10-03"), true);
  assert.equal(esLaDelLunes("2026-10-05", "2026-10-04"), true);
  assert.equal(esLaDelLunes("2026-10-06", "2026-10-03"), true);
  assert.equal(esLaDelLunes("2026-10-02", "2026-10-03"), false);
  assert.equal(esLaDelLunes("2026-10-09", "2026-10-03"), false);
  // Entre semana no aplica.
  assert.equal(esLaDelLunes("2026-10-06", "2026-10-05"), false);
});
