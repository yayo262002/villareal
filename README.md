# Comercializadora Villareal

Web y sistema de gestión para un proveedor de insumos al mayor en
Barquisimeto, Venezuela: queso amarillo, mozzarella, pecorino rallado,
huevos, suero de leche y lo que se vaya añadiendo (embutidos, tocineta,
papas, salsas, bebidas). Le vende a hamburgueserías, pizzerías,
restaurantes, panaderías y bodegas. Se presenta como **«Villa Real — Tu
proveedor para burger & pizza»** (`lema` en `src/config/negocio.ts`).

Tiene dos partes:

- **La web pública** (`/`): la portada «Todo para tu burger & pizzería»,
  todos los productos con buscador, cada categoría, las ofertas y combos,
  la página de cada producto y de cada marca con lo que dicen los negocios
  que lo compran, y un carrito que manda el pedido por WhatsApp. Precios
  del día en bolívares y en dólares si están puestos. Pensada para el
  teléfono.
- **El panel** (`/admin`): la cartera de clientes, con alta rápida por
  teléfono y dirección; las ventas, cada una con su nota de entrega para
  imprimir o mandar; los abonos en dólares o en bolívares con la tasa del
  día, con su recibo por WhatsApp; el pago móvil del BDV, que se abona solo
  al cliente que lo hizo; lo que le deben, nota a nota, los
  recordatorios de cobro y el estado de cuenta de cada cliente; el
  inventario, que entra con las compras y sale con las ventas; los pedidos
  por entregar y la ruta de
  despacho, que los ordena desde la tienda y dice qué cargar; las
  facturas con su IVA, sus notas de crédito y el libro de ventas; la foto de
  cada nota en papel, las reseñas de cada producto, los proveedores (a
  quién se le debe y los pagos que se les hacen), los días de crédito de
  unos y otros, un informe de cuánto se vende, de qué y a quién, el reparto
  de la ganancia de cada mes entre los socios, y la lista de precios de la
  charcutería (el detal), al día con la tasa del BCV.

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
npm run fotos-web      las fotos de la portada y de las familias: la mercancía recortada sobre color (después, npm run miniaturas)
npm run miniaturas     las fotos de public/familias/ y public/productos/ en pequeño (public/miniaturas/), al añadir o cambiar una
npm run combos         la lista personal de los precios de los combos de hoy, desglosada (con lo que cuesta y lo que deja), el flier del estado y el volante con los precios de hoy (en listas/combos/, una carpeta por día)
npm run lista          las listas del detal y del mayor de hoy en PDF y en pantallas JPG para el teléfono, y la hoja de la rebanadora (en listas/precios/, una carpeta por día)
node publicidad/reel.mjs  el video para Instagram (Reels y estados, 1080 × 1920, sin sonido): el león, los productos, precios al mayor, la inauguración y el contacto; lo graba el propio Chrome en MP4 (en listas/videos/)
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
de 30. La copia se escribe aparte y solo se guarda si termina bien: una a
medias no puede pasar por buena. Si quieres que las copias vayan a una carpeta que se sincronice con
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
   - `CRON_SECRET`: un texto largo al azar, para la copia automática y el
     aviso de cada mañana.
   - `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (opcionales): las claves con
     las que se firman los avisos al teléfono. Si no están, se crean solas
     la primera vez y quedan en la tabla `ajustes`.
   - `ANTHROPIC_API_KEY` (opcional): para que la foto de cada nota se lea
     sola. Se crea en https://console.anthropic.com y se paga por uso.
   - `RESEND_API_KEY` (opcional): para que «He olvidado la clave» mande el
     enlace por correo. Se crea gratis en https://resend.com con el correo
     del dueño (sin dominio propio, Resend solo entrega a ese correo). El
     destino es `CORREO_DEL_DUENO` o, si no está, el correo del negocio de
     `src/config/negocio.ts`. Sin esta clave, el enlace llega solo como
     aviso al teléfono.
4. Despliega. La primera visita crea las tablas y los productos iniciales
   (queso amarillo, mozzarella, pecorino y huevos) sin precio.

Para pasar lo que ya tengas en el archivo local a Turso, instala la CLI de
Turso y ejecuta `turso db shell villareal < copia.sql`, donde `copia.sql`
sale de `sqlite3 datos/villareal.db .dump`. Si prefieres empezar de cero en
la nube, no hace falta nada.

Con las mismas dos variables en `.env.local`, `npm run dev` y `npm run copia`
trabajan contra Turso desde tu ordenador.

**El espacio de las versiones.** Vercel guarda las funciones de cada versión
publicada, y el plan gratuito tiene 10 GB para eso (*Functions Storage*; avisa
al 75 %). Para no llenarlo:

- Un cambio que solo toca lo que no es de la web (`publicidad/`, `sellos/`,
  `scripts/` y los textos) no se publica: antes de cada despliegue Vercel
  corre `scripts/desplegar-o-no.sh` (`ignoreCommand` en `vercel.json`).
- Las funciones no se llevan esas carpetas (`outputFileTracingExcludes` en
  `next.config.ts`). Antes, una ruta armada a trozos con `public` arrastraba
  también `publicidad/`: 60 MB más en cada página de cada versión.
- En Vercel, Settings → Build and Deployment → Deployment Retention Policy:
  las versiones viejas se guardan poco tiempo. La que está publicada no se
  borra nunca.

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
src/lib/banco-calculo.ts  Lee el aviso del BDV (monto, teléfono o nombre, referencia, fecha) y las reglas para saber de quién es (puro, con pruebas)
src/lib/banco.ts          El pago móvil que entra al banco: guardarlo, abonarlo solo a quien es, la bandeja, deshacer, «Ya pagué» y no contar dos veces
src/app/api/banco/        Donde el teléfono del banco (MacroDroid) manda cada aviso del BDV, con su clave
src/app/admin/(panel)/banco/  Pago móvil: los pagos por identificar, los abonados, pegar un aviso a mano y cómo se configura el teléfono
src/lib/whatsapp-calculo.ts  Lo que Meta manda del WhatsApp del negocio: leer cada mensaje, eco e historial, y comprobar su firma (puro, con pruebas)
src/lib/whatsapp-api.ts   El WhatsApp conectado a la web (coexistencia): los datos de la app de Meta, conectar el número, guardar los mensajes
src/app/api/whatsapp/     Donde Meta manda cada mensaje del WhatsApp del negocio, firmado con la clave secreta de la app
src/app/admin/(panel)/whatsapp/  WhatsApp: cómo está, los datos de la app de Meta, la dirección de los avisos, «Conectar el número» y los últimos mensajes
src/components/conectar-whatsapp.tsx  La ventana de Meta (Embedded Signup) que une el WhatsApp Business del teléfono con la web sin sacarlo de él
src/app/cuenta/[enlace]/ya-pague/  «Ya pagué» desde el enlace del cliente: la referencia y el monto
src/lib/ajustes.ts        La tasa del día y los demás ajustes
src/lib/tasa.ts           Cuándo se acepta una tasa que llega de fuera
src/lib/tasa-oficial.ts   Trae la tasa del BCV (del viernes en la noche al domingo, la del lunes, de la página del BCV)
src/lib/certificado-bcv.ts  Los intermedios que la página del BCV no manda, para comprobar su certificado
src/lib/intentos.ts       Freno a quien pruebe claves en la entrada del panel
src/lib/variantes.ts      Los artículos de un tipo de producto (marca, presentación, contenido), con su foto
src/lib/marcas.ts         Las marcas: listar, renombrar, unir dos que son la misma y borrar la que no se usa
src/lib/marcas-texto.ts   El nombre de un artículo («Guaralact bolsa de 1 kg»), el filtro por marca y las secciones de una categoría
src/lib/catalogo.ts       Qué precio publica un producto con marcas («desde») y las filas de la venta; estados, presentación, ofertas vigentes
src/lib/familias.ts       Las familias del catálogo, sus productos y su portada
src/lib/catalogo-inicial.ts  Las familias iniciales, los borradores y los combos que pidió el dueño
src/lib/preparar-catalogo.ts Crea en borrador lo que falte del catálogo inicial
src/lib/ofertas.ts        Ofertas y combos: precio, fechas, estado y lo que llevan
src/lib/afiche-combo.ts   El afiche de cada combo en la web: qué producto va con foto y cuál con su cantidad, y la etiqueta del precio (puro, con pruebas)
src/lib/iconos.ts         Los iconos de las familias, a trazo
src/lib/portadas.ts       Qué familias traen su foto en public/familias/, y su miniatura (public/miniaturas/, npm run miniaturas)
src/lib/cache-de-fotos.ts Cuánto se guardan las fotos que la web sirve desde la base (un año en el teléfono con su ?v=)
src/lib/vitrina.ts        Lo que enseña la web: productos publicados con su precio, sus marcas, su foto y sus familias; buscar
src/components/vitrina.tsx  Las piezas de la web: tarjetas de producto, de familia y de combo, la franja de confianza…
src/lib/carrito.ts        El carrito: cantidades, totales y el mensaje del pedido para WhatsApp (con la entrega)
src/lib/delivery.ts       El delivery: la tienda en el plano, la distancia, la zona, el precio por tarifas (puro, con pruebas)
src/lib/delivery-servidor.ts  El delivery de un sitio (GPS o dirección): el plano o el mapa libre, y las tarifas del panel
src/components/carrito/entrega.tsx  «¿Cómo lo recibes?» en el carrito: delivery (con «Usar mi ubicación») o en la tienda
src/app/admin/(panel)/delivery/  Las tarifas del delivery por distancia y «Probar una dirección»
src/components/carrito/   «Agregar», el contador de la cabecera y la página del carrito (lo guarda el teléfono)
src/app/api/carrito/      Dice al carrito los nombres y los precios de hoy de lo que lleva
src/app/api/pedido/       Guarda la copia del pedido que manda el carrito (Pedidos de la web) y avisa al teléfono
src/lib/pedidos-web.ts    Los pedidos de la web: limpiar lo que llega, guardar, listar, atender
src/app/productos/, categoria/, ofertas/, carrito/  Las páginas de la vitrina
src/components/menu-movil.tsx  El menú del teléfono, que se cierra solo al cambiar de página
public/portada/, public/familias/  Las fotos de la portada y de las familias: la mercancía sobre color (npm run fotos-web, CREDITOS.md)
scripts/fotos-web.ts      npm run fotos-web: esas fotos y las referencias sobre blanco, con los productos recortados de publicidad/fotos/
src/components/formulario-producto.tsx  El formulario completo de un producto, con «Crear nueva familia»
src/components/marcas-producto.tsx  Los artículos de un tipo, en su ficha del panel, y sus campos (también en «Agregar producto»)
src/app/foto-producto/, foto-familia/  Sirven la foto de un producto y la portada de una familia
src/app/foto-variante/    Sirve la foto de una marca a la web
src/lib/fotos-referenciales.ts  La foto de referencia de cada producto por su nombre, mientras no tenga la suya
src/components/foto-de-producto.tsx  La foto de un producto: la suya, la de referencia (dicho) o el león
public/productos/         Las fotos de referencia (CREDITOS.md)
src/lib/imagen-social.tsx La imagen que sale al compartir un enlace
src/assets/fuentes/       Las fuentes de esas imágenes, con su licencia
src/lib/cuentas.ts        Qué ventas están pagadas y cuáles por pagar
src/lib/credito.ts        Los días de crédito: cuándo vence una nota y cuánto está vencido
src/lib/vencimientos.ts   Cada cliente y cada proveedor con lo que tiene vencido
src/lib/proveedores.ts    Proveedores, sus compras (con sus líneas de producto) y los pagos que se les hacen
src/lib/stock.ts          El inventario: lo comprado menos lo vendido, más los ajustes; cuánto dura
src/lib/piezas.ts         Lo que suele pesar una pieza, aprendido de las notas
src/lib/inventario.ts     Las existencias desde la base, y los recuentos y mermas (también el recuento general, de una vez)
src/lib/existencias-por-familia.ts  El inventario por familias, para «Contar todo» y para la vendedora; leer lo contado (puro, con pruebas)
src/app/admin/(panel)/inventario/contar/  «Contar todo»: el recuento general, una casilla por artículo
src/app/existencias/      «Lo que hay», lo que ve la vendedora desde su teléfono, con su enlace y sin clave (se crea y se renueva en Inventario)
src/lib/recordatorios.ts  Cuándo se le recordó la deuda a cada cliente
src/components/fila-de-producto.tsx  La fila de un producto en la venta y en la compra
src/lib/caja.ts           El cierre del día: vendido, entrado por método y salido
src/lib/movimientos.ts    Todo lo que se movió entre dos fechas (lo usan la web y el guion de copias)
src/lib/estadisticas.ts   Lo que se saca de los movimientos: por producto, por cliente, por método, por día
src/lib/costo-del-dia.ts  Lo que cuesta hoy cada cosa que se vende (la marca, el tipo, un combo del detal): se guarda con cada línea de venta
src/lib/reparto-calculo.ts  El reparto del mes: la ganancia de lo cobrado, lo que se paga antes y lo de cada parte por puntos; el resumen para WhatsApp (puro, con pruebas)
src/lib/reparto.ts        El reparto desde la base: ventas con su costo, abonos, lo que se paga antes de repartir
src/app/admin/(panel)/reparto/  Reparto del mes: lo vendido, lo cobrado, la ganancia, lo de cada uno, lo que deja cada producto y las partes
src/lib/lista-compra-calculo.ts  La lista de compra: sus tipos, los grupos por tipo o por proveedor y cuánto falta (puro, con pruebas)
src/lib/lista-compra.ts   La lista de compra desde la base: listar, agregar, tachar, quitar y destachar todo
src/app/admin/(panel)/compra/  Lista de compra: lo que hay que comprar, para tachar desde el teléfono
src/lib/exportaciones.ts  El Excel de cada día, guardado solo por la tarea diaria
src/lib/exportaciones-locales.ts  Los Excel que deja npm run copia en el ordenador
src/lib/cuenta-cliente.ts Lo que un cliente ve de su cuenta con su enlace
src/lib/cuenta-proveedor.ts  Lo que un proveedor ve de nuestra cuenta con él, con su enlace
src/components/cuenta.tsx El marco, las pestañas y las tarjetas de la cuenta del cliente
src/lib/exportar.ts       Lo que se descarga para Excel: movimientos y resumen por día
src/lib/buscar.ts         Buscar sin tildes ni mayúsculas; una nota por su número
src/lib/parecido.ts         Buscar «parecido»: desde la primera letra, los que empiezan por ella primero, y aunque falte, sobre o cambie una letra (la caja y la cartera)
src/components/filtro-en-vivo.tsx  La cartera se filtra mientras se escribe, sin pulsar «Buscar»
src/components/foto-ampliable.tsx  Una foto que se amplía ahí mismo, con su flecha para volver (el panel como app no tiene atrás)
src/lib/direcciones.ts    Lee una dirección y la sitúa en la cuadrícula
src/lib/ruta.ts           El orden en que conviene visitar a los clientes
src/lib/despacho.ts       Junta las dos cosas: el plan de un despacho; sitúa a cada cliente
src/lib/plano.ts          La cuadrícula del centro puesta sobre el mapa de verdad
src/lib/mapa.ts           Pregunta al mapa libre por una dirección sin calle y carrera
src/lib/entregas.ts       Pedidos por entregar: qué lleva cada cliente y qué cargar
src/lib/adjuntos.ts       Fotos de las notas de entrega y capturas de los pagos (de clientes y a proveedores)
src/lib/fotos-en-espera.ts  La foto de la nota mientras el formulario va y vuelve
src/lib/lector-de-notas.ts  Le enseña la foto de la nota a Claude: a quién va, fecha, líneas, total, firma
src/lib/nota-leida.ts     Interpreta lo leído y dice en qué no cuadra con lo anotado (también si no es de ese cliente)
src/lib/nota-a-venta.ts   De la nota leída a la venta en la caja: las líneas, lo que hay que elegir y los avisos (puro, con pruebas)
src/lib/cliente-de-la-nota.ts  De quién es una nota: «Nelson» es la Pizzería NEL's, por el negocio, la persona, el RIF y lo aprendido (puro, con pruebas)
src/lib/nombres-en-notas.ts  Cómo se escribe a cada cliente en sus notas, aprendido al guardar cada venta con su nota
src/components/nota-en-la-caja.tsx  «Leer una nota de papel» en la caja y «Lo que leí de la nota»: de quién es, renglón a renglón
src/lib/captura-leida.ts  Lo leído en la captura de un pago: rellena el abono o avisa si no cuadra
src/lib/whatsapp.ts       Mensajes para WhatsApp: cobro, nota, recibo, en camino, pedir reseña, el enlace de cuenta
src/lib/enlace-cuenta.ts  El enlace personal de cada cliente y cada proveedor: cómo se hace y adónde lleva
src/app/cuenta/           La cuenta de un cliente, para él, con su enlace y sin clave
src/app/proveedor/        La cuenta de un proveedor, para él, con su enlace y sin clave
src/lib/copias-nube.ts    Copias automáticas guardadas en la base
src/app/api/tarea-diaria/ Lo que Vercel hace solo cada mañana: tasa y copia
src/app/api/copia-automatica/  Solo la copia, para lanzarla aparte
src/app/api/tasa-del-lunes/  El viernes en la noche, la tasa del lunes (a las 7 y a las 10)
src/lib/dinero.ts         Conversión y formato de dólares y bolívares
src/lib/acciones.ts       Lo que hacen los formularios del panel
src/lib/copias.ts         Copias de seguridad de la base de datos
scripts/copia.ts          npm run copia
scripts/prueba-extremo.mjs  La prueba de extremo a extremo, en local o contra la web
scripts/desplegar-o-no.sh  Lo que Vercel pregunta antes de publicar: si solo cambió lo que no es de la web, no publica
src/lib/sesion.ts         La sesión: cuándo se entró, la versión y la firma (con la clave y el secreto del servidor); 30 días
src/lib/panel.ts          exigirPanel: cada pantalla del panel comprueba la sesión (panel.test.ts lo vigila)
src/lib/iva-del-mes.ts    El IVA de cada mes: débito, crédito, excedente y a pagar (puro, con pruebas)
src/lib/clave.ts          La clave del panel: la de .env.local o la que el dueño puso con «He olvidado la clave»; el enlace de un solo uso
src/lib/correo.ts         Mandar un correo al dueño (Resend): hoy, el enlace de la clave nueva
src/app/admin/entrar/     Entrar; /olvide pide el enlace; /nueva pone la clave nueva
src/proxy.ts              Corta el paso a /admin sin sesión
src/app/page.tsx          La portada de la web pública (sus estilos, en inicio.module.css)
src/app/producto/         La página de cada producto, y dentro la de cada una de sus marcas
src/components/como-comprar.tsx  «Cómo comprar», en la página del producto y en la de la marca
src/components/publico.tsx  Cabecera (menú, buscador, carrito y WhatsApp), pie y cajas de precio de la web pública
src/app/opengraph-image.tsx  La vista previa de la portada al compartirla
src/app/robots.ts, sitemap.ts, manifest.ts  Lo que leen los buscadores y el teléfono
src/app/not-found.tsx, error.tsx  Página no encontrada y página de fallo
src/app/privacidad/       La política de privacidad (la pide Meta para publicar la app del WhatsApp), con cómo pedir que se borren los datos (#eliminar-datos)
src/lib/enlaces.ts        La dirección de la página de cada producto
src/lib/resenas.ts        Las reseñas de cada producto, en la base
src/lib/resenas-texto.ts  Deja limpia una reseña escrita; las reseñas de ejemplo
src/components/resenas.tsx  Las reseñas, como se ven en la página del producto
src/app/foto-resena/      Sirve la foto de una reseña a la web
src/components/entrada-foto.tsx  Reduce la foto en el teléfono antes de subirla
src/components/nav-panel.tsx     El menú del panel en dos pisos: los grupos (Inicio, Vender, Cobrar, Clientes, Mercancía, Facturas, La web) y las pantallas del abierto; la lista, en el layout del panel
src/components/aviso-de-carga.tsx  La raya dorada mientras llega la pantalla que se tocó en el panel
src/components/un-solo-envio.tsx   Que un toque doble no registre dos veces una venta o un abono
src/components/fotos-de-nota.tsx   Las fotos de la nota firmada de una venta, en la nota, en Ventas y en el despacho
src/components/historial-cliente.tsx  El historial de la ficha del cliente: ventas, abonos, llamadas y recordatorios juntos, con su detalle, sus fotos y sus capturas
src/app/admin/(panel)/adjuntos/[id]/ver/  Una foto vista entera, con su fecha, de quién es y la vuelta a donde se estaba
src/lib/avisos.ts         La campanita: los avisos de lo que el sistema sabe antes que el dueño, y los del día
src/lib/aviso-manana.ts   El texto del aviso de cada mañana (puro, con pruebas)
src/lib/push.ts           Los avisos al teléfono (Web Push): los teléfonos activados y el envío
public/admin/sw.js        El avisador del panel: enseña los avisos como notificaciones del teléfono
src/components/avisos-del-telefono.tsx  «Activar avisos en este teléfono»
src/app/admin/(panel)/avisos/  La pantalla de la campanita
src/app/admin/telefonos/  Guarda y quita los teléfonos con avisos (lo usa el botón de activar)
src/app/api/aviso-diario/ Lo que Vercel hace cada mañana a las 7: los avisos del día y el resumen al teléfono
src/lib/cron.ts           Si una llamada viene del cron de Vercel
src/lib/seguimiento.ts    El estudio de clientes: el último trato, qué compra cada uno y cada cuánto (puro, con pruebas)
src/lib/estudio-de-clientes.ts  El estudio desde la base, para el Resumen, su pantalla y los avisos
src/lib/contactos.ts      «Lo llamé», «Lo visité»: los tratos anotados con cada cliente
src/app/admin/(panel)/clientes/seguimiento/  La pantalla del estudio de clientes
src/app/admin/(panel)/ayuda/  «Cómo se usa el panel»: la guía rápida, en el orden del día
src/lib/pos-calculo.ts    Las cuentas de la caja: totales, descuento, cómo paga, cómo queda la cuenta del cliente, el precio de contado en el local y el SKU propuesto (puro, con pruebas)
src/lib/pos.ts            La caja desde la base: el catálogo con existencias, el cliente de mostrador y el guardado de la venta con sus pagos
src/lib/combos-detal.ts   Los dieciséis combos del detal (el 16, la pechuga de pavo con el queso amarillo tipo gouda, de todos los días pero el último: los anteriores ya estaban impresos): lo que lleva cada uno, su precio con la lista del detal y su desglose producto por producto (puro, con pruebas)
src/lib/combos-en-la-caja.ts  Los combos como artículos de la caja, ocultos en la web, con el precio del detal de hoy
src/lib/codigo128.ts      El código de barras Code 128 de las etiquetas de los combos (puro, con pruebas)
src/app/admin/(panel)/combos/etiquetas/  Las etiquetas de las bandejas de los combos, con su precio y su código de barras, para imprimir
src/lib/codigos.ts        Los códigos de barras y los SKU: quién tiene un código, ponerlo y quitarlo
src/lib/factura-calculo.ts  Las cuentas de la factura: lo exento, la base imponible, el IVA, el total en Bs; el libro de ventas (puro, con pruebas)
src/lib/documento.ts      Leer una cédula o un RIF escrito de cualquier forma, como va en la factura (puro, con pruebas)
src/lib/compradores.ts    Quien compró con factura en el mostrador, para reconocerlo por su cédula
src/lib/facturas.ts       Las facturas y las notas de crédito desde la base: emitir, numerar, el número de control, anular, listar
src/app/admin/(panel)/facturas/  Facturas: la lista del mes, los ajustes, cada factura (carta y ticket), anular, y el libro de ventas para Excel; en compras/, el libro de compras; en control/, los números de control de una vez; en iva/, el IVA mes a mes para Excel
src/lib/libro-compras-calculo.ts  Las cuentas del libro de compras: los totales de una factura por sus líneas, revisar una factura, las filas para Excel (puro, con pruebas)
src/lib/facturas-compra.ts  Las facturas de compra desde la base: anotar o corregir, listar el mes, quitar
src/lib/detal-calculo.ts  Las cuentas de la lista del detal: IVA, margen, la charcutería (entre 0,80 y más un 10 % al mayor), dólares subidos al centavo, bolívares subidos de 5 en 5; las reglas guardadas; leer las líneas de una factura y una lista de costos en dólares (puro, con pruebas)
src/lib/detal.ts          La lista del detal desde la base: listar, cargar una factura o unos costos en dólares, agregar, cambiar, esconder, quitar
src/lib/costos-unidos.ts  El mismo costo en el detal y en Villa Real: unir un producto de la lista con su artículo del catálogo e igualar el costo
src/app/admin/(panel)/detal/  La lista del detal en el panel: cargar facturas, agregar a mano, las reglas y el enlace para la familia
src/app/lista/            La lista del detal para la familia, con su enlace y sin clave
src/lib/mis-precios.ts    «Mis precios»: lo publicado en la web con su costo, su precio al mayor y lo que deja (puro, con pruebas)
src/app/precios/          «Mis precios», la lista personal del dueño, con su enlace y sin clave (se crea y se renueva en Productos)
scripts/combos.ts         npm run combos: el precio de cada combo del detal de hoy, producto por producto, con lo que cuesta y lo que deja (publicidad/precios-combos.html, dos hojas carta), el flier del estado y el volante con los precios de hoy; la misma cuenta que la caja
scripts/lista-detal.ts    npm run lista: las listas del detal y del mayor de hoy en archivos para el teléfono (diseño en publicidad/lista-precios.html) y la hoja de la rebanadora (publicidad/tabla-peso.html)
src/lib/precios-especiales.ts  El precio especial de un cliente para un artículo
src/components/pos.tsx    Registrar venta, como una caja (con JavaScript: cliente con saldo, lector, carrito, pago, atajos)
src/app/admin/(panel)/ventas/  Ventas: arriba la caja, debajo las últimas ventas; /clasica, el formulario de siempre, de respaldo
src/app/admin/(panel)/codigos/  La pantalla para poner códigos de barras y SKU con el lector
src/lib/stickers.ts       La lista de stickers de WhatsApp (texto, forma, color, icono)
scripts/stickers.ts       Los dibuja con Chrome en public/stickers/ (PNG y WebP, 512 × 512, y un ZIP)
src/app/admin/(panel)/stickers/  La pantalla para guardarlos en el teléfono
src/app/admin/            El panel (productos/nuevo y productos/[id], marcas, familias, ofertas…)
sellos/                   Los modelos de los sellos de tinta (empresa, RECIBIDO, MERCANCÍA RECIBIDA, PAGADO): sellos.html los dibuja y generar.mjs saca los PNG a 600 ppp y el PDF para la sellería
publicidad/               La inauguración del mayor, el viernes 20/11/2026 (inauguracion.html: el flier para el estado de WhatsApp, 1080 × 1920, y el pendón de la puerta, 80 × 200 cm a tamaño real, con el mismo diseño medido en «unidades»; verde, dorado y crema como el letrero, la foto de la portada y las de los productos). El flier de los combos para el estado de WhatsApp (estado-combos.html: 1080 × 1920, todos los combos con su foto y su precio en dólares, de combos-precios.js, que no va al repositorio). El volante para los clientes (volante-combos.html: media carta, «¡Lleve su COMBO charcutero!», los combos en cuatro columnas con su foto y lo que lleva, y abajo la dirección, sin teléfono; sin precios, y con los de hoy, que saca npm run combos; cada uno también dos en una hoja carta acostada, para imprimir y cortar). El aviso de la calle (aviso-calle.html: una lona de 300 × 100 cm para la fachada, para quien pasa en carro: «¡Llévate tus combos!» en letras de unos 15 cm, los productos de verdad en su mostrador y el WhatsApp, sin precios). La pizarra de precios de la charcutería (pizarra.html, 90 × 60 cm: cada producto con su marca y una casilla con el «$» para el marcador). Los combos del detal: combos-datos.js (los combos, una sola vez), combos.html (el cartel de 60 × 90 cm para la pared, tres por fila y los de la última fila al centro) y combos-individuales.html (una hoja carta por combo; combo-horizontal.html, la prueba de una hoja acostada, 279 × 216 mm, con los productos a la izquierda y una casilla del precio mucho más grande a la derecha, en PDF y en JPG a 300 ppp, para imprimir y plastificar cada una, con el diseño de fondos/referencia-dueno.png y Open Sans, en fuentes/; el navideño y el pizzero, con el de fondos/referencia-navidad.png y referencia-pizza.jpg: placa verde, luces, la mitad de abajo roja y la frase en Kaushan Script; el pizzero, sin nada de Navidad); el de recortes (el 15), con todas las piezas juntas como en una foto de grupo, las altas atrás y las anchas delante (`grupo` en combos-datos.js, también en el cartel y en el flier); fondos.mjs saca los estantes y la madera de esas hojas; los productos separados y en su proporción real (en el cartel, en el flier y en las hojas), en cada hoja lo más grandes que caben sin tocar la cabecera, el sello del número ni los adornos de las esquinas (la mozzarella y los quesos amarillos, del mismo tamaño en todas las de todos los días: ALTO_EN_HOJA), la casilla del precio en blanco para el marcador; quitar-fondo.mjs le quita el fondo a cada foto de fotos/originales/ (red neuronal, se instala aparte), le limpia los bordes y le corrige el color (al queso paisa le quita además el plástico y la banda de la bolsa; fotos/CREDITOS.md dice cuál no es del dueño); generar.mjs saca el PDF para la imprenta y la vista previa
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
- **Desde el viernes en la noche y el fin de semana vale la tasa del
  lunes**, como en los comercios (el dueño, 21/11/2026: «si es viernes en
  la noche todos los precios tienen que ser calculados en tasa del lunes»):
  el BCV la publica el viernes por la tarde («Fecha Valor: lunes», o la del
  martes si el lunes no es día bancario) y con ella no se pierde con la que
  sube el lunes. DolarApi sigue dando la del viernes hasta el lunes, así que
  entonces la tasa se lee de la página del BCV (`leerTasaDelBcv` en
  `src/lib/tasa.ts`): el viernes a las 7 y a las 10 de la noche
  (`/api/tasa-del-lunes`, cron en `vercel.json`) y el sábado y el domingo
  en la tarea de la mañana. Entre semana no se adelanta ninguna. Su servidor
  no manda el certificado intermedio que firmó el suyo; en vez de apagar la
  comprobación, a esa petición se le da (`src/lib/certificado-bcv.ts`, los
  públicos de Sectigo, valen hasta 2036; el 13/11/2026 el BCV cambió de
  intermedio, del «DV R36» al «OV R36», y el sábado 21/11 no se pudo leer la
  del lunes hasta añadirlo). La web dice «Tasa BCV del lunes 05/10/2026», y
  un abono o una nota con fecha de sábado o domingo van con la del lunes que
  les sigue (`tasaEnFecha`); lo que se anota el viernes en la noche con la
  fecha de ese día, también, pero lo del viernes anotado otro día va con la
  del viernes, que queda guardada como tal. Si la del lunes no se puede
  leer, sigue la última y el panel lo avisa; una tasa puesta ese fin de
  semana (la del lunes, o una escrita a mano) no se pisa con la del
  viernes, y el lunes temprano tampoco.
- Cada producto lleva sus **ventajas** (una por línea) y tiene su **propia
  página** en la web, `/producto/2-queso-mozzarella`: su foto grande,
  precios, «Agregar al carrito», el pedido directo por WhatsApp, ventajas,
  cómo se paga y dónde está la tienda. En las listas cada tarjeta enseña la
  foto arriba (la mitad de la tarjeta), el nombre, la presentación, el
  precio al mayor en bolívares bien grande con los dólares debajo («USD
  7,70 / kg»), «Agregar» y «Ver detalles».
- **Familia → tipo → marca → presentación → precio.** El catálogo nunca
  confunde el producto con la marca: el **tipo de producto** es lo que el
  cliente busca («Queso amarillo / Cheddar», «Mozzarella», «Suero») y es
  cada producto de Productos, con su familia; sus **artículos** son las
  marcas y presentaciones en que se vende (`variantes`): cada uno con su
  **marca** (una de la lista o una nueva, que se crea al escribirla), su
  **presentación** («Bloque», «Bolsa») y su **peso o contenido** («1 kg»),
  su precio y su foto. El nombre del artículo sale de ahí («Sortilegio
  500 g», «Guaralact bolsa de 1 kg», `src/lib/marcas-texto.ts`). La marca
  va siempre debajo del tipo: «Marca Guaralact», nunca en su lugar.
  - **Las marcas** son algo propio (tabla `marcas`, `src/lib/marcas.ts`):
    en Productos → «Marcas» (`/admin/marcas`) se ve cuántos artículos
    tiene cada una y en qué tipos, se renombra (una errata: cambia también
    sus artículos y las notas que los nombran), se **une** con otra que es
    la misma y se borra la que ya no tiene nada. Dos marcas escritas con
    otras mayúsculas son la misma («guaralact» y «Guaralact»).
  - Un tipo que se vende de **una sola forma** lleva el precio, la marca y
    la presentación en su propia ficha (la mozzarella, en bloque cuadrado,
    por kilo). Al añadirle la primera marca, lo que ya vendía **pasa a la
    lista como un artículo más**, con su precio, su foto y lo que había en
    inventario (`pasarAArticulo`): no se pierde nada.
  - En Productos, cada tipo tiene «Marcas y presentaciones» con sus
    artículos: marca, presentación, contenido, descripción (una línea por
    ventaja), costo y precio (con el costo salen del margen del tipo) y una
    foto, que el teléfono reduce antes de subir. En la portada, la tarjeta
    del tipo dice «desde» con el precio más barato y «2 marcas para
    elegir»; con dos o más no lleva «Agregar» (sería pedir a ciegas) sino
    «Ver opciones». **En Productos y en cada categoría, una tarjeta por
    artículo** (el dueño, 15/11/2026: «no has añadido los productos»: el Mi
    Vallecito y las salchichas cóctel no se veían, metidos en su tipo): el
    tipo de título, su marca debajo, su foto, su precio y su «Agregar», y
    lleva a la página de su marca (`porArticulo` en `src/lib/vitrina.ts`);
    buscando, solo los artículos que responden («vallecito» trae el Mi
    Vallecito, no el El Legado). En la página del tipo cada artículo tiene su «Agregar» y su «Pedir por
    WhatsApp», con su precio, para que el pedido diga cuál es. Con un solo
    artículo (el suero, de Guaralact) no hay nada que elegir: se pide
    directo desde arriba, como sin marcas, y su descripción y sus reseñas
    van en la misma página (su ficha sigue existiendo: «Ver su ficha»).
    Mientras haya alguno publicado, los precios del tipo no se usan
    (`src/lib/catalogo.ts`).
  - **Filtrar por marca.** En cada categoría, en Productos y en la página
    de un tipo con tres marcas o más, «Filtrar por marca» (casillas, sin
    JavaScript: `?marca=guaralact`) deja los tipos que se venden de esas
    marcas, cada uno solo con ellas. El cliente busca primero lo que
    necesita y después elige la marca.
  - En la venta sale una fila por cada artículo, la nota lo nombra («Queso
    pecorino rallado Sortilegio 500 g») y el despacho carga cada uno
    aparte. Un artículo ya vendido no se borra, se esconde. La foto
  se sirve en `/foto-variante/[id]` solo mientras la marca y el producto
  estén publicados. Al guardarla se recorta el fondo liso que sobre, se
  centra el producto en un cuadrado de 800 px con un poco de aire y se
  guarda como JPEG (`src/lib/foto-producto.ts`): así todas las marcas se
  ven del mismo tamaño y el producto llena su foto. En la web se enseña
  sobre blanco, como la foto de un producto en una tienda: conviene
  fotografiar los paquetes sobre fondo blanco o muy claro.
- **Cada marca tiene su página** (`/producto/1-queso-amarillo-cheddar/2-kemmental`):
  se llega pinchando su foto, su nombre o «Ver detalles» en la página del
  tipo. De título, el tipo («Queso amarillo / Cheddar»), con «Marca
  Kemmental» encima y su presentación debajo; su foto grande, su precio,
  su botón de pedir, **su propia descripción** (una ventaja por línea; la
  primera sale también en la lista de marcas del tipo), **sus reseñas** y
  las otras del mismo tipo. La portada nunca enseña marcas: solo el tipo
  («Suero», no «Suero Guaralact»).
- **Reseñas.** En la página de cada producto, «Por qué elegirlo» enseña
  primero lo que dicen los negocios que lo compran y después las ventajas.
  Las reseñas solo se ven dentro de la página del producto: la portada no
  enseña ninguna. **De un producto con marcas, cada reseña es de una
  marca** (`resenas.variante_id`): sale en los detalles del producto,
  diciendo de qué marca habla («Sobre Kemmental»), y en la página de esa
  marca, que solo enseña las suyas; lo que se dice de una marca no se
  cuelga de la otra. En el panel, la reseña se escribe **en la ficha del
  producto** (`/admin/productos/7`, sección «Reseñas»: las que tiene, con
  su marca y su estado, «＋ Añadir una reseña de un cliente» y «Pedir
  reseña por WhatsApp», por el producto o por cada marca) o en Reseñas,
  que las enseña todas juntas, eligiendo el producto o la marca
  (`src/components/resenas-panel.tsx`).
  El dueño le pide el comentario al cliente y lo escribe con las palabras
  del cliente: producto o marca, quién lo dice, qué negocio es y qué dijo.
  Una reseña se puede esconder sin borrarla.
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
- **Fotos reales, nunca dibujos.** Cada producto se enseña con una foto:
  la que el dueño sube en su ficha del panel; si no la hay y se vende de
  alguna de sus marcas tiene foto (el suero Guaralact, el queso amarillo
  Kemmental), la de la primera, que es mercancía de verdad; si no,
  una **foto de referencia** de lo que es, elegida por su nombre, de lo más
  concreto a lo más general (la salsa cheddar no es un queso, lo rallado
  lleva la del queso rallado, los quesos blancos de aquí, como el queso
  arepero, el llanero o el de mano, la de un queso llanero de verdad, y el
  jamón arepero sigue siendo jamón; `src/lib/fotos-referenciales.ts`), que la
  ficha marca «Foto referencial»; y si ninguna le va, un fondo crema con
  el león. Las de referencia son fotos de comida CC0 o de dominio público
  (`public/productos/`, con sus créditos); en cuanto el dueño sube la suya,
  la sustituye sola. Los productos del catálogo inicial tienen la suya.
  - **Fotos** (`/admin/fotos`): todas las fotos de la web en una pantalla,
    para cambiar las que no gusten: la de cada tipo (y de dónde sale: la
    suya, la de su marca o la de referencia), la de cada marca y la portada
    de cada familia, cada una con «Cambiar» y «Quitar». Lo que se sube se
    guarda como todas: el teléfono la reduce, y el servidor le quita el
    fondo liso que sobra, la centra sobre blanco en un cuadrado de 800 px y
    la guarda como JPEG (`src/lib/foto-producto.ts`). Una foto sin fondo
    (PNG transparente, de una app que lo quita) queda sobre blanco, no
    sobre negro, también cuando el teléfono la reduce. Las portadas se
    recortan en 4:3.
- **Precios de ejemplo.** Si en `ajustes` está la clave
  `precios_de_ejemplo`, el panel avisa en rojo arriba de Productos de que
  los precios publicados no son los del dueño. Se quita con el botón «Ya
  puse mis precios».
- Las cuentas internas siguen en **dólares**.
- Cada venta suma al saldo del cliente. Cada pago resta.
- **Días de crédito.** Cada cliente tiene los suyos (7 si no se dice otra
  cosa; se cambian en su ficha), y una nota puede llevar los suyos propios
  si se le ponen al venderla en la caja (`ventas.dias_credito`; vacío,
  valen los del cliente). Una nota vence a esos días de su fecha:
  si pasado el plazo queda algo por pagar de ella, está **vencida**. El
  Resumen, Clientes y Lo que te deben dicen cuánto está vencido y desde
  cuándo («Vencida hace 3 días»). **Quien debe va por lo que vence
  antes**: mientras menos tiempo le quede para pagar, más arriba (primero
  el más atrasado, después el que vence hoy, mañana, en dos días…; a igual
  plazo, el que más debe; `porUrgencia` en `src/lib/credito.ts`). Así
  salen «Quién debe» en el Resumen, «Los que deben, por lo que vence
  antes» en Clientes y «Quién te debe» en Lo que te deben (cada cliente
  con lo que debe, lo vencido y su plazo más cercano), y debajo las notas,
  en el mismo orden. Lo mismo vale para lo que el negocio le debe a cada
  proveedor, con los días que da el proveedor.
- **Estudio de clientes** (`/admin/clientes/seguimiento`, y «Clientes por
  llamar» en el Resumen). De cada cliente, cuándo fue el **último trato**:
  una compra, un abono, un recordatorio, el día en que se registró o un
  trato anotado a mano («Lo llamé», «Lo visité», «Le escribí»; tabla
  `contactos`). Quien lleva **una semana o más sin trato** sale «por
  llamar», el que más tiempo lleva primero, para ofrecerle mercancía y
  ver cómo va todo: «Ofrecer por WhatsApp» abre el mensaje con lo que
  suele comprar, y «Lo llamé hoy» deja anotado el trato y lo baja de la
  lista. De cada uno dice también qué suele comprar, cada cuántos días y
  cuándo le tocaría la siguiente compra (`src/lib/seguimiento.ts`). En la
  ficha, «Seguimiento» lo resume y deja anotar cualquier trato con fecha y
  nota.
- **Recordatorios de cobro.** Quien pasó su plazo y no ha recibido un
  recordatorio en la última semana sale arriba en el Resumen, en «Cobros
  para recordar». «Recordar» (ahí, en «Quién debe», en la ficha y en el
  estado de cuenta) abre WhatsApp con el mensaje escrito (saldo, notas
  pendientes y su enlace de cuenta) y deja anotado el día
  (`src/lib/recordatorios.ts`): el Resumen y la ficha dicen «Recordado el
  2/10» y no se insiste a quien se le acaba de escribir.
- La nota y el recibo que se mandan por WhatsApp llevan el enlace de la
  cuenta del cliente si lo tiene («Puede ver su cuenta al día aquí»), igual
  que el recordatorio.
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
- **Reparto del mes** (`/admin/reparto`, en Inicio; el dueño, 18/11/2026:
  su hermano entra como socio y la parte de cada uno no puede ir sobre la
  venta, porque hay productos que solo dejan un 5 %). Cada línea de venta
  guarda **el costo de ese día** (`venta_lineas.costo_unitario_usd`): el de
  la marca, el del tipo si se vende de una sola forma (el de Productos, que
  se pone al día solo con cada factura si está unido a la lista del detal)
  o lo que suman los productos de un combo en la lista del detal
  (`src/lib/costo-del-dia.ts`). Si el costo sube mañana, la ganancia de la
  venta de hoy no cambia, y no se reparte el dinero que hace falta para
  volver a comprar. La ganancia que se reparte es **la de lo cobrado** en
  el mes: cada abono paga las notas del cliente de la más antigua a la más
  nueva (`repartoDeAbonos`) y trae la ganancia de lo que paga, en
  proporción; lo vendido y no cobrado entra en el mes en que se cobre, y lo
  que sobra de un abono (a cuenta) no es ganancia. Se resta **lo que se
  paga antes** (la comisión de la vendedora, anotada en el mes; tabla
  `reparto_descuentos`) y lo que queda se reparte **por puntos**: con 2 de
  10, 2 de cada 10 dólares de la ganancia, deje el producto un 5 % o un
  15 %. Las partes (de entrada, fondo de previsión 2, cuota del préstamo 1,
  «Yo» 3, papá 2 y el hermano 2) se cambian en la misma pantalla
  (`ajustes.reparto_partes`) y valen para todos los meses; el reparto se
  hace al centavo sin perder ninguno. Lo vendido sin costo guardado (las
  ventas de antes del 18/11/2026, o un producto sin costo en Productos) no
  entra en la ganancia: se dice aparte y no se estima. La pantalla enseña
  también lo que deja cada producto, sobre su costo, y «Mandar el resumen
  por WhatsApp» abre el mensaje para elegir a quién (el hermano está
  fuera). Las cuentas, con pruebas, en `src/lib/reparto-calculo.ts`. La
  mozzarella, que tenía el precio escrito a mano y ningún costo, quedó
  unida a la de la lista del detal (7,60 $) para que su costo siga a las
  facturas; su precio no cambia, porque no tiene margen.
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
- **Los céntimos de la tasa se acomodan solos** (el dueño, 14/11/2026:
  «toda la gente que tenga un poquito a favor, así céntimos, lo
  acomodas»). Un abono en bolívares casi nunca da justo lo que se debía en
  dólares: 70.686,22 Bs por una nota de 78,41 $ son 78,40 a la tasa del día.
  Si el abono paga notas enteras (las más antiguas por pagar) con hasta
  0,50 $ y el 1 % de diferencia, vale exactamente esas notas: ni un centavo
  colgando ni un saldo a favor que no existe. Los bolívares no cambian;
  cambia la tasa a la que se pasan a dólares, y el abono lo dice en su nota
  («céntimos de la tasa acomodados»). Vale para los abonos de la ficha y de
  Abonos y para los pagos del banco; no para la caja, que cobra su venta
  (`centimosDeLaTasa` en `src/lib/cuentas.ts`, `registrarAbono` en
  `src/lib/pagos.ts`). Más que eso no son céntimos: el abono vale lo que vale.
- **Los de la casa.** Un cliente de la familia del dueño (su casilla «Es
  de la casa», en su ficha) no se cobra: no sale en «Lo que te deben», en
  «Quién debe» ni en «Cobros para recordar» del Resumen, en los avisos de
  vencidos, en «por llamar», en lo por cobrar de Estadísticas ni en las
  ventas sin factura; en la cartera sale en gris, «de la casa».
- **Lo repetido se frena.** El mismo abono (cliente, fecha, método, moneda
  y monto) o el mismo pago a un proveedor anotado hace menos de diez
  minutos, o la misma venta (cliente, fecha y las mismas líneas), casi
  siempre es el botón pulsado dos veces: no se guarda y el formulario
  vuelve con la casilla «Sí, es otro abono» (o «Lo escrito es correcto» en
  la venta) para guardarlo si de verdad son dos (`pagoRepetidoReciente`,
  `ventaRepetidaReciente`). Con JavaScript, además, el botón se apaga al
  enviar.
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
bolívares y tarjeta (los cuatro piden tasa), efectivo en dólares, Zelle,
Binance y otro.

## Cartera, notas y despacho

- **Alta rápida.** En Clientes basta el teléfono y la dirección. Primero
  va la **razón social o negocio** (lo que sale en grande en las listas y
  en la nota) y después el nombre de la persona (a quien se saluda por
  WhatsApp); los dos son opcionales. Sin ninguno, el nombre queda **vacío**
  (nunca se guarda el teléfono como nombre) y las listas enseñan el
  teléfono con «sin nombre». El teléfono se guarda siempre escrito igual
  (`0412-1234567`) y no se puede registrar dos veces, se escriba como se
  escriba. Tras guardar se vuelve al mismo formulario, para registrar el
  siguiente. La cartera se **filtra mientras se escribe**, también
  «parecido» (`src/lib/parecido.ts`), **desde la primera letra**: «c» trae
  a Cecilia, a Cheo y a Carlos, «gu» a Guillermo y «h» a Héctor (pedido
  por el dueño el 14/11/2026: «que al poner una letra muestre las
  coincidencias»). Por nombre, los que empiezan por lo escrito suben
  arriba. La dirección y la nota solo cuentan desde tres letras y van
  después: con una letra, la «c» de «calle» o «carrera» no trae a todos
  (`ordenDeParecido`). Lo mismo en la caja.
- **Borrar un cliente.** Desde su ficha, «Eliminar cliente» lleva a una
  pantalla que dice qué se lleva (notas, abonos, fotos y la deuda) y pide
  la **clave del panel** otra vez, porque no tiene vuelta atrás. Las
  claves malas cuentan como las de la entrada: cinco seguidas y hay que
  esperar. Lo mismo para borrar un proveedor.
- **Abonos.** Lo que el cliente paga, sea todo o una parte. En la ficha
  cada abono lleva su **número** (del más antiguo al más nuevo), lo que
  **debía el cliente en ese momento y lo que quedó** («Debía USD 135,50 →
  quedó USD 101,75», con `movimientosDeCuenta`) y su captura con el mismo
  número («Captura N.º 3»). Se anotan desde
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
- **Historial** (pedido por el dueño el 14/11/2026: «que aparezcan todas
  las operaciones de una manera más detallada»). En la ficha del cliente,
  en lugar de las listas sueltas de notas y de abonos, todo junto y de lo
  más nuevo a lo más viejo: cada venta, cada abono, cada llamada o visita
  anotada y cada recordatorio de cobro, cada uno con cómo quedó su cuenta
  después («Quedó debiendo USD 78,00»). Se filtra por Ventas, Abonos, Por
  pagar o Llamadas y recordatorios (`?ver=`, sin JavaScript), y enseña las
  30 últimas con «Ver todo el historial». Cada venta y cada abono tienen
  **«Ver detalle»**, que se abre ahí mismo: de la venta, sus productos
  (cantidad × precio = importe), el total en bolívares a la tasa de la nota,
  lo pagado y con qué abonos, lo que queda y cuándo vence, la entrega, la
  caja, la factura, la observación y **la foto de la nota firmada**; del
  abono, cómo pagó, la tasa, la referencia, «Debía → quedó», **a qué notas
  fue** (`repartoDeAbonos` en `src/lib/cuentas.ts`, con pruebas: el mismo
  reparto de siempre, de la nota más antigua a la más nueva, abono por
  abono), si entró del banco y **la captura del pago**. Las fotos se
  amplían al tocarlas y no se bajan hasta abrir el detalle.
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
    «Nota N.º 000012 firmada». Sin foto no se guarda la venta. **La foto
    se ve** después en la nota (`/admin/ventas/12/nota`, debajo de
    «Entregada», con su «Eliminar»; una nota entregada sin foto deja
    ponerla ahí mismo), en Ventas y en la ficha del cliente («Foto» en la
    fila de la nota) y en Despacho, en «Entregadas hoy», con cada nota que
    se entregó en el día (`src/components/fotos-de-nota.tsx`). Toda foto
    se abre en su **visor** (`/admin/adjuntos/12/ver`): entera, con la
    fecha y la hora en que se guardó, de qué cliente y de qué nota o abono
    es, «← Volver» a donde se estaba (`?volver_a=`), «Abrir la foto sola»
    y «Eliminar». Tocar la foto la **amplía ahí mismo**, a pantalla entera
    con su «← Volver» (`src/components/foto-ampliable.tsx`): el panel
    puesto como app no tiene botón de atrás, y abrir el archivo solo
    obligaba a cerrar la app. Las capturas de los proveedores tienen el suyo
    (`/admin/adjuntos-proveedor/[id]/ver`).
  - **La foto se lee y se coteja con el pedido.** Con la clave
    `ANTHROPIC_API_KEY` puesta, al guardar se le enseña la foto a Claude
    junto con la lista de productos y marcas (`src/lib/lector-de-notas.ts`)
    y se comprueba que sea una nota y no otra cosa, **que sea de ese
    cliente** (lo que dice en «Señor(es)» y en «RIF» contra su negocio, su
    nombre, su RIF y cómo se le escribió en otras notas: «La nota dice
    "Nelson" y la venta es de Pizzería La Esquina»; `src/lib/cliente-de-la-nota.ts`),
    que su fecha sea la
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
    nada y todo sigue igual. No es gratis: se paga por uso (saldo que se
    recarga en console.anthropic.com, aparte de cualquier plan de
    claude.ai). Con Claude Sonnet 5.5 (2 $ el millón de tokens de entrada y
    10 $ el de salida) cada nota cuesta uno o dos centavos de dólar: la
    foto, las instrucciones con el catálogo y la respuesta. Con
    `MODELO_LECTOR_DE_NOTAS=claude-haiku-5-5` costaría unas veinte veces
    menos, pero lee peor la letra de mano.
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
- **Registrar venta es la caja** (ver «Registrar venta (la caja)» más
  abajo): se busca el cliente y se ve su saldo, se escanea o se busca cada
  producto, y se cobra o se deja pendiente. Las reglas de abajo (la fecha
  de la nota, lo que hay y lo que pesa, lo que no tiene sentido) valen
  igual. El **formulario clásico** (`/admin/ventas/clasica`) sigue de
  respaldo y funciona sin JavaScript: una fila por producto con las
  **piezas** (opcional; solo informa), los **kilos** (o cartones) y el
  **precio en dólares**, como en la nota de papel.
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
- **Calles con letra.** Por el oeste hay calles y carreras «13A», «13B»:
  se entienden pegadas («13A», «13-a») y también separadas («calle 13 A
  con carrera 5», «carrera 13 b, casa 4») cuando después viene el final o
  una palabra de dirección («calle 13 a la derecha» sigue siendo la 13), se
  colocan entre la 13 y la 14 y se escriben igual al enseñarlas («carrera
  13A con calle 60»).
- **Buscar una venta.** En Ventas, por el nombre del cliente, por el número
  de la nota («26» o «000026») o por la fecha («30/09»). Sin buscar salen
  las últimas 50 (`src/lib/buscar.ts`).
- **Los números de nota** son los de la venta y no se repiten: si una nota
  se borra, su número no se vuelve a usar.

## Registrar venta (la caja)

- **En Ventas, arriba** (`/admin/ventas`): la pantalla de registrar una
  venta funciona como una caja, pensada para un computador del local con
  un **lector de códigos de barras USB** (escribe el código como un teclado
  y pulsa Enter), pero cabe en el teléfono. Es la pantalla del panel con
  JavaScript de verdad (`src/components/pos.tsx`); nunca enseña la lista
  entera de productos.
  - **Leer una nota de papel** (pedido por el dueño el 14/11/2026: «que
    yo le tome foto a la nota y él rellene todo», «que sea muy
    inteligente»). Arriba de todo, el botón toma la foto de la nota (o la
    elige de las fotos del teléfono, para una nota de días atrás), la lee
    (`leerNotaEnLaCaja`, con el mismo lector de siempre) y **la caja se
    llena sola**: cada renglón con su producto, sus kilos y piezas y el
    precio de la nota (que es lo que se cobró, y no cambia al cambiar de
    cliente), la fecha de la nota, «Ya entregada» si va firmada, con esa
    foto como la de la nota firmada, y «Queda pendiente» (si pagó, se
    cambia en «Cómo paga»: no se inventa un pago). Nada se guarda solo:
    debajo del botón, «Lo que leí de la nota» enseña la foto, cada renglón
    con su ✓, lo que no se sabe qué producto es (con los que se le parecen,
    para elegir y «Agregar», o «No va»), si el total de la nota cuadra con
    la caja y los avisos (`src/lib/nota-a-venta.ts`, con pruebas), y se
    confirma como cualquier venta. Si el carrito ya tenía algo, pregunta
    antes de cambiarlo.
  - **De quién es la nota.** La nota se escribe con el nombre con que se
    trata al cliente: «Nelson» por la Pizzería NEL's, cuyo dueño se llama
    Nelson. Lo escrito en «Señor(es)» y en «RIF» se compara con el
    negocio, el nombre de la persona y el RIF de cada cliente, sin tildes,
    con la letra de mano mal leída y sin el tipo de negocio («Pizzería»
    sola no dice quién es), y con **lo aprendido**: cada venta guardada con
    su nota leída enseña cómo se le escribe a ese cliente (tabla
    `nombres_en_notas`, `src/lib/nombres-en-notas.ts`). La caja nunca lo
    elige sola: **lo pregunta** («La nota dice "Nelson". ¿Es Pizzería
    NEL's? se llama Nelson · Debe USD 38,50 — Sí, es este»), con los otros
    parecidos debajo; si no se parece a ninguno, lo dice y deja buscarlo o
    registrarlo. Si la caja ya tenía otro cliente (abierta desde su
    ficha), avisa «La nota dice "Nelson" y elegiste a Pizzería La Esquina»
    y propone en grande al que se parece, con «No, es de Pizzería La
    Esquina: dejarla así». Sin decir de quién es, «Confirmar» no sigue
    (`src/lib/cliente-de-la-nota.ts`, con pruebas; la pantalla, en
    `src/components/nota-en-la-caja.tsx`). Lo dicho en la caja viaja con
    la venta (`cliente_de_la_nota`) y al guardar no se vuelve a preguntar.
  - **Cliente**: se busca escribiendo el nombre, la razón social o el
    teléfono (F4), mientras se escribe y **aunque falte, sobre o cambie
    una letra** («kleider» encuentra a Cleiderman; `src/lib/parecido.ts`:
    sin tildes, con b/v, s/z/c, y/ll y la h muda juntas, y un error por
    palabra, dos en las largas), y cada uno sale con su saldo: «Debe USD
    235,40» en rojo,
    «Al día» o «A favor USD 20,00» en verde. Es la misma cifra que en
    Clientes (lo comprado menos lo abonado, `listarClientes`); no se
    calcula otra. El elegido queda arriba con su saldo, sin entrar en
    Clientes. **«Mostrador (sin cliente)»** es un cliente fijo que la caja
    crea la primera vez, para quien compra y paga en el momento: con él no
    se deja nada pendiente. Al lado, el número que llevará la nota y su
    fecha.
  - **Productos**: la casilla «Agregar producto» (F2) busca por **código de
    barras, SKU, nombre, marca, presentación o categoría** y enseña solo lo
    que coincide, con su existencia y su precio (el especial del cliente si
    lo tiene). Escanear o Enter lo mete al **carrito**; el mismo otra vez,
    suma. Un código que no es de nadie avisa («Producto no encontrado.
    ¿Quieres registrarlo?») y deja ponérselo a un artículo o crear uno nuevo
    con el código puesto. Lo que no tiene código se vende igual por su
    nombre.
  - **Los combos del detal** (las dieciséis bandejas de las hojas y el
    cartel: 200 g de jamón y 200 g de queso, el solidario, el perrero, la
    de recortes…)
    también se venden en la caja, **al mismo precio que en la
    charcutería**: lo que suman sus productos en la lista del detal de
    hoy, subido al centavo, también de contado en el local. Se buscan por
    su nombre o por «COMBO-3» (su SKU, el número de la hoja), y en
    Códigos de barras se les puede poner uno para escanear la bandeja. Si
    a un producto del combo le falta el precio en la lista (el queso
    paisa, mientras no se compre), sale sin precio y se escribe a mano.
    El de recortes (el 15) no lleva peso ni precio fijos, porque lo que
    lleva varía con lo que se esté rebanando: en la caja se cobra siempre
    a mano (`precioAMano`).
    Cada combo es un producto del catálogo marcado con su clave
    (`productos.combo_detal`), que la caja crea la primera vez y pone al
    día si cambia su número o su nombre: **nunca sale en la web**, que es
    al mayor, y «Publicar» no lo publica (para dejar de venderlo, se pasa
    a borrador). Lo que lleva cada uno está en `src/lib/combos-detal.ts`
    (con pruebas); su venta es una venta normal, con su nota, su factura
    y sus estadísticas.
  - **Las etiquetas de las bandejas** (Ventas → «Etiquetas de los combos»,
    `/admin/combos/etiquetas`): se elige cuántas de cada combo y salen en
    hojas carta, diez por hoja (90 × 50 mm, para recortar o en papel
    adhesivo), cada una con el número y el nombre del combo, lo que lleva,
    su precio de hoy (el de la charcutería, con «$») y el código de barras
    de su SKU: **en la caja, escanear la bandeja mete el combo en la
    venta**. El código es Code 128, sin librerías (`src/lib/codigo128.ts`,
    con pruebas). Como el precio cambia con los costos, se imprimen otra
    vez cuando cambie.
  - **El carrito** es una tabla compacta: producto (con lo que hay en
    inventario, en verde, amarillo o rojo), la cantidad con su nombre
    («Kilos», «Cartones», «Unidades») y, solo en lo que va por kilo, las
    «Piezas» al lado, el precio (se puede cambiar a mano) y el total. Las
    casillas de números son de texto y aceptan coma o punto («2,5»): la
    casilla numérica rechazaba la coma del teclado del iPhone.
  - **Resumen** (a la derecha; debajo, en el teléfono, con una barra fija
    que dice el total y lleva a cobrar): subtotal, descuento en dólares,
    total en USD y en Bs a la tasa del día de la nota, la **fecha de la
    venta** (la de la nota de papel, aunque sea de días atrás; nunca de
    mañana: los días de crédito cuentan desde ahí) y **cómo paga**:
    **Paga todo ahora** (método, monto, «Pago mixto: otra vía» para varias
    vías que suman el total; en efectivo en dólares, lo **recibido** y el
    **cambio**), **Paga una parte** (lo que paga ahora es un abono y el
    resto queda en su cuenta) o **Queda pendiente** (todo a su cuenta).
    Con un cliente de verdad se ve cómo queda: saldo anterior, esta venta,
    lo que paga ahora y el **nuevo saldo**; y, si queda algo pendiente,
    los **días de crédito de esta nota** (los de la ficha del cliente, 7
    si no se dijo otra cosa; se cambian para esta venta y se guardan con
    ella en `ventas.dias_credito`) con la fecha en que vence. Lo que va en
    bolívares se guarda a la tasa del día de la nota, con su referencia.
  - **Contado en el local.** Quien va al local y paga todo en el momento
    compra al **costo más un 10 %**; a crédito o con entrega, al precio de
    siempre (el de la lista, que es el costo más un 12 %, o el especial del
    cliente). La casilla «Contado en el local», junto a «Cómo paga», viene
    marcada con el mostrador; marcarla pone «Paga todo ahora» y cambia los
    precios que no se tocaron a mano, y elegir «Paga una parte» o «Queda
    pendiente» la quita. El costo es el de la marca, o el del tipo si se
    vende de una sola forma (el de Productos); lo que no tiene costo va a su
    precio de siempre, y la caja dice cuál. Si el de siempre es más bajo,
    se queda ese. La venta se guarda con «Local» delante del cajero («Local
    · Ana»), para que el cierre del mes separe lo del local de lo de la
    vendedora (`precioDeContado`, `cajeroDeLaVenta`).
  - **Confirmar venta** (F8) abre una confirmación compacta (cliente,
    fecha, productos, total, pago, cómo queda su cuenta, entrega) y Enter
    guarda. Antes de abrirla se revisa en la pantalla lo mismo que
    revisará el servidor (`revisarVentaPos`), así el aviso es inmediato.
  - **Debajo del carrito**: **Entrega**, a la vista y **sin opción por
    defecto**: «Ya entregada», que **exige la foto de la nota firmada**
    (se lee y se coteja como siempre; en el mostrador no, porque quien
    compra ahí paga y se lo lleva en el momento), o «Queda por entregar el» con su
    fecha, que se cambia ahí mismo, entra en el despacho y el Resumen la
    recuerda ese día («Entregas pendientes»). Sin elegir una, o entregada
    sin foto, no se guarda. Plegados, **Observación y cajero**.
  - Atajos: **F2** producto, **F4** cliente, **F8** confirmar, **Esc**
    cancelar o cerrar, **Enter** confirmar en la ventana; los atajos no
    estorban al escribir. El carrito se guarda en el navegador: si la
    página se recarga o la venta vuelve con un aviso, no se pierde; una
    venta ya guardada no vuelve a aparecer, y si el navegador vuelve atrás
    a la pantalla ya usada (el iPhone la recupera de su memoria), se
    recarga limpia. Cada venta lleva una clave: la misma venta dos veces
    es una sola, y la misma clave con otro carrito es una venta nueva. Lo
    que el servidor conteste al guardar sale arriba y también junto a
    «Confirmar».
- **Al guardar** (`guardarVentaPos` en `src/lib/acciones.ts`) se aplican
  las mismas reglas que al formulario de siempre: `revisarVenta` (sin
  cantidad, sin precio, cantidades o precios que no pueden ser; un precio
  a menos de la mitad o a más del doble del de la lista o del que se le
  cobró la última vez, una línea de más de 1000 dólares o unas piezas que
  no casan con su peso piden marcar «Lo escrito es correcto»), la **venta
  repetida** hace un momento (pide confirmar) y la **foto de la nota**
  leída y cotejada (pide «Ya revisé la foto de la nota»). Además: los pagos
  tienen que cuadrar con lo elegido, con el mostrador se paga todo en el
  momento, y **no se vende más de lo que hay** salvo que en Inventario se
  marque «Permitir vender sin existencia» (ajuste
  `permitir_stock_negativo`). Lo que no cuadra vuelve a la caja con el
  motivo y el carrito intacto.
- **La venta es una venta normal** (`crearVenta`: líneas con su precio de
  ese día, piezas, tasa del día de la nota, entrega, `origen = 'pos'`,
  `descuento_usd`, `cajero`), así que **descuenta el inventario sola**,
  entra en la ficha del cliente, en Lo que te deben, en el Cierre del día,
  en Estadísticas y en el historial de Ventas (marcada «· caja»). Cada vía
  de pago es un `pago` normal contra el cliente, con la fecha y la tasa de
  la nota, unido a la venta (`pagos.venta_id`): la venta queda pagada o
  abonada con la lógica de siempre, y el saldo del cliente es el de
  siempre. No hay una segunda tabla de productos, de clientes ni de stock.
  Cambiar después el precio de un producto no toca las ventas de antes.
  Cada venta lleva una clave (`ventas.clave_pos`): si llega dos veces, es
  una sola.
- **Después**: con algo cobrado sale el **ticket** de caja
  (`/admin/ventas/12/nota?formato=ticket`, para impresora térmica de 80 mm
  o normal: VILLA REAL, fecha y hora, número, cliente, cajero, líneas,
  subtotal, descuento, total en USD y en Bs, cómo pagó y «Gracias por su
  compra»; es un comprobante interno, **no una factura fiscal**, y lo
  dice); si quedó pendiente, la nota de entrega. Las dos tienen «Nueva
  venta», que vuelve a la caja vacía.
- **Eliminar una venta** de la caja (desde la ficha del cliente o desde la
  nota) borra también los pagos que se cobraron con ella, y la pantalla de
  confirmación lo dice: la cuenta del cliente queda como antes de la venta.
- **Códigos de barras y SKU** (`codigo_barras`, `sku` en `variantes` y, para
  los tipos de una sola forma, en `productos`): se ponen en la ficha del
  artículo o, más rápido, en **`/admin/codigos`**: el cursor en la casilla,
  el lector escribe el código y guarda. El código es **único** en todo el
  catálogo (índice único; «ya es de X»); el SKU es opcional y se propone uno
  (`skuPropuesto`: «MOZ-KEM-25KG»).
- **Precio especial**: en la ficha del cliente, «Precios especiales» (tabla
  `precios_especiales`); la caja lo usa sola para ese cliente.
- Pendiente de las fases siguientes: presentaciones con factor (caja = 10
  unidades), devoluciones, anulación sin borrar, movimientos de inventario,
  usuarios y roles, lotes y vencimientos, filtros de reportes por cajero.

## Facturación

- **Qué es.** Desde la Providencia SNAT/2026/00093 (Gaceta Oficial
  43.484, del 21/10/2026) la factura en Venezuela se emite por medios
  digitales: ya no hace falta la máquina fiscal. La nota de entrega sigue
  siendo el papel de la entrega y de la cuenta del cliente, y la
  **factura** es el documento fiscal de esa venta (`/admin/facturas`).
- **Cómo se emite.** En la caja, marcando **«Emitir factura fiscal»**
  antes de confirmar: la venta se guarda como siempre y sale la factura
  (en ticket si se cobró algo, en carta si quedó pendiente). O después,
  desde la nota de entrega, con **«Facturar»**. Una venta con factura
  vigente no se factura dos veces.
- **A quién: como mínimo, su cédula.** La providencia (art. 8, num. 6)
  pide el nombre y el RIF de quien compra; a una persona que no necesita
  la factura para sus impuestos le basta la cédula. No hay excepción por
  monto: dos lonchas también llevan cédula. Un cliente de la cartera
  factura con la cédula o el RIF de su ficha; si no la tiene, se escribe
  junto a «Emitir factura» (o en «Facturar…», en la nota) y queda en su
  ficha. **En el mostrador** se escriben la cédula (o el RIF) y el nombre
  de quien compra: la factura sale a su nombre, sin crear un cliente, y
  queda guardado (tabla `compradores`, `src/lib/compradores.ts`): la
  próxima vez, al escribir su cédula el nombre sale solo. La cédula se
  escribe como venga («12.345.678», «v12345678», «J408064308») y va en la
  factura como «V-12345678» o «J-40806430-8»; un RIF sin su último número
  no vale (`leerDocumento` en `src/lib/documento.ts`, con pruebas).
- **Lo que lleva** (artículos 8 y 9 de la providencia): «Factura», el
  número correlativo (`facturas.numero`, seis cifras, desde el que diga
  el ajuste «numerar desde» si ya se facturaba en papel), el **número de
  control** cuando lo haya, la razón social, el RIF y el domicilio del
  emisor (`src/config/negocio.ts`), la fecha y la hora, el cliente con su
  RIF o cédula, cada línea con su cantidad, su precio y su importe (las
  exentas marcadas «(E)»), el descuento si lo hubo, lo exento, la base
  imponible, la alícuota, el IVA, el total y su equivalente en bolívares a
  la tasa BCV del día de emisión, la condición (contado o crédito a tantos
  días) y la nota de entrega de la que sale. Se imprime en carta o en la
  impresora de 80 mm y se manda por WhatsApp (`mensajeFactura`).
- **Los precios llevan el IVA incluido.** El precio de la lista es lo que
  paga el cliente; la factura lo desglosa: la base es el precio entre
  1,16 (`calcularFactura` en `src/lib/factura-calculo.ts`). Así el total
  de la factura es el de la nota y el de la cuenta del cliente, y la caja
  no cambia. El descuento se reparte entre las líneas en proporción. Lo
  exento, la base y el IVA suman el total exacto, también en bolívares:
  cada parte se pasa a bolívares y el IVA sale por diferencia, con una sola
  cuenta (`bolivaresDeLaFactura`) para la factura impresa (carta y ticket),
  el libro de ventas y el IVA del mes, así el contador ve en el libro las
  mismas cifras que en el papel.
- **IVA de cada producto** (`productos.iva`: `general` o `exento`). Se
  marca en la ficha del producto («IVA (para la factura)»). Los huevos
  nacen exentos, que la ley los exime; lo demás, gravado. Qué más está
  exento (queso blanco duro, pan, harina…) lo confirma el contador. La
  **alícuota** (16 %) y el número desde el que numerar están en Facturas →
  Ajustes (`ajustes.iva_pct`, `ajustes.facturas_desde`; este último solo
  mientras no haya facturas).
- **Una factura no cambia.** Guarda una foto de todo (emisor, cliente,
  líneas, importes) en JSON: cambiar después el precio o el nombre del
  cliente no la toca. Tampoco se borra: se **anula con una nota de
  crédito** por el mismo importe (`tipo = 'nota_credito'`, con su propia
  numeración y la factura que anula en `factura_id`), y las dos quedan en
  el libro. La venta no se toca al anular: se puede facturar otra vez (con
  el número que sigue) o borrar. Una venta con factura vigente **no se
  borra** hasta anularla. Dos toques a la vez (o dos teléfonos) no hacen
  dos facturas de la misma venta ni dos notas de crédito de la misma
  factura: la factura solo entra si la venta sigue sin factura vigente, y
  la anulación solo si la factura sigue emitida, en la misma sentencia.
- **El número de control** lo asigna la imprenta digital autorizada por el
  SENIAT (o el servicio del propio SENIAT): cuando llega, se anota en la
  factura, que mientras tanto dice «pendiente» y el panel avisa de cuántas
  faltan. **Números de control** (`/admin/facturas/control`, desde ese
  aviso): todos los que faltan en una pantalla, cada uno con su casilla, o
  «Ponerlos seguidos» desde el primero, en el orden en que se emitieron
  («00-00000123», «00-00000124»…, `controlesSeguidos`). Un número que ya
  tiene otro documento no se guarda: casi siempre es un error al copiarlo.
  Integrar la imprenta digital para que lo asigne sola es el paso
  siguiente, cuando el dueño elija una con su contador.
- **El libro de ventas** (Facturas → «Libro de ventas (Excel)»,
  `/admin/facturas/libro?mes=2026-10`): una fila por factura y por nota
  de crédito (en negativo), con el control, el RIF, lo exento, la base, la
  alícuota, el IVA y el total en bolívares a la tasa de cada documento y
  en dólares. Es lo que el contador necesita para declarar el IVA.
- **El libro de compras** (Facturas → «Libro de compras»,
  `/admin/facturas/compras`): las facturas de compra del mes (Drago,
  Cecosesola, Granos de Oro…) con el RIF del proveedor, su número y su
  control, lo exento, la base imponible y el IVA en bolívares, como vienen
  impresas, y su Excel (`/admin/facturas/compras/libro?mes=2026-11`). El
  IVA pagado en las compras (crédito fiscal) se descuenta del cobrado en
  las ventas. Se anotan ahí (lo exento, la base y el IVA tienen que sumar
  el total; la misma factura anotada otra vez se corrige, no se repite) o
  salen solas al cargar una factura en la lista del detal con su número:
  lo exento, la base y el IVA salen de sus líneas (tabla `facturas_compra`,
  `src/lib/facturas-compra.ts`; las cuentas en
  `src/lib/libro-compras-calculo.ts`, con pruebas).
- **El IVA del mes** (Facturas, «El IVA de …»): el de las ventas (débito
  fiscal, cada factura a su tasa, menos las notas de crédito), el de las
  compras (crédito fiscal, como vienen impresas), el excedente que venía
  del mes anterior y lo que queda: el IVA a pagar o el excedente que pasa
  al mes siguiente, en bolívares. «Descargar el IVA mes a mes (Excel)»
  (`/admin/facturas/iva`) es para el contador, que lo confirma y declara;
  no resta las retenciones de IVA (`src/lib/iva-del-mes.ts`, con pruebas).
- **Ventas sin factura** (Facturas): las del mes que no tienen factura
  vigente. Las de un cliente con cédula o RIF en su ficha llevan
  «Facturar» ahí mismo; las del mostrador (o sin cédula), «Facturar…», que
  lleva a su nota para escribirla.
- **Lo que no hace el sistema**: actualizar el RIF (se hace en el SENIAT;
  el de ahora es del 19/08/2026), elegir la imprenta digital, ni declarar
  el IVA. Lo dice la propia pantalla.

## La lista del detal

- **Qué es.** La charcutería (el detal de la familia) tiene su propia lista
  de precios, aparte del catálogo al mayor de la web y del inventario:
  `/admin/detal`, en el menú «Lista del detal».
- **De dónde sale cada precio.** Del costo de una unidad en la factura del
  proveedor, en bolívares y sin IVA, como viene impreso encima del nombre.
  Si el producto es gravado («(G)» en la factura) se le suma el IVA (16 %,
  el de Facturas); si es exento («(E)»), no. Se pasa a dólares con la tasa
  BCV del día de la compra (la que quedó guardada ese día, o la escrita) y
  se le suma el margen: 20 % en los víveres. El precio en dólares se sube
  al centavo y el de bolívares, a la tasa BCV de hoy, de 5 en 5: **siempre
  hacia arriba**, nunca en contra del negocio (0,84 $ que dan Bs 723 se
  cobran Bs 725). Los bolívares cambian solos cada mañana con la tasa.
  Las cuentas, con pruebas, están en `src/lib/detal-calculo.ts`.
- **La charcutería** tiene sus propias reglas. Su costo es el que cobra el
  proveedor, **en dólares** y por kilo (`lista_detal.costo_usd`): es lo que
  se paga, así que no se le suma IVA, salvo que se marque gravado. Hay dos
  precios: **al detal, el costo entre 0,80** (un 25 % más, porque la
  mercancía merma y se gasta en bolsas y papel: 5,20 $ dan 6,50 $) y **al
  mayor, el costo más un 10 %** (5,72 $). Los dos se suben al centavo y en
  bolívares de 5 en 5, como lo demás. Las dos cifras se cambian en «Las
  reglas» (el divisor se escribe «0,80» o «80»; el mayor vacío, sin precio
  al mayor). Un producto con su margen propio o su precio a mano no sigue
  la regla.
- **Cargar costos de la charcutería.** Se pegan los costos que manda el
  proveedor, uno por línea, con el nombre y el costo al final: «Jamón de
  espalda 5,20», «Queso amarillo $6,80 el kilo». Lo nuevo entra en
  Charcutería y por kilo; «c/u» después del costo dice que se vende por
  unidad, y «(G)» que se le suma el IVA. Lo que ya estaba toma el costo
  nuevo y guarda el anterior, igual que con las facturas.
- **Cargar una factura.** Se pegan sus líneas, una por producto:
  «12 x 447,59 Jugo Natulac Pera 200 ml (G)». Vale también como sale en el
  papel, con la cantidad y el precio en su propia línea encima del nombre.
  Lo que ya está en la lista (por el nombre, sin mirar mayúsculas) toma el
  costo nuevo; lo nuevo entra en la categoría elegida (Víveres, Limpieza y
  cuidado personal, Charcutería, Chucherías y snacks…). Lo que no se
  entiende (sin «(E)» o «(G)», sin precio) no se carga y se dice cuál es.
- **Las chucherías** (golosinas, snacks, chupetas, chicles) tienen su
  categoría, «Chucherías y snacks», y van al **30 %** (margen propio de cada
  una; lo demás de la misma factura de chucherías, también). Se venden por
  unidad: si la factura trae la bolsa o la caja («1X24»), el costo de una
  es el de la bolsa entre lo que trae.
- **A mano.** Un producto se agrega también con su costo en dólares, con
  el de la factura en bolívares y su tasa, o con su precio al detal en
  dólares. Con un costo hay que decir si se le suma el IVA. Cada uno puede
  llevar su margen propio y un precio al mayor escrito a mano. En «Las
  reglas» se cambian el margen de los víveres, el redondeo, la charcutería
  y el **margen al mayor de los víveres**: vacío (como está), los víveres
  no tienen precio al mayor.
- **El mismo costo en el detal y en el mayor.** La charcutería y Villa
  Real compran lo mismo al mismo proveedor (el mismo RIF), así que un
  producto de la lista se une a su artículo del catálogo de Villa Real
  (en su ficha, «El mismo producto en Villa Real»: el tipo, o la marca si
  tiene varias, por la misma unidad). Desde ahí, cada vez que su costo
  cambia en la lista (una factura cargada, unos costos pegados o un
  cambio a mano), el artículo de Villa Real toma el mismo costo y su
  precio al mayor se rehace con su margen; el aviso dice qué cambió
  («En Villa Real, el mismo costo: Mozzarella: 7,60 $»). Manda la lista
  del detal, que es donde se cargan las facturas: lo que se cambie a mano
  en el catálogo lo pisa la siguiente compra, y la ficha del producto lo
  avisa. Se desune eligiendo «Ninguno» (`src/lib/costos-unidos.ts`).
- **Para la familia.** «Crear el enlace» da una dirección
  (`/lista/abcdefghjkmnpq`) que se manda por WhatsApp: con ella se ve la
  lista al día, en bolívares y en dólares, por categorías y con buscador
  (con JavaScript filtra con cada letra, también «parecido»; sin él, el
  botón «Buscar»),
  sin clave y sin nada más del panel (ni costos ni proveedores). Arriba,
  las pestañas: «Al detal» (todo), «Charcutería» (`?precio=charcuteria`:
  la charcutería aparte, cada producto con su precio al detal y al mayor
  uno al lado del otro), «Al mayor» (`?precio=mayor`, con la cabecera
  dorada, solo lo que tiene precio al mayor) y «Combos» (`?precio=combos`;
  el dueño, 16/11/2026: «un apartado que diga combos, y quede desglosado
  cuánto es por cada uno»): los de todos los días y los especiales, cada
  uno con su precio de hoy en bolívares y en dólares y, debajo, cada
  producto con lo que lleva, a cuánto está el kilo al detal y lo que pone
  en el combo («200 g Jamón de espalda Drago · USD 6,13 el kilo → USD
  1,23»). Es la misma cuenta que la caja y que `npm run combos`
  (`desgloseDelCombo` en `src/lib/combos-detal.ts`, con pruebas), con toda
  la lista, también lo escondido; lo que aún no está en ella (el queso
  paisa) va con su precio estimado y lo dice. Sin costos ni lo que deja:
  eso, en las hojas de `npm run combos`. Puesta en la pantalla de
  inicio del teléfono es su propia app, «Precios», que abre directo en la
  lista y no en la portada de la web: tiene su manifiesto
  (`/lista/<enlace>/manifest.webmanifest`, solo con el enlace vigente), como
  el panel. Fuera de los buscadores; «Renovar el enlace» pone otro y el
  anterior deja de funcionar. Un producto se puede esconder de esa lista
  sin perder su costo. La lista va en orden alfabético, así que cada queso
  empieza por «Queso» para salir junto a los demás: la mozzarella es «Queso
  mozzarella» (el dueño, 23/11/2026: a su mamá «no le aparece», estaba entre
  las mortadelas). Un combo encuentra un producto también por su nombre de
  antes (`MISMO_PRODUCTO` en `src/lib/combos-detal.ts`).
- **En un archivo.** `npm run lista` deja en `listas/precios/AAAA-MM-DD/` (en OneDrive, fuera
  del repositorio) la lista de hoy en un PDF de una página larga, del ancho
  de un teléfono, y en pantallas JPG de 1080 × 1920 para mandarlas como
  fotos; la de la charcutería aparte, con las columnas «Detal» y «Mayor»
  (`lista-charcuteria-…`); y, si algo tiene precio al mayor, la del mayor
  (`lista-al-mayor-…`, en verde). Y **la hoja de la rebanadora**
  (`tabla-por-peso-…`, carta, para imprimir cada mañana y ponerla al lado
  de la rebanadora): cada producto de la charcutería que se vende por kilo
  con su precio al detal en bolívares en 100 g, 200 g, 250 g, 300 g, 500 g
  y 1 kg, cada peso subido de 5 en 5. Solo lee la base y usa las mismas
  cuentas que el panel; como los bolívares cambian con la tasa, el archivo
  vale para ese día.

## Pago móvil: lo que entra al banco

- **Qué hace** (pedido por el dueño el 14/11/2026: «hazlo automático
  todo»). El teléfono del negocio que tiene el **BDVapp** (un Huawei Y5
  2018) reenvía cada aviso de pago a la web con **MacroDroid**: disparador
  «Notificación recibida» de BDVapp que contenga «Recibiste» (o «SMS
  recibido», si el teléfono no deja leer las notificaciones), acción
  «Petición HTTP» POST a `/api/banco?clave=…` con el título y el texto de
  la notificación. La clave se crea en el panel (Pago móvil → «El teléfono
  del banco»), se guarda en `ajustes.banco_clave` y se cambia ahí; sin
  ella la web no acepta nada (401). Las instrucciones paso a paso están en
  esa misma pantalla.
- **Desde un iPhone** (el dueño lo pidió el 14/11/2026: el Huawei no le
  funcionó). El iPhone no deja a ninguna app leer las notificaciones del
  BDVapp, así que va con los **SMS del BDV**: en Atajos, una automatización
  «Mensaje» del remitente BDV (el número guardado como contacto) que
  contenga «Recibiste», con «Ejecutar inmediatamente» (iOS 17 o más nuevo),
  y la acción «Obtener contenido de URL» POST con cuerpo JSON (el campo
  «texto» con la entrada del atajo). Sin el remitente, cualquiera podría mandar un SMS
  falso que se anotaría como abono. En el panel, «Copiar la dirección» la
  copia para pegarla en Atajos.
- **Con el iPhone y sin SMS: dos toques** (a él no le llegan los SMS del
  BDV, solo la notificación del BDVapp). Un atajo «Pago móvil al panel»
  (hacer captura de pantalla → extraer texto de la imagen → POST JSON con
  el texto) puesto en Ajustes → Accesibilidad → Tocar → Tocar atrás →
  doble toque: con el aviso del BDV en la pantalla, dos toques en la parte
  de atrás y entra. `/api/banco` separa los avisos por «Recibiste» (una
  captura puede traer varios, y lo demás se deja) y un aviso con la
  referencia cortada (el principio de una que ya está, el mismo monto y el
  mismo día) es el mismo pago.
- **Qué lee** (`leerAvisoDelBanco` en `src/lib/banco-calculo.ts`, con
  pruebas): los dos avisos que manda el BDV, «Recibiste un PagomovilBDV por
  Bs.57.158,84 del 0424-5550199 Ref: 012345678094 en fecha 14-11-26 hora:
  08:30.» y «Recibiste un PagomovilBDV de PEDRO ANTONIO GOMEZ RIVAS por
  Bs.2.500,00 bajo el numero de operacion 008000123554» (sin fecha: vale la
  de cuando llegó), y las transferencias recibidas. Lo que no es un pago
  recibido (un pago hecho, una clave del banco, una promoción) **no se
  guarda**; solo se anota la hora, para saber que el teléfono sigue
  conectado. La misma referencia dos veces es un solo pago.
- **De quién es**, en este orden (`src/lib/banco.ts`): **ya estaba
  anotado** (un abono a mano con su captura, o cobrado en la caja, por pago
  móvil o transferencia, de esos días, con la misma referencia, o sin
  referencia y el mismo monto), y entonces solo se une; **lo avisó el
  cliente** desde su enlace de cuenta («¿Ya pagaste?», con la referencia y
  el monto, `avisos_de_pago`); **ya pagó antes** desde ese teléfono o con
  ese nombre en el banco (tabla `pagadores`, que se aprende cada vez que
  el dueño dice de quién era); o es **el teléfono de un cliente**. Si se
  sabe, se le abona como cualquier abono: en bolívares, con la tasa del día
  del pago (`tasaEnFecha`), método pago móvil, la referencia del banco y
  «Entró solo del banco». Si no, espera en **Pago móvil**
  (`/admin/banco`, tabla `movimientos_banco`) con lo que se le parece
  («Es de Pizzería La Esquina»: su nombre se parece o debe casi eso) y la
  lista de clientes para elegir; también «No es de un cliente» y
  «Descartar». Cada pago avisa en la campanita y en el teléfono del dueño, y
  el Resumen dice cuántos esperan.
- **Nunca dos veces.** Si un pago que entró solo se anota además a mano (o
  en la caja), el abono del banco se borra y queda el anotado, unido al
  movimiento (`unirPagoConElBanco`); el aviso de «abono repetido» no
  cuenta los del banco. Borrar un abono que vino del banco (o «Deshacer»
  en la bandeja) devuelve el pago a la bandeja, y deshacer olvida lo
  aprendido de ese teléfono. Lo cobrado en el mostrador no enseña nada de
  quién paga.
- **De la casa.** Los pagos de alguien de la familia no son abonos: «Es de
  la casa (siempre)» aparta ese pago y los siguientes de quien lo hizo (por
  su nombre o su teléfono en el banco; tabla `pagadores_de_la_casa`), sin
  avisar. «Pagan de la casa» los lista, con «Quitar».
- **La fecha de cada aviso.** La del propio aviso («en fecha 14-11-26»); si
  no la trae (la transferencia), la del encabezado de su notificación en la
  captura («mié, 20:45», «ayer»); si tampoco, el día en que llegó. Nunca una
  fecha de lo que se ve detrás en la captura (el historial del panel), y el
  tipo de pago sale de «Recibiste una transferencia…», no del título del
  aviso siguiente (`separarAvisos` y `fechaDelEncabezado` en
  `src/lib/banco-calculo.ts`, con pruebas).
- **Plan B.** Si el teléfono falla, en Pago móvil se pega el aviso (uno o
  varios seguidos) y se trata igual. Y el cliente puede avisar su pago
  desde su enlace: se le abona en cuanto llega (diez avisos al día como
  mucho).
- **Lo que no hace**: no lee el estado de cuenta del banco ni entra en el
  BDV; depende de que el teléfono esté encendido, con datos, con la sesión
  del BDVapp abierta y con MacroDroid fuera del ahorro de batería. Pago
  móvil dice cuándo llegó lo último que mandó.

## El WhatsApp del negocio (en preparación)

- **Qué es** (el dueño, 21/11/2026: «automatizar todos los WhatsApp que entren», con el mismo
  número). El 0424-6343236 sigue en **WhatsApp Business del teléfono** y, a la vez, conectado a la
  API de Meta (**coexistencia**): Meta manda a `/api/whatsapp` cada mensaje de un cliente, cada
  respuesta que el dueño escribe en el teléfono (`smb_message_echoes`) y, al conectar, los chats de
  los últimos seis meses (`history`). Se guardan en `whatsapp_mensajes`, cada uno unido a su
  cliente por el teléfono, y se ven en el panel (Clientes → WhatsApp). **Por ahora nada contesta
  solo**: lo primero que hará será responder precios y pasar los pedidos al panel.
- **En Meta**: el portfolio «Comercializadora Villa Real» (con la web verificada por la metaetiqueta
  de `src/app/layout.tsx`, el Instagram, la página de Facebook y el WhatsApp Business) y la app
  «Villa Real Panel» de Meta for Developers con el caso de uso de WhatsApp. **No es «proveedor de
  tecnología»**: ese paso no tiene vuelta atrás y se prueba antes sin él (Meta dice que la
  coexistencia es para proveedores; si no deja, se hace).
- **Lo que pide** la pantalla WhatsApp: el identificador de la app, el de la configuración de
  «Embedded Signup» (Inicio de sesión con Facebook para empresas → Configuraciones) y la **clave
  secreta de la app**, que se guarda en `secretos` (no va en las copias, nunca se enseña); la
  dirección de los avisos y su palabra de verificación, para pegarlas en la app de Meta; y el botón
  **«Conectar el número»**, que abre la ventana de Meta con `featureType:
  whatsapp_business_app_onboarding`. Al terminar se cambia el código por el permiso, se suscribe la
  app a los avisos de la cuenta y se piden, una sola vez y en 24 horas, los contactos y el historial.
  **Nunca se registra el número** (`/register`): eso lo sacaría del teléfono.
- **La revisión de Meta** (22/11/2026). Con la empresa verificada (21/11) y la app publicada, «Conectar el número»
  dice «Comercializadora Villa Real no puede registrar clientes en este momento»: para conectar un número que está en
  WhatsApp Business del teléfono, la app necesita el acceso avanzado a `whatsapp_business_messaging` y
  `whatsapp_business_management`, que da la revisión de la app. Para ella, la pantalla WhatsApp tiene su paso 4: con el
  número de prueba que Meta da gratis y su token (WhatsApp → Configuración de la API; vale 24 horas y se guarda en
  `secretos`), manda un mensaje y crea una plantilla, y enseña las plantillas de la cuenta, con los textos en castellano y
  en inglés para quien revisa. Son las llamadas de prueba y los dos videos que pide Meta.
- **Seguridad**: lo que llega a `/api/whatsapp` sin la firma de Meta (`X-Hub-Signature-256`, con la
  clave secreta) no se guarda. Solo la pantalla WhatsApp deja cargar el SDK de Facebook (su
  Content-Security-Policy, en `next.config.ts`); si se llega a ella desde otra pantalla sin recargar,
  se recarga sola una vez.
- **Lo que cambia en el teléfono** al conectar: WhatsApp Web y los demás aparatos enlazados se
  desenlazan (se vuelven a enlazar), las listas de difusión quedan de solo lectura y los mensajes
  temporales y de «ver una vez» se apagan. Responder a quien escribe es gratis; lo que la web mande
  por su cuenta lo cobra Meta.

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
  precio de venta): ese se sigue poniendo a mano, salvo en los productos
  unidos a la lista del detal, que toman su costo (ver «El mismo costo en
  el detal y en el mayor»). El último costo pagado se ve en Inventario.

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
- **Contar todo** (`/admin/inventario/contar`, el botón de arriba en
  Inventario; el dueño, 25/11/2026: «necesito perfeccionar mucho lo del
  inventario… por lo menos dejar el sistema ya integrado»). El recuento
  general de una vez: todo lo que está en la web, por familias como el
  catálogo, y al final lo que no está en ella pero tiene existencia o se
  ha vendido («Fuera de la web»). Cada artículo dice lo que cree el
  sistema y tiene su casilla («12,5» o «12.5»): lo contado entra con la
  fecha de hoy como un recuento (lo contado menos lo que había; un cero
  también, para que quede dicho que se contó y el artículo se empiece a
  seguir), todo en una sola escritura. Lo vacío no se toca, y si una
  casilla no se entiende se guarda lo demás y se dice cuál falta (no se
  pierde lo escrito en las otras cuarenta). Mientras no se haya contado
  nada, Inventario lo avisa arriba. Las cuentas, con pruebas, en
  `src/lib/existencias-por-familia.ts`.
- **Lo que ve la vendedora** (`/existencias/abcdefghjkmnpq`; en
  Inventario, «Lo que ve la vendedora»: crear, mandar por WhatsApp y
  renovar el enlace). Desde su teléfono, sin clave, lo publicado en la web
  por familias con lo que hay de cada artículo, al día con las ventas:
  cuánto (y unas cuántas piezas, si se sabe lo que pesa una), «Queda
  poco», «Agotado» o «Pregunta» (aún no se ha contado), con un resumen
  arriba y el buscador. Sin costos, sin precios y sin nada más del panel.
  Puesta en la pantalla de inicio es su app, «Lo que hay» (su manifiesto,
  solo con el enlace vigente). Fuera de los buscadores; «Renovar el
  enlace» pone otro y el anterior deja de funcionar.

## Catálogo: familias, productos y ofertas

- **Familias y colecciones.** Hay dos cosas distintas, y el panel las
  distingue (`familias.coleccion`): las **familias de productos** (Quesos,
  Embutidos, Salsas y aderezos, Papas y congelados, Huevos, Lácteos,
  Bebidas…) y las **colecciones por tipo de negocio** (Burger, Pizzería),
  que no son categorías de productos sino lo que necesita cada negocio,
  juntando productos de varias familias por secciones. Se crean solas en
  una base nueva (`FAMILIAS_INICIALES` en `src/lib/catalogo-inicial.ts`);
  en una que ya tiene familias, las nuevas las crea el dueño en Familias,
  marcando si es una colección. Cada tipo de producto tiene **una familia
  principal** (`productos.familia_id`) y sale **también en los negocios y
  otras familias que se marquen** (`producto_categorias`) sin repetirse en
  la base: la tocineta es de Embutidos y sale en Burger y en Pizzería, con
  un solo precio. Cada familia tiene su nombre, descripción, icono,
  portada, orden y si está activa; su dirección (`/categoria/burger`) no
  cambia aunque cambie el nombre. La portada enseña primero las
  colecciones («¿Qué necesitas para tu negocio?») y después las familias
  activas («Comprar por categoría»).
- **Secciones.** Dentro de una categoría los tipos van por secciones: los
  que vienen de otra familia, en la de su familia («Quesos», «Embutidos»),
  o en la que el dueño puso para esa categoría (la tocineta, en Burger, en
  «Proteínas»: `producto_categorias.seccion`); los suyos, en su sección
  (`productos.seccion`: la carne de hamburguesa, en «Proteínas») o sin
  título, primero. Se escriben en el formulario del tipo, en «Secciones
  dentro de cada categoría». Así Burger queda en Quesos, Proteínas,
  Salsas y aderezos, Papas y congelados…, y Pizzería en Quesos, Embutidos
  y «Salsas y complementos».
- Los productos de antes quedaron en la suya por el nombre: los quesos en
  Quesos (el amarillo y la mozzarella salen también en Burger; la
  mozzarella y el pecorino, en Pizzería), los huevos en Huevos y el suero
  y la crema de leche en Lácteos. Se cambia en la ficha de cada uno.
- **Productos** (`/admin/productos`): arriba la tasa del día; debajo la
  lista, por estado (en la web, borradores, ocultos), por familia o
  buscando, cada uno con su enlace a su ficha, y el enlace a Marcas.
  **«Agregar producto»** (`/admin/productos/nuevo`) es un solo formulario
  en el orden del catálogo: arriba el **tipo de producto** (los que hay,
  agrupados por familia, o «un tipo nuevo»); «¿A qué familia pertenece?»
  con **«＋ Crear nueva familia»** dentro (nombre, descripción, icono,
  orden, portada, si está activa y si es una colección; la crea y vuelve
  con todo lo escrito y la familia ya elegida, sin JavaScript); los
  negocios y otras familias en que sale (casillas) con sus secciones; la
  **marca**, de la lista o «＋ Nueva marca» escrita al lado (se crea al
  guardar); la **presentación**, de la lista o una nueva; peso o
  contenido; estado; se vende por (kilo, unidad o cartón); costo, margen y
  precio al mayor; precio al detal (opcional); existencia (opcional, solo
  para un tipo nuevo); descripción; foto; «Destacarlo en la portada» y
  «Mostrarlo en Ofertas». Si el tipo elegido ya está, lo escrito es el
  **artículo** que se le añade (marca, presentación, precio, foto) y las
  casillas marcadas se le suman; si es nuevo, es el tipo entero
  (`agregarProducto` en `src/lib/acciones.ts`). Lo que no es por kilo se
  cobra por su presentación: «por bolsa de 2,5 kg». Nada de esto necesita
  tocar el código: familias, colecciones, tipos, marcas y presentaciones
  se crean desde el panel.
- **La ficha de cada producto** (`/admin/productos/7`): el mismo
  formulario, su foto (que la web enseña en lugar de la de referencia), publicarlo u
  ocultarlo, sus marcas y presentaciones, y borrarlo. Con varias marcas, el
  precio, la marca y la presentación van en cada artículo: en la ficha del
  tipo queda el margen.
- **Estados.** *Borrador* (sin terminar: no sale en la web ni en las
  ventas), *activo* (en la web) e *inactivo* (oculto). Son las columnas
  `activo` y `borrador`; publicar un borrador lo saca del borrador.
- **Borrar un producto** pide confirmar y solo se puede si nunca se vendió,
  se compró ni se contó: las notas y el inventario lo nombran. Si no, la
  pantalla lo explica y ofrece ocultarlo. Al borrarlo se van con él sus
  marcas sin vender, sus fotos, sus reseñas, sus categorías y su sitio en
  las ofertas.
- **Familias** (`/admin/familias`): cuántos productos tiene cada una (los
  suyos, los que también salen en ella, los publicados), editarlas,
  ordenarlas (el número de orden), esconderlas, ponerles portada (se
  recorta en 4:3, `normalizarPortada`) y borrarlas. Borrar una que es la
  principal de algún producto avisa y pide a qué familia pasan.
- **El catálogo inicial.** El botón **«Preparar el catálogo inicial»**
  (en Productos, mientras falte algo) crea en **borrador** los tipos que
  pidió el dueño (quesos de año y parmesano, crema de leche, tocineta,
  jamón, pepperoni, salami, papas, hash browns, nuggets, salsas, pan y
  carne de hamburguesa, complementos de pizzería, refrescos…; la lista
  está en `BORRADORES`) con su familia, sus otras categorías y su sección,
  **sin precio, sin marca, sin presentación y sin publicar**, y los combos
  Pack Burger, Pack Pizzería y Pack Emprendedor, también en borrador y sin
  precio. No duplica lo que ya existe (sin mirar tildes ni mayúsculas).
  Pulsarlo otra vez no hace nada (`src/lib/preparar-catalogo.ts`). Lo que
  era otra presentación de un tipo ya no va aparte (`BORRADORES_RETIRADOS`):
  el queso cheddar y el amarillo en lonchas son «Queso amarillo /
  Cheddar», la mozzarella rallada es una presentación de la mozzarella,
  los huevos por caja o por unidad son presentaciones de Huevos, los
  refrescos individuales y familiares, de Refrescos, y las papas ralladas
  son los hash browns.
- **La charcutería en la web** (el dueño, 15/11/2026: «añade a mi página web
  todo lo que ya tengo en la charcutería en las facturas que te he pasado»).
  Cada producto de la charcutería de la lista del detal que se sigue
  comprando es un artículo del catálogo, con su marca, y está unido a su
  producto de la lista (`lista_detal.producto_id`, `variante_id`): las
  facturas siguientes le cambian el costo solas. El precio al mayor es el
  costo más un 10 % (`margen_pct` del tipo), la misma regla de la mozzarella
  y del Sortilegio. En Embutidos, por secciones: Jamones (de espalda, de
  pierna, ahumado, arepero), Pavo (pechuga), Mortadelas y boloña (la
  mortadela por kilo, la «Mortadela en pieza» de 1 kg y 500 g, que va por
  unidad, y la boloña de pollo), Salchichas (de paquete y a granel) y
  Tocineta; en Quesos, el queso amarillo (El Legado y Mi Vallecito; el
  Kemmental, que no se vende, escondido) y el pecorino; en Lácteos, los
  sueros y las cremas de leche. Lo que la lista marca «ya no se compra» no
  entra. Las fotos son las de su mercancía recortada (`publicidad/fotos/`);
  un artículo sin foto propia se enseña con la del tipo, la de referencia o
  el león, nunca con la de otra marca.
  **Desde el 18/11/2026, solo sus marcas** (el dueño: «lo de mi mamá al detal
  es aparte del burger, quítalo de la web»): la web enseña Guaralact,
  Sortilegio, El Drago, La Vega, El Legado, Mi Vallecito, Cumbre Fresca, de
  Purolomo solo las salchichas wieners y, en Bebidas, la Big Cola por bulto
  de 6 × 2 L (5,50 $ desde el 20/11/2026: el costo de su factura del 19/11 más un 10 %, como todo lo del burger). Lo demás de la charcutería (Alibal,
  Punta de Monte, Alpro, Ahulux, Magro's, San Pedro) y el queso arepero están
  escondidos, no borrados: siguen en la lista del detal con sus precios, y
  vuelven a la web mostrando la marca en su ficha. La marca «Puroloma» era
  una errata: es Purolomo.
- **Mis precios** (`/precios/abcdefghjkmnpq`; el dueño, 20/11/2026: «necesito una
  lista personal para ver todos los precios del burger y productos»). Como la
  lista de la familia, pero de Villa Real y solo para él: todo lo publicado en
  la web, por familias, cada artículo con su precio al mayor en bolívares a la
  tasa de hoy y en dólares, y debajo su costo y lo que deja («Costo 1,46 $ ·
  deja 0,15 $ (10 %)»). Sin clave, con su enlace (catorce letras al azar,
  fuera de los buscadores), que se crea y se renueva en Productos → «Mis
  precios»; puesta en la pantalla de inicio es su app, «Mis precios». Lleva
  los costos: no se manda a nadie (`src/lib/mis-precios.ts`, con pruebas).
- **Lo comprado para el burger** (desde el 19/11/2026: él manda las facturas y
  las notas): todo a costo + 10 % («a todo el burger le voy a meter un 10
  porciento»). Las salsas Gustossa (bulto de 15) y las papas fritas (bolsas de
  150 g y de 1 kg) se venden por unidad; la carne para hamburguesa Minco (Hot
  Burger) por unidad de 5 carnes; los refrescos (Big Cola, Pepsi, Golden) por
  bulto; los desechables, en la familia **Desechables** (también en Burger),
  por paquete como vienen, y las cajas térmicas y la bandeja C1 en paquetes de
  20 que arma él. Los costos, con su factura, en `listas/compras/costos-burger.txt`.
- **La lista de compra** (`/admin/compra`, en Mercancía; el dueño, 18/11/2026:
  «hazme la lista que pueda abrir en el teléfono»). Lo que hay que comprar, por
  tipo (hamburguesas, perros calientes, pizza, papas y congelados, bebidas,
  desechables, charcutería, huevos, víveres) o por proveedor, cada cosa con
  dónde sale más barato, a cuánto (vacío si ninguna lista lo trae) y una nota
  («bulto de 20: 41,01»). Se toca para tacharla, y otra vez para destacharla;
  «Lo que falta» esconde lo tachado. Abajo se agrega lo que falte, «Quitar
  productos» quita lo que sobre (pregunta antes) y «Destachar todo» la deja
  como nueva para la próxima compra. Sin JavaScript: cada toque es un
  formulario que vuelve a la altura del producto (tabla `lista_compra`,
  `src/lib/lista-compra.ts`; los grupos y la cuenta, con pruebas, en
  `src/lib/lista-compra-calculo.ts`).
- **Lo de La Vega** (el dueño, 18/11/2026: «agrega los chorizos, picante,
  ahumado, ajo, y además el pepperoni»). En Embutidos, la sección
  «Chorizos» (el tipo Chorizo: con ajo, ahumado y el picante parrillero, que
  en el paquete dice «salchicha cocida superior picante parrillera») y la
  sección «Pepperoni», que sale también en Pizzería: solo el estándar, el más
  barato, que es el que vende («el maxi» y «el de 2 piezas» quedan
  escondidos). Por kilo, con el costo de la lista mayorista de La Vega de
  noviembre (sin IVA: trabajan por nota; el paquete normal, no el largo) más
  un 10 %. No están en la lista del detal, así que su costo se cambia a mano
  en la ficha de cada marca. Las fotos son las de La Vega, con su etiqueta;
  la del pepperoni estándar, que sale de producción sin etiqueta, es la del
  pepperoni de la web de La Vega.
- **Ofertas y combos** (`/admin/ofertas`): cada oferta tiene nombre,
  descripción, precio en dólares (vacío: «consulta el precio»), fechas
  desde y hasta (vacías: sin límite), estado (borrador, activa, inactiva),
  orden y lo que lleva, con cuánto de cada producto («2 kg»). Sale en la
  web solo activa y dentro de sus fechas (`estaVigente` en
  `src/lib/catalogo.ts`). Borrarla pide confirmar y no toca los productos.
- **El afiche del combo** (el dueño, 24/11/2026: «los combos de perros,
  ponle unos detalles así», como el volante de la tienda). En la web, la
  imagen de cada combo es un afiche rojo con marco dorado y rayos de luz.
  Lleva los productos del combo y, arriba a la derecha, la etiqueta
  amarilla «PRECIO» con lo que cuesta en dólares; el precio sale de la
  base, así que nunca queda viejo. Cada producto va con su foto si la
  tiene de verdad: la suya, o la de su única marca a la venta. Con varias
  marcas no se sabe cuál lleva el combo: las salchichas del combo de perros
  son Alimex y la única foto de salchichas es la de Purolomo. En ese caso,
  o sin foto, el producto va con su cantidad en grande y su nombre
  («10 Salchichas»). Al subir la foto de un producto en el panel, el afiche
  la pone solo (`src/lib/afiche-combo.ts`, con pruebas; `AficheDeCombo` en
  `src/components/vitrina.tsx`). Con cuatro productos o más, todos con su
  cantidad (los combos de 10 hamburguesas o de 20 perros, 24/11/2026), el
  afiche es cuadrado (4:5 en un teléfono estrecho) y lo que lleva empieza
  debajo de la etiqueta del precio, para que quepa todo y nada quede tapado.

## La vitrina y el carrito

- **La cabecera**, en todas las páginas públicas, verde bosque: arriba el
  león y «Villa Real» (en la serifa de los títulos, en oro), el buscador
  (una píldora crema con la lupa en un círculo dorado), el carrito con
  cuántos productos lleva (el número, en oro, en la esquina del botón) y
  el botón de WhatsApp; en la pantalla ancha, debajo, el menú (Inicio,
  Productos, Burger, Pizzería, Ofertas, Contacto) en su propia fila, más
  oscura, con una raya dorada bajo la sección abierta. En el teléfono, el
  león, el carrito, WhatsApp y un menú que se despliega con el buscador y
  las secciones en letra grande (funciona sin JavaScript; con él, se
  cierra solo al ir a otra página).
- **La portada** vende la idea, no un supermercado: «Todo para tu burger &
  pizzería» sobre la foto de la hamburguesa y la pizza saliendo del horno
  (en la pantalla ancha, la foto a todo el ancho y el texto a la izquierda,
  sobre su parte oscura; en el teléfono, la foto arriba, fundida en el
  verde, y el título montado sobre ella), los dos botones («Ver todos los
  productos» en oro y «Pedir por WhatsApp»), la tasa del día en una
  píldora y, abajo, los atajos a las familias (en el teléfono, una fila
  que se desliza de lado); una banda verde pegada a la foto con el mensaje
  mayorista («Precios al mayor · Compra más, paga menos · Tu proveedor
  para burger & pizza») en la serifa dorada; **«¿Qué necesitas para tu
  negocio?»** con las colecciones (Burger, Pizzería), dos fotos grandes
  con su botón dorado; **«Comprar por categoría»** con las familias
  activas, cada una con su foto y el mismo velo verde (en el teléfono, una
  fila que se desliza de lado; en la pantalla ancha, cuatro por fila, y la
  última fila se reparte para no dejar huecos; una sin productos
  publicados lo dice en su página y ofrece preguntar); los **productos
  destacados**, cuatro como mucho (los marcados «Destacarlo en la
  portada»; si no hay ninguno, los cuatro primeros), sobre una banda crema
  más oscura; los combos vigentes; «¿Estás montando tu negocio?» y dónde
  está la tienda, también sobre la banda crema, que llega hasta el pie. Se
  guarda hecha y se rehace con cada cambio del panel y cada mañana con la
  tarea diaria (así un combo que vence deja de salir).
- **Productos** (`/productos`): todos los publicados y los **filtros**, que
  van y vuelven por la dirección: el **buscador** (`?q=`; «mozzarella» trae
  todas las mozzarellas: cada palabra tiene que estar en el nombre, la
  marca, la presentación, la descripción, las marcas o las familias del
  producto, sin tildes ni mayúsculas y en singular o plural,
  `textoCoincide` en `src/lib/buscar.ts`), la **familia** (`?familia=`),
  el **negocio** (`?negocio=burger`) y la **marca** (`?marca=guaralact`).
  Lo que no se encuentra se dice, con un botón para preguntarlo por
  WhatsApp. En el teléfono los filtros van juntos, para que los productos
  asomen enseguida: «Buscar» al lado de la casilla, la familia y el negocio
  uno al lado del otro y las marcas en una fila que se desliza de lado (las
  elegidas primero); en la pantalla ancha, en una fila.
- **Cada colección y cada familia** (`/categoria/burger`,
  `/categoria/quesos`): su portada, sus productos (los suyos y los que
  también salen en ella, sin repetirse; los destacados primero) por
  secciones, el filtro por marca y las demás familias. Burger lleva a
  Quesos → Queso amarillo / Cheddar, Mozzarella; Embutidos / Proteínas →
  Tocineta, Jamón, Carne de hamburguesa; Papas y congelados; Salsas y
  aderezos; Bebidas. Una familia escondida da 404; una sin nada publicado
  lo dice y ofrece preguntar.
- **Ofertas** (`/ofertas`): los combos activos y en fecha, con lo que
  llevan (cada producto publicado con su enlace), su precio o «Consulta el
  precio del combo», hasta cuándo valen, «Agregar» y «Pedir este combo por
  WhatsApp»; y los productos marcados «Mostrarlo en Ofertas». Sin ninguno,
  lo dice.
- **El carrito** (`/carrito`): «Agregar» suma un kilo, un cartón, una
  unidad o un combo (en la página del producto se elige cuánto; lo que va
  por kilo, de medio en medio). Lo elegido se guarda **en el teléfono del
  cliente** (`localStorage`), no en la base: solo qué y cuánto. Los
  nombres y los precios se piden a la web cada vez (`/api/carrito`), así
  nunca sale un precio viejo; un producto escondido, un borrador, una marca
  escondida o un combo vencido salen como «ya no está en la web» y no
  entran en el pedido. Se cambian cantidades, se quita, se ve el total
  estimado en bolívares a la tasa BCV de hoy y en dólares, y con nombre,
  negocio y nota (opcionales) **«Enviar pedido por WhatsApp»** abre
  WhatsApp con el pedido escrito: cada producto con cuánto y su precio, el
  total estimado, la tasa y a nombre de quién. Lo que no tiene precio va
  «por confirmar» y no suma. La página dice que **el pedido no queda hecho
  hasta que el negocio responda**: abrir WhatsApp no es una venta, y el
  dueño la anota en la caja como siempre. Los buscadores no guardan esta
  página.
- **Pedidos de la web** (`/admin/pedidos`, en el menú «Pedidos web»; noche
  del 14/11/2026). Al pulsar «Enviar pedido por WhatsApp», el carrito deja
  también una copia del pedido en el panel (`navigator.sendBeacon` a
  `/api/pedido`, sin esperar: WhatsApp se abre igual), para que ninguno se
  pierda entre los chats: el Resumen dice cuántos hay nuevos, la campanita
  y el teléfono avisan, y cada uno se marca «Atendido» o «Descartar».
  **«Pasar a la caja»** abre la caja con sus productos en el carrito (a los
  precios de hoy, no de contado; lo que no está en la caja, como un combo de
  la web, lo dice), la observación «Pedido de la web N.º 12» y su nombre en
  el buscador de clientes; si la caja tenía otra venta a medias, pregunta
  antes de cambiarla. Al guardar la venta el pedido queda atendido y unido a
  ella («Su venta: nota 000130»; `pedidos_web.venta_id`). Es
  público: lo que llega se limpia y se recorta, el mismo pedido dos veces es
  uno, y cada dirección puede mandar cinco por hora (tabla `pedidos_web`,
  `src/lib/pedidos-web.ts`).
- **El delivery** (lo más importante para el dueño, 13/11/2026). En el
  carrito, «¿Cómo lo recibes?»: **delivery** a Barquisimeto y Cabudare o
  **lo busco en la tienda**. Con delivery, «Usar mi ubicación» (el GPS del
  teléfono; la web lo puede pedir porque `Permissions-Policy` deja
  `geolocation=(self)`) o la dirección escrita: por calle y carrera se
  sitúa en el plano del centro y, si no (una urbanización, un centro
  comercial), se busca en el mapa libre (`/api/delivery`,
  `src/lib/delivery-servidor.ts`). La web dice a cuántos kilómetros está
  de la tienda, **en línea recta**, y el precio del delivery con las
  **tarifas del panel** (`/admin/delivery`, en el menú «Delivery»: hasta
  tantos km, tantos dólares, y si se quiere, gratis desde un monto de
  compra; «Probar una dirección» dice la distancia y lo que cobraría). Sin
  tarifas, o más allá de la última, «por confirmar»; fuera de
  Barquisimeto y Cabudare (los alrededores del plano), se confirma por
  WhatsApp. El delivery con precio entra en el total, y al pedido por
  WhatsApp van la forma de entrega, la dirección, el enlace a su ubicación
  en Google Maps, la distancia y el precio. El teléfono recuerda la forma,
  la dirección y la ubicación para el próximo pedido. Las cuentas, con
  pruebas, en `src/lib/delivery.ts`; la portada, «Cómo comprar» y el pie
  dicen que hay delivery.
- **La cabecera de la portada** lleva todos los productos de siempre y,
  desde el 18/11/2026, el pepperoni y la salchicha picante parrillera de La
  Vega atrás (una prueba con solo tres productos no le gustó al dueño: «me
  gustaba como estaba antes»). Su foto lleva `?v=` en `src/app/page.tsx`:
  al rehacerla, se cambia, o el teléfono sigue enseñando la de antes un día.
- **Las fotos** de la portada y de las familias (desde el 15/11/2026, sin el
  Kemmental, que no se vende: va el Mi Vallecito; y la tocineta más grande
  que los jamones, como es) son, desde el 13/11/2026,
  **la mercancía del negocio sobre color** (al dueño no le gustaban las
  fotos de comida de internet: «nada, ni el de la hamburguesa, quesos,
  nada»): sus productos recortados (los de las hojas de los combos y los
  de las marcas, en `publicidad/fotos/`) sobre un fondo liso verde, oro o
  crema, con su sombra y una luz suave, al estilo de un catálogo de una app
  de pedidos. Las hace `npm run fotos-web` (`scripts/fotos-web.ts`, que
  dice qué productos van en cada una y dónde). Las de las familias llevan
  los productos en la franja de arriba, entre el 15 % y el 55 % del alto,
  porque la misma foto sale en la tarjeta (cuadrada o apaisada) y en la
  cabecera de su página, con el nombre encima de la mitad de abajo; las
  familias sin mercancía con foto (salsas, papas, bebidas…), el color con
  el león. Las referencias de los huevos, el jamón arepero y los quesos
  blancos son también la mercancía recortada sobre blanco; las demás
  referencias (de productos aún en borrador) siguen siendo fotos de comida
  libres. Créditos en `public/familias/CREDITOS.md` y
  `public/productos/CREDITOS.md`. Una portada de familia o una foto de
  producto subidas en el panel sustituyen a las incluidas.
- **Diseño** (rehecho en noviembre de 2026, porque el de antes al dueño no
  le gustaba): el de una marca de alimentos para negocios, con los colores
  de la fachada y de las franelas llevados a más contraste
  (`src/styles/tokens.css`, sección «La web pública»): **verde bosque**
  casi negro en la cabecera, la portada, el pie y la caja de compra;
  **el oro del león** (`#e3a91f`, el de `public/marca/leon.svg`) en los
  botones principales, las rayas y los detalles, y un oro más hondo para
  la letra pequeña sobre crema; **crema** de fondo, con bandas crema más
  oscuras para separar secciones, y tarjetas blancas con una sombra
  verdosa. Un solo acento, el **rojo tomate**, y solo en las etiquetas
  «Oferta» y «Combo». WhatsApp conserva su verde, porque el cliente lo
  reconoce. Dos letras, que Next descarga al compilar y sirve la propia
  web (el teléfono no le pide nada a Google): **Fraunces**, una serifa
  redonda y gruesa (con su eje «SOFT» al máximo), para los títulos, y
  **Manrope** para leer y para los precios, con las cifras alineadas.
  Anton queda solo para la lista del detal. Los botones son píldoras.
  Las tarjetas de producto: la foto cuadrada arriba, el nombre, el detalle,
  una raya de puntos y el precio al mayor en bolívares grande con los
  dólares debajo, «Agregar» en verde (o «Ver opciones» con borde) y «Ver
  detalles» subrayado en oro. Los combos son como un vale: una raya de
  puntos con un mordisco a cada lado antes del precio. Productos, Ofertas
  y el carrito empiezan con una banda verde a todo el ancho, pegada a la
  cabecera, con el título grande en crema (en Productos, el buscador monta
  sobre ella); cada familia, con su foto en una tarjeta que monta sobre la
  misma banda. La página de cada producto: la foto en su marco blanco y,
  al lado, el nombre y **la caja de compra en verde bosque**, con el
  precio en crema, «Agregar al carrito» en oro y «Pedir por WhatsApp»;
  debajo, las marcas, «Por qué elegirlo» (las reseñas como citas, con
  unas comillas doradas) y «Cómo comprar». Las bandas a todo el ancho
  pintan su fondo con una sombra recortada, así nada se sale de la
  pantalla. Primero el teléfono: entre 360 y 400 px no se desborda nada a
  los lados; en una pantalla ancha, el menú en su fila y la ficha del
  producto en dos columnas.

