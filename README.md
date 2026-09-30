# Comercializadora Villareal

Web y sistema de gestión para un local de quesos en Barquisimeto, Venezuela:
queso amarillo, mozzarella, pecorino rallado, huevos y lo que se vaya
añadiendo. Vende al detal y al mayor.

Tiene dos partes:

- **La web pública** (`/`): qué se vende, precios si están puestos, lo que
  dicen del producto los negocios que lo compran, y cómo contactar. Pensada
  para el teléfono.
- **El panel** (`/admin`): la cartera de clientes, con alta rápida por
  teléfono y dirección; las ventas, cada una con su nota de entrega para
  imprimir o mandar; los abonos en dólares o en bolívares con la tasa del
  día, con su recibo por WhatsApp; las cuentas por pagar y pagadas y el
  estado de cuenta de cada cliente; los pedidos por entregar y la ruta de
  despacho, que los ordena desde la tienda y dice qué cargar; la foto de
  cada nota en papel, las reseñas de cada producto, los proveedores (a
  quién se le debe y los pagos que se les hacen), los días de crédito de
  unos y otros, y un informe de cuánto se vende, de qué y a quién.

## Arrancar

```
npm install
npm run dev
```

Abre http://localhost:3000. El panel está en http://localhost:3000/admin y
pide la clave que está en `.env.local` (`ADMIN_CLAVE`). Cámbiala.

No hace falta instalar ninguna base de datos: es SQLite en un archivo que se
crea solo en `datos/villareal.db` la primera vez. Ese archivo **es el negocio
entero**, fotos incluidas: haz copia de él (ver más abajo).

## Comprobar

```
npm run verificar    typecheck + lint + pruebas unitarias
npm run build        que compila
npm run prueba:local   la web entera con una base temporal (después de build)
npm run prueba:web     la web publicada; crea un cliente de prueba y lo borra
```

## Copias de seguridad

```
npm run copia
```

Guarda `copias/villareal-AAAA-MM-DD-HHMM.db` (un SQLite completo, fotos
incluidas, salga del archivo local o de Turso) y borra las más viejas pasando
de 30. Si quieres que las copias vayan a una carpeta que se sincronice con
la nube, pon `CARPETA_COPIAS=` en `.env.local`.

Para que salga sola cada día a las 8 de la noche, en PowerShell (una vez,
desde la carpeta del proyecto):

```
schtasks /create /tn "Copia Villareal" /sc daily /st 20:00 /tr "cmd /c cd /d $PWD && npm run copia"
```

Desde el teléfono: en el Resumen del panel hay un botón «Descargar copia de
ahora» que baja el mismo archivo.

**Copias automáticas.** En Vercel, cada mañana a las 10:00 UTC (las 6 en
Venezuela) se llama a `/api/tarea-diaria` (cron en `vercel.json`), que trae
la tasa del BCV y guarda una copia completa en la tabla
`copias_automaticas` de la propia base. Se conservan las 14 últimas y se
descargan desde el Resumen. La llamada del cron lleva la variable
`CRON_SECRET`; el botón «Guardar copia en la nube» hace la copia a mano. Estas copias protegen de borrar algo por error, no de
perder la cuenta de Turso: por eso conviene bajar el archivo de vez en cuando.

Para restaurar en local, para el servidor y sustituye `datos/villareal.db`
por la copia (borra también `villareal.db-wal` y `villareal.db-shm` si
existen). Para restaurar en Turso, vuelca la copia con `sqlite3 copia.db
.dump` y cárgala con `turso db shell`.

## Publicar en Vercel

La web se puede alojar gratis en Vercel, pero allí no hay disco: la base de
datos tiene que vivir en Turso, que es el mismo SQLite en la nube y también
tiene plan gratuito. Solo hay que poner dos variables; el código no cambia.

1. Crea una cuenta en https://turso.tech, una base de datos (por ejemplo
   `villareal`) y copia su URL (`libsql://...`) y un token.
2. Sube este repositorio a GitHub y crea el proyecto en https://vercel.com
   importándolo. Vercel detecta Next solo.
