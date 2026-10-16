'use client';

// ========================================
// 🛡️ PANEL DE ADMINISTRACIÓN
// ========================================
// La herramienta con la que la plataforma se modera.
//
// 📌 POR QUÉ EXISTE
//
// El sello "Propietario verificado" que aparece en las fichas es la
// promesa que diferencia a INNOVER de un portal genérico. Pero para que
// ese sello sea cierto, alguien tiene que verificar de verdad el
// documento del propietario. Ese alguien es el admin, y hasta ahora no
// tenía ninguna pantalla desde la que hacerlo.
//
// Lo mismo con los roles: un usuario no puede convertirse en agente por
// su cuenta (a propósito), así que tiene que existir un admin que lo apruebe.
//
// ⚠️ Esta pantalla es la de MAYOR riesgo del proyecto: una sola sesión
// de admin comprometida permite crear administradores, desactivar
// cuentas y poner el sello de "verificado" a cualquiera. Por eso:
//   - Solo renderiza datos si `esAdmin` es true
//   - Las acciones destructivas piden confirmación
//   - Cada cambio muestra qué se modificó, no solo un "listo"

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { api, conQuery, ErrorPeticion } from '@/lib/api';
import type { UsuarioAdmin, RolUsuario } from '@/lib/tipos';

export default function PaginaAdmin() {
  const { esAdmin, cargando: cargandoAuth, usuario } = useAuth();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState<RolUsuario | ''>('');
  const [activo, setActivo] = useState<'' | 'true' | 'false'>('');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  // Un no-admin no debe ni ver la pantalla. replace() en vez de push()
  // para que no pueda volver con el botón "atrás".
  useEffect(() => {
    if (!cargandoAuth && !esAdmin) {
      router.replace('/');
    }
  }, [esAdmin, cargandoAuth, router]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const respuesta = await api<{ datos: UsuarioAdmin[] }>(
        conQuery('/api/usuarios', {
          busqueda: busqueda || undefined,
          rol: rol || undefined,
          activo: activo || undefined,
        })
      );
      setUsuarios(respuesta.datos);
    } catch (e) {
      setError(
        e instanceof ErrorPeticion ? e.message : 'No pudimos cargar los usuarios.'
      );
    } finally {
      setCargando(false);
    }
  }, [busqueda, rol, activo]);

  useEffect(() => {
    if (!esAdmin) return;

    // Debounce: sin esto, cada tecla dispara una petición.
    const temporizador = setTimeout(() => void cargar(), 300);
    return () => clearTimeout(temporizador);
  }, [esAdmin, cargar]);

  /**
   * Aplica un cambio y actualiza solo la fila afectada.
   *
   * ⛔ No recargamos la lista entera: si el admin está verificando
   * veinte usuarios seguidos, un refresco completo lo saca del scroll y
   * pierde el hilo de lo que iba haciendo.
   */
  const actualizar = async (
    id: number,
    cambios: Partial<Pick<UsuarioAdmin, 'identidad_verificada' | 'activo' | 'rol'>>,
    descripcion: string
  ) => {
    setOcupado(id);
    setError(null);
    setAviso(null);

    try {
      const respuesta = await api<{ usuario: UsuarioAdmin }>(`/api/usuarios/${id}`, {
        metodo: 'PUT',
        cuerpo: cambios,
      });

      setUsuarios((actuales) =>
        actuales.map((u) => (u.id === id ? { ...u, ...respuesta.usuario } : u))
      );

      setAviso(descripcion);
    } catch (e) {
      setError(
        e instanceof ErrorPeticion ? e.message : 'No se pudo aplicar el cambio.'
      );
    } finally {
      setOcupado(null);
    }
  };

  // While checking the role, show nothing rather than a flash of the panel.
  if (cargandoAuth || !esAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-8 w-1/3 animate-pulse rounded-chico bg-papel-hundido" />
      </div>
    );
  }

  const pendientes = usuarios.filter((u) => u.documento_identidad && !u.identidad_verificada);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-titulo font-semibold text-tinta">Administración</h1>
        <p className="mt-1 text-cuerpo text-tinta-50">
          Verifica identidades y gestiona el acceso a la plataforma.
        </p>
      </header>

      {/* --- Aviso de cambios --- */}
      {aviso && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-4 rounded-medio border border-senal bg-senal-suave px-4 py-3 text-cuerpo text-senal-hondo"
        >
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="text-senal-hondo hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-medio border border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta"
        >
          {error}
        </div>
      )}

      {/* --- Filtros --- */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="busqueda" className="solo-lector">
            Buscar por nombre o correo
          </label>
          <input
            id="busqueda"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="campo"
          />
        </div>

        <Filtro
          id="rol"
          etiqueta="Rol"
          valor={rol}
          onChange={(v) => setRol(v as RolUsuario | '')}
          opciones={[
            { valor: 'CLIENTE', texto: 'Comprador' },
            { valor: 'PROPIETARIO', texto: 'Propietario' },
            { valor: 'AGENTE', texto: 'Agente' },
            { valor: 'ADMIN', texto: 'Administrador' },
          ]}
          todos="Todos los roles"
        />

        <Filtro
          id="activo"
          etiqueta="Estado"
          valor={activo}
          onChange={(v) => setActivo(v as '' | 'true' | 'false')}
          opciones={[
            { valor: 'true', texto: 'Activos' },
            { valor: 'false', texto: 'Desactivados' },
          ]}
          todos="Activos e inactivos"
        />
      </div>

      {/* --- Cola de verificación ---
          Va arriba porque es la tarea que el admin vino a hacer. Si hay
          alguien esperando, no debería estar escondido en una lista. */}
      {pendientes.length > 0 && (
        <div className="mb-6 rounded-grande border border-latón bg-latón-suave px-4 py-3">
          <p className="text-cuerpo text-latón">
            <strong>
              {pendientes.length}{' '}
              {pendientes.length === 1 ? 'persona espera' : 'personas esperan'}
            </strong>{' '}
            verificación de identidad
            {pendientes.length === 1 ? '' : ''}.
          </p>
        </div>
      )}

      {/* --- Listado --- */}
      {cargando && usuarios.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-medio bg-papel-hundido" />
          ))}
        </div>
      ) : usuarios.length === 0 ? (
        <div className="rounded-grande border border-dashed border-linea-fuerte px-6 py-12 text-center">
          <p className="text-cuerpo font-medium text-tinta">Sin resultados</p>
          <p className="mt-1 text-menor text-tinta-50">
            Prueba con otro término de búsqueda o quita los filtros.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {usuarios.map((u) => (
            <li key={u.id} className="rounded-medio border border-linea bg-papel-alto p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* --- Identidad --- */}
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-tinta">{u.nombre}</p>
                    <span className="distintivo distintivo-neutro">
                      {etiquetaRol(u.rol)}
                    </span>
                    {!u.activo && (
                      <span className="distintivo distintivo-latón">Desactivado</span>
                    )}
                  </div>

                  <p className="mt-0.5 text-menor text-tinta-50">{u.email}</p>

                  <p className="mt-1 text-micro text-tinta-30">
                    {u.propiedades}{' '}
                    {u.propiedades === 1 ? 'publicación' : 'publicaciones'}
                    {u.ultimo_acceso
                      ? ` · último acceso ${tiempoRelativo(u.ultimo_acceso)}`
                      : ' · nunca ha entrado'}
                  </p>

                  {/* El documento es lo que hay que revisar. Por eso se
                      muestra en monoespaciada: los DNI/RUC se leen mejor
                      así y es más difícil confundirlos. */}
                  {u.documento_identidad && (
                    <p className="cifra mt-2 text-menor text-tinta-70">
                      Documento: {u.documento_identidad}
                    </p>
                  )}
                </div>

                {/* --- Estado de verificación --- */}
                <div className="flex flex-col items-end gap-2">
                  {u.identidad_verificada ? (
                    <span className="distintivo distintivo-senal">
                      Identidad verificada
                    </span>
                  ) : u.documento_identidad ? (
                    <span className="distintivo distintivo-latón">
                      Documento enviado
                    </span>
                  ) : (
                    <span className="text-micro text-tinta-30">Sin documento</span>
                  )}

                  {/* --- Acciones ---
                      Solo aparecen si la acción tiene sentido para ese
                      usuario, para no llenar de botones que no hacen nada. */}
                  <div className="flex flex-wrap justify-end gap-1">
                    {u.documento_identidad && (
                      <button
                        type="button"
                        disabled={ocupado === u.id}
                        onClick={() =>
                          actualizar(
                            u.id,
                            { identidad_verificada: !u.identidad_verificada },
                            u.identidad_verificada
                              ? `Se quitó la verificación a ${u.nombre}`
                              : `${u.nombre} quedó con identidad verificada`
                          )
                        }
                        className={`btn text-menor ${
                          u.identidad_verificada ? 'btn-secundario' : 'btn-principal'
                        }`}
                      >
                        {u.identidad_verificada ? 'Quitar sello' : 'Verificar'}
                      </button>
                    )}

                    {u.rol === 'CLIENTE' && u.documento_identidad && (
                      <button
                        type="button"
                        disabled={ocupado === u.id}
                        onClick={() =>
                          actualizar(
                            u.id,
                            { rol: 'AGENTE' },
                            `${u.nombre} pasó a ser agente`
                          )
                        }
                        className="btn btn-secundario text-menor"
                      >
                        Aprobar como agente
                      </button>
                    )}

                    {/* Nadie puede desactivarse a sí mismo: el backend lo
                        bloquea, pero esconder el botón explica mejor por qué. */}
                    {u.id !== usuario?.id && (
                      <button
                        type="button"
                        disabled={ocupado === u.id}
                        onClick={() => {
                          const accion = u.activo ? 'desactivar' : 'reactivar';
                          if (
                            !u.activo ||
                            window.confirm(
                              `¿Desactivar a ${u.nombre}?\n\nDejará de poder iniciar sesión, pero sus publicaciones seguirán visibles.`
                            )
                          ) {
                            void actualizar(
                              u.id,
                              { activo: !u.activo },
                              `${u.nombre} fue ${accion}do`
                            );
                          }
                        }}
                        className={`btn text-menor ${
                          u.activo ? 'btn-secundario text-alerta' : 'btn-secundario'
                        }`}
                      >
                        {u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Menú de filtro con etiqueta, como los de la barra de búsqueda. */
function Filtro({
  id,
  etiqueta,
  valor,
  onChange,
  opciones,
  todos,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  opciones: { valor: string; texto: string }[];
  todos: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="solo-lector">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="campo w-auto py-2"
      >
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function etiquetaRol(rol: string): string {
  const etiquetas: Record<string, string> = {
    CLIENTE: 'Comprador',
    PROPIETARIO: 'Propietario',
    AGENTE: 'Agente',
    ADMIN: 'Administrador',
  };
  return etiquetas[rol] ?? rol;
}

function tiempoRelativo(fechaISO: string): string {
  const segundos = (Date.now() - new Date(fechaISO).getTime()) / 1000;
  if (segundos < 3600) return `hace ${Math.max(1, Math.floor(segundos / 60))} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  const dias = Math.floor(segundos / 86400);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}