## La web hacia fuera

- **Al compartir un enlace** por WhatsApp sale una vista previa con imagen:
  la de la portada, o la del producto con su foto (la suya, la de su marca
  o la de referencia) y su precio en dólares.
  El precio en bolívares no va en la imagen porque cambia cada día.
- **Para los buscadores**: descripción con la ciudad, datos de la tienda y
  de cada producto (JSON-LD), mapa del sitio (portada, Productos, Ofertas,
  cada categoría, cada producto y cada marca) y `robots.txt`. El panel,
  las tareas y el carrito quedan fuera de los buscadores.
- **Que cargue rápido en el teléfono** (revisado con Lighthouse el
  13/11/2026: accesibilidad, buenas prácticas y buscadores a 100). La foto
  grande de arriba se pide primero y nada le quita el turno: los círculos
  de las categorías llevan su miniatura de 128 px, las tarjetas de la fila
  de categorías una portada de 480 px cuando les basta (`srcset`), y los
  productos destacados de la portada esperan a que se llegue a ellos (solo
  en Productos, donde están arriba, las dos primeras fotos van primero).
  Las fotos que la web sirve desde la base llevan `?v=` con su fecha: el
  teléfono las guarda un año y Vercel un día (una foto escondida deja de
  verse a más tardar al día siguiente); las de `public/`, un día
  (`next.config.ts`).
