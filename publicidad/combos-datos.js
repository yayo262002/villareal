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
};

// La charcutería (el jamón, la boloña, la mortadela, el pavo) va siempre primero, a la izquierda; el queso
// o lo que acompaña, después. Los combos con nombre propio (perrero, solidario) son los especiales.
const COMBOS = [
  { n: 1, productos: [["jamon-de-espalda", "Jamón de espalda"], ["queso-amarillo", "Queso amarillo"]], detalle: "Bandeja de 400 g", lema: "El clásico para la arepa y el sándwich" },
  { n: 2, productos: [["jamon-arepero", "Jamón arepero"], ["mozzarella", "Mozzarella"]], detalle: "Bandeja de 400 g", lema: "Para la arepa, el sándwich y la pizza" },
  { n: 3, productos: [["jamon-arepero", "Jamón arepero"], ["queso-amarillo", "Queso amarillo"]], detalle: "Bandeja de 400 g", lema: "Para la arepa y el sándwich de todos los días", separado: true },
  { n: 4, productos: [["jamon-ahumado", "Jamón ahumado"], ["mozzarella", "Mozzarella"]], detalle: "Bandeja de 400 g", lema: "Sabor ahumado para la pizza y el sándwich" },
  { n: 5, productos: [["jamon-de-pierna", "Jamón de pierna"], ["queso-amarillo-vallecito", "Queso amarillo"]], detalle: "200 g de jamón de pierna y queso amarillo", lema: "Para el sándwich y la arepa" },
  { n: 6, productos: [["bolona-de-pollo", "Boloña de pollo"], ["suero-san-pedro", "Suero San Pedro"]], detalle: "200 g de boloña y 1 bolsa de suero", lema: "Desayuno completo: boloña y suero" },
  { n: 7, productos: [["pechuga-de-pavo", "Pechuga de pavo"], ["mozzarella", "Mozzarella"]], detalle: "Bandeja de 400 g", lema: "Pavo y mozzarella, más ligero" },
  {
    n: 8,
    titulo: "Combo perrero",
    productos: [["queso-amarillo", "Queso amarillo"], ["jamon-de-espalda", "Jamón de espalda"], ["salchichas", "Salchichas"]],
    detalle: "100 g de queso amarillo, 100 g de jamón de espalda y 6 salchichas",
    lema: "Todo para los perros calientes de la casa",
    especial: true,
  },
  {
    n: 9,
    titulo: "Combo solidario",
    productos: [["suero-san-pedro", "Suero San Pedro"], ["huevos", "Huevos"], ["mortadela-de-pollo", "Mortadela"]],
    detalle: "1 suero San Pedro de 900 ml, 6 huevos y 5 salchichas o 100 g de mortadela extra",
    lema: "Lo básico de la casa en un solo combo",
    especial: true,
  },
];

/** La foto de un producto, con su tamaño real, para que salga a escala. */
function fotoDe(nombre) {
  return `<img src="fotos/${nombre}.png" style="--cm: ${CM[nombre]}" alt="">`;
}
