'use client';

// ========================================
// 🧾 PANTALLA DE ACCESO
// ========================================
// Login y registro comparten el mismo marco: un formulario centrado sobre
// papel, con una columna estrecha.
//
// La columna va a 380px a propósito. Un formulario de acceso no necesita
// más: meterlo en una pantalla ancha deja los campos tan separados que
// el ojo tiene que saltar de un borde al otro en cada línea.
//
// 📌 NOTA SOBRE EL NOMBRE DEL CAMPO
// El campo se llama `contrasena` (sin ñ) porque así lo espera el backend.
// Antes el frontend mandaba `password` y el login SIEMPRE fallaba con 500,
// porque `bcrypt.compare(undefined, hash)` lanza excepción.

import { useState, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { ErrorPeticion } from '@/lib/api';

/** Marco compartido por login y registro. */
export function MarcoAuth({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  pie: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <h1 className="text-titulo font-semibold text-tinta">{titulo}</h1>
          <p className="mt-1.5 text-cuerpo text-tinta-50">{subtitulo}</p>
        </div>

        {children}

        <p className="mt-6 text-center text-cuerpo text-tinta-50">{pie}</p>
      </div>
    </div>
  );
}

/**
 * Mensaje de error.
 *
 * `role="alert"` hace que un lector de pantalla lo anuncie al aparecer.
 * Sin eso, un usuario con lector de pantalla se queda sin enterarse de
 * que el login falló.
 */
export function MensajeError({ children }: { children: ReactNode }) {
  if (!children) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-medio border border-alerta bg-alerta-suave px-3 py-2.5 text-menor text-alerta"
    >
      {children}
    </div>
  );
}

/** Campo de formulario con su etiqueta y su error. */
export function Campo({
  etiqueta,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  hint,
}: {
  etiqueta: string;
  id: string;
  type?: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-pista` : undefined}
        className="campo"
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-micro text-alerta">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-pista`} className="mt-1 text-micro text-tinta-30">
          {hint}
        </p>
      ) : null}
    </div>
  );
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
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px] space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-chico bg-papel-hundido" />
        <div className="h-10 animate-pulse rounded-medio bg-papel-hundido" />
        <div className="h-10 animate-pulse rounded-medio bg-papel-hundido" />
      </div>
    </div>
  );
}

function FormularioLogin() {
  const { iniciarSesion } = useAuth();
  const router = useRouter();
  const parametros = useSearchParams();

  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  // A dónde ir después de entrar. Por defecto, al buscador.
  const destino = parametros.get('redirect') || '/';

  const alEnviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setErrorCampo({});
    setEnviando(true);

    try {
      await iniciarSesion(email, contrasena);
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
      subtitulo="Accede a tus publicaciones y contactos."
      pie={
        <>
          ¿Todavía no tienes cuenta?{' '}
          <Link href="/registro" className="font-medium text-senal hover:underline">
            Crear una
          </Link>
        </>
      }
    >
      <form onSubmit={alEnviar} noValidate className="space-y-4">
        <MensajeError>{error}</MensajeError>

        <Campo
          etiqueta="Correo electrónico"
          id="email"
          type="email"
          value={email}
          onChange={setEmail}
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
        />

        <button
          type="submit"
          disabled={enviando}
          className="btn btn-principal w-full"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </MarcoAuth>
  );
}