- **En el teléfono** la web se puede poner en la pantalla de inicio, con el
  león de icono. Manteniendo pulsado el icono sale el acceso al panel.
- **El panel como app.** El panel tiene su propio manifiesto
  (`/admin/manifest.webmanifest`, sin sesión): puesto en la pantalla de
  inicio se llama «Panel», abre directamente en `/admin`, a pantalla
  completa, y con atajos a venta, abono, despacho y cierre. Las
  instrucciones para Android y iPhone están en `/admin/app`. No hay app de
  tienda: publicarla en Google Play o en la App Store cuesta dinero y no
  añade nada que esto no haga.
- **El dominio**: https://www.comercializadoravillareal.com, comprado el
  18/11/2026 en Vercel (Settings → Domains; sin www lleva a www). Está en
  `src/config/negocio.ts` (`web`), y con él se hacen los enlaces, el mapa
  del sitio y las vistas previas. La dirección de antes,
  villareal-green.vercel.app, sigue abriendo la misma web sin redirigir:
  los enlaces ya mandados (cuentas, la lista de la familia, el atajo del
  banco) siguen valiendo. El panel puesto como app en el teléfono, sus
  avisos y su sesión son de la dirección en que se abrió: para pasarlos al
  dominio, entrar al panel por él, ponerlo otra vez en la pantalla de
  inicio y volver a activar los avisos.
