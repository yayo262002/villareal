import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheDeFoto } from "./cache-de-fotos.ts";

const version = "2026-10-06 03:31:37";

test("con la versión de hoy en la dirección, el teléfono la guarda un año y Vercel un día", () => {
  assert.equal(cacheDeFoto("https://x.app/foto-producto/2?v=20261006033137", version, true), "public, max-age=31536000, s-maxage=86400, immutable");
});

test("sin versión, o con una vieja, un día", () => {
  assert.equal(cacheDeFoto("https://x.app/foto-producto/2", version, true), "public, max-age=86400, s-maxage=86400");
  assert.equal(cacheDeFoto("https://x.app/foto-producto/2?v=20250101000000", version, true), "public, max-age=86400, s-maxage=86400");
  assert.equal(cacheDeFoto("https://x.app/foto-producto/2?v=", null, true), "public, max-age=86400, s-maxage=86400");
});

test("escondida, no se guarda en ningún sitio", () => {
  assert.equal(cacheDeFoto("https://x.app/foto-producto/2?v=20261006033137", version, false), "private, no-store");
});
