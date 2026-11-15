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
  // Más grande que los jamones, como es (el dueño, 15/11/2026: «la tocineta ya sabes que es más grande»); era de 28.
  tocineta: 36,
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
  {
    // Una bandeja con los recortes de las piezas que se rebanan (el dueño, 14/11: «que aparezcan todas las piezas»). Sin
    // peso: lo que lleva varía (el dueño, el mismo día: «no le pongas la cantidad porque va a variar»).
    // Al final, con los especiales: no es la pareja de un jamón y un queso, y así no se corre ningún número (ni las etiquetas
    // de las bandejas con su código de barras).
    n: 15,
    titulo: "Combo de recortes",
    productos: [
      ["bolona-de-pollo", "Boloña de pollo"],
      ["jamon-de-espalda", "Jamón de espalda"],
      ["jamon-arepero", "Jamón arepero"],
      ["jamon-de-pierna", "Jamón de pierna"],
      ["mortadela-extra", "Mortadela extra"],
      ["mortadela-punta-de-monte", "Mortadela especial"],
      ["queso-amarillo-vallecito", "Queso amarillo"],
      ["queso-amarillo", "Queso amarillo tipo cheddar"],
      ["jamon-ahumado", "Jamón ahumado"],
      ["mozzarella", "Mozzarella"],
      ["pechuga-de-pavo-drago", "Pechuga de pavo"],
      ["pechuga-de-pavo-ahumada", "Pechuga de pavo ahumada"],
    ],
    detalle: "Bandeja de recortes surtidos",
    lema: "Un poquito de todo en una bandeja",
    destacar: "Un poquito de todo",
    especial: true,
    etiqueta: "Especial recortes",
    // Todas las piezas juntas, como en una foto de grupo: atrás, más arriba, las altas; delante, apoyadas en el mostrador, las
    // demás. Cada fila, con su altura sobre el mostrador (cm, a la escala de CM) y lo que se separan sus piezas (cm; negativo,
    // se solapan). Las piezas, por su foto, en el orden en que van de izquierda a derecha.
    // Atrás, las altas y delgadas, tan arriba que su etiqueta asoma por encima de las de delante; delante, las anchas.
    grupo: [
      { base: 20, separacion: 0.6, piezas: ["bolona-de-pollo", "jamon-de-espalda", "jamon-arepero", "jamon-de-pierna", "mortadela-extra", "mortadela-punta-de-monte", "queso-amarillo-vallecito"] },
      { base: 0, separacion: 2.5, piezas: ["queso-amarillo", "jamon-ahumado", "mozzarella", "pechuga-de-pavo-drago", "pechuga-de-pavo-ahumada"] },
    ],
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

// ——— El combo de recortes: todas las piezas juntas ———

// Lo ancho entre lo alto de las fotos del combo de recortes (sus píxeles): con eso se colocan antes de que carguen. Si
// cambia una de estas fotos, se pone aquí su tamaño nuevo.
const PROPORCION = {
  "bolona-de-pollo": 245 / 776,
  "jamon-de-espalda": 346 / 720,
  "jamon-arepero": 146 / 761,
  "jamon-de-pierna": 457 / 673,
  "mortadela-extra": 536 / 1138,
  "mortadela-punta-de-monte": 345 / 1080,
  "pechuga-de-pavo-ahumada": 581 / 1009,
  "queso-amarillo": 332 / 742,
  "jamon-ahumado": 361 / 660,
  mozzarella: 632 / 741,
  "pechuga-de-pavo-drago": 691 / 1066,
  "queso-amarillo-vallecito": 314 / 800,
};

/**
 * Dónde va cada pieza de un combo con `grupo`, en centímetros de la vida real (a la escala de CM): cada fila centrada, con
 * sus piezas una al lado de la otra; la de atrás, más arriba y debajo de la de delante. Devuelve lo que mide la escena y,
 * de cada pieza, su centro, su ancho, su alto y lo alto que se apoya.
 */
globalThis.escenaDe = function escenaDe(combo) {
  const filas = combo.grupo.map((fila, i) => {
    const piezas = fila.piezas.map((foto) => {
      const alto = cmDe(foto, combo);
      const proporcion = ASPECTO[foto] ?? PROPORCION[foto];
      if (!proporcion) throw new Error(`Falta la proporción de la foto ${foto} en PROPORCION (combos-datos.js).`);
      return { foto, alto, ancho: alto * proporcion, base: fila.base, capa: i };
    });
    const ancho = piezas.reduce((suma, p) => suma + p.ancho, 0) + fila.separacion * (piezas.length - 1);
    return { piezas, ancho, separacion: fila.separacion };
  });
  const ancho = Math.max(...filas.map((f) => f.ancho));
  const piezas = filas.flatMap((fila) => {
    let x = (ancho - fila.ancho) / 2;
    return fila.piezas.map((p) => {
      const centro = x + p.ancho / 2;
      x += p.ancho + fila.separacion;
      return { ...p, centro };
    });
  });
  return { ancho, alto: Math.max(...piezas.map((p) => p.base + p.alto)), piezas };
};

/**
 * Las piezas de un combo con `grupo`, en una caja con la proporción de la escena: todo en porcentajes, así la misma escena
 * sirve en la hoja, en el cartel y en el flier, del tamaño que se le dé a la caja (su ancho; lo alto sale solo).
 */
globalThis.grupoDe = function grupoDe(combo) {
  const { ancho, alto, piezas } = escenaDe(combo);
  const por = (n, de) => `${((n / de) * 100).toFixed(3)}%`;
  return `<div class="grupo" style="aspect-ratio: ${ancho.toFixed(2)} / ${alto.toFixed(2)}">${piezas
    .map(
      (p) =>
        `<span class="miembro" data-foto="${p.foto}" style="left: ${por(p.centro - p.ancho / 2, ancho)}; width: ${por(p.ancho, ancho)}; bottom: ${por(p.base, alto)}; height: ${por(p.alto, alto)}; z-index: ${p.capa * 100 + Math.round(100 - p.alto)}"><img src="fotos/${p.foto}.png" alt=""></span>`,
    )
    .join("")}</div>`;
};

/** Lo que necesita la caja de un grupo, en cualquier página: las piezas, cada una en su sitio; su sombra la pone cada página. */
globalThis.ESTILO_DEL_GRUPO = `
  .grupo { position: relative; flex: none; max-width: 100%; }
  .grupo .miembro { position: absolute; display: block; }
  .grupo .miembro img { display: block; width: 100%; height: 100%; max-width: none; object-fit: fill; }`;