- **Fechas.** En Vercel el servidor va en hora UTC. Las fechas que propone
  el panel y las que se enseñan son las de Venezuela (UTC−4), esté donde
  esté el servidor.

- **La campanita y los avisos al teléfono.** Arriba a la derecha del panel
  está la campanita (`/admin/avisos`) con cuántos avisos hay sin leer: lo
  que el sistema sabe antes que el dueño. Cada día se crean los del día
  (`generarAvisosDelDia` en `src/lib/avisos.ts`, con una clave por cosa y
  día o semana para no repetirlos): el resumen de la mañana (con lo de
  ayer: notas, vendido y entrado), cada entrega
  para hoy y cada atrasada, cada cliente que pasó su plazo (una vez por
  semana), lo que se acaba del inventario (una vez por semana) y cuántos
  clientes llevan una semana sin trato; la tarea de las 6 añade la tasa
  BCV del día si cambió y avisa si la copia automática falló. Abrir la
  campanita los da por leídos. Los crea la tarea de las 7 (`/api/aviso-diario`, cron en
  `vercel.json` a las 11:00 UTC) y, por si no corrió, el Resumen al
  abrirse (solo escribe si faltan). Se conservan 90 días.
  - **Al teléfono.** En la campanita, «Activar avisos en este teléfono»
    pide permiso, registra el avisador (`public/admin/sw.js`, con alcance
    `/admin/`; el proxy lo deja pasar sin sesión) y guarda la suscripción
    (tabla `avisos_telefonos`, por `/admin/telefonos`). Cada mañana a las
    7 la tarea manda el resumen a todos los teléfonos con la librería
    `web-push` (`src/lib/push.ts`), como una notificación de cualquier
    app, aunque el panel esté cerrado; tocarla abre el panel. Un teléfono
    que ya no existe (404 o 410) o que falla cinco veces seguidas se quita
    solo. «Mandar un aviso de prueba» comprueba que llegan. En iPhone solo
    funciona con el panel puesto en la pantalla de inicio (desde iOS
    16.4); en Android, desde Chrome. Las claves VAPID se crean solas y
    quedan en `ajustes` si no están en las variables de entorno. La
    prueba de extremo a extremo lo cubre con un teléfono de mentira
    (claves P-256 de verdad y un destino que no responde); contra la web
    publicada no se toca nada de esto.

