// Los combos del detal, escritos una sola vez: los usan el cartel grande (combos.html) y las hojas
// de cada combo (combos-individuales.html). Nada de marcas en los nombres: la marca se ve en la foto.
//
// De cada producto, lo que mide de alto en la vida real, en centímetros, tal como sale en su foto
// (aproximado; el dueño lo corrige): con eso se dibujan todos a la misma escala.
// El jamón de espalda y el de pierna, más grandes que los quesos amarillos (el dueño, 13/11): el de espalda era de 28 y el
// de pierna de 30. Los quesos amarillos, sin quedarse pequeños (el dueño, después): el cheddar era de 26 y el Mi Vallecito, de 30.
const CM = {
  "jamon-de-espalda": 32,
  "queso-amarillo": 29,
  // El arepero es un rollo de 1,8 kg y unos 7,5 cm de grueso (de largo, cerca de 40 cm). Con 32 salía flaco y pequeño al lado
  // de la mozzarella (el dueño, 13/11); con 36 es lo más alto del combo y la mozzarella no se queda chiquita.
  "jamon-arepero": 36,
  mozzarella: 27,
  "jamon-ahumado": 28,
  "jamon-de-pierna": 35,
  "queso-amarillo-vallecito": 32,
  "bolona-de-pollo": 30,
  // Más pequeño (era de 18, después de 16), como pidió el dueño.
  "suero-san-pedro": 14,
  "mortadela-de-pollo": 20,
  "pechuga-de-pavo": 28,
  "pechuga-de-pavo-drago": 28,
  // Un poco más grande (era de 26), como pidió el dueño.
  "pechuga-de-pavo-ahumada": 29,
  huevos: 9,
  salchichas: 17,
  tocineta: 28,
  // Casi tan alta como el queso amarillo: con 30, en el combo 9 el queso se veía muy pequeño a su lado (el dueño, 13/11).
  "mortadela-punta-de-monte": 27,
  "pan-de-sandwich": 34,
  "mortadela-extra": 30,
  "queso-paisa": 30,
};

