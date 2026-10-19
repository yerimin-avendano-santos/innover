'use client';

// ========================================
// 💥 LA FICHA NO SE PUDO CARGAR
// ========================================
// 📌 Y ESTO NO ES UN 404, AUNQUE LO PAREZCA
//
// "No existe" y "no se pudo preguntar" se ven igual desde aquí y son
// opuestos: uno es permanente y el otro pasajero. La página los separa
// (ver `page.tsx`) y este componente es el segundo caso: el backend no
// respondió.
//
// La diferencia importa porque responder 404 a un corte de red le dice a
// Google que una propiedad que SÍ existe ha desaparecido: la desindexa, y el
// dueño pierde su enlace por un fallo que se arregla solo. Aquí se responde
// con error de servidor, que no desindexa nada, y se le da a la persona un
// botón para volver a intentarlo sin recargar la página entera.
//
// El caso raro es este: si la propiedad no existe, quien manda es
// `not-found.tsx`.

export default function ErrorFicha({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-titulo font-semibold text-tinta">
        No pudimos cargar esta propiedad
      </h1>
      <p className="mt-2 text-cuerpo text-tinta-50">
        El servidor no respondió. Es un problema temporal: la propiedad sigue
        ahí.
      </p>
      <button type="button" onClick={reset} className="btn btn-principal mt-6">
        Reintentar
      </button>
    </div>
  );
}
