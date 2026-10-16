# 🗺️ Hoja de Ruta de Desarrollo y Aprendizaje (ROADMAP)

Cada fase tiene dos listas: lo que **hay que aprender** y lo que **hay que construir**. Una casilla marcada significa que está terminado y funcionando.

> 📖 Al terminar cada fase, el *qué* queda en el código y el *por qué* en [`02_ARQUITECTURA_Y_SEGURIDAD.md`](./02_ARQUITECTURA_Y_SEGURIDAD.md).

---

## Fase 1: Fundamentos y arquitectura 🏗️

- [x] **Aprender:** qué es frontend, backend, API y base de datos
- [x] **Aprender:** Git y control de versiones
- [x] **Definición técnica:** JavaScript/TypeScript con Node.js, React y Next.js
- [x] **Diseño de base de datos:** el modelo entidad-relación de INNOVER

## Fase 2: Backend y base de datos ⚙️

- [x] **Aprender:** servidor web con Express
- [x] **Aprender:** PostgreSQL relacional
- [x] **Aprender:** **datos espaciales con PostGIS** (puntos, `ST_DWithin`, índices GIST)
- [x] **Desarrollo:** modelo de propiedades con su migración versionada
- [x] **Desarrollo:** CRUD completo con arquitectura por capas
- [x] **Desarrollo:** **migraciones de Prisma** en vez de `db push`
- [x] **Desarrollo:** búsqueda geográfica por radio en km

## Fase 3: Seguridad y autenticación 🔐

- [x] **Aprender:** qué es un JWT y cómo se verifica
- [x] **Aprender:** encriptación de contraseñas con bcrypt
- [x] **Aprender:** **cookies `httpOnly`** frente a `localStorage`
- [x] **Aprender:** **autorización en tres capas** (sesión → rol → recurso)
- [x] **Aprender:** **mass assignment** y por qué restringir la lista de campos
- [x] **Aprender:** **XSS** y por qué `setHTML()` es una decisión, no un atajo
- [x] **Desarrollo:** registro y login con cookie de sesión
- [x] **Desarrollo:** roles `CLIENTE`, `PROPIETARIO`, `AGENTE` y `ADMIN`
- [x] **Desarrollo:** el rol **nunca** se autoasigna en el registro
- [x] **Desarrollo:** validación de entrada con Zod en todas las rutas
- [x] **Desarrollo:** rate limiting, CORS con lista blanca y cabeceras de seguridad
- [x] **Desarrollo:** 166 pruebas de integración y seguridad (144 API + 22 puente)

## Fase 4: Frontend y mapas interactivos 🎨

- [x] **Aprender:** React y el ciclo de componentes
- [x] **Aprender:** Next.js y el App Router
- [x] **Aprender:** **Tailwind v4 CSS-first** (tokens con `@theme`, sin config JS)
- [x] **Aprender:** **puente SSR** entre navegador y backend (mismo origen, sin CORS)
- [x] **Desarrollo:** buscador con mapa a pantalla completa
- [x] **Desarrollo:** filtros por tipo, distrito, habitaciones, precio y orden
- [x] **Desarrollo:** marcadores con precio y popup seguro (sin XSS)
- [x] **Desarrollo:** ficha de detalle con URL por slug
- [x] **Desarrollo:** formulario de publicación con vista previa en el mapa
- [x] **Desarrollo:** perfil del usuario y gestión de publicaciones

## Fase 5: CRM para agentes (B2B) 🤝

- [x] **Desarrollo:** modelo de contactos (leads) con estado
- [x] **Desarrollo:** crear lead desde la ficha de una propiedad
- [x] **Desarrollo:** bandeja de leads del agente y del propietario directo
- [x] **Desarrollo:** métricas de conversión (total, cerrados, tasa de cierre)
- [x] **Desarrollo:** panel de administración (verificar identidades, gestionar roles y accesos)
- [x] **Desarrollo:** flujo de solicitud de agente con estado (aprobada / rechazada) — *backend: cola, historial, motivo de rechazo y auditoría de quién resolvió*
- [ ] **Desarrollo:** pantalla de solicitud de agente (el formulario en `/perfil` y la cola en `/admin`)
- [x] **Desarrollo:** modelo del plan comercial (`GRATIS` / `PRO`) con vencimiento — *independiente del rol*
- [x] **Desarrollo:** candado del recorrido 3D y del destaque por plan, verificado **en el servidor**
- [ ] **Desarrollo:** cobro de la suscripción (el plan se asigna a mano desde el panel; falta la pasarela de pago)
- [ ] **Desarrollo:** créditos de contacto por plan

## Fase 6: Multimedia y 3D 🏠

- [ ] **Aprender:** almacenamiento de archivos en la nube (S3 / Cloudinary)
- [ ] **Desarrollo:** subida de imágenes de propiedades
- [ ] **Desarrollo:** galería en la ficha
- [x] **Desarrollo:** campo e incrustación del recorrido 3D
- [ ] **Desarrollo:** recorrido 360° con Matterport

## Fase 7: Inteligencia artificial 🤖

- [ ] **Aprender:** consumo de APIs de IA
- [ ] **Desarrollo:** asistente de "zona ideal" con test de necesidades
- [ ] **Desarrollo:** estimación de precio por zona
- [ ] **Desarrollo:** validación de identidad de propietarios (RENIEC)

## Fase 8: Producción 🚀

- [ ] **Aprender:** hosting de base de datos, backend y frontend
- [ ] **Aprender:** dominios, DNS y certificados HTTPS
- [ ] **Aprender:** CI/CD y despliegue automático
- [ ] **Desarrollo:** despliegue de INNOVER en producción
- [ ] **Desarrollo:** monitoreo y alertas

---

## 📌 Deuda técnica conocida

Lo que queda pendiente y conviene no olvidar:

- [ ] **Tests unitarios** (hay 166 de integración, ninguno aislado de un componente)
- [ ] **Refresh tokens** (la sesión caduca a las 2 h sin renovación)
- [ ] **Fotos de propiedades** (el campo `imagenes` existe y se guarda, pero no hay subida ni galería)
- [ ] **Pantalla de solicitud de agente** (el backend ya resuelve y audita; falta el formulario y la cola)
- [ ] **Verificación contra RENIEC** (hoy el admin valida a ojo el documento)
- [ ] **Rate limiting distribuido** (el actual guarda contadores en memoria; con varias instancias hace falta Redis)
- [ ] **Búsqueda de texto completo** (PostgreSQL `tsvector` o Meilisearch)
- [ ] **Auditoría de cambios** (bitácora de quién editó qué)
- [ ] **El destaque no recuerda su origen** (al bajar a GRATIS se retiran *todos* los destaques del usuario, incluidos los que puso un admin a mano. Se arregla con una columna `destacado_origen`, pero hoy no hay forma de distinguirlos)

### Lo que se rompió al principio y conviene no repetir

- **`next dev` activa React StrictMode**: los efectos corren dos veces. Si un `cleanup` cancela una petición, su `.catch()` NO debe tocar el estado, o se provoca un "logout falso" que expulsa al usuario de las páginas protegidas. Ver el comentario en `contextos/Auth.tsx`.