3. En Vercel, Settings → Environment Variables, añade:
   - `ADMIN_CLAVE`: la clave del panel.
   - `TURSO_DATABASE_URL`: la URL de Turso.
   - `TURSO_AUTH_TOKEN`: el token de Turso.
   - `CRON_SECRET`: un texto largo al azar, para la copia automática.
4. Despliega. La primera visita crea las tablas y los productos iniciales
   (queso amarillo, mozzarella, pecorino y huevos) sin precio.

Para pasar lo que ya tengas en el archivo local a Turso, instala la CLI de
Turso y ejecuta `turso db shell villareal < copia.sql`, donde `copia.sql`
sale de `sqlite3 datos/villareal.db .dump`. Si prefieres empezar de cero en
la nube, no hace falta nada.

Con las mismas dos variables en `.env.local`, `npm run dev` y `npm run copia`
trabajan contra Turso desde tu ordenador.

## Dónde está cada cosa

```
src/config/negocio.ts     Nombre, WhatsApp, dirección, RIF. Lo que falta está vacío, no inventado
src/styles/tokens.css     Colores y medidas. Nada de colores sueltos en los componentes
src/lib/db.ts             Conexión a la base (archivo local o Turso) y consultas
src/lib/esquema.ts        Las tablas (se crean solas)
src/lib/conexion.ts       Dónde está la base, según el entorno
src/lib/clientes.ts       Clientes y su saldo
src/lib/ventas.ts         Ventas con sus líneas de producto
src/lib/pagos.ts          Pagos: método, moneda, tasa, equivalente en USD
src/lib/ajustes.ts        La tasa del día y los demás ajustes
src/lib/tasa.ts           Cuándo se acepta una tasa que llega de fuera
src/lib/tasa-oficial.ts   Trae la tasa del BCV
src/lib/intentos.ts       Freno a quien pruebe claves en la entrada del panel
src/lib/dibujos.ts        El dibujo de cada producto, en SVG
src/lib/imagen-social.tsx La imagen que sale al compartir un enlace
src/assets/fuentes/       Las fuentes de esas imágenes, con su licencia
src/lib/cuentas.ts        Qué ventas están pagadas y cuáles por pagar
src/lib/credito.ts        Los días de crédito: cuándo vence una nota y cuánto está vencido
src/lib/vencimientos.ts   Cada cliente y cada proveedor con lo que tiene vencido
src/lib/proveedores.ts    Proveedores, sus compras y los pagos que se les hacen
src/lib/caja.ts           El cierre del día: vendido, entrado por método y salido
src/lib/exportar.ts       Lo que se descarga para Excel: movimientos y resumen por día
src/lib/direcciones.ts    Lee una dirección y la sitúa en la cuadrícula
src/lib/ruta.ts           El orden en que conviene visitar a los clientes
src/lib/despacho.ts       Junta las dos cosas: el plan de un despacho
src/lib/entregas.ts       Pedidos por entregar: qué lleva cada cliente y qué cargar
src/lib/adjuntos.ts       Fotos de las notas de entrega
src/lib/whatsapp.ts       Mensajes para WhatsApp: cobro, nota, recibo, en camino, pedir reseña
src/lib/copias-nube.ts    Copias automáticas guardadas en la base
src/app/api/tarea-diaria/ Lo que Vercel hace solo cada mañana: tasa y copia
src/app/api/copia-automatica/  Solo la copia, para lanzarla aparte
src/lib/dinero.ts         Conversión y formato de dólares y bolívares
src/lib/acciones.ts       Lo que hacen los formularios del panel
src/lib/copias.ts         Copias de seguridad de la base de datos
scripts/copia.ts          npm run copia
scripts/prueba-extremo.mjs  La prueba de extremo a extremo, en local o contra la web
src/lib/sesion.ts         La clave del panel y la cookie
src/proxy.ts              Corta el paso a /admin sin sesión
src/app/page.tsx          La portada de la web pública
src/app/producto/         La página de cada producto
src/components/publico.tsx  Cabecera, pie y cajas de precio de la web pública
src/components/ilustracion-producto.tsx  El dibujo de un producto dentro de la página
src/app/opengraph-image.tsx  La vista previa de la portada al compartirla
src/app/robots.ts, sitemap.ts, manifest.ts  Lo que leen los buscadores y el teléfono
src/app/not-found.tsx, error.tsx  Página no encontrada y página de fallo
src/lib/enlaces.ts        La dirección de la página de cada producto
src/lib/resenas.ts        Las reseñas de cada producto, en la base
src/lib/resenas-texto.ts  Deja limpia una reseña escrita; las reseñas de ejemplo
src/components/resenas.tsx  Las reseñas, como se ven en la página del producto
src/app/foto-resena/      Sirve la foto de una reseña a la web
src/components/entrada-foto.tsx  Reduce la foto en el teléfono antes de subirla
src/components/nav-panel.tsx     El menú del panel, con la sección abierta marcada
src/app/admin/            El panel
datos/                    La base de datos (fuera de Git)
```

