Speedtab: El espacio de trabajo ultrasónico y local para Nueva Pestaña que no te rastrea. Creado con Vanilla JS puro, cero frameworks y una huella de memoria mínima.

Speedtab reemplaza la página predeterminada de Nueva Pestaña de tu navegador por una Marcación rápida y un panel de productividad rápidos, densos y centrados en la privacidad local. Sin cuenta. Sin servidor central de Speedtab. Sin rastreo. Sincronización remota opcional. Simplemente tus datos, a tu manera.

Crea páginas de inicio personalizadas para diferentes contextos, divídelas en cuadrículas modulares y organiza tu contenido en pestañas. Combina marcadores visuales, fuentes RSS/Atom, notas rápidas, fragmentos de código, listas de enlaces, componentes HTML y notas privadas cifradas en un único espacio de trabajo ultrasónico y unificado.

Speedtab está diseñado para ofrecer estructura, velocidad y un control total sobre tus datos:

• no requiere cuenta
• sin servicio de servidor central de Speedtab
• no requiere cuenta en la nube
• almacenamiento local real dentro del navegador
• exportación/importación portable para una libertad total de datos

Lo que puedes hacer con Speedtab:

• organizar marcadores en páginas, módulos y pestañas personalizadas
• disfrutar de una experiencia clásica de Marcación rápida de alto rendimiento adaptada a tus flujos de trabajo
• subir imágenes de vista previa locales y favicons personalizados para tus marcadores
• gestionar tareas y pendientes con prioridades, fechas de vencimiento, notas e indicadores visuales de estado
• crear notas de texto, código, enlaces, HTML personalizado y notas cifradas
• construir estructuras de pestañas anidadas e infinitas dentro de tus notas HTML gracias a YaiTabs
• desacoplar notas y módulos de noticias en ventanas flotantes Document Picture-in-Picture (PiP)
• leer fuentes RSS/Atom directamente en tu página de inicio con intervalos de actualización automática por pestaña
• realizar un seguimiento del estado de leído/no leído y archivar elementos de fuentes interesantes con comentarios
• personalizar el tema visual, los diseños de cuadrícula y los fondos CSS
• exportar e importar espacios de trabajo completos o colecciones individuales de marcadores, notas y tareas (ToDo) en JSON

Speedtab funciona completamente de forma local. Los datos de la aplicación se guardan de forma segura en IndexedDB dentro del perfil de tu navegador. La obtención de fuentes RSS la gestiona íntegramente la propia extensión a través del service worker en segundo plano. Las notas cifradas se protegen en el cliente mediante AES-GCM y PBKDF2-SHA256. Tus frases de paso nunca salen de tu dispositivo.

Obtén un espacio de trabajo real y potente en Nueva Pestaña en lugar de una página de inicio genérica o un panel en la nube que vulnera tu privacidad.

----------------------------------------
RESUMEN DETALLADO DE CARACTERÍSTICAS DE SPEEDTAB
----------------------------------------

INTERFAZ PRINCIPAL Y ARQUITECTURA DEL ESPACIO DE TRABAJO
• Interfaz de pantalla completa con navegación multipágina adaptable para diferentes espacios de trabajo o categorías de contexto.
• Reordenación mediante arrastrar y soltar para páginas, módulos, colecciones y elementos individuales.
• Núcleo de delegación de eventos impulsado por YaiJS y YEH (Yai Event Hub), ejecutándose en un único motor compartido con escalado O(1) y cero sobrecarga de DOM virtual.
• Núcleo ultraligero con una interfaz de usuario reactiva y sin la pesadez de un DOM virtual.
• Navegación completa por teclado y soporte de accesibilidad WCAG 2.1 AA (Teclas de dirección, Inicio, Fin, Intro, Barra espaciadora).
• Búsqueda global en el encabezado con flujo de localización instantáneo, capa de resultados absolutos y resaltado en la página.
• Elementos visuales y de diseño:
  - Fondo global predeterminado y reemplazo de fondo individual por página.
  - Editor de fondo CSS personalizado con validación de sintaxis en tiempo real y archivo de degradados/colores guardados.
  - Gestión de diseño por módulo: diseños de cuadrícula auto, multicolumna y de ancho completo.
  - Altura mínima de módulo y ajustes de separación/relleno de contenido por módulo.
  - Límites de ancho de interfaz y ubicación de la barra de widgets (superior o inferior).

MÓDULO DE MARCADORES VISUALES
• Renderizado de mosaicos visuales compatible con favicons personalizados o imágenes de vista previa subidas.
• Herramienta de recorte integrada (CropperJS) para recortar imágenes locales a una proporción fija antes de guardar.
• Explorador de archivos y gestor de favicons:
  - Selección entre todos los favicons guardados en las tablas de archivos de IndexedDB.
  - Subida directa de favicons personalizados.
  - Herramienta de detección y corrección automática para favicons oscuros con bajo contraste/transparencia (añade una capa de fondo limpia antes de guardar).
