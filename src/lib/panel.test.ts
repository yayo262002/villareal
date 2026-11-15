import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Revisión de seguridad del 14/11/2026: el layout del panel no basta para protegerlo (una petición hecha a mano puede
// pedir una página sin pasar por él). Cada pantalla tiene que comprobar la sesión por su cuenta, y su generateMetadata
// también, que puede leer datos (el nombre de un cliente).
const RAIZ = path.join(process.cwd(), "src/app/admin/(panel)");

function paginas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? paginas(p) : e.name === "page.tsx" ? [p] : [];
  });
}

test("cada pantalla del panel comprueba la sesión al principio (y su generateMetadata)", () => {
  const sinComprobar: string[] = [];
  for (const archivo of paginas(RAIZ)) {
    const texto = fs.readFileSync(archivo, "utf8");
    const necesarias = 1 + (texto.includes("export async function generateMetadata") ? 1 : 0);
    const tiene = (texto.match(/await exigirPanel\(\);/g) ?? []).length;
    if (tiene < necesarias) sinComprobar.push(path.relative(RAIZ, archivo));
  }
  assert.deepEqual(sinComprobar, [], "Estas pantallas no llaman a exigirPanel() al principio");
  assert.ok(paginas(RAIZ).length > 40);
});
