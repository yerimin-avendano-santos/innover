'use client';

// ========================================
// 🏠 PÁGINA PRINCIPAL · LA PUERTA
// ========================================
// Esta página no dibuja nada: decide qué se ve.
//
//   · Cargando la sesión  → la marca, sin más
//   · Sin sesión          → la invitación a entrar
//   · Con sesión          → el buscador
//
// 📌 POR QUÉ EL BUSCADOR VIVE EN OTRO ARCHIVO
//
// No es por orden. Es porque el muro tiene que ser ESTRUCTURAL.
//
// El buscador monta Mapbox, y Mapbox se cobra por carga de mapa. Si el
// buscador fuera el cuerpo de esta página y aquí se decidiera "ahora enseño
// la invitación en su lugar", el componente se montaría igual —React
// construye el árbol antes de decidir qué rama se ve— y el mapa se habría
// cargado para alguien que solo venía a ver la puerta. Estaríamos pagando
// por cada visitante anónimo, que es justo lo que el muro evita.
//
// Con `<Buscador />` en su propio archivo y renderizado solo dentro de la
// rama con sesión, sin sesión no hay componente, ni mapa, ni petición de
// búsqueda, ni datos en el navegador. El muro no es una capa de pintura.
//
// Y el candado de verdad no está aquí: está en el servidor. `GET
// /api/propiedades` exige token (ver `backend/src/routes/propiedadRoutes.js`),
// así que aunque alguien saltara este componente a mano, la API no le
// devolvería nada.

import { Marca } from '@/components/Logo';
import { Buscador } from '@/components/Buscador';
import { Invitacion } from '@/components/Invitacion';
import { useAuth } from '@/contextos/Auth';

export default function PaginaPrincipal() {
  const { estaConectado, cargando } = useAuth();

  if (cargando) return <Espera />;
  if (!estaConectado) return <Invitacion />;

  return <Buscador />;
}

/**
 * Lo que se ve mientras se comprueba la sesión.
 *
 * 📌 NO ES UN DETALLE DE ESTILO: es el HTML que sirve el servidor.
 *
 * La sesión se comprueba en el navegador (`useAuth` llama a
 * `/api/auth/perfil`), así que en la primera respuesta —la que lee un
 * buscador y la que pinta el navegador antes de que arranque JavaScript—
 * todavía no se sabe quién eres. Lo único honesto que se puede poner ahí es
 * esto: la marca. Nada de "cargando…" ni de un esqueleto con forma de
 * buscador, porque un esqueleto promete una pantalla que quizá no sea esa.
 *
 * Ocupa la misma altura que el buscador para que, al llegar la respuesta, la
 * página no dé un salto.
 */
function Espera() {
  return (
    <div className="superficie-clara flex h-[calc(100vh-3.5rem)] items-center justify-center bg-papel">
      <Marca className="animate-pulse text-tinta-30" />
    </div>
  );
}