• Configuración de navegación: cambia el comportamiento de apertura por módulo entre la pestaña actual y pestañas nuevas en segundo o primer plano.
• Personalización de diseño y mosaicos:
  - Modo estándar (mosaicos de vista previa visual de 106x60px).
  - Modo enlaces rápidos (cuadrícula muy compacta de 48x48px centrada en favicons).
  - Modo mosaicos grandes (vistas previas visuales ampliadas de 154x80px).
  - Modo de diseño opcional "título debajo del mosaico" para examinar marcadores visuales basados en etiquetas.
  - Colores de fondo personalizados a nivel de mosaico compatibles con transparencia.

MÓDULO DE MARCACIÓN RÁPIDA
• Superficie de Marcación rápida dedicada de ancho completo con una interfaz transparente y visualmente mínima.
• Mosaicos centrados en formato 16:9 con altura adaptable y alineación de contenido superior, central o inferior.
• Pestañas opcionales, botón integrado para añadir mosaicos y modo de altura de página completa para diseños de Marcación rápida clásicos o categorizados.
• Archivos de imagen locales dedicados para Marcación rápida con ajuste de relleno por imagen.
• Los colores de mosaico derivados de los favicons crean composiciones visuales armónicas sin depender de servicios externos de captura o imágenes.

MÓDULO DE TAREAS (TODO)
• Módulo dedicado para la gestión de tareas integrado directamente en la cuadrícula de tu espacio de trabajo.
• Opciones de tareas flexibles: prioridades, indicadores de color opcionales, notas, fechas/horas de vencimiento y visualización compacta de metadatos.
• Etiquetas de estado visuales claras y código de colores para tareas abiertas, completadas a tiempo, completadas con retraso y vencidas.
• Modo de vista en mosaico, pestañas de módulo estándar y controles compartidos de ajuste rápido.

NOTAS Y MOTOR DE NOTAS INTERACTIVO
• Cinco tipos de contenido para notas:
  - Notas HTML:
    * Renderizado HTML depurado compatible con marcadores de posición basados en archivos e imágenes integradas.
    * Aloja estructuras de pestañas anidadas YaiTabs interactivas y en vivo directamente dentro del contenido de la nota.
    * API de estilos basada en atributos (attributos data-st-* para ancho, altura, margen, relleno, flexbox, grid, bordes, radio, sombras, tipografía y colores) sin vulnerabilidades de estilos en línea.
    * Macros preestablecidas para insertar esquemas y plantillas de componentes en el editor.
  - Notas de texto: Procesador de texto sencillo para notas rápidas sin formato.
  - Notas de enlaces: Convierte URLs en texto plano directamente línea por línea en listas de enlaces interactivos; los bloques de texto sin URL se muestran como citas con formato.
  - Notas de código: Fragmentos de código guardados en fuente monoespaciada con resaltado de sintaxis automático mediante Highlight.js.
  - Notas cifradas: Notas privadas cifradas en el cliente con AES-GCM y PBKDF2-SHA256 (310,000 iteraciones). Requieren una frase de paso para desbloquearse; las frases de paso nunca se guardan ni se almacenan en caché.
• Modos del editor de notas:
  - Editor en vista dividida estándar con vista previa en vivo activable para notas HTML.
  - Configuración al vuelo: Edita el contenido de pestañas en notas HTML profundamente anidadas desde una superficie de configuración enfocada y dedicada. Sin tener que navegar por pestañas anidadas para encontrar el contenido adecuado.
  - Nota rápida local: Bloc de notas local accesible desde el encabezado que se guarda de forma independiente a las exportaciones del espacio de trabajo.
• Sistema de ventanas flotantes y Picture-in-Picture: Las notas se pueden desacoplar en ventanas arrastrables y redimensionables con orden de enfoque, o abrir en ventanas nativas Document Picture-in-Picture (PiP) con sincronización de contenido en tiempo real.

