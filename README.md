# Comercializadora Villareal

Web y sistema de gestión para un local de quesos en Barquisimeto, Venezuela:
queso amarillo, mozzarella, pecorino rallado, huevos y lo que se vaya
añadiendo. Vende solo al mayor: a pizzerías, panaderías, restaurantes y
bodegas.

Tiene dos partes:

- **La web pública** (`/`): qué se vende, precios si están puestos, lo que
  dicen del producto los negocios que lo compran, y cómo contactar. Pensada
  para el teléfono.
- **El panel** (`/admin`): la cartera de clientes, con alta rápida por
  teléfono y dirección; las ventas, cada una con su nota de entrega para
  imprimir o mandar; los abonos en dólares o en bolívares con la tasa del
  día, con su recibo por WhatsApp; lo que le deben, nota a nota, los
  recordatorios de cobro y el estado de cuenta de cada cliente; el
  inventario, que entra con las compras y sale con las ventas; los pedidos
  por entregar y la ruta de
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
npm run prueba:web     la web publicada, solo mirando: no crea ni borra nada
```

La web publicada tiene los datos de verdad del negocio. Por eso
`prueba:web` solo abre las pantallas, baja las descargas y abre la copia
de seguridad: nada que escriba. Crear una venta de prueba allí gastaría un
número de nota, y guardar una copia empujaría fuera una de las de cada
noche. Todo lo que escribe se prueba en local.

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
la tasa del BCV, guarda una copia completa en la tabla
`copias_automaticas` de la propia base y guarda el Excel de los movimientos
del día anterior (tabla `exportaciones`). Se conservan las 14 últimas
copias y se descargan desde el Resumen; los Excel, desde Estadísticas. La llamada del cron lleva la variable
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
   - `ANTHROPIC_API_KEY` (opcional): para que la foto de cada nota se lea
     sola. Se crea en https://console.anthropic.com y se paga por uso.
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
src/lib/variantes.ts      Las marcas o presentaciones de un producto, con su foto
src/lib/catalogo.ts       Qué precio publica un producto con marcas («desde») y las filas de la venta
src/app/foto-variante/    Sirve la foto de una marca a la web
src/lib/dibujos.ts        El dibujo de cada producto, en SVG
src/lib/imagen-social.tsx La imagen que sale al compartir un enlace
src/assets/fuentes/       Las fuentes de esas imágenes, con su licencia
src/lib/cuentas.ts        Qué ventas están pagadas y cuáles por pagar
src/lib/credito.ts        Los días de crédito: cuándo vence una nota y cuánto está vencido
src/lib/vencimientos.ts   Cada cliente y cada proveedor con lo que tiene vencido
src/lib/proveedores.ts    Proveedores, sus compras (con sus líneas de producto) y los pagos que se les hacen
src/lib/stock.ts          El inventario: lo comprado menos lo vendido, más los ajustes; cuánto dura
src/lib/piezas.ts         Lo que suele pesar una pieza, aprendido de las notas
src/lib/inventario.ts     Las existencias desde la base, y los recuentos y mermas
src/lib/recordatorios.ts  Cuándo se le recordó la deuda a cada cliente
src/components/fila-de-producto.tsx  La fila de un producto en la venta y en la compra
src/lib/caja.ts           El cierre del día: vendido, entrado por método y salido
src/lib/movimientos.ts    Todo lo que se movió entre dos fechas (lo usan la web y el guion de copias)
src/lib/estadisticas.ts   Lo que se saca de los movimientos: por producto, por cliente, por método, por día
src/lib/exportaciones.ts  El Excel de cada día, guardado solo por la tarea diaria
src/lib/exportaciones-locales.ts  Los Excel que deja npm run copia en el ordenador
src/lib/cuenta-cliente.ts Lo que un cliente ve de su cuenta con su enlace
src/lib/cuenta-proveedor.ts  Lo que un proveedor ve de nuestra cuenta con él, con su enlace
src/components/cuenta.tsx El marco, las pestañas y las tarjetas de la cuenta del cliente
src/lib/exportar.ts       Lo que se descarga para Excel: movimientos y resumen por día
src/lib/buscar.ts         Buscar sin tildes ni mayúsculas; una nota por su número
src/lib/direcciones.ts    Lee una dirección y la sitúa en la cuadrícula
src/lib/ruta.ts           El orden en que conviene visitar a los clientes
src/lib/despacho.ts       Junta las dos cosas: el plan de un despacho; sitúa a cada cliente
src/lib/plano.ts          La cuadrícula del centro puesta sobre el mapa de verdad
src/lib/mapa.ts           Pregunta al mapa libre por una dirección sin calle y carrera
src/lib/entregas.ts       Pedidos por entregar: qué lleva cada cliente y qué cargar
src/lib/adjuntos.ts       Fotos de las notas de entrega y capturas de los pagos (de clientes y a proveedores)
src/lib/fotos-en-espera.ts  La foto de la nota mientras el formulario va y vuelve
src/lib/lector-de-notas.ts  Le enseña la foto de la nota a Claude: fecha, líneas, total, firma
src/lib/nota-leida.ts     Interpreta lo leído y dice en qué no cuadra con lo anotado
src/lib/captura-leida.ts  Lo leído en la captura de un pago: rellena el abono o avisa si no cuadra
src/lib/whatsapp.ts       Mensajes para WhatsApp: cobro, nota, recibo, en camino, pedir reseña, el enlace de cuenta
src/lib/enlace-cuenta.ts  El enlace personal de cada cliente y cada proveedor: cómo se hace y adónde lleva
src/app/cuenta/           La cuenta de un cliente, para él, con su enlace y sin clave
src/app/proveedor/        La cuenta de un proveedor, para él, con su enlace y sin clave
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

- **Solo al mayor.** El negocio vende al mayor, así que cada producto
  tiene **un precio**, el de mayor. Sale del **costo en dólares** (lo que
  paga el negocio) más un **margen** en porcentaje: costo 6,80 con margen
  25 % vende a 8,50. Si se prefiere, el precio se escribe directamente. La
  web lo llama «Precio al mayor» y no habla de detal en ningún sitio. Las
  columnas del precio al detal de antes (`precio_mayor_usd`,
  `margen_mayor_pct`, `clientes.tipo`) siguen en la base pero no se usan.
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
- **Marcas y presentaciones.** Un producto puede venderse de varias marcas
  o en varios tamaños (queso amarillo Kemmental y El Legado; pecorino
  Sortilegio y Guaralac en bolsa de 500 g). En Productos, cada producto
  tiene «Marcas y presentaciones»: nombre, una línea para la web, costo y
  precios (con el costo salen de los márgenes del producto) y una foto,
  que el teléfono reduce antes de subir. La portada dice «desde» con el
  precio más barato de las publicadas y cuántas hay; la página del
  producto las enseña todas con su foto, su precio y su botón de pedir
  (`src/lib/catalogo.ts`). Con dos o más marcas, la tarjeta de la portada
  no lleva «Pedir» (sería pedir a ciegas): lleva «Ver las 2 opciones y
  pedir», que abre la lista de marcas, y el botón de pedir está en cada
  marca, con su precio, para que el mensaje de WhatsApp diga cuál es. Mientras haya alguna publicada, los precios del
  producto no se usan. En la venta sale una fila por cada marca, la nota la
  nombra («Queso pecorino rallado Sortilegio 500 g») y el despacho carga
  cada marca aparte. Una marca ya vendida no se borra, se esconde. La foto
  se sirve en `/foto-variante/[id]` solo mientras la marca y el producto
  estén publicados. Al guardarla se recorta el fondo liso que sobre, se
  centra el producto en un cuadrado de 800 px con un poco de aire y se
  guarda como JPEG (`src/lib/foto-producto.ts`): así todas las marcas se
  ven del mismo tamaño y el producto llena su foto. En la web se enseña sin
  su fondo blanco (se funde con el fondo de la página): conviene
  fotografiar los paquetes sobre fondo blanco o muy claro.
- **Reseñas.** En la página de cada producto, «Por qué elegirlo» enseña
  primero lo que dicen los negocios que lo compran y después las ventajas.
  Las reseñas solo se ven dentro de la página del producto: la portada no
  enseña ninguna.
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
- **Recordatorios de cobro.** Quien pasó su plazo y no ha recibido un
  recordatorio en la última semana sale arriba en el Resumen, en «Cobros
  para recordar». «Recordar» (ahí, en «Quién debe», en la ficha y en el
  estado de cuenta) abre WhatsApp con el mensaje escrito (saldo, notas
  pendientes y su enlace de cuenta) y deja anotado el día
  (`src/lib/recordatorios.ts`): el Resumen y la ficha dicen «Recordado el
  2/10» y no se insiste a quien se le acaba de escribir.
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
- **Estadísticas** (`/admin/estadisticas`): se elige un período (este mes,
  mes pasado, 30 o 90 días, este año, todo, o dos fechas) y de él se ve
  cuánto se vendió y cobró (con el ticket medio y los kilos), lo comprado y
  pagado a proveedores y lo que entró neto; por cobrar, vencido, deuda con
  proveedores y pedidos por entregar a hoy; la evolución día a día; por
  producto y marca; por cliente (lo comprado y lo abonado); cómo pagaron
  (por método y moneda); por día de la semana; por mes (todos los meses); y
  la lista de absolutamente todos los movimientos del período, cada uno con
  su enlace. Abajo, las descargas para Excel (`src/lib/estadisticas.ts`).
  El enlace viejo `/admin/informe` lleva aquí.
- **Exportación diaria.** Cada mañana a las 6 (hora de Venezuela), la tarea
  diaria de Vercel guarda en la base el Excel con los movimientos del día
  anterior (y rehace el de anteayer, por si se anotó algo tarde); se
  conservan 90 días y se bajan desde Estadísticas → «Exportaciones
  diarias» (`src/lib/exportaciones.ts`, `/admin/exportaciones/[fecha]`).
  Además, `npm run copia` (la tarea de las 8 de la noche en el ordenador
  del dueño) deja en `exportaciones/` el Excel de hoy, el de ayer y el de
  todo desde el principio (`movimientos-todo.csv`); esa carpeta está en
  OneDrive, así que quedan también en la nube.
- Un pago en bolívares se guarda con la **tasa del día** que se escribió al
  registrarlo, y se convierte a dólares en ese momento. Si la tasa cambia
  mañana, el pago de hoy no se mueve.
- **La tasa de cada día queda guardada** (tabla `tasas`: la del BCV de cada
  mañana, la escrita a mano, y la de los abonos y notas de antes). Al
  registrar un abono o una nota **de días atrás**, la tasa que se propone y
  se usa es **la que había ese día** (`tasaEnFecha` en `src/lib/ajustes.ts`:
  la guardada ese día; si no, la de un abono o nota de ese día; si no, la
  última anterior; si no, la vigente), y se puede cambiar. Con la tasa
  vacía en un abono en bolívares, se usa esa y el aviso lo dice.
- **El abono se pide en la moneda que toca.** Al elegir cómo pagó, el monto
  se pide en bolívares (pago móvil, transferencia, efectivo en Bs) o en
  dólares (los demás), la tasa solo aparece con bolívares, y debajo se ve
  el equivalente en la otra moneda y lo que debe el cliente
  (`src/components/abono-vivo.tsx`, el otro trozo de JavaScript del panel;
  sin él, el formulario funciona igual). Un monto en bolívares que no llega
  a un dólar (casi siempre un monto en dólares con el método equivocado)
  pide confirmar con «El monto es correcto». Un monto que no llega a un centavo
  de dólar (Bs 1, por ejemplo) se rechaza: casi siempre es un error al
  teclear.
- El saldo del cliente es lo comprado menos lo pagado, en dólares.
- Una venta o un pago mal anotado se **borra** desde la ficha del cliente
  (enlace «Eliminar», con pantalla de confirmación) y se registra de nuevo.
  No hay edición: es más fácil de entender y más difícil de equivocarse.
- **Lo que te deben** (`/admin/cuentas`). Los pagos van contra el cliente, no
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
  - **El comprobante del pago.** Al registrar un abono se elige cómo pagó
    el cliente (pago móvil, transferencia, efectivo en bolívares o en
    dólares, Zelle, Binance, otro). Con **pago móvil, transferencia, Zelle
    y Binance** la captura del comprobante es **obligatoria**: sin ella no
    se registra el abono y el panel dice «Falta adjuntar el comprobante de
    pago». En efectivo no hace falta. La captura queda guardada con el
    abono (enlace «Captura» en su fila; `adjuntos.pago_id`). Con la clave
    `ANTHROPIC_API_KEY`, la captura se **lee sola**: si el monto se deja
    vacío, el formulario vuelve relleno con el monto en bolívares, el
    método, la fecha y la referencia leídos, y dice el equivalente en
    dólares a la tasa del día, para revisar y guardar; si el monto se
    escribió, se comprueba contra la captura (monto, moneda, fecha) y lo
    que no cuadre vuelve como aviso con la casilla «Ya revisé la captura»
    (`src/lib/captura-leida.ts`). Nada se guarda sin que el dueño pulse.
    Sin la clave, la captura solo se guarda.
- **Estado de cuenta.** En la ficha del cliente, «Estado de cuenta»
  (`/admin/clientes/7/estado`): cada compra y cada abono en su orden, con
  el saldo que deja cada uno (`movimientosDeCuenta` en `src/lib/cuentas.ts`).
  Se imprime o se guarda como PDF. En el teléfono cada movimiento es una
  ficha; en papel, una fila con sus columnas.
- **El enlace de cuenta del cliente.** En su ficha, «Crear su enlace de
  cuenta» le da una dirección personal (`/cuenta/abcdefghjkmnpq`, catorce
  letras y números al azar, sin 0, o, 1, l ni i) que se le manda por
  WhatsApp. Con ella ve en su teléfono, sin clave, lo que tiene pendiente
  (en dólares y en bolívares a la tasa de hoy) y, en pestañas, **Resumen**
  (las notas por pagar, cada una con lo que llevaba, lo abonado en una
  barra, cuántos días lleva pendiente y su plazo; su último abono; botones
  para avisar un pago o pedir), **Notas** (todas, por pagar y pagadas, con
  su estado y el enlace a cada una: la nota entera con el total en dólares
  y en bolívares del día de la venta, lo abonado, lo que queda, la fecha
  límite y «Pedir lo mismo otra vez»), **Abonos** (cada uno con su recibo:
  monto, tasa, método, referencia, el comprobante que mandó y cómo quedó su
  cuenta) y **Movimientos** (el estado de cuenta). Solo lo suyo: una nota o
  un abono de otro cliente dan 404 (`src/lib/cuenta-cliente.ts`). Solo ve lo suyo. El recordatorio de deuda lleva el enlace.
  Si se compartió de más, «Renovar el enlace» pone otro y el anterior deja
  de funcionar. Los buscadores no la indexan (`robots.txt` y `noindex`).
- **Nota de entrega.** Cada venta tiene la suya, numerada con el número de
  la venta (`/admin/ventas/12/nota`): datos del negocio y del cliente, lo
  entregado, el total en dólares y en bolívares a la tasa del día de la
  venta, lo abonado y lo que queda. Se imprime, se guarda como PDF o se
  manda por WhatsApp. **No es una factura fiscal** y lo dice: una factura
  legal en Venezuela necesita un formato autorizado por el SENIAT.
- **La entrega se elige a mano** al anotar la venta: «Sí, ya la entregué»
  o «No, queda por entregar». No hay opción por defecto.
  - **Entregada** exige la **foto de la nota firmada** por el cliente (la
    hoja de papel). Se guarda como foto del cliente unida a esa venta,
    «Nota N.º 000012 firmada». Sin foto no se guarda la venta.
  - **La foto se lee y se coteja con el pedido.** Con la clave
    `ANTHROPIC_API_KEY` puesta, al guardar se le enseña la foto a Claude
    junto con la lista de productos y marcas (`src/lib/lector-de-notas.ts`)
    y se comprueba que sea una nota y no otra cosa, que su fecha sea la
    fecha de la nota, y **línea a línea** que lo anotado sea lo que dice
    la nota: qué producto (y qué marca), los kilos, las piezas, el precio y
    el importe. Lo que falte en la nota, lo que sobre o lo que no coincida
    vuelve como aviso con nombre («En la nota Queso mozzarella son 5 kg y
    anotaste 4 kg», «Anotaste 2 cartón de Huevos y en la nota no
    aparece»); también si las líneas no suman el total o falta la firma.
    Si todo cuadra, la venta se guarda sin preguntar nada. Con avisos, la
    casilla «Ya revisé la foto de la nota» permite guardar igual; nada se
    corrige solo (`src/lib/nota-leida.ts`). Lo mismo al marcar entregado
    un pedido desde el despacho o desde la nota. Sin la clave no se lee
    nada y todo sigue igual. Cada lectura cuesta una fracción de centavo.
  - **La foto no se pierde.** Al llegar se guarda en `fotos_en_espera`
    (`src/lib/fotos-en-espera.ts`); si el formulario vuelve con un aviso
    (un precio raro, la fecha de la nota), la trae por su número y no hay
    que repetirla. Al guardar la venta pasa a ser su adjunto; las que
    nadie reclama se limpian pasado un día.
  - **Por entregar** exige el **día previsto de entrega** (no anterior a
    la fecha de la nota; a más de un mes, pide confirmar). Si se marca «ya
    la entregué» y a la vez se pone un día previsto, no se guarda: una de
    las dos cosas está mal. Esas ventas salen en Despacho con su ruta, con
    lo que lleva cada cliente, la suma de lo que hay que cargar
    (`src/lib/entregas.ts`) y para cuándo es cada una; y el Resumen las
    recuerda arriba: «Entregas pendientes», con las de hoy y las
    atrasadas. En cada parada, «Entregado» pide también la foto de la nota
    firmada y la quita de la lista; desde la nota se puede devolver al
    despacho si se marcó por error. «Avisar» abre WhatsApp con «vamos en
    camino» y el pedido. Las ventas anteriores a este cambio cuentan como
    entregadas.
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
- **El formulario de venta** es como la nota de papel: una fila por
  producto con las **piezas** (opcional; solo informa), los **kilos** (o
  cartones) y el **precio en dólares**, que se escribe cada vez, como en la
  nota. El importe sale de los kilos por el precio. El total se ve mientras
  se escribe (es el único cálculo con JavaScript del formulario; sin él, lo
  calcula el servidor al guardar).
  - **Fecha de la nota.** La que lleva la nota de papel, aunque sea de días
    atrás: los días de crédito cuentan desde ahí. No puede ser de mañana.
    No es el día de entrega: ese se pone aparte, solo si queda por
    entregar.
  - **Lo que hay y lo que pesa.** Cada fila dice cuánto hay en inventario
    (si se sigue) y lo que suele pesar una pieza; vender más de lo que hay,
    o unas piezas que no casan con su peso, avisa y pide confirmar (ver
    «Inventario»).
  - **Lo que no tiene sentido no se guarda** (`src/lib/venta-sensata.ts`):
    sin kilos, sin precio, más de 1000 kilos, más de 500 piezas, un precio
    de más de 1000 dólares. Lo que solo es raro pide confirmar: un precio a
    menos de la mitad o a más del doble del de la lista (o del que se le
    cobró a ese cliente la última vez), o una línea de más de 1000 dólares.
    El formulario vuelve con todo lo escrito y una casilla para confirmar.
- **La dirección del cliente** se comprueba al guardarla. Si dice calle y
  carrera, entra en la cuadrícula y se enseña como se dice aquí, «carrera
  19 con calle 25». Si no (un centro comercial, una avenida con nombre, un
  edificio), se le pregunta al mapa libre de OpenStreetMap, acotado a
  Barquisimeto; lo que conteste se guarda con el cliente y se dice «según
  el mapa: …» para que el dueño lo compruebe. Si tampoco el mapa la
  encuentra, el cliente se guarda igual y sale un aviso en amarillo con el
  motivo, el mapa y el enlace para corregirla; en la ficha hay un botón
  para volver a buscarla.
  - «Av. Libertador con calle 30»: se junta la calle escrita con la
    carrera a la que cae la avenida según el mapa. Una avenida sola es un
    punto cualquiera de ella, y se marca como aproximado.
  - Cómo se ponen en el mismo plano la cuadrícula y el mapa está en
    `src/lib/plano.ts`: una fórmula sacada de 605 cruces de OpenStreetMap.
  - Con `MAPA_APAGADO=1` no se llama al mapa (las pruebas locales).
- **Nombre y razón social.** El nombre del cliente es como lo llama el
  dueño («Luis», «Panadería Tuttopan»); la razón social, el nombre legal
  para la nota («Tutto Pan, C.A.»). En las listas, en la ficha, en las
  ventas y en los abonos lo que va en grande es la razón social si la
  hay, y si no, el nombre (`rotulo` en `src/lib/clientes.ts`); en la nota
  y el estado de cuenta va como «Señor(es)» y deja el nombre como
  «Atención». Los mensajes de WhatsApp saludan por el nombre. Los dos son
  opcionales: sin nombre, el cliente queda con el teléfono y se dice
  bajito («sin nombre») en la cartera y en la ficha, sin frenar nada.
- **Calles con letra.** Por el oeste hay calles «13A», «13B»: se entienden
  y se colocan entre la 13 y la 14, y se escriben igual al enseñarlas
  («carrera 5 con calle 13A»).
- **Buscar una venta.** En Ventas, por el nombre del cliente, por el número
  de la nota («26» o «000026») o por la fecha («30/09»). Sin buscar salen
  las últimas 50 (`src/lib/buscar.ts`).
- **Los números de nota** son los de la venta y no se repiten: si una nota
  se borra, su número no se vuelve a usar.

## Proveedores

- En Proveedores se registra a quien le vende al negocio (el de los quesos,
  el de los huevos): nombre, teléfono y los **días de crédito que da**.
- Desde su ficha se anota cada **compra** como la nota del proveedor: una
  fila por producto (y marca) con las piezas, los kilos o cartones y el
  costo en dólares, más «otras cosas» que no son producto (flete, hielo).
  El total sale de ahí y la descripción se escribe sola si se deja vacía;
  un costo por encima del precio de venta pide confirmar, y la fecha no
  puede ser de mañana. Con esas líneas entra el inventario (ver abajo). Y
  cada **pago** que se le hace, con los mismos métodos y la misma tasa que
  los abonos de los clientes. Lo que se le debe es lo
  comprado menos lo pagado; los pagos se aplican a las compras más
  antiguas primero, igual que con los clientes, y cada compra sale como
  pagada, abonada o por pagar, y vencida si pasó el plazo.
- El Resumen enseña «Debo a proveedores» y «A quién le debo», con el plazo.
- **La captura del pago** al proveedor se adjunta al registrarlo (no es
  obligatoria: se guarda si la hay) y queda unida al pago, con su enlace
  «Captura» en la ficha; se borra con él. Con `ANTHROPIC_API_KEY` se lee
  igual que la de un abono: sin monto, el formulario vuelve relleno con lo
  leído; con monto, se comprueba. **La tasa es la del día del pago**: con
  una fecha de días atrás el formulario trae la tasa de ese día, y si se
  deja vacía se usa esa (`tasaEnFecha`), como en los abonos.
- **Su enlace de cuenta.** Como el del cliente: desde su ficha, «Crear su
  enlace de cuenta» y «Mandárselo por WhatsApp». Con `/proveedor/<enlace>`
  el proveedor ve, sin clave, lo que el negocio le debe (en dólares y en
  bolívares a la tasa de hoy), cada compra con lo pagado y su plazo, y cada
  pago con su comprobante (`src/lib/cuenta-proveedor.ts`). Solo lo suyo,
  fuera de los buscadores, y se renueva si se compartió de más.
- Una compra o un pago mal anotado se borra y se registra de nuevo. Borrar
  un proveedor pide la clave del panel.
- Las compras no cambian el costo que figura en Productos (del que sale el
  precio de venta): ese se sigue poniendo a mano. El último costo pagado se
  ve en Inventario.

## Inventario

- **Lo que hay de cada producto y marca** (`/admin/inventario`). Entra con
  cada compra a un proveedor (sus líneas de producto), sale con cada venta
  y se corrige con un recuento («conté y tengo tanto»: el sistema anota la
  diferencia), una merma o una entrada sin compra. Un producto se empieza
  a seguir con su primera compra o su primer recuento; hasta entonces
  sale «sin seguir» y no avisa de nada (`src/lib/stock.ts`,
  `src/lib/inventario.ts`).
- De cada uno dice cuánto se compró, cuánto se vendió, cuánto queda (y
  cuántas piezas serían), lo vendido en los últimos 30 días, para cuántos
  días alcanza a ese ritmo y el último costo de compra. Con menos de una
  semana, o sin existencia, lo avisa arriba y en el Resumen.
- **Al anotar una venta** el formulario dice cuánto hay; si se anota más de
  lo que hay, avisa y pide confirmar (el inventario puede ir atrasado: se
  arregla anotando la compra que falta o con un recuento).
- **El peso por pieza se aprende solo** (`src/lib/piezas.ts`): con las
  últimas 20 notas que anotaron piezas y kilos de un producto se saca lo
  que suele pesar una pieza (la mediana, con al menos tres notas). El
  formulario lo dice («suele pesar 2,5 kg por pieza») y, si un día las
  piezas y los kilos de una nota se alejan más de un 15 % de eso, avisa:
  «cada pieza suele pesar 2,5 kg … y hoy anotaste 2 piezas y 8 kg». Nada
  se corrige solo.

## La web hacia fuera

- **Al compartir un enlace** por WhatsApp sale una vista previa con imagen:
  la de la portada, o la del producto con su dibujo y su precio en dólares.
  El precio en bolívares no va en la imagen porque cambia cada día.
- **Para los buscadores**: descripción con la ciudad, datos de la tienda y
  de cada producto (JSON-LD), mapa del sitio y `robots.txt`. El panel y
  las tareas quedan fuera de los buscadores.
- **En el teléfono** la web se puede poner en la pantalla de inicio, con el
  león de icono. Manteniendo pulsado el icono sale el acceso al panel.
- **El panel como app.** El panel tiene su propio manifiesto
  (`/admin/manifest.webmanifest`, sin sesión): puesto en la pantalla de
  inicio se llama «Panel», abre directamente en `/admin`, a pantalla
  completa, y con atajos a venta, abono, despacho y cierre. Las
  instrucciones para Android y iPhone están en `/admin/app`. No hay app de
  tienda: publicarla en Google Play o en la App Store cuesta dinero y no
  añade nada que esto no haga.
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
  Ninguna página se desborda a los lados. Las tablas del panel llevan la
  clase `tabla--fichas` y cada celda su `data-label`: en el teléfono cada
  fila se pinta como una ficha, con el nombre de la columna delante de
  cada dato; en pantallas anchas y en papel siguen siendo tablas.
- **Ninguna clave en el código.** Van en `.env.local`.

## Pendiente

- El comprobante de RIF que hay venció el 15/07/2019: conviene renovarlo en
  el SENIAT antes de imprimirlo en facturas o ponerlo en la web.
- Poner los precios reales del queso amarillo, los huevos y el pecorino
  rallado: los que hay son de ejemplo y el panel lo avisa. El de la
  mozzarella (7,70 USD el kilo) es real.
- Los precios de cada marca (Kemmental, El Legado, Sortilegio, Guaralac):
  están creadas con su foto y sin precio. El pecorino se vende en bolsa de
  500 g, por unidad.
- Fotos reales de los productos: hoy llevan un dibujo.
- Las reseñas de verdad de cada producto: las que hay son de ejemplo y solo
  las ve el dueño.
- Registrar a los proveedores y lo que se les debe.
- Poner `ANTHROPIC_API_KEY` en Vercel y en `.env.local` para que las
  fotos de las notas se lean solas. Sin ella, la foto se guarda sin más.
- Un dominio propio.
- Facturación fiscal, cuando el negocio empiece a facturar. Hoy hay notas
  de entrega, que no son facturas.
- Las avenidas con nombre y los sitios conocidos entran en la ruta por el
  mapa libre, con la precisión que tenga ese mapa: conviene comprobar en
  la ficha dónde los puso.
