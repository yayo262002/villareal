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
};

// Cada producto: [foto, nombre, adorno]; el adorno es opcional y va dibujado encima de la foto: en el perrero, el
// perro caliente, las salsas y el chorro; en el solidario, el corazón, los corazones y la escarapela; en el navideño,
// el gorro, el moño y el acebo; en el pizzero, el cortapizza, el gorro de cocinero y la porción. `fondo` pone
// dibujitos detrás de los productos: perros, corazones, copos de nieve o pizzas.
// La charcutería (el jamón, la boloña, la mortadela, el pavo) va siempre primero, a la izquierda; el queso
// o lo que acompaña, después. Los combos con nombre propio (perrero, solidario, navideño, pizzero) son los especiales y van al final.
// COMBOS y fotoDe quedan en globalThis: los usan las páginas que cargan este archivo con <script>.
globalThis.COMBOS = [
  { n: 1, productos: [["jamon-de-espalda", "Jamón de espalda"], ["queso-amarillo", "Queso amarillo"]], detalle: "200 g de cada producto", lema: "El clásico para la arepa y el sándwich", destacar: "la arepa" },
  { n: 2, productos: [["jamon-arepero", "Jamón arepero"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para la arepa, el sándwich y la pizza", destacar: "la pizza" },
  { n: 3, productos: [["jamon-ahumado", "Jamón ahumado"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Sabor ahumado para la pizza y el sándwich", destacar: "Sabor ahumado" },
  { n: 4, productos: [["jamon-de-pierna", "Jamón de pierna"], ["queso-amarillo-vallecito", "Queso amarillo"]], detalle: "200 g de cada producto", lema: "Para el sándwich y la arepa", destacar: "el sándwich" },
  { n: 5, productos: [["bolona-de-pollo", "Boloña de pollo"], ["queso-amarillo", "Queso amarillo"]], detalle: "200 g de cada producto", lema: "Desayuno completo: boloña y queso", destacar: "Desayuno completo" },
  { n: 6, productos: [["pechuga-de-pavo", "Pechuga de pavo"], ["mozzarella", "Mozzarella"]], detalle: "200 g de cada producto", lema: "Para un sándwich diferente", destacar: "diferente" },
  {
    n: 7,
    titulo: "Combo perrero",
    productos: [["queso-amarillo", "Queso amarillo", "chorro"], ["jamon-de-espalda", "Jamón de espalda", "perro"], ["salchichas", "Salchichas", "salsas"]],
    detalle: "100 g de queso amarillo, 100 g de jamón de espalda y 6 salchichas",
    lema: "Todo para los perros calientes de la casa",
    destacar: "perros calientes",
    especial: true,
    etiqueta: "Especial perros calientes",
    fondo: "perros",
    // Algo más bajos, para que el perro caliente de encima del jamón no llegue a la onda.
    alto: 88,
  },
  {
    n: 8,
    titulo: "Combo solidario",
    productos: [["suero-san-pedro", "Suero San Pedro", "corazon"], ["huevos", "Huevos", "corazones"], ["mortadela-de-pollo", "Mortadela", "escarapela"]],
    detalle: "1 suero San Pedro de 900 ml, 6 huevos y 1 mortadela de 500 g",
    lema: "Lo básico de la casa en un solo combo",
    destacar: "un solo combo",
    especial: true,
    etiqueta: "Especial solidario",
    fondo: "corazones",
  },
  {
    n: 9,
    titulo: "Combo navideño",
    productos: [["tocineta", "Tocineta", "moño"], ["jamon-ahumado", "Jamón ahumado", "gorro"], ["mozzarella", "Mozzarella", "acebo"]],
    detalle: "200 g de tocineta, 200 g de jamón ahumado y 200 g de mozzarella",
    lema: "Para tu mesa de Navidad",
    destacar: "Navidad",
    especial: true,
    etiqueta: "Especial de Navidad",
    // Copos de nieve en el fondo, y los productos algo más bajos para que el gorro no llegue al nombre.
    fondo: "copos",
    alto: 86,
  },
  {
    n: 10,
    titulo: "Combo pizzero",
    productos: [["tocineta", "Tocineta", "cortapizza"], ["jamon-de-espalda", "Jamón de espalda", "cocinero"], ["mozzarella", "Mozzarella", "porcion"]],
    detalle: "100 g de tocineta, 200 g de jamón de espalda y 200 g de mozzarella",
    lema: "Arma tu pizza en casa",
    destacar: "tu pizza",
    especial: true,
    etiqueta: "Especial pizza",
    // Porciones de pizza en el fondo, y los productos algo más bajos para que el gorro de cocinero no llegue a la onda.
    fondo: "pizzas",
    alto: 84,
    // El cartel grande es de 3 × 3: este va solo en su hoja.
    cartel: false,
  },
];

/** La foto de un producto, con su tamaño real, para que salga a escala. */
globalThis.fotoDe = function fotoDe(nombre) {
  return `<img src="fotos/${nombre}.png" style="--cm: ${CM[nombre]}" alt="">`;
};