## Cómo funcionan las cuentas

- Cada producto tiene un **costo en dólares** (lo que paga el negocio) y
  **dos márgenes** en porcentaje, al detal y al mayor. De ahí salen los dos
  precios de venta en dólares: costo 6,80 con margen 25 % vende al detal a
  8,50, y con margen 10 % al mayor a 7,48. Si se prefiere, cada precio se
  escribe directamente. Un producto puede no tener precio al mayor.
- **A quién se le cobra cuál.** El cliente está marcado como «detal» o
  «mayor». Al anotar una venta con el precio vacío, al mayorista se le
  cobra el precio al mayor y a los demás el de detal. Escribir el precio a
  mano siempre manda.
- La web publica los precios en **bolívares** con la **tasa del día**. Al
  cambiar la tasa cambian todos los precios en bolívares a la vez. Sin
  tasa, la web muestra dólares.
- **La tasa se trae sola del BCV** cada mañana, antes de abrir. El BCV no
  la ofrece en un formato para programas: se lee de DolarApi
  (`ve.dolarapi.com`), que la copia de la página del banco. Nada de lo
  que llega se da por bueno sin revisar: si no es un número, o si se aleja
  más de un 15 % por día de la tasa vigente, se deja la que había y el
  panel lo avisa. En Productos el dueño puede escribir la tasa a mano,
  traer la del BCV en el momento, o apagar la actualización automática.
- Cada producto lleva sus **ventajas** (una por línea) y tiene su **propia
  página** en la web, `/producto/2-queso-mozzarella`: dibujo grande,
  precios, ventajas, cómo se paga y dónde está la tienda. En la portada
  cada tarjeta enseña el dibujo, el nombre y los precios, con dos botones:
  «Ver detalles», que lleva a esa página, y «Pedir», que abre WhatsApp.
- **Reseñas.** En la página de cada producto, «Por qué elegirlo» enseña
  primero lo que dicen los negocios que lo compran y después las ventajas.
  En la portada, cada tarjeta lleva además la reseña más corta de ese
  producto (hasta 120 letras), con el nombre de quien la dijo.
  El dueño le pide el comentario al cliente y lo escribe en el panel, en
  Reseñas, con las palabras del cliente: producto, quién lo dice, qué
  negocio es y qué dijo. Una reseña se puede esconder sin borrarla.
  - **El permiso del cliente.** La reseña sale con el nombre del negocio,
    así que hace falta su permiso. Al guardarla se marca «Me dio permiso
    para publicarla con su nombre» y sale en el momento. Sin marcar se
    guarda escondida, y cuando el cliente lo da se pulsa «Ya me dio
    permiso: publicar». Sin permiso anotado una reseña no sale en la web.
  - **Pedir la reseña.** En Reseñas, cada producto tiene «Pedir reseña por
    WhatsApp»: abre WhatsApp con el mensaje escrito, que pregunta por el
    producto y pide el permiso, y deja elegir a quién mandarlo. En la
    ficha de un cliente, «Pedirle una reseña» lo manda directo a él, por
    cada producto que ha comprado.
  - **La foto.** Una reseña puede llevar una foto pequeña (el local, el
    dueño del negocio, el plato) que sale redonda junto al nombre, como en
    un comentario de una red social; sin foto van las iniciales. Se pone
    al escribir la reseña o después, desde su tarjeta en el panel, y el
    teléfono la reduce antes de subirla. La web la sirve en
    `/foto-resena/[id]` solo mientras la reseña se vea.
  - **Reseñas de ejemplo.** El botón «Poner reseñas de ejemplo» carga unas
    de muestra para ver cómo queda la página. No las dijo nadie, así que
    **solo las ve el dueño**, con la sesión del panel abierta, marcadas
    «Ejemplo». Al público no se le enseñan nunca: una opinión inventada no
    se publica como si fuera de un cliente. Es la regla de «no inventar».
  - Las reseñas no van en los datos para buscadores: Google no acepta las
    que un negocio recoge sobre sí mismo.
