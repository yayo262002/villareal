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

  -- Cada producto tiene dos precios de venta en dólares, al detal y al mayor.
  -- Cada uno sale del costo más su margen; la web los muestra en bolívares
  -- con la tasa del día (tabla ajustes).
  create table if not exists productos (
    id integer primary key autoincrement,
    nombre text not null,
    unidad text not null default 'kg' check (unidad in ('kg', 'unidad', 'carton')),
    costo_usd real,
    margen_pct real,
    precio_usd real,
    margen_mayor_pct real,
    precio_mayor_usd real,
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
    -- La tasa del día al anotar la venta, para que la nota de entrega diga
    -- los bolívares de ese día y no los de hoy. Vacía en las ventas viejas.
    tasa real,
    -- Una venta que se lleva al cliente queda por entregar hasta que se marca
    -- entregada; con ellas se arma el despacho. La que se despacha en el
    -- mostrador nace entregada.
    por_entregar integer not null default 0,
    entregada_en text,
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

  -- Reseñas: lo que dicen de cada producto los negocios que lo compran. Las
  -- escribe el dueño con las palabras del cliente y con su permiso: sin
  -- permiso anotado no salen en la web. Las de ejemplo sirven para ver cómo
  -- queda la página y nunca se enseñan al público.
  create table if not exists resenas (
    id integer primary key autoincrement,
    producto_id integer not null references productos(id),
    autor text not null,
    detalle text not null default '',
    texto text not null,
    de_ejemplo integer not null default 0,
    con_permiso integer not null default 0,
    publicada integer not null default 1,
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

  -- Intentos fallidos de entrar al panel, para frenar a quien pruebe
  -- claves. No entra en las copias: no es parte del negocio.
  create table if not exists entradas_fallidas (
    id integer primary key autoincrement,
    direccion text not null,
    momento text not null default (datetime('now'))
  );

  create index if not exists entradas_fallidas_momento on entradas_fallidas(momento);
  create index if not exists ventas_cliente on ventas(cliente_id);
  create index if not exists pagos_cliente on pagos(cliente_id);
  create index if not exists adjuntos_cliente on adjuntos(cliente_id);
  create index if not exists resenas_producto on resenas(producto_id);
`;

/** Las tablas en orden de dependencias, para copiar o restaurar en orden. */
export const TABLAS = [
  "clientes",
  "productos",
  "ventas",
  "venta_lineas",
  "pagos",
  "adjuntos",
  "ajustes",
  "resenas",
] as const;

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
    margen_mayor_pct real,
    precio_mayor_usd real,
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
// La descripción de la mozzarella son palabras del dueño; una ventaja por
// línea. Las de los demás describen para qué se usa el producto, sin
// prometer nada que no se sepa. Solo se ponen si el producto no tiene ninguna.
export const PRODUCTOS_INICIALES: { nombre: string; unidad: string; descripcion: string }[] = [
  {
    nombre: "Queso amarillo",
    unidad: "kg",
    descripcion: "Para sándwiches, arepas y hamburguesas\nFunde bien al calentar\nSe vende por kilo, al detal y al mayor",
  },
  {
    nombre: "Queso mozzarella",
    unidad: "kg",
    descripcion:
      "Perfecta para rallar\nGratina dorado y no se quema\nAl rebanar no se desborona\nPerfecta para pizza\nMuy buen gusto",
  },
  {
    nombre: "Huevos",
    unidad: "carton",
    descripcion: "Se venden por cartón\nPara negocios y para la casa\nAl detal y al mayor",
  },
  {
    nombre: "Queso pecorino rallado",
    unidad: "kg",
    descripcion: "Ya viene rallado, listo para usar\nPara pastas, pizzas y ensaladas\nSabor intenso",
  },
];

/**
 * Productos que cambiaron de nombre. La siembra busca por nombre, así que
 * sin esto un producto renombrado aquí se crearía otra vez. El texto viejo
 * solo se sustituye si el dueño no lo ha tocado.
 */
export const RENOMBRES: { de: string; a: string; descripcionVieja: string; descripcionNueva: string }[] = [
  {
    de: "Queso pecorino",
    a: "Queso pecorino rallado",
    descripcionVieja:
      "Queso curado de sabor intenso\nPara rallar sobre pastas y ensaladas\nSe vende por kilo, al detal y al mayor",
    descripcionNueva: "Ya viene rallado, listo para usar\nPara pastas, pizzas y ensaladas\nSabor intenso",
  },
];
