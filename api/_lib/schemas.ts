import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Correo no válido.').max(120);
const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .regex(/[A-Z]/, 'La contraseña necesita una mayúscula.')
  .regex(/[a-z]/, 'La contraseña necesita una minúscula.')
  .regex(/\d/, 'La contraseña necesita un número.');
const fullName = z.string().trim().min(3, 'El nombre es demasiado corto.').max(80);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (AAAA-MM-DD).');
const status = z.enum(['pending', 'processing', 'shipped', 'cancelled']);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

/** Validaciones de entrada de la API (nunca se confía en el cliente). */
export const schemas = {
  register: z.object({ fullName, email, password }),
  createUser: z.object({ fullName, email, password, role: z.enum(['admin', 'user']) }),
  updateUser: z
    .object({ fullName: fullName.optional(), role: z.enum(['admin', 'user']).optional() })
    .refine(
      (value) => value.fullName !== undefined || value.role !== undefined,
      'Nada que actualizar.',
    ),
  updateMe: z.object({ fullName }),
  emailQuery: z.object({ email }),
  category: z.object({ name: z.string().trim().min(2).max(80), description: optionalText(200) }),
  supplier: z.object({
    name: z.string().trim().min(2).max(80),
    email,
    phone: optionalText(20),
    city: optionalText(60),
  }),
  product: z.object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3,4}-\d{4,6}$/, 'Formato de SKU no válido.'),
    name: z.string().trim().min(3).max(120),
    categoryId: z.coerce.number().int().positive(),
    supplierId: z.coerce.number().int().positive(),
    price: z.coerce.number().positive().max(1_000_000),
    stock: z.coerce.number().int().min(0).max(1_000_000),
    minStock: z.coerce.number().int().min(0).max(1_000_000),
    active: z.boolean(),
  }),
  productQuery: z.object({
    categoryId: z.coerce.number().int().positive().optional(),
    lowStock: z.enum(['true', 'false']).optional(),
    active: z.enum(['true', 'false']).optional(),
  }),
  skuQuery: z.object({
    sku: z.string().trim().toUpperCase().min(1),
    excludeId: z.coerce.number().int().optional(),
  }),
  order: z.object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          quantity: z.number().int().min(1).max(10_000),
        }),
      )
      .min(1, 'El pedido debe tener al menos una línea.')
      .max(50)
      .refine(
        (items) => new Set(items.map((item) => item.productId)).size === items.length,
        'Hay productos repetidos.',
      ),
    notes: optionalText(300),
  }),
  orderQuery: z.object({
    status: status.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(1000).optional(),
  }),
  orderStatus: z.object({ status }),
  stats: z.object({
    from: isoDate.default('2000-01-01'),
    to: isoDate.default('2100-01-01'),
    categoryId: z.coerce.number().int().positive().optional(),
    status: status.optional(),
  }),
  id: z.coerce.number().int().positive(),
};

/** Valida datos con un esquema y lanza 400 con el primer error legible. */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const error = new Error(issue?.message ?? 'Datos no válidos.');
    (error as Error & { validation: true }).validation = true;
    throw error;
  }
  return result.data;
}
