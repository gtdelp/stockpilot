import {
  ActivityEvent,
  Category,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  Supplier,
  UserProfile,
} from '../models';

/**
 * Generador de números pseudoaleatorios con semilla (mulberry32).
 * Garantiza que los datos sintéticos sean siempre los mismos (tests reproducibles).
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Correos de las cuentas de demostración (no son personas reales). */
export const DEMO_ADMIN_EMAIL = 'admin@stockpilot.demo';
/** Correo de la cuenta de demostración con rol Usuario estándar. */
export const DEMO_USER_EMAIL = 'usuario@stockpilot.demo';

/** Línea de pedido interna con categoría para cálculos. */
export interface DemoOrderItem extends OrderItem {
  /** Identificador de la categoría. */
  categoryId: number;
}

/** Pedido interno con sus líneas. */
export interface DemoOrder extends Omit<Order, 'items'> {
  /** Líneas o elementos asociados. */
  items: DemoOrderItem[];
}

/** Conjunto completo de datos sintéticos. */
export interface DemoDataset {
  /** Lista de usuarios. */
  users: UserProfile[];
  /** Lista de categorías. */
  categories: Omit<Category, 'productCount'>[];
  /** Lista de proveedores. */
  suppliers: Omit<Supplier, 'productCount'>[];
  /** Lista de productos. */
  products: Product[];
  /** Número de pedidos o lista de pedidos. */
  orders: DemoOrder[];
  /** Eventos de actividad. */
  activity: ActivityEvent[];
}

/** Definición de categorías, productos base y rangos de precio. */
const CATEGORY_DEFS: {
  name: string;
  prefix: string;
  description: string;
  items: string[];
  price: [number, number];
}[] = [
  {
    name: 'Electrónica',
    prefix: 'ELE',
    description: 'Pequeña electrónica y accesorios',
    items: [
      'Auriculares inalámbricos',
      'Altavoz Bluetooth',
      'Cargador USB-C',
      'Batería externa',
      'Cable HDMI',
    ],
    price: [8, 120],
  },
  {
    name: 'Informática',
    prefix: 'INF',
    description: 'Periféricos y componentes',
    items: ['Ratón ergonómico', 'Teclado mecánico', 'Monitor 27"', 'Disco SSD', 'Webcam Full HD'],
    price: [15, 340],
  },
  {
    name: 'Oficina',
    prefix: 'OFI',
    description: 'Material de oficina',
    items: [
      'Paquete de folios A4',
      'Archivador de palanca',
      'Bolígrafos gel',
      'Grapadora',
      'Agenda anual',
    ],
    price: [2, 35],
  },
  {
    name: 'Hogar',
    prefix: 'HOG',
    description: 'Menaje y organización',
    items: [
      'Juego de sartenes',
      'Caja organizadora',
      'Termo de acero',
      'Set de cuchillos',
      'Toallas algodón',
    ],
    price: [6, 90],
  },
  {
    name: 'Ferretería',
    prefix: 'FER',
    description: 'Herramientas y fijaciones',
    items: [
      'Taladro percutor',
      'Juego de destornilladores',
      'Cinta métrica',
      'Caja de tornillos',
      'Nivel láser',
    ],
    price: [4, 160],
  },
  {
    name: 'Iluminación',
    prefix: 'ILU',
    description: 'Lámparas y bombillas',
    items: [
      'Bombilla LED E27',
      'Tira LED',
      'Flexo de escritorio',
      'Foco exterior',
      'Lámpara de pie',
    ],
    price: [3, 110],
  },
  {
    name: 'Limpieza',
    prefix: 'LIM',
    description: 'Productos de limpieza profesional',
    items: [
      'Detergente industrial',
      'Bayetas microfibra',
      'Fregona profesional',
      'Guantes nitrilo',
      'Desinfectante',
    ],
    price: [2, 40],
  },
  {
    name: 'Embalaje',
    prefix: 'EMB',
    description: 'Cajas, cintas y protección',
    items: [
      'Caja de cartón',
      'Cinta adhesiva',
      'Plástico de burbujas',
      'Film estirable',
      'Etiquetas envío',
    ],
    price: [1, 25],
  },
];

/** Variantes de cada producto base. */
const VARIANTS = ['Básico', 'Pro', 'Plus'];

/** Nombres comerciales ficticios de proveedores. */
const SUPPLIER_NAMES = [
  'Suministros Íbera',
  'Distribuciones Meseta',
  'Tecnoalmacén Norte',
  'Grupo Levante Pack',
  'Ferrosur Industrial',
  'Luminia Iberia',
  'Clean Pro Hispania',
  'Oficentro Mayorista',
  'Hogarplus Comercial',
  'Datalink Componentes',
  'Embalajes del Tajo',
  'Atlántico Logística',
];

/** Ciudades de los proveedores. */
const CITIES = [
  'Madrid',
  'Barcelona',
  'Valencia',
  'Sevilla',
  'Bilbao',
  'Zaragoza',
  'Málaga',
  'Valladolid',
];

/** Nombres de pila ficticios para los clientes. */
const FIRST_NAMES = [
  'Lucía',
  'Hugo',
  'Martina',
  'Mateo',
  'Sofía',
  'Leo',
  'Valeria',
  'Daniel',
  'Carla',
  'Pablo',
  'Noa',
  'Álvaro',
];
/** Apellidos ficticios para los clientes. */
const LAST_NAMES = [
  'García',
  'Romero',
  'Navarro',
  'Torres',
  'Molina',
  'Ortega',
  'Delgado',
  'Castro',
  'Rubio',
  'Serrano',
];