- El **dibujo** de cada producto se elige por su nombre (queso, mozzarella,
  rallado, curado, huevos) en `src/lib/dibujos.ts`. Un producto que no
  encaje lleva un dibujo genérico.
- **Precios de ejemplo.** Si en `ajustes` está la clave
  `precios_de_ejemplo`, el panel avisa en rojo arriba de Productos de que
  los precios publicados no son los del dueño. Se quita con el botón «Ya
  puse mis precios».
- Las cuentas internas siguen en **dólares**.
- Cada venta suma al saldo del cliente. Cada pago resta.
- **Días de crédito.** Cada cliente tiene los suyos (7 si no se dice otra
  cosa; se cambian en su ficha). Una nota vence a esos días de su fecha:
  si pasado el plazo queda algo por pagar de ella, está **vencida**. El
  Resumen, Clientes y Cuentas dicen cuánto está vencido y desde cuándo
  («Vencida hace 3 días»), y quien tiene el plazo vencido va primero.
  Lo mismo vale para lo que el negocio le debe a cada proveedor, con los
  días que da el proveedor (`src/lib/credito.ts`).
- Los mensajes de WhatsApp (recordatorio y nota) dicen el monto en dólares y,
  si hay tasa del día, también en bolívares. El recordatorio dice de cada
  nota si venció y desde cuándo, o cuándo vence; la nota va con su número
  y con la fecha límite de pago.
- **Cierre del día** (`/admin/caja`, desde el Resumen o desde Abonos): lo
  que se vendió, lo que entró por cada método en su moneda (para contar
  la caja en bolívares y en dólares aparte) y lo que salió a proveedores,
  con las notas, abonos y pagos de ese día. Se elige cualquier día y se
  imprime. El Resumen enseña arriba las tres cifras de hoy.
- **Descargar para Excel** (en Cierre del día, y desde el Informe): todos
  los movimientos entre dos fechas (ventas, abonos, compras y pagos a
  proveedores), una fila por movimiento con cada monto en su columna, o
  un resumen con una fila por día. Es un CSV con punto y coma y coma
  decimal, que es lo que abre bien Excel en castellano
  (`src/lib/exportar.ts`).
- El **Informe** suma por mes, junto a lo vendido y cobrado, lo comprado y
  lo pagado a proveedores, y lo que entró neto (cobrado menos pagado).
- Un pago en bolívares se guarda con la **tasa del día** que se escribió al
  registrarlo, y se convierte a dólares en ese momento. Si la tasa cambia
  mañana, el pago de hoy no se mueve.
- El saldo del cliente es lo comprado menos lo pagado, en dólares.
- Una venta o un pago mal anotado se **borra** desde la ficha del cliente
  (enlace «Eliminar», con pantalla de confirmación) y se registra de nuevo.
  No hay edición: es más fácil de entender y más difícil de equivocarse.
- **Cuentas por pagar y pagadas.** Los pagos van contra el cliente, no
  contra una venta. Para decir qué notas están pagadas, los pagos se aplican
  a las ventas de la más antigua a la más nueva: una venta está «Pagada» si
  los pagos ya la cubren, «Abonada» si la cubren en parte y «Por pagar» si
  no. Lo pendiente de todas suma el saldo del cliente.
- **Notas de entrega.** Por ahora no se factura. La nota en papel se
  fotografía desde la ficha del cliente y queda guardada en la base, unida
  al cliente y, si se elige, a la venta. El teléfono reduce la foto antes de
  subirla para que pese poco.
