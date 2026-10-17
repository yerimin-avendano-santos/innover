// ========================================
// 👤 CONTEXTO DE SESIÓN
// ========================================
// Un único lugar donde vive "quién está conectado".
//
// ⛔ CAMBIO IMPORTANTE: antes el token se guardaba en localStorage.
//
//     localStorage.setItem('innover_token', token)   // ← ya no
//
// ¿Por qué estaba mal? localStorage es JavaScript, así que cualquier
// script que corra en la página puede leerlo. Bastaba un XSS para robar
// la sesión de todos los usuarios.
//
// Ahora el token viaja en una cookie httpOnly que el navegador manda
// solo y que JavaScript no puede leer. Este contexto NO guarda el token:
// solo guarda los DATOS del usuario, que no son secretos.
//
// 📌 Por qué un contexto y no leer el localStorage en cada componente:
// si cada componente leyera la sesión por su cuenta, al iniciar sesión
// habría que recargar 12 componentes a mano.

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import type { MiPerfil, Usuario } from '@/lib/tipos';

interface ContextoAuth {
  usuario: Usuario | null;
  /** true mientras se consulta la sesión al arrancar. */
  cargando: boolean;
  estaConectado: boolean;
  esAgente: boolean;
  esAdmin: boolean;
  iniciarSesion: (email: string, contrasena: string) => Promise<void>;
  registrar: (datos: {
    nombre: string;
    email: string;
    contrasena: string;
    telefono?: string;
  }) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const Contexto = createContext<ContextoAuth | null>(null);

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  /**
   * Al arrancar, preguntamos al servidor "¿sigo con sesión?".
   *
   * No podemos leer la cookie desde JavaScript (es httpOnly, para eso es
   * httpOnly). La única forma de saberlo es preguntar. El navegador
   * manda la cookie solo en la petición.
   *
   * 📌 Y ESTA ES LA PETICIÓN QUE DESPIERTA LA RENOVACIÓN AUTOMÁTICA.
   *
   * En una visita fría —el navegador recién abierto, o más de dos horas
   * después— el pase corto ya venció, así que esta llamada vuelve con 401. El
   * cliente de la API (`lib/api.ts`) lo intercepta, pide un pase nuevo con el
   * token de renovación y repite la petición: lo que llega aquí es un perfil,
   * no un 401. La persona entra directamente con su sesión abierta, sin pasar
   * por el login, que es exactamente lo que la renovación existe para lograr.
   */
  const refrescar = useCallback(async () => {
    try {
      const perfil = await api<MiPerfil>('/api/auth/perfil');
      setUsuario(perfil);
    } catch {
      // Un 401 aquí es lo NORMAL (el usuario no ha entrado). No es un error.
      // Tampoco lo es que se caiga la red: en ambos casos simplemente no
      // hay sesión, y la app se sigue usando en modo invitado.
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  /**
   * 📌 POR QUÉ EL setState NO ESTÁ EN EL CUERPO DEL EFECTO
   *
   * `refrescar` hace su trabajo dentro de una promesa. Si el efecto
   * llamara a setCargando y luego a refrescar, React pintaría dos veces
   * al montar, una de ellas inútil.
   *
   * Además, `cargando` se apaga dentro del `finally` de la propia
   * promesa, así que hay exactamente un render útil por cada cambio.
   */

  /**
   * 📌 POR QUÉ LA PETICIÓN ESTÁ DENTRO DEL EFECTO Y NO EN `refrescar`
   *
   * La versión anterior hacía `useEffect(() => { refrescar(); })`.
   * Parece más limpia, pero `refrescar` llama a `setUsuario` y
   * `setCargando`, así que el efecto dispara estados de forma
   * SINCÓNCRONA al montarse: React pinta, descarta ese render y repite.
   *
   * Poniendo la petición dentro del efecto, los setState ocurren en el
   * `.then()` y el `.finally()`, que sí son asíncronos. El resultado
   * es un render, no dos.
   *
   * El AbortController evita que una respuesta llegue tarde, después de
   * que el componente ya se desmontó, y provoque un "setState en un
   * componente desmontado".
   *
   * ⛔ PERO CANCELAR NO ES "CERRAR SESIÓN"
   *
   * Este bug era invisible y difícil de reproducir:
   *
   * `next dev` activa React StrictMode, que monta, desmonta y remonta
   * cada componente para detectar efectos mal hechos. Al montarse dos
   * veces en el arranque:
   *
   *   1ª vuelta  → empieza la petición
   *   cleanup    → abort() cancela esa petición
   *   su catch   → ponía usuario = null     ⬅ logout falso
   *   su finally → ponía cargando = false
   *   2ª vuelta  → empieza una petición nueva, que sí funciona
   *
   * Entre el paso 3 y el final del 5, el estado era "sin sesión" con
   * `cargando` ya en false. Cualquier página protegida que mirara
   * `!cargando && !esAdmin` expulsaba al usuario a `/` antes de que la
   * segunda respuesta llegara. En el panel de admin pasaba siempre.
   *
   * La regla: un AbortError significa "esta petición ya no importa",
   * no "el usuario cerró sesión". Solo se tocan estados cuando la
   * petición NO fue cancelada.
   */
  useEffect(() => {
    const controlador = new AbortController();

    api<MiPerfil>('/api/auth/perfil', { signal: controlador.signal })
      .then(setUsuario)
      .catch((fallo: Error) => {
        // Petición cancelada: la cerró el cleanup, no el servidor.
        if (fallo?.name === 'AbortError') return;

        // Sin sesión, o el servidor no respondió. En ambos casos el
        // usuario sigue navegando en modo invitado, así que no es
        // un error que haya que mostrar.
        setUsuario(null);
      })
      .finally(() => {
        if (controlador.signal.aborted) return;
        setCargando(false);
      });

    return () => controlador.abort();
    // Solo al montar: después, la sesión cambia con iniciarSesion()
    // o cerrarSesion(), que ya actualizan el estado directamente.
  }, []);

  const iniciarSesion = useCallback(async (email: string, contrasena: string) => {
    // ⛔ OJO con el nombre del campo. El backend espera "contrasena"
    // (español, como todo el proyecto). Antes el frontend mandaba
    // "password" y el login SIEMPRE fallaba con un error 500.
    await api('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { email, contrasena },
    });

    await refrescar();
  }, [refrescar]);

  const registrar = useCallback(
    async (datos: { nombre: string; email: string; contrasena: string; telefono?: string }) => {
      // ⛔ No se manda `rol`. El backend lo ignora y asigna CLIENTE.
      await api('/api/auth/registro', { metodo: 'POST', cuerpo: datos });
      await refrescar();
    },
    [refrescar]
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await api('/api/auth/logout', { metodo: 'POST' });
    } finally {
      // Aunque la petición falle, limpio la sesión local.
      // Si no, el usuario vería un botón de "salir" que no hace nada.
      setUsuario(null);
    }
  }, []);

  const valor: ContextoAuth = {
    usuario,
    cargando,
    estaConectado: usuario !== null,
    esAgente: usuario?.rol === 'AGENTE' || usuario?.rol === 'ADMIN',
    esAdmin: usuario?.rol === 'ADMIN',
    iniciarSesion,
    registrar,
    cerrarSesion,
    refrescar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Hook para usar la sesión.
 *
 * Lanza un error si se usa fuera del proveedor. Es preferible romper en
 * desarrollo con un mensaje claro que devolver `undefined` en silencio
 * y que el error aparezca 300 líneas más abajo.
 */
export function useAuth(): ContextoAuth {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error(
      'useAuth() debe usarse dentro de <ProveedorAuth>. Revisa tu layout.tsx.'
    );
  }

  return contexto;
}
