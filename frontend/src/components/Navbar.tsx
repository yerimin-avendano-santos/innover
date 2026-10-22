'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contextos/Auth';
import { Logo } from '@/components/Logo';

export function Navbar() {
  const { usuario, estaConectado, esAgente, esAdmin, cerrarSesion, cargando } = useAuth();
  const router = useRouter();
  const ruta = usePathname();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    if (!menuAbierto && !menuMovilAbierto) return;

    const alHacerClicFuera = (evento: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(evento.target as Node)) {
        setMenuAbierto(false);
        setMenuMovilAbierto(false);
      }
    };

    document.addEventListener('mousedown', alHacerClicFuera);
    return () => document.removeEventListener('mousedown', alHacerClicFuera);
  }, [menuAbierto, menuMovilAbierto]);

  const alSalir = async () => {
    await cerrarSesion();
    setMenuAbierto(false);
    setMenuMovilAbierto(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-50 h-16 border-b border-teal-900/40 shadow-md backdrop-blur-md"
      style={{
        background: 'linear-gradient(90deg, #0B4A50 0%, #0F5C63 100%)',
      }}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* --- 1. Logo sin tarjeta blanca (directo sobre teal) --- */}
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <Link
            href="/"
            className="flex min-w-0 shrink-0 items-center gap-2.5 transition-opacity hover:opacity-95"
            aria-label="Innover, ir al inicio"
          >
            <Logo className="h-8 w-8 shrink-0 text-turquesa" />
            <div className="flex flex-col">
              <span className="text-base font-bold uppercase tracking-wider text-white leading-tight sm:text-lg">
                INNOVER
              </span>
              <span className="hidden text-[11px] font-medium text-[#9FD3D6] leading-tight sm:inline">
                Propiedades en el mapa
              </span>
            </div>
          </Link>

          {/* --- 2. Enlaces centrales de navegación (aprovechando espacio vacío) --- */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            <Link
              href="/"
              className={`relative px-3.5 py-2 text-menor transition-all ${
                ruta === '/'
                  ? 'font-semibold text-white after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-turquesa'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Mapa
            </Link>
            <Link
              href="/favoritos"
              className={`relative px-3.5 py-2 text-menor transition-all ${
                ruta === '/favoritos'
                  ? 'font-semibold text-white after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-turquesa'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Favoritos
            </Link>
            <Link
              href="/perfil"
              className={`relative px-3.5 py-2 text-menor transition-all ${
                ruta === '/perfil'
                  ? 'font-semibold text-white after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-turquesa'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Mis propiedades
            </Link>
          </nav>
        </div>

        {/* --- 3. Lado derecho: Publicar, Notificaciones y Usuario --- */}
        <div className="flex items-center gap-2 sm:gap-3" ref={menuRef}>
          {/* Botón "Publicar propiedad" en coral #FF6B4A destacado */}
          <Link
            href="/publicar"
            className="btn btn-coral inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-menor shadow-md"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Publicar propiedad</span>
            <span className="sm:hidden">Publicar</span>
          </Link>

          {/* Campana de avisos con dot */}
          <div
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/85 transition hover:bg-white/20 hover:text-white"
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span
              className="absolute right-2 top-2 h-2 w-2 rounded-full bg-turquesa ring-2 ring-[#0F5C63]"
              aria-hidden="true"
            />
          </div>

          {/* Menú de sesión */}
          {cargando ? (
            <div className="h-9 w-20 animate-pulse rounded-xl bg-white/10" />
          ) : estaConectado ? (
            <div className="relative">
              {/* Botón de usuario translúcido según propuesta */}
              <button
                type="button"
                onClick={() => setMenuAbierto((abierto) => !abierto)}
                aria-expanded={menuAbierto}
                aria-haspopup="menu"
                aria-label={`${usuario!.nombre}: abrir menú de usuario`}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/12 px-2.5 py-1.5 text-white transition hover:bg-white/20 active:scale-95"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-turquesa text-micro font-bold text-marino shadow-xs"
                >
                  {usuario!.nombre.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[110px] truncate text-menor font-medium text-white md:inline">
                  {usuario!.nombre.split(' ')[0]}
                </span>
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3 text-white/80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Dropdown del usuario con esquinas de 12px, iconos y sombra suave */}
              {menuAbierto && (
                <div
                  role="menu"
                  className="superficie-clara panel-aparece absolute right-0 top-full mt-2 w-64 rounded-xl border border-linea bg-papel-alto py-1.5 shadow-xl"
                >
                  <div className="border-b border-linea px-3.5 py-2.5">
                    <p className="truncate text-cuerpo font-semibold text-tinta">
                      {usuario!.nombre}
                    </p>
                    <p className="truncate text-micro text-tinta-50">{usuario!.email}</p>
                    <span className="distintivo distintivo-neutro mt-1.5">
                      {etiquetaRol(usuario!.rol)}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/perfil"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-menor text-tinta-70 transition hover:bg-papel-hundido hover:text-tinta"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4 text-tinta-50" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <circle cx="10" cy="7" r="4" />
                        <path d="M4 17a6 6 0 0 1 12 0" />
                      </svg>
                      Mi perfil
                    </Link>

                    <Link
                      href="/perfil"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-menor text-tinta-70 transition hover:bg-papel-hundido hover:text-tinta"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4 text-tinta-50" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 8l7-5 7 5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" />
                      </svg>
                      Mis propiedades
                    </Link>

                    <Link
                      href="/favoritos"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-menor text-tinta-70 transition hover:bg-papel-hundido hover:text-tinta"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4 text-tinta-50" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M10 17l-6-6a4.5 4.5 0 0 1 6.36-6.36L10 5.27l-.36-.63a4.5 4.5 0 0 1 6.36 6.36l-6 6z" />
                      </svg>
                      Favoritos
                    </Link>

                    {esAgente && (
                      <Link
                        href="/leads"
                        role="menuitem"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-menor text-tinta-70 transition hover:bg-papel-hundido hover:text-tinta"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-tinta-50" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <rect x="3" y="4" width="14" height="12" rx="2" />
                          <path d="M3 8h14M8 12h4" />
                        </svg>
                        Panel de contactos
                      </Link>
                    )}

                    {esAdmin && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-menor text-tinta-70 transition hover:bg-papel-hundido hover:text-tinta"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-tinta-50" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M10 2l6 3v5c0 4-3 7-6 8-3-1-6-4-6-8V5l6-3z" />
                        </svg>
                        Administración
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-linea pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={alSalir}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-menor font-medium text-alerta transition hover:bg-alerta-suave"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 4h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4M9 14l4-4-4-4M13 10H3" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link href="/login" className="btn btn-fantasma-claro text-cuerpo">
                Entrar
              </Link>
              <Link href="/registro" className="btn btn-turquesa text-cuerpo">
                Crear<span className="hidden sm:inline">&nbsp;cuenta</span>
              </Link>
            </div>
          )}
        </div>
      </div>
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
