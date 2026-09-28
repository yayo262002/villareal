/**
 * El esquema de la base de datos, en un archivo sin `server-only` porque
 * también lo usa el script de copias fuera de Next. Todo es SQLite normal:
 * vale para el archivo local y para Turso.
 */

export const ESQUEMA = `
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

  -- Fotos de las notas de entrega de cada cliente. Van dentro de la base
  -- para que la copia de seguridad se lleve todo y para que funcione igual
  -- en un servidor propio que en Vercel, donde no hay disco.
  create table if not exists adjuntos (
    id integer primary key autoincrement,
    cliente_id integer not null references clientes(id),
    venta_id integer references ventas(id) on delete set null,
    descripcion text not null default '',
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    creado_en text not null default (datetime('now'))
  );

  create index if not exists ventas_cliente on ventas(cliente_id);
  create index if not exists pagos_cliente on pagos(cliente_id);
  create index if not exists adjuntos_cliente on adjuntos(cliente_id);
`;

/** Las tablas en orden de dependencias, para copiar o restaurar en orden. */
export const TABLAS = ["clientes", "productos", "ventas", "venta_lineas", "pagos", "adjuntos"] as const;

// Los dos quesos con los que abre el local. Sin precio: el precio real lo
// pone el dueño desde el panel, nunca lo inventa el código.
export const PRODUCTOS_INICIALES = [
  { nombre: "Queso amarillo", unidad: "kg" },
  { nombre: "Queso mozzarella", unidad: "kg" },
];
