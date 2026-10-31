/** Categoría de producto. */
export interface Category {
  /** Identificador único. */
  id: number;
  /** Nombre. */
  name: string;
  /** Descripción opcional. */
  description: string | null;
  /** Número de productos asociados (calculado por la API). */
  productCount: number;
}

/** Datos editables de una categoría. */
export interface CategoryInput {
  /** Nombre. */
  name: string;
  /** Descripción opcional. */
  description: string | null;
}

/** Proveedor de productos. */
export interface Supplier {
  /** Identificador único. */
  id: number;
  /** Nombre. */
  name: string;
  /** Correo electrónico. */
  email: string;
  /** Teléfono de contacto. */
  phone: string | null;
  /** Ciudad. */
  city: string | null;
  /** Número de productos asociados (calculado por la API). */
  productCount: number;
}

/** Datos editables de un proveedor. */
export interface SupplierInput {
  /** Nombre. */
  name: string;
  /** Correo electrónico. */
  email: string;
  /** Teléfono de contacto. */
  phone: string | null;
  /** Ciudad. */
  city: string | null;
}