- **Stickers para WhatsApp** (`/admin/stickers`). Un juego de stickers con
  el león (512 × 512, fondo transparente, PNG y WebP, todos de menos de
  100 KB) para responder a los clientes: cuando pagan («¡Pago recibido!»,
  «Cuenta al día»), formas de pago («Pago móvil», «Zelle», «Mándeme la
  captura»), pedidos y entregas («¡Vamos en camino!»), cobrar con
  buena cara («Recordatorio de pago», «¿Me confirma el pago?»), saludos,
  productos y horario. La lista está en `src/lib/stickers.ts` y los dibuja
  `npm run stickers` (Chrome, Archivo Black, el león grande arriba) en
  `public/stickers/`, con un ZIP. Desde la pantalla se guardan en el
  teléfono y en WhatsApp se convierten en sticker con la foto (en iPhone:
  «+» → Sticker; en Android: stickers → crear). Para cambiar uno o añadir
  otro, se edita la lista y se vuelve a correr el guion. **Los cinco de todos
  los días** (el dueño, 15/11/2026: «solo necesito esos»): «Recibido,
  ¡gracias!», «¡Confirmado!», «Pedido confirmado», «Pago móvil» con sus datos
  y «¡Gracias por preferirnos!» tienen su propio diseño (`DISENOS` en
  `scripts/stickers.ts`): letra grande, el león sobre verde, borde blanco
  recortado y sombra, en PNG de color completo; salen arriba en la pantalla
  (`STICKERS_DE_SIEMPRE`) y los demás, plegados en «Otros stickers». La
  pantalla avisa de guardarlos desde ahí y no con una captura: la captura
  trae el fondo blanco y en el chat sale un cuadro blanco. El sticker con los
  **datos del pago móvil del dueño** (banco, cédula y teléfono) los toma de
  `PAGO_MOVIL_BANCO`, `PAGO_MOVIL_CEDULA` y `PAGO_MOVIL_TELEFONO` en
  `.env.local`: no van en el código, que es público (en la imagen sí, que es
  para mandársela a los clientes).

