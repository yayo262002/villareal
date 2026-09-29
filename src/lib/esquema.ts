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

  -- El precio de venta en dólares sale del costo más el margen del dueño; la
  -- web lo muestra en bolívares con la tasa del día (tabla ajustes).
  create table if not exists productos (
    id integer primary key autoincrement,
    nombre text not null,
    unidad text not null default 'kg' check (unidad in ('kg', 'unidad', 'carton')),
    costo_usd real,
    margen_pct real,
    precio_usd real,
    descripcion text not null default '',
    activo integer not null default 1,
    creado_en text not null default (datetime('now'))
  );

  -- Ajustes sueltos del negocio, como la tasa del día.
  create table if not exists ajustes (
    clave text primary key,
    valor text not null,
    actualizado_en text not null default (datetime('now'))
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

  -- Copias automáticas: cada noche se guarda aquí una copia completa de las
  -- tablas de arriba (un archivo SQLite en un blob). No entra en TABLAS,
  -- así una copia nunca contiene a las anteriores.
  create table if not exists copias_automaticas (
    id integer primary key autoincrement,
    creado_en text not null default (datetime('now')),
    tamano integer not null,
    datos blob not null
  );

  create index if not exists ventas_cliente on ventas(cliente_id);
  create index if not exists pagos_cliente on pagos(cliente_id);
  create index if not exists adjuntos_cliente on adjuntos(cliente_id);
`;

/** Las tablas en orden de dependencias, para copiar o restaurar en orden. */
export const TABLAS = ["clientes", "productos", "ventas", "venta_lineas", "pagos", "adjuntos", "ajustes"] as const;

/**
 * Cambio para bases creadas antes de que productos tuviera costo, margen y
 * descripción. SQLite no puede cambiar una columna ni un `check`, así que
 * la tabla se reconstruye. Lo aplica `migrar` en db.ts solo si hace falta.
 */
export const RECONSTRUIR_PRODUCTOS = `
  begin;
  create table productos_nueva (
    id integer primary key autoincrement,
    nombre text not null,
    unidad text not null default 'kg' check (unidad in ('kg', 'unidad', 'carton')),
    costo_usd real,
    margen_pct real,
    precio_usd real,
    descripcion text not null default '',
    activo integer not null default 1,
    creado_en text not null default (datetime('now'))
  );
  insert into productos_nueva (id, nombre, unidad, precio_usd, activo, creado_en)
    select id, nombre, unidad, precio_usd, activo, creado_en from productos;
  drop table productos;
  alter table productos_nueva rename to productos;
  commit;
`;

// Los productos con los que abre el local. Sin precio: el precio real lo
// pone el dueño desde el panel, nunca lo inventa el código. Se crean solo
// los que falten (por nombre), así se pueden añadir más aquí sin duplicar.
// La descripción de la mozzarella son palabras del dueño; una ventaja por línea.
export const PRODUCTOS_INICIALES: { nombre: string; unidad: string; descripcion: string }[] = [
  { nombre: "Queso amarillo", unidad: "kg", descripcion: "" },
  {
    nombre: "Queso mozzarella",
    unidad: "kg",
    descripcion: "Gratina muy bien\nPerfecta para pizza\nAl rebanar no se desborona\nMuy buen gusto",
  },
  { nombre: "Huevos", unidad: "carton", descripcion: "" },
];
