// ========================================
// 🚫 ESA PROPIEDAD NO EXISTE
// ========================================
// 📌 POR QUÉ ESTE ARCHIVO Y NO UN `if` DENTRO DE LA PÁGINA
//
// El mensaje podría dibujarse en la propia ficha con un `if`: sería el mismo
// texto y una línea menos. Lo que NO sería es un 404 de verdad — la respuesta
// saldría con estado 200 y un contenido que dice "no encontrada".
//
// Eso tiene nombre —"soft 404"— y es de las cosas que peor se pagan en SEO:
// Google ve una página válida y vacía, y las URLs inventadas se van
// acumulando. Aquí se lanza `notFound()` en la página, Next responde 404 y
// este componente pone el texto.
//
// Se usa para cualquier propiedad que el backend no encuentre: un enlace mal
// escrito, o una que se vendió y se retiró.
//
// ⚠️ Por esto NO hay `loading.tsx` en esta carpeta. Con streaming, Next
// responde 200 también en este caso. Está explicado en `page.tsx`.

import Link from 'next/link';

export default function PropiedadNoEncontrada() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-titulo font-semibold text-tinta">Propiedad no encontrada</h1>
      <p className="mt-2 text-cuerpo text-tinta-50">
        Es posible que se haya vendido o que el enlace esté mal escrito.
      </p>
      <Link href="/" className="btn btn-principal mt-6">
        Volver al inicio
      </Link>
    </div>
  );
}