## Seguridad

- **La clave del panel** nace en `.env.local` (`ADMIN_CLAVE`, y la misma
  en Vercel). **«He olvidado la clave»**, en la entrada, manda un enlace de
  un solo uso que vale 30 minutos: al correo del dueño si hay Resend
  configurado (`RESEND_API_KEY`) y como aviso a los teléfonos con avisos
  activados. Con él se pone una clave nueva, que se guarda en la base
  (`ajustes.clave_panel`, como resumen con sal; nunca en claro) y manda
  sobre la de `.env.local`; las sesiones abiertas caducan. Para volver a
  la de `.env.local` se borra ese ajuste. No se manda otro enlace si se
  pidió uno hace menos de dos minutos, y desde una dirección frenada por
  claves malas no se manda ninguno (`src/lib/clave.ts`,
  `src/lib/correo.ts`).

- La entrada al panel frena a quien pruebe claves: con 5 fallos en 15
  minutos desde una dirección, esa dirección espera. Con 40 fallos de
  todas las direcciones juntas, cada intento tarda unos segundos más, pero
  nadie queda fuera: antes se bloqueaba a todos, y cualquiera podía dejar
  al dueño sin entrar.
- **Revisión de seguridad del 14/11/2026** (el dueño: «que no tenga chance
  de ser hackeable»):
  - **Cada pantalla del panel comprueba la sesión** al principio
    (`exigirPanel`, `src/lib/panel.ts`), no solo el layout: una petición
    hecha a mano podía pedir una página sin pasar por él. La prueba
    `panel.test.ts` falla si una pantalla nueva no lo hace. El proxy, además,
    para las cookies que ni siquiera tienen la forma de una de verdad.
  - **La sesión** (`src/lib/sesion.ts`) lleva cuándo se entró, una versión
    y una firma; dura 30 días. La firma usa la clave y un **secreto al azar
    del servidor** (tabla `secretos`, que no va en las copias): una copia de
    la base no sirve para entrar, y una cookie robada no deja adivinar la
    clave. En Avisos → «Seguridad», **«Cerrar la sesión en todos los
    teléfonos»** deja fuera a los demás. Las cookies de antes valen hasta el
    15/12/2026 y se cambian solas por una nueva.
  - **Los teléfonos con avisos** (que reciben también el enlace de «He
    olvidado la clave») se ven en Avisos, con «Quitar», y cuando se activa
    uno nuevo los demás reciben un aviso.
  - «Ya pagué» pide **seis cifras** de la referencia y el monto al céntimo,
    y no se abona solo si el pago salió del teléfono de otro cliente.
  - Las descargas para Excel ponen un apóstrofo delante de lo escrito que
    Excel ejecutaría como fórmula (`=`, `+`, `-`, `@`).
  - **Content-Security-Policy**: cada página solo carga lo de la propia web.
  - Next 16.4.6, con los arreglos de seguridad de esa versión.
