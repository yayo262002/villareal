import { test } from "node:test";
import assert from "node:assert/strict";
import { claveDeNombre, clientesParecidos, notaDiceElCliente, reparoDelCliente, type ClienteParaLaNota, type NombreAprendido } from "./cliente-de-la-nota.ts";

// La cartera de la prueba: la Pizzería NEL's es de Nelson (el ejemplo del dueño, 14/11/2026).
const nels: ClienteParaLaNota = { id: 1, rotulo: "Pizzería NEL's", nombre: "Nelson", cedula_rif: "" };
const esquina: ClienteParaLaNota = { id: 2, rotulo: "Pizzería La Esquina", nombre: "Luis", cedula_rif: "J-40806430-8" };
const nelly: ClienteParaLaNota = { id: 3, rotulo: "Nelly Pérez", nombre: "Nelly Pérez", cedula_rif: "" };
const tuttopan: ClienteParaLaNota = { id: 4, rotulo: "Panadería Tutto Pan", nombre: "Carmen", cedula_rif: "" };
const cleiderman: ClienteParaLaNota = { id: 5, rotulo: "Burger Cleiderman", nombre: "Cleiderman", cedula_rif: "" };
const luisGomez: ClienteParaLaNota = { id: 6, rotulo: "Luis Gómez", nombre: "Luis Gómez", cedula_rif: "V-12345678" };
const cartera = [nels, esquina, nelly, tuttopan, cleiderman, luisGomez];

const ids = (nombre: string | null, rif: string | null = null, aprendidos: NombreAprendido[] = []) => clientesParecidos({ nombre, rif }, cartera, aprendidos).map((c) => c.id);

test("«Nelson» en la nota es la Pizzería NEL's, porque así se llama su dueño, y dice por qué", () => {
  const [primero, ...resto] = clientesParecidos({ nombre: "Nelson", rif: null }, cartera);
  assert.equal(primero.id, 1);
  assert.equal(primero.por, "nombre");
  assert.match(primero.motivo, /se llama Nelson/);
  // Nelly no es Nelson.
  assert.ok(!resto.some((c) => c.id === 3));
  // Escrito con tratamiento, con tilde, con la z o en mayúsculas, lo mismo.
  for (const escrito of ["Sr. Nelson", "nelsón", "Nelzon", "NELSON"]) assert.equal(ids(escrito)[0], 1, escrito);
});

test("el nombre del negocio también vale, aunque se escriba de corrido o sin «Pizzería»", () => {
  assert.equal(ids("NEL'S")[0], 1);
  assert.equal(ids("Pizzeria Nels")[0], 1);
  assert.equal(ids("Tuttopan")[0], 4);
  assert.equal(ids("Panaderia tutto pan")[0], 4);
  assert.equal(ids("Kleiderman")[0], 5);
  assert.match(clientesParecidos({ nombre: "La Esquina", rif: null }, cartera)[0].motivo, /su negocio es Pizzería La Esquina/);
});

test("con dos que se parecen igual, salen los dos para preguntar; el tipo de negocio solo no dice quién es", () => {
  assert.deepEqual(ids("Luis").sort(), [2, 6]);
  assert.equal(ids("Luis Gomez")[0], 6);
  assert.deepEqual(ids("Pizzería"), []);
  assert.equal(notaDiceElCliente({ nombre: "Pizzería", rif: null }), false);
  assert.equal(notaDiceElCliente({ nombre: "Nelson", rif: null }), true);
  assert.deepEqual(ids("Ramón Martínez"), []);
  assert.deepEqual(clientesParecidos(null, cartera), []);
});

test("el RIF de la nota pesa más que el nombre", () => {
  const parecidos = clientesParecidos({ nombre: "Nelson", rif: "J408064308" }, cartera);
  assert.equal(parecidos[0].id, 2);
  assert.equal(parecidos[0].por, "rif");
  assert.match(parecidos[0].motivo, /J-40806430-8/);
  assert.equal(parecidos[1].id, 1);
  assert.equal(ids(null, "12.345.678")[0], 6);
});

test("lo aprendido de otras notas: «El Gocho» fue Burger Cleiderman, y con una letra cambiada también", () => {
  const aprendidos: NombreAprendido[] = [{ nombre: claveDeNombre("El Gocho"), cliente_id: 5, veces: 3 }];
  const [primero] = clientesParecidos({ nombre: "el gocho", rif: null }, cartera, aprendidos);
  assert.equal(primero.id, 5);
  assert.equal(primero.por, "aprendido");
  assert.match(primero.motivo, /ya escribiste «el gocho» en 3 notas suyas/);
  assert.equal(ids("Gochu", null, aprendidos)[0], 5);
  // Lo aprendido de un cliente que ya no está en la cartera no cuenta.
  assert.deepEqual(clientesParecidos({ nombre: "el gocho", rif: null }, [nels], aprendidos), []);
});

test("la clave con que se aprende un nombre: sin tildes, mayúsculas ni tratamiento", () => {
  assert.equal(claveDeNombre("Sr. Nelson"), "nelson");
  assert.equal(claveDeNombre("  NELSÓN "), "nelson");
  assert.equal(claveDeNombre("Pizzería NEL's C.A."), "pizzeria nel");
  assert.equal(claveDeNombre(""), "");
});

test("si la nota no es de ese cliente, se dice qué dice la nota y de quién es la venta", () => {
  assert.equal(reparoDelCliente({ nombre: "Nelson", rif: null }, nels), null);
  assert.equal(
    reparoDelCliente({ nombre: "Nelson", rif: null }, esquina),
    "La nota dice «Nelson» y la venta es de Pizzería La Esquina (Luis): revisa que sea de ese cliente.",
  );
  assert.equal(reparoDelCliente({ nombre: "Nelson", rif: null }, nelly), "La nota dice «Nelson» y la venta es de Nelly Pérez: revisa que sea de ese cliente.");
  // Si en otras notas suyas ya se escribió así, casa.
  assert.equal(reparoDelCliente({ nombre: "Nelson", rif: null }, esquina, [{ nombre: "nelson", cliente_id: 2, veces: 1 }]), null);
  // Un RIF que no es el suyo, también; el suyo, basta aunque el nombre no se parezca.
  assert.match(reparoDelCliente({ nombre: "Luis", rif: "V-12345678" }, esquina) ?? "", /El RIF de la nota \(V-12345678\) no es el de Pizzería La Esquina/);
  assert.equal(reparoDelCliente({ nombre: "El amigo", rif: "J-40806430-8" }, esquina), null);
  // Si la nota no dice a quién va, o solo dice «Pizzería», nada.
  assert.equal(reparoDelCliente(null, esquina), null);
  assert.equal(reparoDelCliente({ nombre: "Pizzería", rif: null }, esquina), null);
});
