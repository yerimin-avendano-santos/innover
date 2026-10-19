'use client';

// ========================================
// 🧾 PANTALLA DE ACCESO
// ========================================
// La puerta de Innover. El marco —tarjeta, campos y mensaje de error—
// vive en `components/MarcoAuth.tsx`, porque el registro usa el mismo.
//
// ── De dónde sale este diseño ──
//
// De la entrega de `design/`: una tarjeta de dos columnas, con el
// formulario a la izquierda y el panel de marca a la derecha. Se descartó
// la versión de móvil para los copys («Bienvenido Innover») porque el
// boceto final de escritorio es el que manda; el móvil se toma como lo que
// es, el mismo diseño estrechado.
//
// ── Lo que NO tiene, y por qué ──
//
// · Botones de Google y Apple: no son un cambio visual. Sin backend de
//   OAuth ni credenciales de esos proveedores, un botón así solo puede
//   fallar, y un botón que falla en la pantalla de entrada es peor que no
//   tenerlo.
// · «¿Olvidaste tu contraseña?»: tampoco hay endpoint de recuperación, ni
//   correo saliente, ni forma de que un ADMIN restablezca la contraseña
//   de nadie (`actualizarUsuarioAdminSchema` no acepta `contrasena`).
//   Un enlace ahí llevaría a una pantalla que no existe.
//
// 📌 NOTA SOBRE EL NOMBRE DEL CAMPO
// El campo se llama `contrasena` (sin ñ) porque así lo espera el backend.
// Antes el frontend mandaba `password` y el login SIEMPRE fallaba con 500,
// porque `bcrypt.compare(undefined, hash)` lanza excepción.

