import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

/**
 * SQLite con el módulo integrado de Node 24: no hay que instalar nada ni
 * crear cuentas en ningún servicio. El archivo vive en `datos/` y está
 * fuera de Git. Si el día de mañana la web se aloja fuera del local,
 * cambiar a Turso o Postgres solo toca este archivo.
 */

const RUTA_DB =
  process.env.RUTA_BASE_DATOS ?? path.join(process.cwd(), "datos", "villareal.db");

const ESQUEMA = `
  create table if not exists clientes (
    id integer primary key autoincrement,
    nombre text not null,
    telefono text not null default '',
    cedula_rif text not null default '',
    direccion text not null default '',
    tipo text not null default 'detal' check (tipo in ('detal', 'mayor')),
    nota text not null default '',
    creado_en text not null default (datetime('now'))
  );

  create table if not exists productos (
    id integer primary key autoincrement,
    nombre text not null,
    unidad text not null default 'kg' check (unidad in ('kg', 'unidad')),
    precio_usd real,
    activo integer not null default 1,
    creado_en text not null default (datetime('now'))
  );

  create table if not exists ventas (
    id integer primary key autoincrement,
    cliente_id integer not null references clientes(id),
    fecha text not null,
    total_usd real not null,
    nota text not null default '',
    creado_en text not null default (datetime('now'))
  );

  create table if not exists venta_lineas (
    id integer primary key autoincrement,
    venta_id integer not null references ventas(id) on delete cascade,
    producto_id integer not null references productos(id),
    cantidad real not null,
    precio_unitario_usd real not null,
    subtotal_usd real not null
  );

  create table if not exists pagos (
    id integer primary key autoincrement,
    cliente_id integer not null references clientes(id),
    fecha text not null,
    metodo text not null check (metodo in (
      'pago_movil', 'transferencia', 'efectivo_bs', 'efectivo_usd',
      'zelle', 'binance', 'otro'
    )),
    moneda text not null check (moneda in ('USD', 'VES')),
    monto real not null,
    tasa real,
    monto_usd real not null,
    referencia text not null default '',
    nota text not null default '',
    creado_en text not null default (datetime('now'))
  );

  create index if not exists ventas_cliente on ventas(cliente_id);
  create index if not exists pagos_cliente on pagos(cliente_id);
`;

// Los dos quesos con los que abre el local. Sin precio: el precio real lo
// pone el dueño desde el panel, nunca lo inventa el código.
const PRODUCTOS_INICIALES = [
  { nombre: "Queso amarillo", unidad: "kg" },
  { nombre: "Queso mozzarella", unidad: "kg" },
];

function abrir(): DatabaseSync {
  fs.mkdirSync(path.dirname(RUTA_DB), { recursive: true });
  const db = new DatabaseSync(RUTA_DB);
  db.exec("pragma journal_mode = wal");
  db.exec("pragma foreign_keys = on");
  db.exec(ESQUEMA);

  const hayProductos = db.prepare("select count(*) as n from productos").get() as { n: number };
  if (hayProductos.n === 0) {
    const insertar = db.prepare("insert into productos (nombre, unidad) values (?, ?)");
    for (const p of PRODUCTOS_INICIALES) insertar.run(p.nombre, p.unidad);
  }
  return db;
}

// En desarrollo Next recarga los módulos a cada cambio; guardar la conexión
// en globalThis evita abrir decenas de conexiones al mismo archivo.
const global = globalThis as unknown as { __dbVillareal?: DatabaseSync };

export function db(): DatabaseSync {
  if (!global.__dbVillareal) global.__dbVillareal = abrir();
  return global.__dbVillareal;
}