- Cabeceras de seguridad en todas las páginas (`next.config.ts`).
- Ninguna clave en el código ni en el repositorio, que es público.

## Reglas

- **No inventar.** Si el precio no está, la web dice «consulta el precio del
  día». Si el teléfono no está, la web no muestra ninguno.
- **Escribir en castellano.** Código, comentarios, mensajes y commits.
- **El panel responde al toque.** Al tocar un enlace del panel sale una raya
  dorada arriba mientras llega la pantalla (`src/components/aviso-de-carga.tsx`;
  la web dormida tras un rato sin uso tarda unos segundos en la primera), y al
  enviar un formulario el botón se apaga y dice «Guardando…» hasta que la
  página cambia: un toque doble no registra dos veces una venta ni un abono
  (`src/components/un-solo-envio.tsx`). Sin JavaScript todo sigue
  funcionando igual. No hay `loading.tsx`: con él la respuesta sale antes de
  saber si la página existe y los 404 y las redirecciones dejan de serlo.
- **El menú, por lo que se quiere hacer** (el dueño, 15/11/2026: «quiero que
  sea más fácil para las otras personas»). Arriba siete grupos en el orden
  del día (Inicio, Vender, Cobrar, Clientes, Mercancía, Facturas, La web),
  cada uno con su dibujo; debajo, solo las pantallas del grupo abierto, con
  la abierta en dorado (`GRUPOS` en `src/app/admin/(panel)/layout.tsx`). En
  el teléfono los grupos van en una cuadrícula de cuatro, sin deslizar de
  lado. Una pantalla nueva va en su grupo; lo que cuelga de otra (la ficha
  de una marca, de Productos) va en su `tambien`. «Cómo se usa» lo explica.