import { useState, Suspense, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { ErrorPeticion } from '@/lib/api';
import { MarcoAuth, MensajeError, Campo } from '@/components/MarcoAuth';

/**
 * Dónde se recuerda el correo.
 *
 * Solo el correo, nunca la contraseña: guardar una contraseña en
 * `localStorage` es dejar una llave bajo el felpudo, porque cualquier
 * script que corra en la página la puede leer. El correo es un dato que
 * el usuario ya escribe en la barra del navegador cada vez que entra a
 * su propio correo.
 *
 * Tampoco se recuerda la SESIÓN, que es lo que parece prometer un
 * «recuérdame» de verdad. La duración de la sesión la decide el servidor
 * —el pase corto dura 2 h y la cookie de renovación 30 días—, y el
 * cliente no puede alargarla aunque quiera. Prometerlo sería mentir en la
 * misma casilla que lo pide.
 */
const CLAVE_CORREO = 'innover-correo';

/**
 * Un `subscribe` que no se suscribe a nada.
 *
 * `useSyncExternalStore` lo exige, pero el valor que se lee aquí solo
 * cambia cuando el usuario envía ESTE formulario, y eso ya lo sabe esta
 * pantalla: no hay nada que escuchar. Se declara fuera del componente
 * para que sea siempre la misma función y React no se resuscriba en cada
 * render.
 */
const SIN_SUSCRIPCION = () => () => {};

/** Durante la hidratación se enseña lo mismo que pintó el servidor. */
const NADA_EN_EL_SERVIDOR = () => '';

/**
 * Lee el correo recordado del navegador.
 *
 * El `try` no es decorativo: hay navegadores que lanzan excepción al
 * tocar `localStorage` —modo privado, cookies de terceros bloqueadas—, y
 * no poder recordar un correo no puede impedir entrar.
 */
function leerCorreoGuardado() {
  try {
    return window.localStorage.getItem(CLAVE_CORREO) ?? '';
  } catch {
    return '';
  }
}

/**
 * El correo recordado, tal y como lo tiene el navegador.
 *
 * ── Por qué `useSyncExternalStore` y no un `useEffect` ──
 *
 * La forma que sale primero —leerlo dentro de un `useEffect` y meterlo en
 * el estado— funciona, pero el linter la prohíbe y tiene razón: escribir
 * el estado dentro de un efecto encadena un segundo render justo después
 * del primero, y React lo llama cascada.
 *
 * La que sale después —leerlo al declarar el estado, con
 * `useState(() => localStorage…)`— es peor: el servidor no tiene
 * `localStorage`, así que pinta el campo vacío, y el navegador lo
 * pintaría con el correo dentro. Dos renders distintos, y React avisa
 * del desajuste de hidratación.
 *
 * `useSyncExternalStore` existe justo para esto: leer de un almacén
 * externo —y `localStorage` lo es— sin desajustes. Durante la hidratación
 * devuelve la versión del servidor (el campo vacío) y, en cuanto termina,
 * vuelve a leer y repinta con el valor de verdad.
 */
function useCorreoGuardado() {
  return useSyncExternalStore(SIN_SUSCRIPCION, leerCorreoGuardado, NADA_EN_EL_SERVIDOR);
}

/**
 * ¿Es una ruta interna?
 *
 * `?redirect=` se lee de la barra de direcciones, o sea que lo escribe
 * cualquiera. `router.push(destino)` acepta direcciones absolutas, así que
 * `?redirect=https://otro-sitio` —o `?redirect=//otro-sitio`, que es una
 * ruta protocol-relative y hace lo mismo— sacaría al usuario de Innover
 * justo después de escribir su contraseña. Ese es el montaje clásico del
 * phishing: una copia del login que te devuelve a «tu» sitio.
 *
 * Solo pasa lo que empieza por una barra y NO por dos. La barra invertida
 * también se rechaza porque los navegadores la normalizan a `/`, así que
 * `/\otro-sitio` acabaría valiendo lo mismo que `//otro-sitio`.
 *
 * Es la misma lista blanca que usa la barra de navegación para el enlace
 * de la ficha, y por el mismo motivo: la dirección la escribe el visitante.
 */
function esRutaInterna(ruta: string) {
  return ruta === '/' || /^\/[^/\\]/.test(ruta);
}

// ========================================
// PÁGINA: INICIAR SESIÓN
// ========================================

export default function PaginaLogin() {
  /**
   * 📌 POR QUÉ ESTÁ ENVUELTO EN <Suspense>
   *
   * `useSearchParams()` obliga a Next a renderizar esta página en el
   * servidor en tiempo real en vez de pre-generarla al compilar. Sin un
   * <Suspense> alrededor, el build falla con:
   *
   *     Error occurred prerendering page "/login"
   *
   * El límite se pone AQUÍ, no dentro del componente con el hook: el
   * hook solo puede vivir en un hijo de Suspense, y así el shell de la
   * página se sigue renderizando en el servidor normalmente.
   */
  return (
    <Suspense fallback={<MarcoEsqueleto />}>
      <FormularioLogin />
    </Suspense>
  );
}

/** Placeholder mientras se resuelve la query en el servidor. */
function MarcoEsqueleto() {
  return (
    <div className="flex flex-1 flex-col items-stretch justify-center sm:items-center sm:p-6 lg:p-8">
      <div className="tarjeta-acceso flex w-full flex-1 flex-col gap-4 p-6 sm:max-w-[480px] sm:flex-none sm:rounded-grande lg:min-h-[660px] lg:max-w-[1080px] lg:p-14">
        <div className="h-14 w-14 animate-pulse rounded-full bg-papel-hundido" />
        <div className="mt-8 h-8 w-2/3 animate-pulse rounded-chico bg-papel-hundido" />
        <div className="h-12 animate-pulse rounded-full bg-papel-hundido" />
        <div className="h-12 animate-pulse rounded-full bg-papel-hundido" />
      </div>
    </div>
  );
}

function FormularioLogin() {
  const { iniciarSesion } = useAuth();
  const router = useRouter();
  const parametros = useSearchParams();

  const correoGuardado = useCorreoGuardado();

  /**
   * El correo que se enseña es el que el usuario esté escribiendo y, si
   * todavía no ha escrito nada, el que había guardado.
   *
   * Esta es la razón de que sean dos estados y no uno: `email` no puede
   * ser un estado que se *rellene* desde el almacén (eso obliga a
   * escribirlo dentro de un efecto, y además el primer render saldría sin
   * él). Es un valor DERIVADO, y derivar se hace durante el render, que
   * es justo donde React quiere que se haga.
   */
  const [correoEscrito, setCorreoEscrito] = useState<string | null>(null);
  const email = correoEscrito ?? correoGuardado;

  /**
   * La casilla tampoco se marca sola: viene marcada si de verdad hay un
   * correo recordado. Una casilla de «recordar» premarcada decide por el
   * usuario lo que se guarda en su propio dispositivo; así, el estado de
   * la casilla dice la verdad.
   */
  const [marcado, setMarcado] = useState<boolean | null>(null);
  const recordar = marcado ?? correoGuardado !== '';

  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  // A dónde ir después de entrar. Por defecto, al buscador.
  const crudo = parametros.get('redirect');
  const destino = crudo && esRutaInterna(crudo) ? crudo : '/';

  const alEnviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setErrorCampo({});
    setEnviando(true);

    try {
      await iniciarSesion(email, contrasena);

      // Se guarda DESPUÉS de que la sesión se abra: un correo que no
      // entró no se recuerda, así la próxima visita no empieza con un
      // dato equivocado en el campo.
      try {
        if (recordar) window.localStorage.setItem(CLAVE_CORREO, email);
        else window.localStorage.removeItem(CLAVE_CORREO);
      } catch {
        // Si el navegador bloquea el almacenamiento, no se recuerda el
        // correo y ya está: entrar ya ha funcionado, que es lo importante.
      }

      router.push(destino);
      router.refresh();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setError(e.message);
        // El backend manda qué campo falló: se muestra bajo el campo,
        // no solo arriba. Quien tiene el error a la vista lo corrige.
        setErrorCampo(
          Object.fromEntries(e.detalles.map((d) => [d.campo, d.mensaje]))
        );
      } else {
        setError('Algo salió mal. Inténtalo de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <MarcoAuth
      titulo="Entra a Innover"
      subtitulo="Todo tu ecosistema inmobiliario en un solo mapa."
      pie={
        <>
          ¿Todavía no tienes cuenta?{' '}
          <Link
            href="/registro"
            className="font-semibold text-tinta hover:underline"
          >
            Regístrate gratis
          </Link>
        </>
      }
    >
      <form onSubmit={alEnviar} noValidate className="space-y-5">
        <MensajeError>{error}</MensajeError>

        <Campo
          etiqueta="Correo electrónico"
          id="email"
          type="email"
          value={email}
          onChange={setCorreoEscrito}
          placeholder="ana@correo.com"
          autoComplete="email"
          error={errorCampo.email}
        />

        <Campo
          etiqueta="Contraseña"
          id="contrasena"
          type="password"
          value={contrasena}
          onChange={setContrasena}
          autoComplete="current-password"
          error={errorCampo.contrasena}
          revelable
        />

        <label className="flex w-fit cursor-pointer items-center gap-2 text-menor text-tinta-70">
          <input
            type="checkbox"
            checked={recordar}
            onChange={(e) => setMarcado(e.target.checked)}
            className="h-4 w-4 accent-senal"
          />
          Recordar mi correo
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="btn btn-principal w-full rounded-full py-3"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </MarcoAuth>
  );
}
