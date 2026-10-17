'use client';

// ========================================
// 🧭 BARRA DE NAVEGACIÓN
// ========================================

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contextos/Auth';
import { Logo } from '@/components/Logo';

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
    /*
     * La barra va en azul marino, no en blanco.
     *
     * Es lo que pide la guía visual, y tiene una consecuencia práctica
     * más allá de la estética: la barra es lo único que se ve en TODAS
     * las pantallas, así que es donde la marca se reconoce. En blanco se
     * confundía con el fondo de la página y el logo flotaba sin
     * pertenecer a nada.
     *
     * La clase `sobre-marino` no pinta nada: le dice al sistema de
     * diseño que aquí el foco por teclado tiene que ser turquesa claro,
     * porque el turquesa oscuro se pierde contra este fondo.
     */
    <header className="sobre-marino sticky top-0 z-40 bg-marino">
      {/* `min-w-0` en la marca + `gap-3` en el contenedor:
          sin el primero, el logotipo empuja el bloque de sesión fuera
          de la pantalla en móviles estrechos. */}
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        {/* --- Marca ---
            El icono es decorativo (no lleva `titulo`) porque la palabra
            "Innover" está escrita a su lado: si ambos se anunciaran, un
            lector de pantalla diría "Innover Innover". */}
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2.5"
          aria-label="Innover, ir al inicio"
        >
          <Logo className="h-7 w-7 shrink-0" />
          <span className="truncate text-normal font-bold tracking-tight text-sobre-marino">
            Innover
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
                    ? 'bg-marino-alto font-medium text-turquesa'
                    : 'text-sobre-marino-tenue hover:bg-marino-alto hover:text-sobre-marino'
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
            <div className="h-8 w-24 animate-pulse rounded-medio bg-marino-alto" />
          ) : estaConectado ? (
            <>
              <button
                type="button"
                onClick={() => setMenuAbierto((abierto) => !abierto)}
                aria-expanded={menuAbierto}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-medio px-2 py-1.5 text-cuerpo transition-colors hover:bg-marino-alto"
              >
                {/* Inicial en lugar de avatar: no todos suben foto, y
                    un círculo vacío se ve como una imagen rota.
                    Turquesa sobre marino, con el texto en marino: al
                    revés —blanco sobre turquesa— daría 1,9:1. */}
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-turquesa text-micro font-semibold text-marino"
                >
                  {usuario!.nombre.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate text-sobre-marino-tenue md:inline">
                  {usuario!.nombre.split(' ')[0]}
                </span>
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3 text-sobre-marino-tenue"
                  aria-hidden="true"
                >
                  <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>

              {menuAbierto && (
                /*
                 * El menú cuelga de la barra oscura pero su fondo es
                 * blanco, así que recupera el foco del sistema para
                 * superficies claras. Sin esto heredaría el turquesa
                 * claro de la barra, que sobre blanco no se ve.
                 */
                <div
                  role="menu"
                  className="superficie-clara panel-aparece absolute right-0 top-full mt-1 w-56 rounded-medio border border-linea bg-papel-alto py-1 shadow-lg"
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

                  {/*
                    "Guardados" va aquí y no en la barra principal: es una
                    lista personal, como el perfil, no una sección del producto.
                    En la barra competiría con "Buscar" —que es lo que hace todo
                    el mundo todo el rato— y le quitaría sitio a la navegación
                    que sí se usa a diario.
                  */}
                  <Link
                    href="/favoritos"
                    role="menuitem"
                    onClick={() => setMenuAbierto(false)}
                    className="block px-3 py-2 text-cuerpo text-tinta-70 transition-colors hover:bg-papel-hundido hover:text-tinta"
                  >
                    Guardados
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
             *
             * "Crear cuenta" usa `.btn-turquesa` y no `.btn-principal`
             * porque está encima del azul marino: el color de acción se
             * queda a 2,4:1 contra este fondo y el botón no se leería
             * como un botón.
             */
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

      {/* --- Navegación en móvil --- */}
      <nav
        className="sin-barra flex gap-1 overflow-x-auto px-4 py-1.5 sm:hidden"
        aria-label="Principal (móvil)"
      >
        {ENLACES.map((enlace) => {
          if (enlace.href === '/leads' && !esAgente) return null;

          const activo = ruta === enlace.href;
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={`shrink-0 rounded-chico px-3 py-1 text-menor transition-colors ${
                activo
                  ? 'bg-marino-alto font-medium text-turquesa'
                  : 'text-sobre-marino-tenue hover:text-sobre-marino'
              }`}
            >
              {enlace.etiqueta}
            </Link>
          );
        })}
      </nav>

      {/* El degradado de marca cierra la barra. Va aquí y no como
          `border-b` porque un borde solo admite un color por lado, y
          esto son dos. Es decorativo: cero texto encima, que es la
          única forma de usar el turquesa claro sin perder contraste. */}
      <div className="franja-marca h-0.5" aria-hidden="true" />
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
