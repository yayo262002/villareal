// Los combos del detal, escritos una sola vez: los usan el cartel grande (combos.html) y las hojas
// de cada combo (combos-individuales.html). Nada de marcas en los nombres: la marca se ve en la foto.
//
// De cada producto, lo que mide de alto en la vida real, en centímetros, tal como sale en su foto
// (aproximado; el dueño lo corrige): con eso se dibujan todos a la misma escala.
const CM = {
  "jamon-de-espalda": 28,
  "queso-amarillo": 26,
  "jamon-arepero": 32,
  mozzarella: 27,
  "jamon-ahumado": 28,
  "jamon-de-pierna": 30,
  "queso-amarillo-vallecito": 32,
  "bolona-de-pollo": 30,
  "suero-san-pedro": 18,
  "mortadela-de-pollo": 20,
  "pechuga-de-pavo": 28,
  huevos: 9,
  salchichas: 17,
  tocineta: 28,
  "mortadela-punta-de-monte": 30,
  "pan-de-sandwich": 34,
  "mortadela-extra": 30,
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
// COMBOS y fotoDe quedan en globalThis: los usan las páginas que cargan este archivo con <script>.
globalThis.COMBOS = [
  { n: 1, productos: [["jamon-de-pierna", "Jamón de pierna"], ["queso-amarillo-vallecito", "Queso amarillo"]], detalle: "200 g de cada producto", lema: "Para el sándwich y la arepa", destacar: "el sándwich" },
  { n: 2, productos: [["jamon-de-espalda", "Jamón de espalda"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "El clásico para la arepa y el sándwich", destacar: "la arepa" },
  { n: 3, productos: [["jamon-ahumado", "Jamón ahumado"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Sabor ahumado para la pizza y el sándwich", destacar: "Sabor ahumado" },
  { n: 4, productos: [["jamon-arepero", "Jamón arepero"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para la arepa, el sándwich y la pizza", destacar: "la pizza" },
  { n: 5, productos: [["pechuga-de-pavo", "Jamón de pavo"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para un sándwich diferente", destacar: "diferente" },
  { n: 6, productos: [["bolona-de-pollo", "Boloña de pollo"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "Desayuno completo: boloña y queso", destacar: "Desayuno completo" },
  { n: 7, productos: [["mortadela-punta-de-monte", "Mortadela especial"], ["queso-amarillo", "Queso amarillo tipo cheddar"]], detalle: "200 g de cada producto", lema: "Para la arepa de todos los días", destacar: "todos los días" },
  {
    n: 8,
    titulo: "Combo solidario",
    productos: [["suero-san-pedro", "Suero San Pedro"], ["huevos", "Huevos"], ["mortadela-de-pollo", "Mortadela"]],
    detalle: "1 suero San Pedro de 900 ml, 6 huevos y 250 g de mortadela",
    lema: "Lo básico de la casa en un solo combo",
    destacar: "un solo combo",
    especial: true,
    etiqueta: "Especial solidario",
    // Sin corazones: al dueño no le gustaban.
    estilo: "solidario",
  },
  {
    n: 9,
    titulo: "Combo perrero",
    productos: [["queso-amarillo", "Queso amarillo tipo cheddar", "chorro"], ["jamon-de-espalda", "Jamón de espalda", "perro"], ["salchichas", "Salchichas", "salsas"]],
    detalle: "100 g de queso amarillo tipo cheddar, 100 g de jamón de espalda y 6 salchichas",
    lema: "Todo para los perros calientes de la casa",
    destacar: "perros calientes",
    especial: true,
    etiqueta: "Especial perros calientes",
    fondo: "perros",
    // Algo más bajos, para que el perro caliente de encima del jamón no llegue a la onda.
    alto: 88,
  },
  {
    n: 10,
    titulo: "Combo navideño",
    productos: [["tocineta", "Tocineta", "moño"], ["jamon-ahumado", "Jamón ahumado", "gorro"]],
    detalle: "200 g de tocineta y 200 g de jamón ahumado",
    lema: "Para tu mesa de Navidad",
    destacar: "Navidad",
    especial: true,
    etiqueta: "Especial de Navidad",
    // Luces de Navidad en el fondo, y los productos algo más bajos para que el gorro no llegue a la cabecera.
    estilo: "navidad",
    alto: 86,
  },
  {
    n: 11,
    titulo: "Combo pizzero",
    productos: [["tocineta", "Tocineta", "cortapizza"], ["jamon-de-espalda", "Jamón de espalda", "cocinero"], ["mozzarella", "Mozzarella", "porcion"]],
    detalle: "100 g de tocineta, 200 g de jamón de espalda y 200 g de mozzarella",
    lema: "Arma tu pizza en casa",
    destacar: "tu pizza",
    especial: true,
    etiqueta: "Especial pizza",
    // Porciones de pizza en el fondo, y los productos algo más bajos para que el gorro de cocinero no llegue a la onda.
    fondo: "pizzas",
    estilo: "pizza",
    alto: 84,
  },
  {
    n: 12,
    titulo: "Combo sandwichero",
    productos: [["pan-de-sandwich", "Pan de sándwich"], ["mortadela-extra", "Mortadela extra"], ["jamon-de-espalda", "Jamón de espalda"], ["queso-amarillo", "Queso amarillo tipo cheddar", "sandwich"]],
    detalle: "1 pan de sándwich, 200 g de mortadela extra, 200 g de queso amarillo tipo cheddar y 200 g de jamón de espalda",
    lema: "Todo para tus sándwiches",
    destacar: "tus sándwiches",
    especial: true,
    etiqueta: "Especial sándwich",
    fondo: "sandwiches",
    estilo: "sandwich",
    // Algo más bajos, para que el sándwich de encima del queso no llegue a la cabecera.
    alto: 86,
  },
];

/** La foto de un producto, con su tamaño real, para que salga a escala. */
globalThis.fotoDe = function fotoDe(nombre) {
  return `<img src="fotos/${nombre}.png" style="--cm: ${CM[nombre]}" alt="">`;
};
