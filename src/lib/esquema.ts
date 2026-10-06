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
    -- Cuántos días tiene para pagar cada nota. Pasados, lo pendiente está vencido.
    dias_credito integer not null default 7,
    -- El nombre legal del negocio, para la nota; el nombre es cómo se le llama.
    razon_social text not null default '',
    -- Dónde lo puso el mapa, si la dirección no dice calle y carrera.
    lat real,
    lon real,
    sitio text not null default '',
    -- El enlace personal con el que el cliente ve su cuenta sin clave. Null hasta que se crea.
    enlace text,
    creado_en text not null default (datetime('now'))
  );

  -- A quién le compra el negocio (el que le vende los quesos) y cuánto le
  -- debe: cada compra suma y cada pago que se le hace resta, como con los
  -- clientes pero al revés. Los días de crédito son los que da el proveedor.
  create table if not exists proveedores (
    id integer primary key autoincrement,
    nombre text not null,
    telefono text not null default '',
    cedula_rif text not null default '',
    direccion text not null default '',
    nota text not null default '',
    dias_credito integer not null default 7,
    -- El enlace personal con el que el proveedor ve nuestra cuenta con él. Null hasta que se crea.
    enlace text,
    creado_en text not null default (datetime('now'))
  );

  -- Lo que se le compró a un proveedor: el total en dólares y, en
  -- compra_lineas (más abajo), los kilos de cada producto, con los que entra
  -- el inventario. Lo que no es un producto va en la descripción.
  create table if not exists compras (
    id integer primary key autoincrement,
    proveedor_id integer not null references proveedores(id),
    fecha text not null,
    descripcion text not null default '',
    total_usd real not null,
    nota text not null default '',
    tasa real,
    creado_en text not null default (datetime('now'))
  );

  -- Los pagos que el negocio le hace a un proveedor. Misma forma que pagos.
  create table if not exists pagos_proveedores (
    id integer primary key autoincrement,
    proveedor_id integer not null references proveedores(id),
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

  -- Cada producto tiene su precio de venta al mayor en dólares, que sale del
  -- costo más el margen; la web lo muestra en bolívares con la tasa del día
  -- (tabla ajustes). Las columnas «mayor» quedaron de cuando había dos
  -- precios (detal y mayor): ya no se usan. El precio al detal de ahora,
  -- opcional, va en precio_detal_usd.
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
    -- El catálogo: su familia principal (las otras, en producto_categorias),
    -- si es un borrador sin publicar, su marca, su presentación («Bolsa») y
    -- su contenido («2,5 kg»), el precio al detal si lo hay, y si se destaca
    -- en la portada o sale en ofertas.
    familia_id integer references familias(id),
    borrador integer not null default 0,
    marca text not null default '',
    presentacion text not null default '',
    contenido text not null default '',
    precio_detal_usd real,
    destacado integer not null default 0,
    en_oferta integer not null default 0,
    creado_en text not null default (datetime('now')),
    -- La marca, si se vende de una sola sin separarla (marca repite su nombre),
    -- y la sección en que sale dentro de su familia («Proteínas» en Burger).
    marca_id integer references marcas(id),
    seccion text not null default ''
  );

  -- Las marcas: Guaralact, Kemmental, El Legado… Una marca puede vender
  -- varios tipos de producto (suero y crema de leche). Se crean desde el
  -- panel al escribirlas por primera vez.
  create table if not exists marcas (
    id integer primary key autoincrement,
    nombre text not null collate nocase unique,
    creado_en text not null default (datetime('now'))
  );

  -- Los artículos de un tipo de producto: cada marca y presentación en que
  -- se vende (queso amarillo Kemmental y El Legado; pecorino Sortilegio y
  -- Guaralac en bolsa de 500 g). Cada uno con su marca, su presentación, su
  -- contenido, su costo, su precio y su foto. El nombre es el que dicen las
  -- notas («Sortilegio 500 g») y sale de lo demás al guardar. La web publica
  -- «desde» el más barato y la página del tipo los enseña todos.
  create table if not exists variantes (
    id integer primary key autoincrement,
    producto_id integer not null references productos(id),
    nombre text not null,
    descripcion text not null default '',
    costo_usd real,
    precio_usd real,
    precio_mayor_usd real,
    activo integer not null default 1,
    creado_en text not null default (datetime('now')),
    marca_id integer references marcas(id),
    presentacion text not null default '',
    contenido text not null default ''
  );

  create table if not exists fotos_variantes (
    variante_id integer primary key references variantes(id) on delete cascade,
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    actualizado_en text not null default (datetime('now'))
  );

  -- Las familias del catálogo (Burger, Pizzería, Quesos…). Cada producto
  -- tiene una principal (productos.familia_id) y puede salir también en
  -- otras (producto_categorias), sin repetirse en la base. El slug es el de
  -- su dirección, /categoria/burger, y no cambia aunque cambie el nombre.
  create table if not exists familias (
    id integer primary key autoincrement,
    nombre text not null,
    slug text not null unique,
    descripcion text not null default '',
    icono text not null default '',
    orden integer not null default 0,
    activa integer not null default 1,
    -- 1: una colección por tipo de negocio (Burger, Pizzería), que junta productos de varias familias; 0: una familia de productos (Quesos).
    coleccion integer not null default 0,
    creado_en text not null default (datetime('now'))
  );

  -- La foto de portada de una familia: la de su tarjeta en la web.
  create table if not exists fotos_familias (
    familia_id integer primary key references familias(id) on delete cascade,
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    actualizado_en text not null default (datetime('now'))
  );

  -- Las otras familias en que sale un producto, además de la principal, y la
  -- sección en que sale en cada una (vacía: la de su familia principal).
  create table if not exists producto_categorias (
    producto_id integer not null references productos(id),
    familia_id integer not null references familias(id),
    seccion text not null default '',
    primary key (producto_id, familia_id)
  );

  -- La foto principal de un producto: sale en su tarjeta y en su página en
  -- lugar de la foto de referencia.
  create table if not exists fotos_productos (
    producto_id integer primary key references productos(id) on delete cascade,
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    actualizado_en text not null default (datetime('now'))
  );

  -- Ofertas y combos: varios productos juntos, con su precio y su vigencia.
  -- Nacen en borrador y no salen en la web hasta que el dueño las activa.
  create table if not exists ofertas (
    id integer primary key autoincrement,
    nombre text not null,
    descripcion text not null default '',
    precio_usd real,
    desde text,
    hasta text,
    estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'inactiva')),
    orden integer not null default 0,
    creado_en text not null default (datetime('now'))
  );

  -- Lo que lleva cada oferta, con cuánto de cada producto («2 kg»).
  create table if not exists oferta_productos (
    oferta_id integer not null references ofertas(id),
    producto_id integer not null references productos(id),
    cantidad text not null default '',
    primary key (oferta_id, producto_id)
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
    -- El día en que hay que llevarla, si quedó por entregar; el resumen lo recuerda.
    entrega_prevista text,
    creado_en text not null default (datetime('now'))
  );

  create table if not exists venta_lineas (
    id integer primary key autoincrement,
    venta_id integer not null references ventas(id) on delete cascade,
    producto_id integer not null references productos(id),
    cantidad real not null,
    precio_unitario_usd real not null,
    subtotal_usd real not null,
    -- Cuántas piezas (bloques de queso) eran. Solo informa: el importe sale de los kilos.
    piezas integer,
    -- Qué marca o presentación se vendió, si el producto las tiene.
    variante_id integer references variantes(id)
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
    -- La captura de un pago va unida a su abono.
    pago_id integer references pagos(id) on delete set null,
    descripcion text not null default '',
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    creado_en text not null default (datetime('now'))
  );

  -- La foto de la nota firmada mientras el formulario de la venta va y
  -- vuelve con avisos: se guarda al llegar y pasa a adjuntos al guardar la
  -- venta. En «lectura» va lo que el lector leyó de ella, para no leerla dos veces.
  create table if not exists fotos_en_espera (
    id integer primary key autoincrement,
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    lectura text,
    creado_en text not null default (datetime('now'))
  );

  -- Reseñas: lo que dicen de cada producto los negocios que lo compran. Las
  -- escribe el dueño con las palabras del cliente y con su permiso: sin
  -- permiso anotado no salen en la web. Las de ejemplo sirven para ver cómo
  -- queda la página y nunca se enseñan al público.
  create table if not exists resenas (
    id integer primary key autoincrement,
    producto_id integer not null references productos(id),
    -- La marca de la que habla, si el producto tiene varias: cada marca tiene sus reseñas.
    variante_id integer references variantes(id),
    autor text not null,
    detalle text not null default '',
    texto text not null,
    de_ejemplo integer not null default 0,
    con_permiso integer not null default 0,
    publicada integer not null default 1,
    creado_en text not null default (datetime('now'))
  );

  -- La foto que acompaña a una reseña (el local, el dueño del negocio, el
  -- plato): pequeña, como la de un comentario en una red social. Aparte de
  -- la tabla de reseñas para no cargar el blob cada vez que se listan.
  create table if not exists fotos_resenas (
    resena_id integer primary key references resenas(id) on delete cascade,
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    actualizado_en text not null default (datetime('now'))
  );

  -- Copias automáticas: cada noche se guarda aquí una copia completa de las
  -- tablas de arriba (un archivo SQLite en un blob). No entra en TABLAS,
  -- así una copia nunca contiene a las anteriores.
  -- La tasa que hubo cada día (bolívares por dólar): del BCV, escrita a mano,
  -- o la de un abono o una nota de ese día. Para registrar cosas atrasadas
  -- con la tasa que había.
  create table if not exists tasas (
    fecha text primary key,
    valor real not null,
    origen text not null default 'manual',
    actualizada_en text not null default (datetime('now'))
  );

  -- El Excel de cada día, que la tarea diaria guarda sola cada mañana.
  create table if not exists exportaciones (
    fecha text primary key,
    csv text not null,
    movimientos integer not null default 0,
    tamano integer not null default 0,
    creado_en text not null default (datetime('now'))
  );

  create table if not exists copias_automaticas (
    id integer primary key autoincrement,
    creado_en text not null default (datetime('now')),
    tamano integer not null,
    datos blob not null
  );

  -- Las líneas de una compra: qué producto (y marca), cuántas piezas y
  -- kilos o cartones, y a qué costo. Con ellas entra el inventario. Una
  -- compra puede no tener líneas (solo «otras cosas», en la descripción).
  create table if not exists compra_lineas (
    id integer primary key autoincrement,
    compra_id integer not null references compras(id),
    producto_id integer not null references productos(id),
    variante_id integer references variantes(id),
    piezas integer,
    cantidad real not null,
    costo_unitario_usd real not null,
    subtotal_usd real not null
  );

  -- Lo que corrige el inventario sin compra ni venta: un recuento (lo
  -- contado menos lo que decía el sistema), una merma o una entrada suelta.
  -- La cantidad suma, o resta si es negativa.
  create table if not exists inventario_ajustes (
    id integer primary key autoincrement,
    fecha text not null,
    producto_id integer not null references productos(id),
    variante_id integer references variantes(id),
    cantidad real not null,
    motivo text not null default '',
    creado_en text not null default (datetime('now'))
  );

  -- Cuándo se le recordó la deuda a cada cliente (al abrir el recordatorio
  -- de WhatsApp desde el panel), con el saldo que tenía.
  create table if not exists recordatorios (
    id integer primary key autoincrement,
    cliente_id integer not null references clientes(id),
    fecha text not null,
    saldo_usd real not null,
    creado_en text not null default (datetime('now'))
  );

  -- La captura del pago a un proveedor, unida a ese pago. Es el espejo de
  -- adjuntos, que va unida al cliente.
  create table if not exists adjuntos_proveedores (
    id integer primary key autoincrement,
    proveedor_id integer not null references proveedores(id),
    pago_proveedor_id integer references pagos_proveedores(id) on delete set null,
    descripcion text not null default '',
    tipo text not null,
    tamano integer not null,
    datos blob not null,
    creado_en text not null default (datetime('now'))
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
  create index if not exists compras_proveedor on compras(proveedor_id);
  create index if not exists pagos_proveedores_proveedor on pagos_proveedores(proveedor_id);
  create index if not exists compra_lineas_compra on compra_lineas(compra_id);
  create index if not exists recordatorios_cliente on recordatorios(cliente_id);
  create index if not exists adjuntos_proveedores_proveedor on adjuntos_proveedores(proveedor_id);
  create index if not exists producto_categorias_familia on producto_categorias(familia_id);
  create index if not exists oferta_productos_producto on oferta_productos(producto_id);
`;

/** Las tablas en orden de dependencias, para copiar o restaurar en orden. */
export const TABLAS = [
  "clientes",
  "marcas",
  "familias",
  "fotos_familias",
  "productos",
  "variantes",
  "fotos_variantes",
  "fotos_productos",
  "producto_categorias",
  "ventas",
  "venta_lineas",
  "pagos",
  "adjuntos",
  "ajustes",
  "resenas",
  "fotos_resenas",
  "proveedores",
  "compras",
  "compra_lineas",
  "pagos_proveedores",
  "adjuntos_proveedores",
  "exportaciones",
  "tasas",
  "inventario_ajustes",
  "recordatorios",
  "ofertas",
  "oferta_productos",
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
export const PRODUCTOS_INICIALES: { nombre: string; unidad: string; descripcion: string; descripcionAnterior?: string }[] = [
  {
    nombre: "Queso amarillo",
    unidad: "kg",
    descripcion: "Para sándwiches, arepas y hamburguesas\nFunde bien al calentar\nSe vende por kilo, al mayor",
    descripcionAnterior: "Para sándwiches, arepas y hamburguesas\nFunde bien al calentar\nSe vende por kilo, al detal y al mayor",
  },
  {
    nombre: "Mozzarella",
    unidad: "kg",
    descripcion:
      "Perfecta para rallar\nGratina dorado y no se quema\nAl rebanar no se desborona\nPerfecta para pizza\nMuy buen gusto",
  },
  {
    nombre: "Huevos",
    unidad: "carton",
    descripcion: "Se venden por cartón\nPara panaderías, restaurantes y bodegas\nSolo al mayor",
    descripcionAnterior: "Se venden por cartón\nPara negocios y para la casa\nAl detal y al mayor",
  },
  {
    nombre: "Pecorino",
    unidad: "kg",
    descripcion: "Ya viene rallado, listo para usar\nPara pastas, pizzas y ensaladas\nSabor intenso",
  },
];

/**
 * Productos que cambiaron de nombre. La siembra busca por nombre, así que
 * sin esto un producto renombrado aquí se crearía otra vez. El texto viejo
 * solo se sustituye si el dueño no lo ha tocado. Los nombres de los tipos
 * van sin la palabra «queso» delante (el dueño los pidió así, 05/10/2026):
 * «Mozzarella», «Pecorino», «Parmesano»; la familia ya dice que son quesos.
 */
export const RENOMBRES: { de: string; a: string; descripcionVieja: string; descripcionNueva: string }[] = [
  {
    de: "Queso pecorino",
    a: "Pecorino",
    descripcionVieja:
      "Queso curado de sabor intenso\nPara rallar sobre pastas y ensaladas\nSe vende por kilo, al detal y al mayor",
    descripcionNueva: "Ya viene rallado, listo para usar\nPara pastas, pizzas y ensaladas\nSabor intenso",
  },
  {
    de: "Queso pecorino rallado",
    a: "Pecorino",
    descripcionVieja: "Ya viene rallado, listo para usar\nPara pastas, pizzas y ensaladas\nSabor intenso",
    descripcionNueva: "Ya viene rallado, listo para usar\nPara pastas, pizzas y ensaladas\nSabor intenso",
  },
  {
    de: "Queso mozzarella",
    a: "Mozzarella",
    descripcionVieja: "Perfecta para rallar\nGratina dorado y no se quema\nAl rebanar no se desborona\nPerfecta para pizza\nMuy buen gusto",
    descripcionNueva: "Perfecta para rallar\nGratina dorado y no se quema\nAl rebanar no se desborona\nPerfecta para pizza\nMuy buen gusto",
  },
  { de: "Queso parmesano", a: "Parmesano", descripcionVieja: "", descripcionNueva: "" },
];
