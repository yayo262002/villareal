import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { miniatura, portadaMediana } from "./portadas.ts";

test("la miniatura de una foto incluida está en public/miniaturas; la subida en el panel va tal cual", () => {
  assert.equal(miniatura("/familias/quesos.webp"), "/miniaturas/familias/quesos.webp");
  assert.equal(miniatura("/productos/refrescos.webp"), "/miniaturas/productos/refrescos.webp");
  assert.equal(miniatura("/foto-familia/3?v=20261003"), "/foto-familia/3?v=20261003");
});

test("cada foto de public/familias y public/productos tiene su miniatura (si falta: npm run miniaturas)", () => {
  const publico = path.join(process.cwd(), "public");
  const faltan = ["familias", "productos"].flatMap((carpeta) =>
    fs
      .readdirSync(path.join(publico, carpeta))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => `/${carpeta}/${f}`)
      .filter((src) => !fs.existsSync(path.join(publico, miniatura(src)))),
  );
  assert.deepEqual(faltan, []);
});

test("cada portada de familia tiene su versión de 480 px; una subida en el panel, no", () => {
  assert.equal(portadaMediana("/familias/quesos.webp"), "/miniaturas/familias-480/quesos.webp");
  assert.equal(portadaMediana("/foto-familia/3?v=1"), null);
  const publico = path.join(process.cwd(), "public");
  const faltan = fs
    .readdirSync(path.join(publico, "familias"))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => portadaMediana(`/familias/${f}`) ?? "")
    .filter((src) => !fs.existsSync(path.join(publico, src)));
  assert.deepEqual(faltan, []);
});