- **Móvil primero.** El dueño usa el panel desde el teléfono en el local.
  Ninguna página se desborda a los lados. Las tablas del panel llevan la
  clase `tabla--fichas` y cada celda su `data-label`: en el teléfono cada
  fila se pinta como una ficha, con el nombre de la columna delante de
  cada dato; en pantallas anchas y en papel siguen siendo tablas.
- **Ninguna clave en el código.** Van en `.env.local`.

## Pendiente

- El RIF está al día: el comprobante digital (formato nuevo, sin fecha de
  vencimiento) dice «Última actualización 19/08/2026», con el mismo
  domicilio fiscal de `negocio.ts`. Contribuyente ordinario del IVA.
- Ya no hay precios de ejemplo: los huevos tienen el suyo desde el
  21/11/2026 (el cartón de 30 a 4,63 $ en la factura de AMBG del 20/11,
  más un 10 %: 5,09 $). La charcutería tiene precio desde el 15/11/2026
  (costo de la lista + 10 %).
- La foto de las salchichas cóctel de Cumbre Fresca, lo único en la web sin
  la suya: se sube en la ficha de la marca. Las de la mortadela tapara de El
  Drago y la tocineta de Cumbre Fresca las mandó el 18/11 y se recortaron con
  `publicidad/quitar-fondo.mjs`. La de la tocineta dice «Campo Fresco» y trae
  un RIF de ejemplo (parece hecha con un programa): se puso porque el dueño
  insistió; cambiarla por una foto real cuando la haya. La «tocineta ahumada» que mandó el 18/11 dice «Campo Fresco» y
  un RIF de ejemplo: parece hecha con un programa, y no se puso.
- Ver si Guaralac (la marca del pecorino) y Guaralact (la del suero) son
  la misma: si lo son, unirlas en Productos → Marcas.
- Fotos propias de los productos: hoy llevan una foto de referencia, marcada
  como tal. Se suben en la ficha de cada producto del panel.
- Las reseñas de verdad de cada producto: las que hay son de ejemplo y solo
  las ve el dueño.
- Registrar a los proveedores y lo que se les debe.
- Completar los productos del catálogo que vende (precio, presentación,
  foto) y activarlos; borrar los que no vende. Lo mismo con los combos.
  Las categorías (Embutidos, Papas, Bebidas…) ya salen en la portada;
  mientras no tengan nada activo, su página invita a preguntar por
  WhatsApp.
- Marcar los productos destacados: mientras no haya ninguno, la portada
  enseña todos.
- Si quiere, subir en Familias fotos propias para cada categoría: las que
  trae la web son fotos de comida de licencia libre, no de su mercancía.
- Activar los avisos en el teléfono del dueño (campanita → «Activar avisos
  en este teléfono», con el panel puesto en la pantalla de inicio).
- Poner `ANTHROPIC_API_KEY` en Vercel y en `.env.local` para que las
  fotos de las notas se lean solas. Sin ella, la foto se guarda sin más.
- Para facturar de verdad: elegir con el contador la
  imprenta digital autorizada (y entonces integrarla para que asigne el
  número de control sola) y confirmar con él qué productos están exentos.
  El panel ya emite las facturas, las notas de crédito y el libro de
  ventas; hasta tener el número de control, el papel no vale como factura
  fiscal.
- Las avenidas con nombre y los sitios conocidos entran en la ruta por el
  mapa libre, con la precisión que tenga ese mapa: conviene comprobar en
  la ficha dónde los puso.