MÓDULO LECTOR DE FUENTES RSS
• Módulo lector de fuentes RSS/Atom integrado que se puede colocar en cualquier cuadrícula de módulos de la página.
• Gestión de fuentes RSS: añade, valida y descubre automáticamente enlaces RSS/Atom ocultos en URLs de dominios web estándar.
• Capacidades del lector:
  - Filtrado por fuente y límites personalizables de artículos visibles.
  - Seguimiento del estado de leído y no leído con acciones masivas para marcar.
  - Gestor de archivo para guardar artículos localmente con comentarios opcionales.
  - Vista del lector ampliada: Expande los módulos de fuentes a una vista de lectura dedicada de ancho completo con ancho de columna de lectura ajustable.
  - Soporte para Document Picture-in-Picture (PiP): Desacopla módulos de fuentes RSS en ventanas flotantes de escritorio manteniendo la posición de desplazamiento y actualizando el contenido en tiempo real.
  - Filtro de texto local dentro de la fuente para buscar artículos cargados en tiempo real.
  - Actualización automática por pestaña de fuente RSS con intervalos configurables mientras la pestaña permanece abierta.
  - La obtención de datos entre orígenes (cross-origin) la realiza de forma segura el service worker en segundo plano.

BARRA DE WIDGETS Y HERRAMIENTAS
• Barra de widgets modular colocada en la parte superior o inferior de las páginas del espacio de trabajo.
• Herramientas de reloj y hora:
  - Programador central compartido App Clock que impulsa relojes sincronizados y temporizadores de tareas.
  - Modos de visualización de reloj Digital o Analógico activables.
  - Formato de fecha/hora localizable, herramientas de inserción de caracteres, tamaño de fuente personalizado, alineación y colores de elementos por componente.
  - Cronómetro local y herramientas de temporizador múltiple que se ejecutan en un bucle DOM en tiempo real sin impacto en el rendimiento.
• Sistema meteorológico:
  - Lectura de temperatura compacta en la barra con búsqueda de ubicación personalizada y selector de unidades (Celsius/Fahrenheit).
  - Pronóstico del tiempo semanal detallado accesible directamente desde la barra.
• Indicador de estado para la sincronización remota con comentarios visuales.

MENÚ CONTEXTUAL DE CAPTURA Y MOTOR DE BANDEJA DE ENTRADA
• Integración con el menú contextual del navegador: Haz clic derecho en cualquier página web o selección de texto para ejecutar "Añadir a Nota rápida" sin cambiar de pestaña.
• Contador en tiempo real en la pestaña: Los títulos de las pestañas en segundo plano se actualizan dinámicamente para mostrar los elementos pendientes (ej. INBOX [3] - Speedtab).
• Gestor de bandeja de entrada avanzado: Panel dedicado en el encabezado para revisar, editar, filtrar y guardar fragmentos capturados en módulos específicos de marcadores o notas.

PROPIEDAD DE DATOS, ALMACENAMIENTO Y SINCRONIZACIÓN REMOTA
• Almacenamiento 100% local: Todos los estados de la aplicación, estructuras de módulos y archivos binarios se guardan en IndexedDB en el cliente a través de Dexie.
• Intercambio de datos JSON portable:
  - Archivos de exportación JSON verificados con suma de comprobación (speedtab-export-<checksum>.json).
  - Importación y exportación compacta en formato JSON para colecciones de marcadores visuales, notas y pestañas ToDo.
  - Motor de combinación de registros para transferir espacios de trabajo entre perfiles del navegador sin duplicar registros.
  - Superficie de utilidades de importación/exportación aislada (import-export.html).
• Sincronización opcional en la nube:
  - Sincronización WebDAV: Envío, obtención, comparación de contenido remoto y comprobaciones de estado manuales.
  - Sincronización con Google Drive: Sincronización con OAuth mediante chrome.identity en la carpeta oculta appDataFolder del usuario, incluyendo intervalos de envío automático y verificación del estado del espacio de trabajo remoto.

MANTENIMIENTO DEL SISTEMA Y ORDENADOR DE CUADRÍCULA
• Ordenador de cuadrícula dedicado (sorter.html): Página de configuración aislada para reorganizar las jerarquías de las páginas del espacio de trabajo, editar títulos de pestañas en línea y realizar eliminaciones en cascada.
• Gestor de limpieza del sistema: Escanea las tablas locales de la base de datos para detectar y eliminar registros huérfanos, archivos binarios no utilizados y favicons obsoletos.

INTERNACIONALIZACIÓN Y LOCALIZACIÓN NATIVA
• Internacionalización de la extensión integrada con chrome.i18n nativo.
• Traducciones completas de la interfaz y espacios de trabajo de ejemplo localizados para inglés, alemán, holandés, turco, hindi, ruso, chino (simplificado) y español.


----------------------------------------
RENDIMIENTO Y TAMAÑO
----------------------------------------

• Tamaño de la extensión comprimida (.ZIP): ~710 KB
• Administrador de tareas de Chrome
  - Memoria: ~50 MB de memoria total / ~5 MB de memoria JavaScript activa
  - Uso de CPU: 1-10% durante el uso activo
  - ~40 listeners de eventos en total para toda la extensión
  - Interfaz de usuario reactiva sin la sobrecarga de un DOM virtual