- **WhatsApp al cliente.** En la ficha de quien debe hay «Recordar deuda por
  WhatsApp», que abre WhatsApp con el mensaje escrito (saldo y notas
  pendientes); en cada nota, «Enviar nota» manda el detalle de esa venta.
  Solo aparecen si el cliente tiene un teléfono venezolano completo. El
  mensaje se revisa y se envía desde el teléfono del dueño; la web no envía
  nada sola.
- **Lista de clientes para publicidad.** En Clientes, «Descargar lista
  (Excel)» baja un CSV con nombre, teléfono, tipo, cuánto compra y cuándo
  compró por última vez.

Métodos de pago que reconoce: pago móvil, transferencia, efectivo en
bolívares (los tres piden tasa), efectivo en dólares, Zelle, Binance y otro.

## Cartera, notas y despacho

- **Alta rápida.** En Clientes basta el teléfono y la dirección. El nombre
  es opcional: quien no lo tiene lleva el teléfono como nombre. El teléfono
  se guarda siempre escrito igual (`0412-1234567`) y no se puede registrar
  dos veces, se escriba como se escriba. Tras guardar se vuelve al mismo
  formulario, para registrar el siguiente.
- **Borrar un cliente.** Desde su ficha, «Eliminar cliente» lleva a una
  pantalla que dice qué se lleva (notas, abonos, fotos y la deuda) y pide
  la **clave del panel** otra vez, porque no tiene vuelta atrás. Las
  claves malas cuentan como las de la entrada: cinco seguidas y hay que
  esperar. Lo mismo para borrar un proveedor.
- **Abonos.** Lo que el cliente paga, sea todo o una parte. Se anotan desde
  su ficha o desde Abonos y se aplican a sus notas más antiguas primero.
  En la ficha, cada abono tiene «Enviar recibo»: abre WhatsApp con lo que
  se recibió (en bolívares, con su tasa) y cómo queda la cuenta hoy.
- **Estado de cuenta.** En la ficha del cliente, «Estado de cuenta»
  (`/admin/clientes/7/estado`): cada compra y cada abono en su orden, con
  el saldo que deja cada uno (`movimientosDeCuenta` en `src/lib/cuentas.ts`).
  Se imprime o se guarda como PDF. En el teléfono cada movimiento es una
  ficha; en papel, una fila con sus columnas.
- **Nota de entrega.** Cada venta tiene la suya, numerada con el número de
  la venta (`/admin/ventas/12/nota`): datos del negocio y del cliente, lo
  entregado, el total en dólares y en bolívares a la tasa del día de la
  venta, lo abonado y lo que queda. Se imprime, se guarda como PDF o se
  manda por WhatsApp. **No es una factura fiscal** y lo dice: una factura
  legal en Venezuela necesita un formato autorizado por el SENIAT.
- **Pedidos por entregar.** Al anotar una venta se elige la entrega: «Ya
  entregada» (se la lleva del local, lo normal) o «Por entregar». Las que
  quedan por entregar salen en Despacho con su ruta, con lo que lleva cada
  cliente y con la suma de lo que hay que cargar (`src/lib/entregas.ts`).
  En cada parada, «Entregado» la quita de la lista; desde la nota se puede
  devolver al despacho si se marcó por error. «Avisar» abre WhatsApp con
  «vamos en camino» y el pedido. Las ventas anteriores a este cambio
  cuentan como entregadas.
- **Ruta de despacho.** El centro de Barquisimeto es una cuadrícula de
  calles y carreras numeradas. De cada dirección se lee el número de la
  calle y el de la carrera (`src/lib/direcciones.ts`) y con eso se cuenta
  a cuántas cuadras está un cliente de otro. La ruta sale de la tienda,
  pasa por los clientes elegidos y vuelve, andando lo menos posible
  (`src/lib/ruta.ts`); a igualdad de cuadras, primero el más cercano.
  - Entiende «Calle 38 entre carreras 30 y 31», «Carrera 19 con calle 25»,
    «Cra 21 esq 33», «Av. 20 con calle 28» (la avenida 20 es la carrera 20).
  - Lo que no entiende no lo adivina: una urbanización, un barrio o una
    dirección sin calle o sin carrera quedan «fuera de la ruta», con el
    motivo, para que el dueño la complete.
  - No sabe del sentido de las calles ni del tráfico. Para eso la ruta se
    abre en Google Maps con las paradas ya ordenadas, en tramos de nueve.
  - La ruta se hace con los pedidos por entregar, con todos los clientes,
    con los que deben o con los que se elijan. La selección viaja en la
    dirección de la página, así una ruta se puede guardar o mandar a quien
    reparte.
