import { Role } from '../../core/models';

/** Tema de la ayuda integrada. */
export interface HelpTopic {
  /** Identificador usado por la ayuda contextual de cada pantalla. */
  id: HelpTopicId;
  /** Título. */
  title: string;
  /** Roles que ven este tema. */
  roles: Role[];
  /** Resumen breve. */
  summary: string;
  /** Nombre del icono de Ionicons. */
  icon: string;
  /** Secciones del tema. */
  sections: { heading: string; text?: string; steps?: string[] }[];
}

/** Identificadores de los temas de ayuda. */
export type HelpTopicId =
  | 'primeros-pasos'
  | 'panel'
  | 'productos'
  | 'pedidos'
  | 'nuevo-pedido'
  | 'usuarios'
  | 'maestros'
  | 'perfil'
  | 'exportar'
  | 'accesibilidad';

/** Atajo: visible para ambos roles. */
const ALL: Role[] = ['admin', 'user'];

/** Contenido del manual de usuario integrado en la aplicación. */
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    roles: ALL,
    icon: 'rocket-outline',
    summary: 'Cómo entrar, moverte por la aplicación y qué puede hacer cada rol.',
    sections: [
      {
        heading: 'Iniciar sesión',
        steps: [
          'Abre la aplicación e introduce tu correo y contraseña.',
          'Si no tienes cuenta, pulsa «Crear cuenta»: se te asignará el rol Usuario estándar.',
          'Tras entrar, el Administrador llega al Cuadro de mando y el Usuario estándar al Catálogo.',
        ],
      },
      {
        heading: 'Navegación',
        text: 'En escritorio el menú lateral está siempre visible. En móvil y tablet se abre con el botón de menú de la barra superior. Solo verás las secciones permitidas para tu rol.',
      },
      {
        heading: 'Roles',
        text: 'El Administrador gestiona inventario, pedidos, usuarios y datos maestros, y consulta el cuadro de mando. El Usuario estándar consulta el catálogo, realiza pedidos y sigue su estado.',
      },
    ],
  },
  {
    id: 'panel',
    title: 'Cuadro de mando',
    roles: ['admin'],
    icon: 'analytics-outline',
    summary: 'Indicadores, gráficos interactivos y actividad en tiempo real.',
    sections: [
      {
        heading: 'Indicadores (KPI)',
        text: 'Muestran ventas, pedidos pendientes, productos con stock bajo y ticket medio, comparados con el periodo anterior de la misma duración.',
      },
      {
        heading: 'Filtrar',
        steps: [
          'Elige el rango de fechas, la categoría o el estado: todo se recalcula al instante.',
          'Haz clic en una categoría del gráfico de stock o en un estado del gráfico de pedidos para filtrar por ese valor.',
          'Pulsa «Restablecer» para volver a los últimos 12 meses.',
        ],
      },
      {
        heading: 'Actividad en tiempo real',
        text: 'El panel lateral se actualiza solo cuando se crean pedidos, cambian estados o un producto baja de su stock mínimo.',
      },
      {
        heading: 'Gráficos accesibles',
        text: 'Cada gráfico tiene el botón «Ver como tabla» con los mismos datos en formato tabla para lectores de pantalla.',
      },
    ],
  },
  {
    id: 'productos',
    title: 'Productos e inventario',
    roles: ALL,
    icon: 'cube-outline',
    summary: 'Buscar, filtrar y (como administrador) crear o editar productos.',
    sections: [
      {
        heading: 'Buscar y filtrar',
        steps: [
          'Escribe en el buscador para filtrar por nombre, SKU, categoría o proveedor.',
          'Usa los filtros de categoría y «Solo stock bajo» para acotar el listado.',
          'Ordena pulsando en la cabecera de cada columna.',
        ],
      },
      {
        heading: 'Crear o editar (Administrador)',
        steps: [
          'Pulsa «Nuevo producto» o el botón de editar de una fila.',
          'El SKU se comprueba al momento: si ya existe, el formulario te avisa antes de guardar.',
          'Precio debe ser mayor que 0 y stock un número entero no negativo.',
        ],
      },
      {
        heading: 'Stock bajo',
        text: 'Un producto está en stock bajo cuando sus unidades son iguales o inferiores a su stock mínimo. Se marca con una etiqueta y genera una alerta en tiempo real.',
      },
    ],
  },
  {
    id: 'pedidos',
    title: 'Pedidos',
    roles: ALL,
    icon: 'receipt-outline',
    summary: 'Consultar pedidos, ver su detalle y cambiar su estado.',
    sections: [
      {
        heading: 'Consultar',
        text: 'El Usuario estándar ve solo sus pedidos; el Administrador ve todos. Filtra por estado o fechas y abre el detalle pulsando en una fila (o con Intro desde el teclado).',
      },
      {
        heading: 'Cambiar estado (Administrador)',
        steps: [
          'Abre el detalle del pedido.',
          'Elige el nuevo estado: Pendiente, En preparación, Enviado o Cancelado.',
          'Al cancelar, las unidades vuelven al stock. El cliente recibe una notificación.',
        ],
      },
    ],
  },
  {
    id: 'nuevo-pedido',
    title: 'Crear un pedido',
    roles: ALL,
    icon: 'cart-outline',
    summary: 'Añadir líneas, revisar el total y confirmar.',
    sections: [
      {
        heading: 'Pasos',
        steps: [
          'Ve a Pedidos › «Nuevo pedido».',
          'Elige un producto y la cantidad en cada línea; añade más líneas con «Añadir línea».',
          'La cantidad no puede superar el stock disponible: el formulario te avisa.',
          'Revisa el total y pulsa «Confirmar pedido».',
        ],
      },
    ],
  },
  {
    id: 'usuarios',
    title: 'Usuarios',
    roles: ['admin'],
    icon: 'people-outline',
    summary: 'Dar de alta usuarios y gestionar sus roles.',
    sections: [
      {
        heading: 'Alta de usuarios',
        steps: [
          'Pulsa «Nuevo usuario».',
          'El correo se valida en el momento contra la base de datos para evitar duplicados.',
          'La contraseña debe tener 8 caracteres, mayúscula, minúscula y número.',
        ],
      },
      {
        heading: 'Cambiar rol',
        text: 'Usa la acción «Cambiar rol» de la fila. Por seguridad no puedes cambiar tu propio rol.',
      },
    ],
  },
  {
    id: 'maestros',
    title: 'Categorías y proveedores',
    roles: ['admin'],
    icon: 'albums-outline',
    summary: 'Mantener los datos maestros del catálogo.',
    sections: [
      {
        heading: 'Gestión',
        text: 'Cambia entre Categorías y Proveedores con las pestañas superiores. Puedes crear, editar y eliminar registros. No se puede eliminar un registro con productos asociados.',
      },
    ],
  },
  {
    id: 'perfil',
    title: 'Mi perfil',
    roles: ALL,
    icon: 'person-circle-outline',
    summary: 'Consultar tus datos, cambiar tu nombre y el tema de color.',
    sections: [
      {
        heading: 'Preferencias',
        text: 'Puedes editar tu nombre visible y alternar entre modo claro y oscuro desde la barra superior. La preferencia se recuerda en este navegador.',
      },
    ],
  },
  {
    id: 'exportar',
    title: 'Exportar informes',
    roles: ALL,
    icon: 'download-outline',
    summary: 'Descargar los datos en CSV o PDF.',
    sections: [
      {
        heading: 'Formatos',
        text: 'El botón CSV descarga un archivo compatible con Excel (separador punto y coma, UTF-8). El botón PDF genera un informe con cabecera, filtros aplicados, totales y numeración de páginas.',
      },
      {
        heading: 'Qué se exporta',
        text: 'Siempre se exportan los datos que estás viendo: se respetan la búsqueda, los filtros y el orden aplicados.',
      },
    ],
  },
  {
    id: 'accesibilidad',
    title: 'Accesibilidad y teclado',
    roles: ALL,
    icon: 'accessibility-outline',
    summary: 'Atajos y ayudas para navegar sin ratón o con lector de pantalla.',
    sections: [
      {
        heading: 'Teclado',
        steps: [
          'Tab / Mayús+Tab: avanzar o retroceder entre elementos.',
          'Al cargar, el primer Tab muestra «Saltar al contenido».',
          'Intro sobre una fila de tabla abre su detalle.',
          'Esc cierra diálogos y menús.',
        ],
      },
      {
        heading: 'Lectores de pantalla y zoom',
        text: 'La interfaz usa etiquetas semánticas y atributos ARIA, anuncia avisos y resultados de búsqueda, y admite zoom del navegador hasta el 200 % sin pérdida de contenido.',
      },
    ],
  },
];
