import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";
import { ESQUEMA } from "./esquema.ts";
import {
  copiarArchivo,
  esNombreDeCopia,
  exportarBaseDeDatos,
  listarCopias,
  nombreDeCopia,
  podarCopias,
} from "./copias.ts";

/**
 * En Windows libsql tarda en soltar el archivo tras cerrarlo; si no se
 * puede borrar la carpeta temporal se deja, que el sistema la limpia.
 */
function limpiar(carpeta: string): void {
  try {
    fs.rmSync(carpeta, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch {
    // Ver comentario de arriba.
  }
}

function carpetaTemporal(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "villareal-copias-"));
}

/** Una base con el esquema real, un cliente, una venta con línea, un pago y una foto. */
async function baseConDatos(ruta: string) {
  const db = createClient({ url: "file:" + ruta.replace(/\\/g, "/") });
  await db.execute("pragma journal_mode = wal");
  await db.executeMultiple(ESQUEMA);
  await db.execute("insert into clientes (id, nombre) values (7, 'Ana')");
  await db.execute("insert into productos (id, nombre, precio_usd) values (1, 'Queso', 6.5)");
  await db.execute("insert into ventas (id, cliente_id, fecha, total_usd) values (3, 7, '2026-09-28', 13)");
  await db.execute(
    "insert into venta_lineas (venta_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd) values (3, 1, 2, 6.5, 13)",
  );
  await db.execute(
    "insert into pagos (cliente_id, fecha, metodo, moneda, monto, tasa, monto_usd) values (7, '2026-09-28', 'pago_movil', 'VES', 360, 36, 10)",
  );
  await db.execute({
    sql: "insert into adjuntos (cliente_id, venta_id, tipo, tamano, datos) values (7, 3, 'image/png', 3, ?)",
    args: [new Uint8Array([1, 2, 3])],
  });
  return db;
}

function leerCopia(rutaCopia: string) {
  const copia = new DatabaseSync(rutaCopia, { readOnly: true });
  // node:sqlite devuelve objetos sin prototipo; se copian para poder compararlos.
  const todas = <T>(sql: string) => (copia.prepare(sql).all() as T[]).map((f) => ({ ...f }));
  const una = <T>(sql: string) => ({ ...(copia.prepare(sql).get() as T) });
  try {
    return {
      clientes: todas<{ id: number; nombre: string }>("select id, nombre from clientes"),
      lineas: todas<{ venta_id: number; cantidad: number }>("select venta_id, cantidad from venta_lineas"),
      pagos: todas<{ monto_usd: number; tasa: number }>("select monto_usd, tasa from pagos"),
      foto: una<{ datos: Uint8Array; tipo: string }>("select datos, tipo from adjuntos"),
      siguienteId: una<{ seq: number }>("select seq from sqlite_sequence where name = 'clientes'"),
    };
  } finally {
    copia.close();
  }
}

test("el nombre de la copia lleva fecha y hora y se ordena cronológicamente", () => {
  assert.equal(nombreDeCopia(new Date(2026, 8, 28, 9, 5)), "villareal-2026-09-28-0905.db");
  assert.equal(nombreDeCopia(new Date(2026, 11, 1, 23, 59)), "villareal-2026-12-01-2359.db");
  assert.ok(nombreDeCopia(new Date(2026, 0, 2, 0, 0)) > nombreDeCopia(new Date(2025, 11, 31, 23, 59)));
});

test("solo se reconocen como copias los archivos con ese nombre", () => {
  assert.equal(esNombreDeCopia("villareal-2026-09-28-0905.db"), true);
  assert.equal(esNombreDeCopia("villareal.db"), false);
  assert.equal(esNombreDeCopia("villareal-2026-09-28-0905.db-wal"), false);
  assert.equal(esNombreDeCopia("notas.txt"), false);
});

test("la copia lleva todas las tablas, las fotos y los contadores de id", async () => {
  const carpeta = carpetaTemporal();
  const origen = await baseConDatos(path.join(carpeta, "villareal.db"));
  try {
    const destino = await exportarBaseDeDatos(origen, path.join(carpeta, "copias", "una.db"));
    const copia = leerCopia(destino);
    assert.deepEqual(copia.clientes, [{ id: 7, nombre: "Ana" }]);
    assert.deepEqual(copia.lineas, [{ venta_id: 3, cantidad: 2 }]);
    assert.deepEqual(copia.pagos, [{ monto_usd: 10, tasa: 36 }]);
    assert.equal(copia.foto.tipo, "image/png");
    assert.deepEqual(Array.from(copia.foto.datos), [1, 2, 3]);
    // El siguiente cliente que se cree en la copia restaurada no pisa el id 7.
    assert.equal(copia.siguienteId.seq, 7);
  } finally {
    origen.close();
    limpiar(carpeta);
  }
});

test("copiar desde la ruta del archivo abre, exporta y cierra", async () => {
  const carpeta = carpetaTemporal();
  const rutaOrigen = path.join(carpeta, "villareal.db");
  (await baseConDatos(rutaOrigen)).close();
  try {
    const destino = await copiarArchivo(rutaOrigen, path.join(carpeta, "copia.db"));
    assert.equal(leerCopia(destino).clientes.length, 1);
    await assert.rejects(
      copiarArchivo(path.join(carpeta, "no-existe.db"), path.join(carpeta, "x.db")),
      /No existe/,
    );
  } finally {
    limpiar(carpeta);
  }
});

test("podar deja las copias más nuevas y no toca otros archivos", () => {
  const carpeta = carpetaTemporal();
  try {
    for (const nombre of [
      "villareal-2026-09-01-1000.db",
      "villareal-2026-09-03-1000.db",
      "villareal-2026-09-02-1000.db",
      "villareal-2026-09-04-1000.db",
      "notas.txt",
    ]) {
      fs.writeFileSync(path.join(carpeta, nombre), "");
    }

    const borradas = podarCopias(carpeta, 2).map((r) => path.basename(r));
    assert.deepEqual(borradas, ["villareal-2026-09-01-1000.db", "villareal-2026-09-02-1000.db"]);
    assert.deepEqual(
      listarCopias(carpeta).map((r) => path.basename(r)),
      ["villareal-2026-09-03-1000.db", "villareal-2026-09-04-1000.db"],
    );
    assert.ok(fs.existsSync(path.join(carpeta, "notas.txt")));

    assert.deepEqual(podarCopias(carpeta, 10), []);
    assert.throws(() => podarCopias(carpeta, 0), /al menos una/);
  } finally {
    limpiar(carpeta);
  }
});

test("podar una carpeta que no existe no falla", () => {
  assert.deepEqual(podarCopias(path.join(os.tmpdir(), "villareal-no-existe"), 5), []);
});
