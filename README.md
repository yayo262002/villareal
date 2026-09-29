# Comercializadora Villareal

Web y sistema de gestión para un local de quesos en Barquisimeto, Venezuela:
queso amarillo, mozzarella, pecorino rallado, huevos y lo que se vaya
añadiendo. Vende al detal y al mayor.

Tiene dos partes:

- **La web pública** (`/`): qué se vende, precios si están puestos, y cómo
  contactar. Pensada para el teléfono.
- **El panel** (`/admin`): registrar clientes, anotar ventas, registrar pagos
  en dólares o en bolívares con la tasa del día, ver las cuentas por pagar
  y pagadas, guardar la foto de cada nota de entrega, y un informe de
  cuánto se vende, de qué y a quién.

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
src/lib/adjuntos.ts       Fotos de las notas de entrega
src/lib/whatsapp.ts       Mensajes de cobro y de nota para WhatsApp
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
src/components/entrada-foto.tsx  Reduce la foto en el teléfono antes de subirla
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
- El **dibujo** de cada producto se elige por su nombre (queso, mozzarella,
  rallado, curado, huevos) en `src/lib/dibujos.ts`. Un producto que no
  encaje lleva un dibujo genérico.
- **Precios de ejemplo.** Si en `ajustes` está la clave
  `precios_de_ejemplo`, el panel avisa en rojo arriba de Productos de que
  los precios publicados no son los del dueño. Se quita con el botón «Ya
  puse mis precios».
- Las cuentas internas siguen en **dólares**.
- Cada venta suma al saldo del cliente. Cada pago resta.
- Los mensajes de WhatsApp (recordatorio y nota) dicen el monto en dólares y,
  si hay tasa del día, también en bolívares.
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
- Un dominio propio.
- Facturación, cuando el negocio empiece a facturar.