/** Peso relativo de ventas por mes (enero = 0) para simular estacionalidad. */
const SEASONALITY = [0.8, 0.75, 0.9, 0.95, 1, 0.95, 0.85, 0.6, 1, 1.05, 1.3, 1.45];

/**
 * Genera el conjunto de datos sintéticos de la demostración.
 * Todos los nombres, correos (dominios reservados `.demo` y `example.com`) y cifras son ficticios.
 */
export function generateDemoData(seed = 2026, now = new Date()): DemoDataset {
  const random = createRandom(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const between = (min: number, max: number): number => min + random() * (max - min);
  const intBetween = (min: number, max: number): number => Math.floor(between(min, max + 1));

  const createdBase = new Date(now.getFullYear() - 2, now.getMonth(), 1).toISOString();

  // --- Usuarios ---
  const users: UserProfile[] = [
    {
      id: 'demo-admin',
      email: DEMO_ADMIN_EMAIL,
      fullName: 'Administración Demo',
      role: 'admin',
      createdAt: createdBase,
    },
    {
      id: 'demo-user',
      email: DEMO_USER_EMAIL,
      fullName: 'Lucía Romero',
      role: 'user',
      createdAt: createdBase,
    },
  ];
  for (let i = 0; i < 10; i++) {
    const first = FIRST_NAMES[(i + 1) % FIRST_NAMES.length] as string;
    const last = pick(LAST_NAMES);
    users.push({
      id: `demo-customer-${i + 1}`,
      email: `${first.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}.${last
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()}${i + 1}@example.com`,
      fullName: `${first} ${last}`,
      role: 'user',
      createdAt: createdBase,
    });
  }

  // --- Categorías y proveedores ---
  const categories = CATEGORY_DEFS.map((def, index) => ({
    id: index + 1,
    name: def.name,
    description: def.description,
  }));
  const suppliers = SUPPLIER_NAMES.map((name, index) => ({
    id: index + 1,
    name: `${name} S.L.`,
    email: `pedidos@${name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')}.example.com`,
    phone: `9${intBetween(10, 99)} ${intBetween(100, 999)} ${intBetween(100, 999)}`,
    city: CITIES[index % CITIES.length] as string,
  }));

  // --- Productos (15 por categoría) ---
  const products: Product[] = [];
  CATEGORY_DEFS.forEach((def, categoryIndex) => {
    let counter = 1;
    for (const base of def.items) {
      for (const variant of VARIANTS) {
        const id = products.length + 1;
        const minStock = intBetween(5, 20);
        // ~12 % de productos en stock bajo para que el KPI tenga sentido
        const stock = random() < 0.12 ? intBetween(0, minStock) : intBetween(minStock + 5, 260);
        products.push({
          id,
          sku: `${def.prefix}-${String(counter).padStart(4, '0')}`,
          name: `${base} ${variant}`,
          categoryId: categoryIndex + 1,
          categoryName: def.name,
          supplierId: ((categoryIndex + counter) % suppliers.length) + 1,
          supplierName: '',
          price:
            Math.round(
              between(def.price[0], def.price[1]) *
                (variant === 'Pro' ? 1.4 : variant === 'Plus' ? 1.8 : 1) *
                100,
            ) / 100,
          stock,
          minStock,
          active: random() > 0.04,
          updatedAt: createdBase,
        });
        counter++;
      }
    }
  });
  for (const product of products) {
    product.supplierName =
      suppliers.find((supplier) => supplier.id === product.supplierId)?.name ?? '';
  }

  // --- Pedidos: 24 meses con estacionalidad y crecimiento interanual (~18 %) ---
  const customers = users.filter((user) => user.role === 'user');
  const orders: DemoOrder[] = [];
  for (let monthOffset = 23; monthOffset >= 0; monthOffset--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const weight = SEASONALITY[monthStart.getMonth()] as number;
    const growth = monthOffset >= 12 ? 0.82 : 1;
    const count = Math.round(34 * weight * growth);
    const monthEnd =
      monthOffset === 0 ? now : new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 1);
    for (let i = 0; i < count; i++) {
      const createdAt = new Date(
        monthStart.getTime() + random() * (monthEnd.getTime() - monthStart.getTime()),
      );
      const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
      let status: OrderStatus = 'shipped';
      if (random() < 0.06) {
        status = 'cancelled';
      } else if (ageDays < 4) {
        status = random() < 0.6 ? 'pending' : 'processing';
      } else if (ageDays < 12) {
        status = random() < 0.5 ? 'processing' : 'shipped';
      }
      const customer = pick(customers);
      const lines = intBetween(1, 4);
      const items: DemoOrderItem[] = [];
      for (let line = 0; line < lines; line++) {
        const product = pick(products);
        if (items.some((item) => item.productId === product.id)) {
          continue;
        }
        items.push({
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          quantity: intBetween(1, 6),
          unitPrice: product.price,
          categoryId: product.categoryId,
        });
      }
      orders.push({
        id: 0,
        userId: customer.id,
        customerName: customer.fullName,
        status,
        total:
          Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) /
          100,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: createdAt.toISOString(),
        notes: null,
        items,
      });
    }
  }
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  orders.forEach((order, index) => (order.id = index + 1));

  // --- Actividad inicial ---
  const activity: ActivityEvent[] = orders
    .slice(-6)
    .reverse()
    .map((order, index) => ({
      id: `seed-${index}`,
      type: 'order_created',
      message: `Nuevo pedido #${order.id} por ${order.total.toFixed(2).replace('.', ',')} €`,
      actorName: order.customerName,
      createdAt: order.createdAt,
    }));

  return { users, categories, suppliers, products, orders, activity };
}
