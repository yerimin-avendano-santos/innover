'use client';

// ========================================
// 🏠 PÁGINA PRINCIPAL · LA PUERTA
// ========================================
// Esta página no dibuja nada: decide qué se ve.
//
//   · Cargando la sesión  → la marca, sin más
//   · Sin sesión          → la marca, y de ahí al acceso
//   · Con sesión          → el buscador
//
// 📌 POR QUÉ EL BUSCADOR VIVE EN OTRO ARCHIVO
//
// No es por orden. Es porque el muro tiene que ser ESTRUCTURAL.
//
// El buscador monta Mapbox, y Mapbox se cobra por carga de mapa. Si el
// buscador fuera el cuerpo de esta página y aquí se decidiera "ahora enseño
// otra cosa en su lugar", el componente se montaría igual —React construye
// el árbol antes de decidir qué rama se ve— y el mapa se habría cargado para
// alguien que solo venía a la puerta. Estaríamos pagando por cada visitante
// anónimo, que es justo lo que el muro evita.
//
// Con `<Buscador />` en su propio archivo y renderizado solo dentro de la
// rama con sesión, sin sesión no hay componente, ni mapa, ni petición de
// búsqueda, ni datos en el navegador. El muro no es una capa de pintura.
//
// Y el candado de verdad no está aquí: está en el servidor. `GET
// /api/propiedades` exige token (ver `backend/src/routes/propiedadRoutes.js`),
// así que aunque alguien saltara este componente a mano, la API no le
// devolvería nada.
//
// 📌 LA PORTADA MANDA AL ACCESO (y antes no lo hacía)
//
// Antes, quien llegaba sin cuenta veía una pantalla que explicaba el
// producto con tres beneficios y dos botones (`components/Invitacion.tsx`).
// Era una decisión defendible —explicar antes de pedir— y se cambió a
// propósito: Innover es una herramienta, y lo primero que aparece es su
// puerta, que ya lleva el titular de marca y la maqueta del buscador.
//
// El rebote se hace AQUÍ y no en un `middleware.ts` por un motivo concreto:
// la sesión se comprueba contra la API (el pase es una cookie httpOnly, y
// solo el servidor la puede leer), así que un middleware podría mirar si
// HAY cookies, no si valen. Un rebote por presencia de cookie dejaría fuera
// a quien tiene el pase caducado pero la renovación viva, que es
// exactamente a quien hay que dejar pasar —porque entra solo.
//
// Y mientras se decide, se sigue viendo la marca. La alternativa
// —`return null`— es un parpadeo en blanco.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Marca } from '@/components/Logo';
import { Buscador } from '@/components/Buscador';
import { useAuth } from '@/contextos/Auth';

export default function PaginaPrincipal() {
  const { estaConectado, cargando } = useAuth();
  const router = useRouter();

  /**
   * Sin sesión no hay nada que ver aquí: se va al acceso.
   *
   * `replace` y no `push`: la portada no es un sitio al que volver con el
   * botón de atrás —volvería a rebotar—. El `?redirect=/` es lo que hace
   * que, después de entrar, se llegue al buscador y no al panel de la
   * cuenta, y `login/page.tsx` ya sabe leerlo (y validarlo: la dirección
   * la escribe cualquiera).
   */
  useEffect(() => {
    if (cargando || estaConectado) return;
    router.replace('/login?redirect=/');
  }, [cargando, estaConectado, router]);

  if (cargando || !estaConectado) return <Espera />;

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
 * Y también es lo que se ve en el rebote al acceso: en vez de un salto seco
 * a otra pantalla, la marca se queda un instante y el formulario aparece
 * debajo, como si hubiera estado ahí.
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
