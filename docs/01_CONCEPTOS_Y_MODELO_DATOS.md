# 01. Conceptos Básicos y Modelo de Datos 🧠

Antes de empezar a escribir código, necesitamos hablar el mismo idioma. Cuando desarrollamos una aplicación completa (Full-Stack) como INNOVER, la dividimos en partes.

## 1. El Diccionario del Desarrollador Full-Stack

Imagina INNOVER como un restaurante:

*   **Frontend (La Sala y las Mesas):** Es todo lo que el usuario ve y con lo que interactúa. En nuestro caso: los mapas, los botones, los recorridos 3D, el panel del agente. Lo construiremos con **React.js**.
*   **Backend (La Cocina):** Es la parte oculta que hace que todo funcione. Recibe las peticiones del Frontend, procesa la lógica del negocio (ej. "¿Este agente pagó su suscripción?", "Calcula las propiedades cercanas"), y guarda las cosas de forma segura. Lo haremos con **Node.js**.
*   **Base de Datos (La Alacena / Inventario):** Es donde guardamos permanentemente la información. Aquí viven los usuarios, contraseñas (encriptadas), datos de las propiedades, etc. Usaremos **PostgreSQL**.
*   **API (El Mesero):** Es el mensajero que comunica el Frontend (Sala) con el Backend (Cocina). Cuando el usuario hace clic en "Ver propiedades", el Frontend manda a la API a pedirle los datos al Backend.

---

## 2. Nuestro Primer Diseño: La Base de Datos 🗄️

Una Base de Datos Relacional (como PostgreSQL) usa **Tablas** (imagina hojas de cálculo de Excel) que se relacionan entre sí.

Para INNOVER, inicialmente necesitaremos estas tablas principales:

### Tabla: `Usuarios`
Guarda a todas las personas que usan la app, ya sean clientes, dueños o agentes.
*   `id` (Identificador único, ej. 1, 2, 3...)
*   `nombre` (Texto)
*   `email` (Texto único)
*   `contrasena_hash` (Texto encriptado)
*   `rol` (Opciones: 'CLIENTE', 'PROPIETARIO', 'AGENTE', 'ADMIN')
*   `fecha_creacion` (Fecha)

### Tabla: `Propiedades`
El corazón de INNOVER.
*   `id` (Identificador único)
*   `usuario_id` (Relación: ¿Quién subió/es dueño de esta propiedad?)
*   `titulo` (Texto, ej. "Depa de lujo en Amarilis")
*   `descripcion` (Texto largo)
*   `precio` (Número decimal)
*   `tipo` (Opciones: 'VENTA', 'ALQUILER')
*   `coordenadas` (Dato espacial/Punto en el mapa - ¡Aquí usaremos PostGIS!)
*   `habitaciones` (Número)
*   `banos` (Número)
*   `tour_3d_url` (Texto, enlace al recorrido virtual)

### Tabla: `Contactos_Leads` (B2B CRM)
Cuando un cliente le envía un mensaje a un agente por una propiedad.
*   `id`
*   `propiedad_id` (Relación: Por qué propiedad preguntaron)
*   `cliente_id` (Relación: Quién preguntó)
*   `agente_id` (Relación: A qué agente le llegó)
*   `mensaje` (Texto)
*   `estado` (Opciones: 'NUEVO', 'EN_PROCESO', 'CERRADO')

## ¿Qué sigue?
Hemos definido la lógica de nuestro proyecto en papel. El siguiente paso en nuestro roadmap es aprender a usar la herramienta que nos permitirá guardar estos archivos en la nube y mantener un historial de nuestros cambios: **Git**.
