# Sistema de Diseño y Guía de Arquitectura UI: Innover (PropMap 3D)

## 1. Identidad Visual y Paleta de Colores
El diseño debe transmitir confianza, modernidad e innovación tecnológica, alineado con el sector PropTech.

### Colores de Marca (Brand Colors)
*   **Primario Oscuro (Texto y Cabeceras):** `#1A3E62` (Azul Marino Profundo) - *Uso: Barra de navegación principal, títulos (H1, H2), iconografía activa.*
*   **Gradiente Principal (Acciones y Botones):** De `#008B8B` (Turquesa Oscuro) a `#00CED1` (Turquesa Claro) - *Uso: Botones principales (Call to Action), marcadores de propiedades destacadas en el mapa.*
*   **Acento Sutil:** `#9FD6B3` (Verde Menta) - *Uso: Fondos de etiquetas (tags), indicadores de "Inmueble Verificado" o "Dueño Directo".*

### Superficies y Fondos (Backgrounds)
*   **Fondo Principal (App y Mapa base):** `#F0F2F5` (Gris muy claro) - *Reduce la fatiga visual frente al blanco puro.*
*   **Paneles y Tarjetas (Cards):** `#FFFFFF` (Blanco puro) - *Uso: Tarjetas de propiedades, modales, menús laterales.*
*   **Bordes y Líneas Divisorias:** `#E0E3E8` - *Uso: Separadores de secciones, bordes de inputs de formulario.*
*   **Texto Secundario:** `#4A5C70` - *Uso: Descripciones cortas, placeholders, subtítulos.*

### Colores Semánticos (Feedback del Sistema)
*   **Éxito (Verde):** `#4CAF50` (Ej. "Mensaje enviado al agente", "Propiedad validada")
*   **Advertencia (Naranja):** `#FF9800` (Ej. "Suscripción B2B por vencer")
*   **Error (Rojo):** `#F44336` (Ej. "Error al cargar el recorrido 3D")
*   **Información (Azul):** `#03A9F4` (Ej. Tooltips del Asistente Virtual)

---

## 2. Tipografía Recomendada
Para mantener una interfaz limpia y legible tanto en los mapas como en el panel CRM:
*   **Fuente Principal:** `Inter` o `Roboto` (Optimizado para interfaces web y lectura de datos numéricos como precios y metrajes).
*   **Jerarquía:**
    *   H1/H2: Bold (700), Color `#1A3E62`
    *   Cuerpo (Body): Regular (400) o Medium (500), Color `#4A5C70`
    *   Precios de Inmuebles: Semi-Bold (600), Color `#008B8B`

---

## 3. Estructura de la Interfaz (Layouts Principales)

El proyecto requiere dos vistas bien diferenciadas según el flujo del usuario:

### A. Vista B2C (Usuario Final / Buscador)
El enfoque debe ser **"Map-First"** (El mapa es el protagonista).
*   **Navegación Superior (Navbar):** Buscador inteligente, filtros rápidos (Alquiler/Venta), botón de "Publicar Inmueble" y Perfil.
*   **Área Principal (Split View):**
    *   *Izquierda (o vista móvil superpuesta):* Lista de propiedades en formato tarjeta (Cards) con imagen miniatura, precio, habitaciones y etiqueta de "Tour 3D disponible".
    *   *Derecha (70% de la pantalla en Desktop):* Mapa interactivo (Se recomienda integrar librerías como Mapbox GL). Los marcadores deben agruparse (clustering) al alejar el zoom.
*   **Filtros Flotantes "Estilo de Vida":** Un panel desplegable para filtrar por cercanía a parques, colegios o nivel de seguridad.
*   **Botón Flotante (FAB):** Chatbot del Asistente Virtual impulsado por IA posicionado en la esquina inferior derecha.

### B. Vista B2B / Propietarios (Dashboard CRM)
El enfoque debe ser analítico y de gestión orientada a la conversión.
*   **Layout:** Estructura de panel de administración (Sidebar lateral fijo y área de contenido central).
*   **Métricas Clave (Top KPI Cards):** Vistas del inmueble, Leads generados, Mensajes no leídos.
*   **Tabla de Prospección:** Lista de contactos y clientes potenciales con estados (Ej. "Interesado", "Visita Agendada", "Cerrado").
*   **Gestor de Inmuebles:** Interfaz tipo formulario paso a paso para subir fotos, configurar el Tour 3D y solicitar la validación de identidad (Reniec).

---

## 4. Componentes UI Clave a Desarrollar (Recomendaciones para el Agente)

1.  **MapMarkerComponent (Componente de Cliente):** Marcadores interactivos que al hacer hover despliegan un mini-popup con el precio y foto de la propiedad.
2.  **PropertyCard:** Tarjeta de propiedad reutilizable. Debe incluir un carrusel de imágenes integrado y botones rápidos para "Guardar" (Corazón) y "Contactar".
3.  **Tour3DViewer:** Un modal a pantalla completa o un contenedor *iframe* optimizado que se active al dar clic en "Ver recorrido 3D", aislando al usuario de otras distracciones.
4.  **AI_ChatWidget:** Componente de chat con interfaz de usuario tipo burbuja que maneje estados de "escribiendo..." para dar naturalidad al asistente de IA.

---

## 5. Notas de Implementación Frontend / Backend
*   **Framework CSS:** Se recomienda encarecidamente usar **Tailwind CSS** para aplicar estos colores hexadecimales fácilmente a través del archivo de configuración `tailwind.config.js`.
*   **Librería de Componentes:** Considerar el uso de **Shadcn UI** o **Material UI** para acelerar el desarrollo de modales, selectores y tablas del CRM, adaptándolos a los colores primarios.
*   **Renderizado:** Utilizar Server Components (para SEO en las fichas de propiedades públicas) y Client Components para el mapa interactivo y el dashboard de agentes.