- **El formulario de venta** tiene seis filas de producto: dos a la vista y
  cuatro más en «Más productos». Son fijas porque no lleva JavaScript.

## Proveedores

- En Proveedores se registra a quien le vende al negocio (el de los quesos,
  el de los huevos): nombre, teléfono y los **días de crédito que da**.
- Desde su ficha se anota cada **compra** (fecha, qué se compró y el total
  en dólares) y cada **pago** que se le hace, con los mismos métodos y la
  misma tasa que los abonos de los clientes. Lo que se le debe es lo
  comprado menos lo pagado; los pagos se aplican a las compras más
  antiguas primero, igual que con los clientes, y cada compra sale como
  pagada, abonada o por pagar, y vencida si pasó el plazo.
- El Resumen enseña «Debo a proveedores» y «A quién le debo», con el plazo.
- Una compra o un pago mal anotado se borra y se registra de nuevo. Borrar
  un proveedor pide la clave del panel.
- Las compras no tocan los productos ni sus costos: eso se sigue poniendo
  en Productos.

## La web hacia fuera

- **Al compartir un enlace** por WhatsApp sale una vista previa con imagen:
  la de la portada, o la del producto con su dibujo y su precio en dólares.
  El precio en bolívares no va en la imagen porque cambia cada día.
- **Para los buscadores**: descripción con la ciudad, datos de la tienda y
  de cada producto (JSON-LD), mapa del sitio y `robots.txt`. El panel y
  las tareas quedan fuera de los buscadores.
- **En el teléfono** la web se puede poner en la pantalla de inicio, con el
  león de icono. Manteniendo pulsado el icono sale el acceso al panel.
- La dirección de la web está en `src/config/negocio.ts` (`web`). Con un
  dominio propio se cambia ahí y cambian los enlaces, el mapa del sitio y
  las vistas previas.
- **Fechas.** En Vercel el servidor va en hora UTC. Las fechas que propone
  el panel y las que se enseñan son las de Venezuela (UTC−4), esté donde
  esté el servidor.

## Seguridad

- La entrada al panel frena a quien pruebe claves: con 5 fallos en 15
  minutos desde una dirección, esa dirección espera. Hay también un tope
  de 40 fallos para todas las direcciones juntas.
- Cabeceras de seguridad en todas las páginas (`next.config.ts`).
- Ninguna clave en el código ni en el repositorio, que es público.

## Reglas

- **No inventar.** Si el precio no está, la web dice «consulta el precio del
  día». Si el teléfono no está, la web no muestra ninguno.
- **Escribir en castellano.** Código, comentarios, mensajes y commits.
- **Móvil primero.** El dueño usa el panel desde el teléfono en el local.
- **Ninguna clave en el código.** Van en `.env.local`.

## Pendiente

- El comprobante de RIF que hay venció el 15/07/2019: conviene renovarlo en
  el SENIAT antes de imprimirlo en facturas o ponerlo en la web.
- Poner los precios reales del queso amarillo, los huevos y el pecorino
  rallado: los que hay son de ejemplo y el panel lo avisa. El de la
  mozzarella (7,70 USD el kilo) es real.
- Confirmar si el pecorino rallado se vende por kilo.
- Fotos reales de los productos: hoy llevan un dibujo.
- Las reseñas de verdad de cada producto: las que hay son de ejemplo y solo
  las ve el dueño.
- Registrar a los proveedores y lo que se les debe.
- Un dominio propio.
- Facturación fiscal, cuando el negocio empiece a facturar. Hoy hay notas
  de entrega, que no son facturas.
- Las avenidas con nombre (Venezuela, Vargas, Morán…) no están en la
  cuadrícula de la ruta: hay que escribir la calle y la carrera.
