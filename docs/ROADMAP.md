# 🗺️ Hoja de Ruta de Desarrollo y Aprendizaje (ROADMAP)

Este documento detalla el paso a paso que seguiremos para construir **INMOVER** desde cero, aprendiendo los fundamentos de programación en el proceso.

## Fase 1: Fundamentos y Arquitectura 🏗️
*El objetivo aquí es preparar las bases y entender las reglas del juego.*
- [x] **Aprender:** ¿Qué es Frontend, Backend, API y Base de Datos?
- [x] **Aprender:** Git y Control de Versiones (Cómo guardar nuestro progreso).
- [x] **Definición técnica:** Elegir el lenguaje principal (Elegido: Full-Stack JavaScript/TypeScript con Node.js y React).
- [ ] **Diseño de Base de Datos (Modelo Entidad-Relación):** Diseñar cómo se guardarán los usuarios, propiedades, y agentes.

## Fase 2: Backend y Base de Datos (El Motor) ⚙️
*Crearemos el cerebro de la aplicación, donde se guardan y procesan los datos.*
- [ ] **Aprender:** Configuración de un servidor web básico.
- [ ] **Aprender:** Bases de datos relacionales (PostgreSQL) e introducción a datos espaciales (PostGIS) para los mapas.
- [ ] **Desarrollo:** Crear la base de datos de Propiedades.
- [ ] **Desarrollo:** Crear las rutas (APIs) para crear, leer, actualizar y eliminar propiedades (CRUD).

## Fase 3: Seguridad y Autenticación 🔐
*Protegeremos la plataforma y diferenciaremos entre Usuarios y Agentes.*
- [ ] **Aprender:** ¿Qué es un JWT (JSON Web Token), Encriptación de contraseñas (Bcrypt) y Ciberseguridad básica.
- [ ] **Desarrollo:** Sistema de Registro y Login.
- [ ] **Desarrollo:** Validación de roles (Usuario normal vs. Agente Inmobiliario vs. Propietario).
- [ ] **Idea del Startup:** Preparar el terreno para la "Validación con Reniec/IA".

## Fase 4: Frontend y Mapas Interactivos (La Cara del Proyecto) 🎨
*Crearemos lo que el usuario ve y toca.*
- [ ] **Aprender:** Fundamentos de React.js o Next.js, Componentes, y Estado.
- [ ] **Desarrollo:** Maquetado de la página principal.
- [ ] **Desarrollo (Core):** Integración de **Mapbox o Google Maps** para mostrar los "pines" de las propiedades consumiendo el Backend que hicimos en la Fase 2.
- [ ] **Desarrollo:** Filtros avanzados de búsqueda (Estilo de vida, precio, zona).

## Fase 5: 3D y Gestión Multimedia 🏠
*El factor WOW de la aplicación.*
- [ ] **Aprender:** Almacenamiento de archivos en la nube (ej. AWS S3 o Cloudinary) para fotos pesadas.
- [ ] **Desarrollo:** Subida de imágenes de propiedades por parte de los agentes.
- [ ] **Desarrollo:** Integración de recorridos 3D (IFrames de Matterport o renderizados con Three.js).

## Fase 6: El Asistente Virtual y Funciones Avanzadas 🤖
*Dándole vida a la IA y al modelo de negocio B2B.*
- [ ] **Aprender:** Consumo de APIs de Inteligencia Artificial (OpenAI).
- [ ] **Desarrollo:** Gamificación / Asistente de "Zona Ideal". Chatbot inmobiliario.
- [ ] **Desarrollo (B2B):** Panel de CRM para que los agentes vean sus "leads" o contactos generados.

## Fase 7: Despliegue y Producción 🚀
*Llevar el proyecto a internet para que cualquiera pueda usarlo.*
- [ ] **Aprender:** Hosting de Base de Datos, Hosting de Backend (Render/Heroku/AWS), Hosting de Frontend (Vercel/Netlify).
- [ ] **Aprender:** Nombres de dominio (DNS) y Certificados de seguridad (HTTPS).
- [ ] **Desarrollo:** Despliegue final de INMOVER.
