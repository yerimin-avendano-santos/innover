'use client';

// ========================================
// 🧭 BARRA DE NAVEGACIÓN
// ========================================

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contextos/Auth';

const ENLACES = [
  { href: '/', etiqueta: 'Buscar' },
  { href: '/publicar', etiqueta: 'Publicar' },
  { href: '/leads', etiqueta: 'Mis contactos' },
];

export function Navbar() {
  const { usuario, estaConectado, esAgente, esAdmin, cerrarSesion, cargando } = useAuth();
  const router = useRouter();
  const ruta = usePathname();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú al hacer clic fuera. Sin esto, el menú se queda
  // abierto encima del contenido y el usuario no sabe cómo quitarlo.
  useEffect(() => {
    if (!menuAbierto) return;

    const alHacerClicFuera = (evento: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    };

    document.addEventListener('mousedown', alHacerClicFuera);
    return () => document.removeEventListener('mousedown', alHacerClicFuera);
  }, [menuAbierto]);

  const alSalir = async () => {
    await cerrarSesion();
    setMenuAbierto(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-linea bg-papel-alto">
      {/* `min-w-0` en la marca + `gap-3` en el contenedor:
          sin el primero, el logotipo empuja el bloque de sesión fuera
          de la pantalla en móviles estrechos. */}
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        {/* --- Marca ---
            El símbolo es una aguja de brújula: dos trazos que se cruzan,
            uno relleno. Es la idea del proyecto (ubicar) en 20 px. */}
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2.5"
          aria-label="INNOVER, ir al inicio"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden="true">
            <path d="M10 1L12.8 8.5 20 10l-7.2 1.5L10 19l-2.8-7.5L0 10l7.2-1.5z" fill="#0f6b70" />
          </svg>
          <span className="truncate text-normal font-semibold tracking-tight text-tinta">
            INNOVER
          </span>
        </Link>

        {/* --- Navegación principal --- */}
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
          {ENLACES.map((enlace) => {
            // "Mis contactos" es de quienes publican o son agentes.
            if (enlace.href === '/leads' && !esAgente) return null;

            const activo = ruta === enlace.href;
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={`rounded-medio px-3 py-1.5 text-cuerpo transition-colors ${
                  activo
                    ? 'bg-papel-hundido font-medium text-tinta'
                    : 'text-tinta-70 hover:text-tinta'
                }`}
              >
                {enlace.etiqueta}
              </Link>
            );
          })}
        </nav>

        {/* --- Sesión --- */}
        <div className="relative" ref={menuRef}>
          {cargando ? (
            <div className="h-8 w-24 animate-pulse rounded-medio bg-papel-hundido" />
          ) : estaConectado ? (
            <>
              <button
                type="button"
                onClick={() => setMenuAbierto((abierto) => !abierto)}
                aria-expanded={menuAbierto}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-medio px-2 py-1.5 text-cuerpo transition-colors hover:bg-papel-hundido"
              >
                {/* Inicial en lugar de avatar: no todos suben foto, y
                    un círculo vacío se ve como una imagen rota. */}
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-senal text-micro font-semibold text-white"
                >
                  {usuario!.nombre.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate text-tinta-70 md:inline">
                  {usuario!.nombre.split(' ')[0]}
                </span>
                <svg viewBox="0 0 12 12" className="h-3 w-3 text-tinta-50" aria-hidden="true">
                  <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>

              {menuAbierto && (
                <div
                  role="menu"
                  className="panel-aparece absolute right-0 top-full mt-1 w-56 rounded-medio border border-linea bg-papel-alto py-1 shadow-lg"
                >
                  <div className="border-b border-linea px-3 py-2.5">
                    <p className="truncate text-cuerpo font-medium text-tinta">
                      {usuario!.nombre}
                    </p>
                    <p className="truncate text-micro text-tinta-50">{usuario!.email}</p>
                    <span className="distintivo distintivo-neutro mt-1.5">
                      {etiquetaRol(usuario!.rol)}
                    </span>
                  </div>

                  <Link
                    href="/perfil"
                    role="menuitem"
                    onClick={() => setMenuAbierto(false)}
                    className="block px-3 py-2 text-cuerpo text-tinta-70 transition-colors hover:bg-papel-hundido hover:text-tinta"
                  >
                    Mi perfil
                  </Link>

                  {esAgente && (
                    <Link
                      href="/leads"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="block px-3 py-2 text-cuerpo text-tinta-70 transition-colors hover:bg-papel-hundido hover:text-tinta"
                    >
                      Panel de contactos
                    </Link>
                  )}

                  {/* El panel de admin va en el menú y no en la barra
                      principal: es una herramienta de moderación, no una
                      sección del producto. Un admin la usa de vez en
                      cuando; el resto de usuarios ni la ven. */}
                  {esAdmin && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="block px-3 py-2 text-cuerpo text-tinta-70 transition-colors hover:bg-papel-hundido hover:text-tinta"
                    >
                      Administración
                    </Link>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={alSalir}
                    className="w-full border-t border-linea px-3 py-2 text-left text-cuerpo text-alerta transition-colors hover:bg-alerta-suave"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </>
          ) : (
            /*
             * En pantallas estrechas el botón dice "Crear cuenta" completo
             * y se desborda. Se acorta a "Crear" con `hidden sm:inline`
             * dentro del propio enlace, sin duplicar el botón ni usar
             * JavaScript para detectar el ancho.
             */
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link href="/login" className="btn btn-fantasma text-cuerpo">
                Entrar
              </Link>
              <Link href="/registro" className="btn btn-principal text-cuerpo">
                Crear<span className="hidden sm:inline">&nbsp;cuenta</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* --- Navegación en móvil --- */}
      <nav
        className="sin-barra flex gap-1 overflow-x-auto border-t border-linea px-4 py-1.5 sm:hidden"
        aria-label="Principal (móvil)"
      >
        {ENLACES.map((enlace) => {
          if (enlace.href === '/leads' && !esAgente) return null;

          const activo = ruta === enlace.href;
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={`shrink-0 rounded-chico px-3 py-1 text-menor ${
                activo ? 'bg-papel-hundido font-medium text-tinta' : 'text-tinta-70'
              }`}
            >
              {enlace.etiqueta}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/** El rol en palabras que un usuario entiende. */
function etiquetaRol(rol: string): string {
  const etiquetas: Record<string, string> = {
    CLIENTE: 'Comprador',
    PROPIETARIO: 'Propietario',
    AGENTE: 'Agente inmobiliario',
    ADMIN: 'Administrador',
  };
  return etiquetas[rol] ?? rol;
}
