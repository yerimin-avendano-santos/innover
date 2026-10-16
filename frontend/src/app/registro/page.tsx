'use client';

// ========================================
// 📝 PÁGINA DE REGISTRO
// ========================================
// ⛔ CAMBIO IMPORTANTE: aquí YA NO HAY SELECTOR DE ROL.
//
// La versión anterior ofrecía "Cliente / Agente / Propietario" y mandaba
// el valor al backend, que lo aceptaba. Eso significaba que cualquiera
// se registraba como agente con una sola petición, y rompía la promesa
// del producto ("directorio de propietarios validados").
//
// Ahora toda cuenta nace como CLIENTE. Para publicar propiedades hay un
// proceso de verificación aparte, igual que en cualquier plataforma que
// cobra por sus servicios.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { ErrorPeticion } from '@/lib/api';
import { MarcoAuth, MensajeError, Campo } from '../login/page';

export default function PaginaRegistro() {
  const { registrar } = useAuth();
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [telefono, setTelefono] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const alEnviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setErrorCampo({});
    setEnviando(true);

    try {
      await registrar({
        nombre,
        email,
        contrasena,
        // El teléfono es opcional y solo se manda si el usuario lo escribió.
        telefono: telefono || undefined,
      });
      router.push('/');
      router.refresh();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setError(e.message);
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
      titulo="Crea tu cuenta"
      subtitulo="Para buscar propiedades y guardar tus favoritos."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-senal hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={alEnviar} noValidate className="space-y-4">
        <MensajeError>{error}</MensajeError>

        <Campo
          etiqueta="Nombre completo"
          id="nombre"
          value={nombre}
          onChange={setNombre}
          placeholder="Ana Salazar"
          autoComplete="name"
          error={errorCampo.nombre}
        />

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
          autoComplete="new-password"
          error={errorCampo.contrasena}
          hint="Mínimo 8 caracteres."
        />

        <Campo
          etiqueta="Celular (opcional)"
          id="telefono"
          type="tel"
          value={telefono}
          onChange={setTelefono}
          placeholder="987654321"
          autoComplete="tel"
          error={errorCampo.telefono}
        />

        <button type="submit" disabled={enviando} className="btn btn-principal w-full">
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        {/* El aviso va antes de enviar, no en un modal después. Si el rol
            no es elegible aquí, el usuario debe saberlo ANTES de
            llenar el formulario, no descubrirlo al final. */}
        <p className="rounded-medio bg-papel-hundido px-3 py-2.5 text-micro text-tinta-70">
          ¿Publicas propiedades por trabajo? Tu cuenta empieza como
          comprador. Después puedes solicitar ser agente y verificamos tus
          datos.
        </p>
      </form>
    </MarcoAuth>
  );
}