// Cada producto: [foto, nombre, adorno]; el adorno es opcional y va dibujado encima de la foto: en el perrero, el
// perro caliente, las salsas y el chorro; en el navideño, el gorro y el moño; en el pizzero, el cortapizza,
// el gorro de cocinero y la porción; en el sandwichero, un sándwich. `fondo` pone dibujitos detrás de los productos: perros,
// pizzas o sándwiches.
// `estilo` es el de las imágenes que trajo el dueño (fondos/referencia-*.png|jpg): «navidad» y «pizza», con la cabecera
// en una placa verde, luces de fondo y la mitad de abajo roja («sandwich», como «pizza», sin nada de Navidad); «solidario»,
// la hoja roja de siempre, sin corazones, con
// estrellas en el sello, el título en relieve y hojas verdes a los lados.
// La charcutería (el jamón, la boloña, la mortadela, el pavo) va siempre primero, a la izquierda; el queso
// o lo que acompaña, después. Los combos con nombre propio (perrero, solidario, navideño, pizzero) son los especiales y van al final.
// Van en secuencia, como pidió el dueño: primero los de todos los días y al final los especiales. Un combo nuevo entra en su
// sitio y los que vienen detrás se corren un número (y se vuelven a imprimir sus hojas y el cartel).
// En las hojas, los productos van separados (el dueño, 13/11: «están muy pegados»): 10 mm entre dos, 6 mm entre tres.
// `separacion` (en mm) la cambia; negativa, se solapan. `alto` pone un tope a lo más alto (en mm); sin él, los productos
// salen lo más grandes que caben sin tocar la cabecera, el sello ni los lados.
// COMBOS y fotoDe quedan en globalThis: los usan las páginas que cargan este archivo con <script>.
globalThis.COMBOS = [
  { n: 1, productos: [["jamon-de-pierna", "Jamón de pierna"], ["queso-amarillo-vallecito", "Queso amarillo"]], detalle: "200 g de cada producto", lema: "Para el sándwich y la arepa", destacar: "el sándwich" },
  { n: 2, productos: [["jamon-de-espalda", "Jamón de espalda"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "El clásico para la arepa y el sándwich", destacar: "la arepa" },
  { n: 3, productos: [["jamon-de-espalda", "Jamón de espalda"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para el sándwich caliente y la pizza", destacar: "sándwich caliente" },
  { n: 4, productos: [["jamon-ahumado", "Jamón ahumado"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Sabor ahumado para la pizza y el sándwich", destacar: "Sabor ahumado" },
  { n: 5, productos: [["jamon-arepero", "Jamón arepero"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para la arepa, el sándwich y la pizza", destacar: "la pizza" },
  { n: 6, productos: [["pechuga-de-pavo-drago", "Pechuga de pavo"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para un sándwich diferente", destacar: "diferente" },
  { n: 7, productos: [["pechuga-de-pavo-drago", "Pechuga de pavo"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "Para la lonchera y el desayuno", destacar: "la lonchera" },
  { n: 8, productos: [["bolona-de-pollo", "Boloña de pollo"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "Desayuno completo: boloña y queso", destacar: "Desayuno completo" },
  { n: 9, productos: [["mortadela-punta-de-monte", "Mortadela especial"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "Para la arepa de todos los días", destacar: "todos los días" },
  {
    n: 10,
    titulo: "Combo solidario",
    productos: [["suero-san-pedro", "Suero San Pedro"], ["huevos", "Huevos"], ["mortadela-de-pollo", "Mortadela"]],
    detalle: "1 suero San Pedro de 800 ml, 6 huevos y 250 g de mortadela",
    lema: "Lo básico de la casa en un solo combo",
    destacar: "un solo combo",
    especial: true,
    etiqueta: "Especial solidario",
    // Sin corazones: al dueño no le gustaban.
    estilo: "solidario",
    // Los tres juntos, un poco solapados, como estaban.
    separacion: -7,
  },
  {
    n: 11,
    titulo: "Combo perrero",
    productos: [["queso-amarillo", "Queso amarillo tipo cheddar", "chorro"], ["jamon-de-espalda", "Jamón de espalda", "perro"], ["salchichas", "Salchichas", "salsas"]],
    detalle: "100 g de queso amarillo tipo cheddar, 100 g de jamón de espalda y 6 salchichas",
    lema: "Todo para los perros calientes de la casa",
    destacar: "perros calientes",
    especial: true,
    etiqueta: "Especial perros calientes",
    fondo: "perros",
    // Separados, no solapados (el dueño, 13/11: «que no estén tan pegados»). Lo alto lo pone la hoja: el perro caliente y
    // las salsas no llegan a la onda.
    // El queso amarillo, un poquito más grande que en los demás (era de 29), sin pasar al jamón (32).
    cm: { "queso-amarillo": 31 },
  },
  {
    n: 12,
    titulo: "Combo navideño",
    productos: [["tocineta", "Tocineta", "moño"], ["jamon-ahumado", "Jamón ahumado", "gorro"]],
    detalle: "200 g de tocineta y 200 g de jamón ahumado",
    lema: "Para tu mesa de Navidad",
    destacar: "Navidad",
    especial: true,
    etiqueta: "Especial de Navidad",
    // Luces de Navidad en el fondo.
    estilo: "navidad",
  },
  {
    n: 13,
    titulo: "Combo pizzero",
    productos: [["tocineta", "Tocineta", "cortapizza"], ["jamon-de-espalda", "Jamón de espalda", "cocinero"], ["mozzarella", "Mozzarella", "porcion"]],
    detalle: "100 g de tocineta, 200 g de jamón de espalda y 200 g de mozzarella",
    lema: "Arma tu pizza en casa",
    destacar: "tu pizza",
    especial: true,
    etiqueta: "Especial pizza",
    // Porciones de pizza en el fondo.
    fondo: "pizzas",
    estilo: "pizza",
    // El jamón de espalda, como era: más alto, con el gorro de cocinero encima, achicaba a los tres.
    cm: { "jamon-de-espalda": 28 },
  },
  {
    n: 14,
    titulo: "Combo sandwichero",
    productos: [["pan-de-sandwich", "Pan de sándwich"], ["pechuga-de-pavo-ahumada", "Pechuga de pavo ahumada"], ["queso-paisa", "Queso paisa", "sandwich"]],
    detalle: "1 pan de sándwich, 200 g de queso paisa y 200 g de pechuga de pavo ahumada",
    lema: "Todo para tus sándwiches",
    destacar: "tus sándwiches",
    especial: true,
    etiqueta: "Especial sándwich",
    fondo: "sandwiches",
    estilo: "sandwich",
  },
];

// Lo que mide de alto un producto en las hojas de todos los días, en mm, igual en todas (el dueño, 13/11: «el mismo tamaño en
// todas»): la mozzarella (iba de 81 a 104 mm, según con qué fuera) y los quesos amarillos, algo más bajos que los jamones
// (10,8 cm). Lo demás de la hoja se acomoda a su alrededor, a su escala. En los especiales no: van con otras medidas.
// El gouda Mi Vallecito (solo en el combo 1), un poco más grande que el cheddar (el dueño, 13/11), sin pasar al jamón de pierna.
globalThis.ALTO_EN_HOJA = { mozzarella: 92, "queso-amarillo": 98, "queso-amarillo-vallecito": 104 };

// Lo ancho de una foto entre lo alto, cuando no es el de la foto: el arepero, más gordito (el dueño, 13/11). Su foto es de
// 0,19 y se ensancha un 40 %.
const ASPECTO = { "jamon-arepero": 0.27 };

/** Lo que mide de alto un producto en un combo: lo de CM, salvo que el combo diga otra cosa (`cm`). */
globalThis.cmDe = (nombre, combo) => combo?.cm?.[nombre] ?? CM[nombre];

/** El estilo de la foto de un producto: su alto real y, si se ensancha, su proporción. */
globalThis.estiloDeFoto = (nombre, combo) =>
  `--cm: ${cmDe(nombre, combo)}${ASPECTO[nombre] ? `; aspect-ratio: ${ASPECTO[nombre]}; object-fit: fill` : ""}`;

/** La foto de un producto, con su tamaño real, para que salga a escala. */
globalThis.fotoDe = function fotoDe(nombre, combo) {
  return `<img src="fotos/${nombre}.png" style="${estiloDeFoto(nombre, combo)}" alt="">`;
};
