'use client';

// ========================================
// 🧾 MARCO DEL ACCESO
// ========================================
// Entrar y registrarse comparten este marco: la pantalla, sus campos y su
// mensaje de error viven aquí, para que las dos pantallas no se vayan
// separando. Antes el registro importaba estas piezas desde el archivo
// del login (`../login/page`), que funciona pero deja a una pantalla
// colgando del archivo de otra.
//
// ── Cómo se adapta ──
//
// · La pantalla de acceso NO es una tarjeta flotante: ocupa el viewport
//   entero, sin márgenes ni esquinas. Antes flotaba desde `sm` sobre el
//   gris del fondo (máx. 1080 × mín. 660 px) y se quitó a propósito: es la
//   primera pantalla del producto, y un marco alrededor del marco era un
//   borde que no separaba nada. Lo que antes decía «aquí empieza Innover»
//   ahora lo dice que el formulario esté pegado al borde de la ventana.
// · Desde `lg` la mitad derecha es el panel oscuro de marca.
// · Dentro de la mitad del formulario, el contenido vive en un carril de
//   26 rem centrado: en un monitor ancho, esa mitad son 900 px, y unos
//   campos de 900 px no se leen —hay que girar la cabeza para ir de la
//   etiqueta al valor—. La marca, el título, los campos y el pie comparten
//   el carril, así que quedan alineados entre sí aunque la columna sea el
//   doble.
//
// 📌 NOTA SOBRE EL NOMBRE DEL CAMPO
// El campo se llama `contrasena` (sin ñ) porque así lo espera el backend.
// Antes el frontend mandaba `password` y el login SIEMPRE fallaba con
// 500, porque `bcrypt.compare(undefined, hash)` lanza excepción.

import { useState, type ReactNode } from 'react';
import { Marca } from '@/components/Logo';
import { PanelAcceso } from '@/components/PanelAcceso';

/** La pantalla de acceso: formulario a la izquierda, marca a la derecha. */
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
    <div className="flex flex-1 flex-col">
      <div className="superficie-acceso flex w-full flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-2">
        <div className="flex flex-1 flex-col px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          {/* El carril: marca, título, formulario y pie, todos al mismo
              ancho y centrados en la mitad que les toca. */}
          <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col">
            {/* La marca: apilada y centrada en móvil (como en el diseño de
                móvil), en fila a la izquierda desde `lg`. */}
            <Marca
              icono="h-14 w-14 sm:h-12 sm:w-12"
              texto="text-grande"
              className="flex-col items-center gap-2 text-tinta lg:flex-row lg:gap-3"
            />

            {/* `flex-1` + `justify-center`: el bloque del título y el
                formulario se centra en el hueco que queda entre la marca y
                el pie, que es lo que reparte el aire del diseño. */}
            <div className="flex flex-1 flex-col justify-center py-10 lg:py-12">
              <div className="text-center">
                <h1 className="text-titulo font-semibold text-tinta">{titulo}</h1>
                <p className="mx-auto mt-2 max-w-[36ch] text-cuerpo text-tinta-50">
                  {subtitulo}
                </p>
              </div>

              <div className="mt-8">{children}</div>
            </div>

            <p className="text-center text-cuerpo text-tinta-50">{pie}</p>
          </div>
        </div>

        <PanelAcceso />
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
      className="mb-5 rounded-medio border border-alerta bg-alerta-suave px-3 py-2.5 text-menor text-alerta"
    >
      {children}
    </div>
  );
}

/**
 * Campo de formulario con su etiqueta y su error.
 *
 * `revelable` añade el botón del ojo para ver lo escrito. Es lo que más
 * hace falta en un móvil: escribir una contraseña a ciegas en un teclado
 * táctil es donde más erratas se cometen. El dato no se mueve de sitio
 * —es el mismo `input`, solo cambia su `type`—, así que no hay ninguna
 * petición ni ninguna copia de la contraseña en el estado.
 *
 * El ojo va con `aria-pressed`: es un botón de dos estados, no dos
 * botones que aparecen y desaparecen.
 */
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
  revelable = false,
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
  revelable?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const tipo = revelable && visible ? 'text' : type;

  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
      </label>

      <div className="relative">
        <input
          id={id}
          name={id}
          type={tipo}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-pista` : undefined}
          /* `rounded-full` y el relleno vienen después de `.campo` a
             propósito: la utilidad gana a la clase de componente (las
             utilidades se declaran en una capa posterior), así que el
             mismo campo sirve para el resto del producto —rectángulo— y
             para el acceso —pastilla—. */
          className={`campo rounded-full px-4 py-3 ${revelable ? 'pr-12' : ''}`}
        />

        {revelable ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label="Mostrar contraseña"
            aria-pressed={visible}
            className="absolute inset-y-0 right-1 my-auto flex h-9 w-9 items-center justify-center rounded-full text-tinta-50 hover:bg-papel-hundido hover:text-tinta"
          >
            {visible ? <IconoOjoTachado /> : <IconoOjo />}
          </button>
        ) : null}
      </div>

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

/* Los dos iconos del ojo. Van dibujados a mano y con `currentColor`, así
   que heredan el color del botón y no hay ningún hexadecimal suelto en el
   componente. Son decorativos: el nombre lo pone el `aria-label`. */
function IconoOjo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
